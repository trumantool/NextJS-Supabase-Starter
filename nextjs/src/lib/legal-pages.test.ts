import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SHORTCODE_MAP } from './shortcodes.ts'
import {
  GENERIC_PRIVACY_HTML,
  GENERIC_TERMS_HTML,
  LEGAL_IDENTITY_FIELDS,
  LEGAL_PUBLIC_SETTING_NAMES,
  legalSettingWrite,
  mergeLegalSettings,
  publicLegalSettingsResult,
  renderLegalDocument,
  resolveLegalShortcodes,
} from './legal-pages.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function read(relative: string): string {
  return readFileSync(join(root, relative), 'utf8')
}

const migration = 'supabase/migrations/20261013120000_posts_editor_legal_settings.sql'

describe('legal shortcodes', () => {
  it('replaces identity shortcodes and keeps unknown tokens', () => {
    const settings = [
      { option_name: 'company_name', option_value: 'Northwind' },
      { option_name: 'site_url', option_value: 'https://example.com' },
      { option_name: 'contact_email', option_value: 'hello@example.com' },
      { option_name: 'effective_date', option_value: '1 January 2026' },
      { option_name: 'site_title', option_value: 'Example' },
    ]
    const rendered = resolveLegalShortcodes(
      '[company_name] [site_url] [contact_email] [effective_date] [site_title] [not_a_code]',
      settings
    )
    assert.equal(
      rendered,
      'Northwind https://example.com hello@example.com 1 January 2026 Example [not_a_code]'
    )
  })

  it('uses generic phrases when identity values are missing or blank', () => {
    const rendered = resolveLegalShortcodes(
      '[company_name] [site_url] [contact_email] [effective_date] [site_title]',
      [{ option_name: 'company_name', option_value: '   ' }]
    )
    assert.equal(
      rendered,
      'the site operator this website the contact email published for this site the date this page was last updated this site'
    )
  })

  it('uses support_email when contact_email is blank', () => {
    const rendered = resolveLegalShortcodes('[contact_email]', [
      { option_name: 'contact_email', option_value: '' },
      { option_name: 'support_email', option_value: 'support@example.com' },
    ])
    assert.equal(rendered, 'support@example.com')
  })

  it('renders generic terms and privacy when the body is missing', () => {
    const terms = renderLegalDocument('terms', [])
    const privacy = renderLegalDocument('privacy', [])
    assert.match(terms, /Terms of Service/)
    assert.match(privacy, /Privacy Policy/)
    assert.equal(terms.includes('['), false)
    assert.equal(privacy.includes('['), false)
    assert.equal(/reach them/i.test(terms + privacy + GENERIC_TERMS_HTML + GENERIC_PRIVACY_HTML), false)
  })

  it('keeps stored body instead of the generic fallback', () => {
    const rendered = renderLegalDocument('terms', [
      { option_name: 'terms_of_service', option_value: '<p>Stored [company_name] terms.</p>' },
      { option_name: 'company_name', option_value: 'Northwind' },
    ])
    assert.equal(rendered, '<p>Stored Northwind terms.</p>')
  })

  it('maps the new shortcodes and the older ones', () => {
    for (const key of ['company_name', 'site_url', 'contact_email', 'effective_date', 'support_email', 'site_title']) {
      assert.equal(SHORTCODE_MAP[key], key)
    }
  })
})

describe('legal settings writes', () => {
  it('creates a missing allowlisted row and rejects other names', () => {
    const created = legalSettingWrite('site_url', 'https://example.com', null, '2026-10-13T00:00:00.000Z')
    assert.equal(created?.option_name, 'site_url')
    assert.equal(created?.option_value, 'https://example.com')
    assert.equal(created?.option_field_type, 'text')
    assert.equal(legalSettingWrite('openrouter_api_key', 'secret', null, '2026-10-13T00:00:00.000Z'), null)
    assert.equal(
      legalSettingWrite('company_name', 'Northwind', { option_field_type: 'secret', option_title: 'x', option_description: null }, '2026-10-13T00:00:00.000Z'),
      null
    )
  })

  it('lists the admin identity fields and does not treat them as secrets', () => {
    assert.deepEqual(
      LEGAL_IDENTITY_FIELDS.map((field) => field.option_name),
      ['company_name', 'site_url', 'contact_email', 'effective_date']
    )
    for (const name of ['company_name', 'site_url', 'contact_email', 'effective_date', 'terms_of_service', 'privacy_policy']) {
      assert.equal(LEGAL_PUBLIC_SETTING_NAMES.includes(name as (typeof LEGAL_PUBLIC_SETTING_NAMES)[number]), true)
    }
    assert.equal((LEGAL_PUBLIC_SETTING_NAMES as readonly string[]).includes('openrouter_api_key'), false)
  })

  it('merges a newly saved key into the settings already on the page', () => {
    const merged = mergeLegalSettings(
      [{ option_name: 'company_name', option_value: 'Old' }],
      [{ option_name: 'site_url', option_value: 'https://example.com' }]
    )
    assert.deepEqual(merged, [
      { option_name: 'company_name', option_value: 'Old' },
      { option_name: 'site_url', option_value: 'https://example.com' },
    ])
  })

  it('treats a missing table or column as an empty public read', () => {
    for (const code of ['42P01', '42703', 'PGRST200', 'PGRST204', 'PGRST205']) {
      const result = publicLegalSettingsResult({ code, message: 'missing' }, [{ option_name: 'site_title', option_value: 'x' }])
      assert.deepEqual(result, { rows: [], missingSchema: true })
    }
    assert.deepEqual(publicLegalSettingsResult(null, []), { rows: [], missingSchema: false })
    assert.deepEqual(publicLegalSettingsResult({ code: '42501', message: 'denied' }, []), { failed: true })
  })
})

describe('posts and legal SQL', () => {
  const sql = read(migration)
  const schema = read('supabase/schema.sql')

  it('adds the editor columns and does not drop existing policies', () => {
    for (const column of ['body_doc jsonb', 'cover_image_alt text', 'seo_title text', 'meta_description text', 'og_image_url text', 'deleted_at timestamptz']) {
      assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`))
      assert.match(schema, new RegExp(column.replace(' ', '\\s+')))
    }
    assert.match(sql, /CREATE INDEX IF NOT EXISTS posts_not_deleted_idx/)
    assert.equal(/DROP POLICY/i.test(sql), false)
    assert.equal(sql.includes('edu.is_admin'), false)
    assert.equal(/reach them/i.test(sql), false)
  })

  it('hides soft-deleted blogs from anon without calling is_admin', () => {
    const anon = sql.slice(sql.indexOf('posts_hide_soft_deleted_anon'), sql.indexOf('posts_hide_soft_deleted\n'))
    assert.match(anon, /FOR SELECT/)
    assert.match(anon, /TO anon/)
    assert.match(anon, /USING \(type <> 'blog' OR deleted_at IS NULL\)/)
    assert.equal(/is_admin\s*\(/i.test(anon), false)
  })

  it('lets an authenticated admin or author read a soft-deleted blog', () => {
    const auth = sql.slice(sql.indexOf('policyname = \'posts_hide_soft_deleted\''), sql.indexOf('posts_no_authenticated_blog_hard_delete'))
    assert.match(auth, /TO authenticated/)
    assert.match(auth, /authenticative\.is_admin\(\)/)
    assert.match(auth, /author_id = \(SELECT auth\.uid\(\)\)/)
    assert.match(sql, /posts_no_authenticated_blog_hard_delete[\s\S]*USING \(type <> 'blog'\)/)
  })

  it('revokes is_admin from public and anon and seeds missing legal keys only', () => {
    assert.match(sql, /REVOKE ALL ON FUNCTION authenticative\.is_admin\(\) FROM PUBLIC, anon/)
    assert.equal(sql.includes('FROM PUBLIC, anon, authenticated'), false)
    for (const key of ['company_name', 'site_url', 'contact_email', 'effective_date', 'terms_of_service', 'privacy_policy']) {
      assert.match(sql, new RegExp(`'${key}'`))
      assert.match(schema, new RegExp(`'${key}'`))
    }
    assert.match(sql, /WHERE NOT EXISTS/)
    assert.equal(/UPDATE\s+public\.admin_settings/i.test(sql), false)
  })

  it('schema revokes anon execute on is_admin and still grants authenticated', () => {
    assert.match(schema, /REVOKE ALL ON FUNCTION authenticative\.is_admin\(\) FROM PUBLIC, anon/)
    assert.match(schema, /GRANT EXECUTE ON FUNCTION authenticative\.is_admin\(\) TO authenticated/)
    assert.match(schema, /CREATE POLICY posts_hide_soft_deleted_anon/)
    assert.equal(schema.includes('edu.is_admin'), false)
  })
})
