import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  omitSecretAdminSettings,
  publicAdminSettingNames,
  YOUTUBE_DATA_API_KEY_OPTION,
} from './admin-setting-secrets.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function policyStatement(sql: string, name: string): string {
  const marker = `CREATE POLICY ${name}`
  const start = sql.indexOf(marker)
  assert.notEqual(start, -1, name)
  const rest = sql.slice(start + marker.length)
  const nextPolicy = rest.search(/\n(?:CREATE|DROP) POLICY/)
  return nextPolicy === -1 ? sql.slice(start) : sql.slice(start, start + marker.length + nextPolicy)
}

describe('public admin settings', () => {
  it('excludes the YouTube Data API key from named public settings reads', () => {
    const names = publicAdminSettingNames([
      'site_title',
      YOUTUBE_DATA_API_KEY_OPTION,
      'openrouter_api_key',
      'support_email',
    ])
    assert.deepEqual(names, ['site_title', 'support_email'])

    const rows = omitSecretAdminSettings([
      { option_name: 'site_title', option_value: 'Starter' },
      { option_name: 'youtube_data_api_key', option_value: 'should-not-leak' },
      { option_name: 'openrouter_api_key', option_value: 'should-not-leak' },
    ])
    assert.deepEqual(rows, [{ option_name: 'site_title', option_value: 'Starter' }])
    assert.equal(
      rows.some((row) => row.option_name === 'youtube_data_api_key'),
      false
    )
  })

  it('seeds an empty secret and conflicts on (app_key, option_name)', () => {
    const schema = readFileSync(join(root, 'supabase/schema.sql'), 'utf8')
    const migration = readFileSync(
      join(root, 'supabase/migrations/20261013120000_admin_setting_youtube_data_api_key.sql'),
      'utf8'
    )

    for (const sql of [schema, migration]) {
      assert.match(
        sql,
        /'youtube_data_api_key',\s*'',\s*'secret',\s*'YouTube Data API key'/
      )
      assert.match(sql, /Used for the future autoblogging feature/)
      assert.match(sql, /ON CONFLICT \(app_key, option_name\) DO NOTHING/)
      assert.equal(sql.includes('ON CONFLICT (option_name)'), false)
      assert.equal(/AIza[0-9A-Za-z_-]{20,}/.test(sql), false)
    }

    assert.equal(/SECURITY DEFINER/i.test(migration), false)
    assert.equal(/CREATE POLICY/i.test(migration), false)
    assert.equal(/is_admin\s*\(/i.test(migration), false)

    const policy = policyStatement(schema, 'admin_settings_select_public')
    assert.match(policy, /FOR SELECT TO anon, authenticated/)
    assert.match(policy, /option_field_type IS DISTINCT FROM 'secret'/)
    assert.match(policy, /option_field_type IS DISTINCT FROM 'password'/)
    assert.equal(/is_admin\s*\(/i.test(policy), false)
  })

  it('public settings readers drop secret and password field types', () => {
    const readers = [
      'nextjs/src/app/(dashboard)/admin/actions.ts',
      'nextjs/src/lib/actions/privacy.ts',
      'nextjs/src/lib/actions/terms.ts',
    ]
    for (const file of readers) {
      const source = readFileSync(join(root, file), 'utf8')
      assert.match(source, /dropConcealedAdminSettings/)
      assert.match(source, /\.neq\('option_field_type', 'secret'\)/)
      assert.match(source, /\.neq\('option_field_type', 'password'\)/)
    }

    const actions = readFileSync(join(root, 'nextjs/src/app/(dashboard)/admin/actions.ts'), 'utf8')
    assert.match(actions, /placeYoutubeKeyBesideOpenRouter/)
    assert.match(actions, /YOUTUBE_DATA_API_KEY_OPTION/)

    for (const file of [
      'nextjs/src/lib/actions/privacy.ts',
      'nextjs/src/lib/actions/terms.ts',
      'nextjs/src/app/(public)/contact/page.tsx',
    ]) {
      const source = readFileSync(join(root, file), 'utf8')
      assert.equal(source.includes('youtube_data_api_key'), false, file)
    }
  })

  it('reads the key on the server with the scoped service role', () => {
    const source = readFileSync(join(root, 'nextjs/src/lib/youtube-data-api-key.ts'), 'utf8')
    assert.match(source, /export async function getYoutubeDataApiKey/)
    assert.match(source, /readScopedAdminSettings/)
    assert.match(source, /YOUTUBE_DATA_API_KEY_OPTION/)
    assert.equal(source.includes('NEXT_PUBLIC_'), false)
    assert.equal(source.includes('createBrowserClient'), false)
  })
})
