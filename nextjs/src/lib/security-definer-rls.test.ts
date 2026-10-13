import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

export type SqlViolation = {
  policy?: string
  detail: string
}

const ANON_ROLES = new Set(['anon', 'public'])

function statements(sql: string): string[] {
  const parts: string[] = []
  let current = ''
  let i = 0
  let paren = 0

  const pushChar = (ch: string) => {
    current += ch
  }

  while (i < sql.length) {
    if (sql.startsWith('--', i)) {
      const nl = sql.indexOf('\n', i)
      i = nl === -1 ? sql.length : nl
      continue
    }
    if (sql.startsWith('/*', i)) {
      const end = sql.indexOf('*/', i + 2)
      i = end === -1 ? sql.length : end + 2
      continue
    }
    if (sql[i] === "'") {
      pushChar(sql[i])
      i += 1
      while (i < sql.length) {
        pushChar(sql[i])
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            pushChar(sql[i + 1])
            i += 2
            continue
          }
          i += 1
          break
        }
        i += 1
      }
      continue
    }
    if (sql[i] === '$') {
      const tag = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/)
      if (tag) {
        const end = sql.indexOf(tag[0], i + tag[0].length)
        const chunk = end === -1 ? sql.slice(i) : sql.slice(i, end + tag[0].length)
        current += chunk
        i += chunk.length
        continue
      }
    }
    const ch = sql[i]
    if (ch === '(') paren += 1
    if (ch === ')') paren = Math.max(0, paren - 1)
    if (ch === ';' && paren === 0) {
      if (current.trim()) parts.push(current.trim())
      current = ''
      i += 1
      continue
    }
    pushChar(ch)
    i += 1
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

function roleList(clause: string): string[] {
  return clause
    .split(',')
    .map((role) => role.trim().replace(/"/g, '').toLowerCase())
    .filter((role) => role.length > 0 && role !== ' ')
}

function policyName(statement: string): string {
  const match = statement.match(/CREATE\s+POLICY\s+(?:"([^"]+)"|([A-Za-z_][\w]*))/i)
  return match?.[1] ?? match?.[2] ?? '(unnamed)'
}

function policyAppliesToAnon(statement: string): boolean {
  const header = statement.split(/\bUSING\b|\bWITH\s+CHECK\b/i)[0] ?? statement
  const toMatch = header.match(/\bTO\s+([\s\S]+)$/i)
  if (!toMatch) return true
  return roleList(toMatch[1]).some((role) => ANON_ROLES.has(role))
}

function referencesIsAdmin(statement: string): boolean {
  return /\bis_admin\b/i.test(statement)
}

function referencesFunction(statement: string, functionName: string): boolean {
  const bare = functionName.split('.').pop() ?? functionName
  return new RegExp(`\\b${bare}\\b`, 'i').test(statement)
}

export function findViolations(sql: string, definerNames: string[] = ['is_admin']): SqlViolation[] {
  const violations: SqlViolation[] = []
  const names = new Set(['is_admin', ...definerNames.map((name) => name.split('.').pop() ?? name)])
  for (const statement of statements(sql)) {
    if (/^\s*CREATE\s+POLICY\b/i.test(statement)) {
      if (!policyAppliesToAnon(statement)) continue
      for (const name of names) {
        if (!referencesFunction(statement, name)) continue
        violations.push({
          policy: policyName(statement),
          detail: `policy ${policyName(statement)} applies to anon or public and references ${name}`,
        })
      }
      continue
    }
    if (!/^\s*GRANT\s+EXECUTE\b/i.test(statement) || !referencesIsAdmin(statement)) continue
    const toMatch = statement.match(/\bTO\s+([\s\S]+)$/i)
    if (!toMatch) continue
    const roles = roleList(toMatch[1])
    if (roles.some((role) => ANON_ROLES.has(role))) {
      violations.push({
        detail: `GRANT EXECUTE on is_admin to ${roles.join(', ')}`,
      })
    }
  }
  return violations
}

function securityDefinerNames(sql: string): string[] {
  const names: string[] = []
  for (const statement of statements(sql)) {
    if (!/^\s*CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\b/i.test(statement)) continue
    if (!/\bSECURITY\s+DEFINER\b/i.test(statement)) continue
    const match = statement.match(/FUNCTION\s+((?:[\w]+\.)?[\w]+)\s*\(/i)
    if (match) names.push(match[1])
  }
  return names
}

function revokeCoversAnon(statement: string, functionName: string): boolean {
  if (!/^\s*REVOKE\s+(ALL|EXECUTE)\b/i.test(statement)) return false
  if (!statement.toLowerCase().includes(functionName.toLowerCase())) return false
  const fromMatch = statement.match(/\bFROM\s+([\s\S]+)$/i)
  if (!fromMatch) return false
  const roles = new Set(roleList(fromMatch[1]))
  return roles.has('public') && roles.has('anon') && roles.has('authenticated')
}

export function findDefinerGrantGaps(sql: string): string[] {
  const gaps: string[] = []
  const parsed = statements(sql)
  for (const name of securityDefinerNames(sql)) {
    const revoked = parsed.some((statement) => revokeCoversAnon(statement, name))
    if (!revoked) {
      gaps.push(`${name} does not REVOKE EXECUTE FROM PUBLIC, anon, and authenticated`)
    }
    for (const statement of parsed) {
      if (!/^\s*GRANT\s+EXECUTE\b/i.test(statement)) continue
      if (!statement.toLowerCase().includes(name.toLowerCase())) continue
      const toMatch = statement.match(/\bTO\s+([\s\S]+)$/i)
      if (!toMatch) continue
      const roles = roleList(toMatch[1])
      if (roles.some((role) => ANON_ROLES.has(role))) {
        gaps.push(`GRANT EXECUTE on ${name} to ${roles.join(', ')}`)
      }
    }
  }
  return gaps
}

function sqlFiles(): string[] {
  const dir = join(root, 'supabase/migrations')
  const migrations = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(dir, name))
  return [join(root, 'supabase/schema.sql'), ...migrations]
}

function definerNamesInRepo(): string[] {
  const names = new Set<string>()
  for (const file of sqlFiles()) {
    for (const name of securityDefinerNames(readFileSync(file, 'utf8'))) names.add(name)
  }
  return [...names]
}

describe('anon policies do not call is_admin', () => {
  it('flags an anon policy that ORs in is_admin', () => {
    const sql = `
      CREATE POLICY post_categories_select
      ON public.post_categories
      FOR SELECT
      TO anon, authenticated
      USING (
        status = 'published'
        OR authenticative.is_admin()
      );
    `
    const violations = findViolations(sql)
    assert.equal(violations.length, 1)
    assert.match(violations[0].detail, /post_categories_select/)
  })

  it('flags a policy with no TO clause and a policy for public', () => {
    const sql = `
      CREATE POLICY open_select ON public.posts FOR SELECT USING (is_admin());
      CREATE POLICY public_select ON public.posts FOR SELECT TO public USING (authenticative.is_admin());
      CREATE POLICY admin_select ON public.posts FOR SELECT TO authenticated USING (authenticative.is_admin());
    `
    const violations = findViolations(sql)
    assert.deepEqual(
      violations.map((item) => item.policy),
      ['open_select', 'public_select'],
    )
  })

  it('flags GRANT EXECUTE on is_admin to anon or public', () => {
    const granted = `
      GRANT EXECUTE ON FUNCTION authenticative.is_admin() TO anon;
      GRANT EXECUTE ON FUNCTION authenticative.is_admin() TO public;
    `
    assert.equal(findViolations(granted).length, 2)
    const kept = `
      REVOKE EXECUTE ON FUNCTION authenticative.is_admin() FROM PUBLIC, anon, authenticated;
      GRANT EXECUTE ON FUNCTION authenticative.is_admin() TO authenticated;
      GRANT EXECUTE ON FUNCTION authenticative.is_admin() TO service_role;
    `
    assert.deepEqual(findViolations(kept), [])
  })

  it('accepts authenticated-only admin policies', () => {
    const sql = `
      CREATE POLICY post_categories_select_admin
      ON public.post_categories
      FOR SELECT
      TO authenticated
      USING (authenticative.is_admin());
    `
    assert.deepEqual(findViolations(sql), [])
  })

  for (const file of sqlFiles()) {
    it(`${file} keeps security definer calls off anon and public policies`, () => {
      const violations = findViolations(readFileSync(file, 'utf8'), definerNamesInRepo())
      assert.deepEqual(violations, [])
    })
  }
})

describe('security definer execute privileges', () => {
  for (const file of sqlFiles()) {
    it(`${file} revokes anon execute on every security definer function it creates`, () => {
      const sql = readFileSync(file, 'utf8')
      assert.deepEqual(findDefinerGrantGaps(sql), [])
    })
  }
})

describe('blog join-table select policies', () => {
  const expected = [
    'post_categories_select_public',
    'post_categories_select_admin',
    'post_categories_select_author',
    'post_tags_select_public',
    'post_tags_select_admin',
    'post_tags_select_author',
  ]

  for (const file of [
    join(root, 'supabase/schema.sql'),
    join(root, 'supabase/migrations/20261009140200_blog_taxonomy_and_authors.sql'),
  ]) {
    it(`${file} splits public, admin, and author selects`, () => {
      const sql = readFileSync(file, 'utf8')
      for (const name of expected) {
        assert.match(sql, new RegExp(`CREATE POLICY ${name}\\b`))
      }
      assert.equal(/CREATE POLICY post_categories_select\b/.test(sql), false)
      assert.equal(/CREATE POLICY post_tags_select\b/.test(sql), false)
      const publicPolicies = statements(sql).filter((statement) =>
        /^\s*CREATE\s+POLICY\s+(post_categories_select_public|post_tags_select_public)\b/i.test(statement),
      )
      assert.equal(publicPolicies.length, 2)
      for (const statement of publicPolicies) {
        assert.equal(policyAppliesToAnon(statement), true)
        assert.equal(referencesIsAdmin(statement), false)
        assert.match(statement, /status = 'published'/)
        assert.match(statement, /published_at <= now\(\)/)
      }
    })
  }
})
