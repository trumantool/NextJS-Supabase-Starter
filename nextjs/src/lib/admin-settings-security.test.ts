import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, it } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  adminSettingsAppKey,
  filterAdminSettingsByAppKey,
  isConcealedAdminField,
  ledgerMarkupArgument,
  presentAdminSettingForBrowser,
  resolveAdminSettingWrite,
} from './admin-settings-scope.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function read(relative: string): string {
  return readFileSync(join(root, relative), 'utf8')
}

function policyStatement(sql: string, name: string): string {
  const quoted = `CREATE POLICY "${name}"`
  const bare = `CREATE POLICY ${name}`
  const start = sql.includes(quoted) ? sql.indexOf(quoted) : sql.indexOf(bare)
  assert.notEqual(start, -1, name)
  const rest = sql.slice(start)
  const next = rest.slice(name.length + 14).search(/\n(?:CREATE|DROP) POLICY/)
  return next === -1 ? rest : rest.slice(0, name.length + 14 + next)
}

function selectPolicies(sql: string): string[] {
  const policies: string[] = []
  const pattern = /CREATE POLICY\s+(?:"[^"]+"|[A-Za-z_][\w]*)[\s\S]*?;/g
  for (const match of sql.matchAll(pattern)) {
    const statement = match[0]
    if (/\bFOR\s+SELECT\b/i.test(statement)) policies.push(statement)
  }
  return policies
}

const scopeFiles = [
  'supabase/schema.sql',
  'supabase/migrations/20261010160000_admin_settings_app_scope.sql',
]

describe('admin_settings select policies', () => {
  for (const file of scopeFiles) {
    it(`${file} hides secret and password from anon and authenticated`, () => {
      const sql = read(file)
      const policy = policyStatement(sql, 'admin_settings_select_public')
      assert.match(policy, /FOR SELECT TO anon, authenticated/)
      assert.match(policy, /option_field_type IS DISTINCT FROM 'secret'/)
      assert.match(policy, /option_field_type IS DISTINCT FROM 'password'/)
      assert.equal(/is_admin\s*\(/i.test(policy), false)
      assert.equal(/SECURITY DEFINER/i.test(policy), false)
      assert.equal(sql.includes('CREATE POLICY admin_settings_select_admin'), false)
      assert.equal(sql.includes('CREATE POLICY "Public can read non-secret admin settings"'), false)
    })
  }

  it('no anon select policy on admin_settings calls is_admin', () => {
    for (const file of scopeFiles) {
      const sql = read(file)
      for (const statement of selectPolicies(sql)) {
        if (!/admin_settings/i.test(statement)) continue
        const header = statement.split(/\bUSING\b/i)[0] ?? statement
        const toAnon = /\bTO\s+[^;]*\banon\b/i.test(header) || !/\bTO\s+/i.test(header)
        if (!toAnon) continue
        assert.equal(/is_admin\s*\(/i.test(statement), false, statement.slice(0, 80))
      }
    }
  })

  it('the new migration is later than every other migration', () => {
    const names = readdirSync(join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql'))
    const latest = [...names].sort().at(-1)
    assert.equal(latest, '20261010160000_admin_settings_app_scope.sql')
  })

  it('schema seeds stay idempotent on (app_key, option_name)', () => {
    const schema = read('supabase/schema.sql')
    assert.equal(schema.includes('ON CONFLICT (option_name)'), false)
    assert.match(schema, /UNIQUE NULLS NOT DISTINCT \(app_key, option_name\)/)
    const conflicts = schema.match(/ON CONFLICT \(app_key, option_name\) DO NOTHING/g) ?? []
    assert.equal(conflicts.length >= 2, true)
    assert.match(schema, /AND app_key IS NULL/)
    assert.match(
      read('supabase/migrations/20261010160000_admin_settings_app_scope.sql'),
      /REVOKE EXECUTE ON FUNCTION public\.record_llm_turn_usage\([\s\S]*FROM PUBLIC, anon, authenticated/
    )
  })
})

describe('admin view blanks concealed values', () => {
  it('returns an empty value and a set flag for secret and password', () => {
    const secret = presentAdminSettingForBrowser({
      option_name: 'openrouter_api_key',
      option_field_type: 'secret',
      option_value: 'sk-live-value',
    })
    assert.equal(secret.option_value, '')
    assert.equal(secret.secret_is_set, true)
    assert.equal(secret.option_value.includes('sk-live'), false)

    const password = presentAdminSettingForBrowser({
      option_name: 'smtp_password',
      option_field_type: 'password',
      option_value: 'hunter2',
    })
    assert.equal(password.option_value, '')
    assert.equal(password.secret_is_set, true)

    const emptySecret = presentAdminSettingForBrowser({
      option_field_type: 'secret',
      option_value: '   ',
    })
    assert.equal(emptySecret.secret_is_set, false)

    const title = presentAdminSettingForBrowser({
      option_name: 'site_title',
      option_field_type: 'text',
      option_value: 'Starter',
    })
    assert.equal(title.option_value, 'Starter')
    assert.equal(title.secret_is_set, false)
    assert.equal(isConcealedAdminField('password'), true)
    assert.equal(isConcealedAdminField('textarea'), false)
  })

  it('an empty concealed save keeps the stored value', () => {
    const kept = resolveAdminSettingWrite('secret', 'stored-key', '   ', false)
    assert.equal(kept.keepExisting, true)
    assert.equal(kept.optionValue, 'stored-key')

    const passwordKept = resolveAdminSettingWrite('password', 'stored-pass', '', false)
    assert.equal(passwordKept.keepExisting, true)
    assert.equal(passwordKept.optionValue, 'stored-pass')

    const replaced = resolveAdminSettingWrite('secret', 'stored-key', '  next-key  ', false)
    assert.equal(replaced.keepExisting, false)
    assert.equal(replaced.optionValue, 'next-key')

    const cleared = resolveAdminSettingWrite('password', 'stored-pass', 'ignored', true)
    assert.equal(cleared.keepExisting, false)
    assert.equal(cleared.optionValue, '')

    const textCleared = resolveAdminSettingWrite('text', 'Starter', '', false)
    assert.equal(textCleared.keepExisting, false)
    assert.equal(textCleared.optionValue, '')
  })
})

describe('admin settings app key scope', () => {
  const rows = [
    { option_name: 'site_title', app_key: null, option_value: 'Starter' },
    { option_name: 'support_email', app_key: null, option_value: 'support@example.com' },
    { option_name: 'site_title', app_key: 'clone-a', option_value: 'Clone A' },
    { option_name: 'site_title', app_key: 'clone-b', option_value: 'Clone B' },
    { option_name: 'openrouter_api_key', app_key: 'clone-a', option_value: 'clone-secret' },
  ]

  it('filters reads and writes to the configured key', () => {
    const clone = filterAdminSettingsByAppKey(rows, 'clone-a')
    assert.deepEqual(
      clone.map((row) => row.option_name),
      ['site_title', 'openrouter_api_key']
    )
    assert.equal(
      clone.some((row) => row.option_value === 'Starter' || row.option_value === 'Clone B'),
      false
    )
    assert.equal(adminSettingsAppKey(' clone-a '), 'clone-a')
  })

  it('an unset app key keeps the existing NULL rows', () => {
    for (const raw of [undefined, null, '', '   ']) {
      assert.equal(adminSettingsAppKey(raw), null)
    }
    const defaults = filterAdminSettingsByAppKey(rows, adminSettingsAppKey(undefined))
    assert.deepEqual(
      defaults.map((row) => row.option_value),
      ['Starter', 'support@example.com']
    )
    assert.equal(ledgerMarkupArgument(null, '0', false), 0)
    assert.equal(ledgerMarkupArgument(null, null, true), null)
    assert.equal(ledgerMarkupArgument('clone-a', null, true), 0)
    assert.equal(ledgerMarkupArgument('clone-a', '1.5', false), 1.5)
  })
})

describe('admin settings readers', () => {
  const readers = [
    'nextjs/src/app/(dashboard)/admin/actions.ts',
    'nextjs/src/lib/actions/privacy.ts',
    'nextjs/src/lib/actions/terms.ts',
    'nextjs/src/lib/openrouter-key.ts',
    'nextjs/src/lib/llm-usage.ts',
  ]

  it('every reader scopes by the configured app key', () => {
    for (const file of readers) {
      const source = read(file)
      assert.equal(
        source.includes('configuredAdminSettingsAppKey') || source.includes('readScopedAdminSettings'),
        true,
        file
      )
    }
  })

  it('public readers drop secret and password field types', () => {
    for (const file of [
      'nextjs/src/app/(dashboard)/admin/actions.ts',
      'nextjs/src/lib/actions/privacy.ts',
      'nextjs/src/lib/actions/terms.ts',
    ]) {
      const source = read(file)
      assert.match(source, /\.neq\('option_field_type', 'secret'\)/)
      assert.match(source, /\.neq\('option_field_type', 'password'\)/)
      assert.match(source, /dropConcealedAdminSettings/)
    }
  })

  it('secret reads and admin writes use the service role after an admin check', () => {
    const openrouter = read('nextjs/src/lib/openrouter-key.ts')
    assert.match(openrouter, /readScopedAdminSettings/)
    assert.match(openrouter, /createServerAdminClient/)
    assert.equal(openrouter.includes('createBrowserClient'), false)
    assert.equal(openrouter.includes('NEXT_PUBLIC_'), false)

    const actions = read('nextjs/src/app/(dashboard)/admin/actions.ts')
    assert.match(actions, /requireCurrentUserAdmin/)
    assert.match(actions, /presentAdminSettingForBrowser/)
    assert.match(actions, /resolveAdminSettingWrite/)
    assert.match(actions, /createServerAdminClient/)

    const form = read('nextjs/src/components/AdminSettingsForm.tsx')
    assert.match(form, /isConcealedAdminField/)
    assert.match(form, /type="password"/)
    assert.match(form, /Clear saved value/)
    assert.equal(form.includes('createBrowserClient'), false)
    assert.equal(form.includes('createServerAdminClient'), false)
    assert.equal(form.includes("from('admin_settings')"), false)

    const server = read('nextjs/src/lib/admin-settings-server.ts')
    assert.match(server, /createServerAdminClient/)
    assert.equal(server.includes('NEXT_PUBLIC_'), false)
  })
})
