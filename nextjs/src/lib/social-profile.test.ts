import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  SOCIAL_PROFILE_COLUMNS,
  SOCIAL_PROFILE_FIELDS,
  assertProfileRowUpdated,
  buildSocialProfileUpdate,
  isUndefinedColumnError,
  socialColumnsFromInformationSchema,
  socialColumnsFromRow,
  socialColumnsFromSchemaQuery,
  validateSocialProfileUrl,
} from './social-profile.ts'

describe('social profile columns', () => {
  it('lists the optional social URL columns on user_data', () => {
    assert.deepEqual([...SOCIAL_PROFILE_COLUMNS], [
      'twitter_url',
      'linkedin_url',
      'github_url',
      'instagram_url',
      'youtube_url',
      'website_url',
    ])
  })

  it('exposes a field definition for each social column', () => {
    assert.deepEqual(
      SOCIAL_PROFILE_FIELDS.map((field) => field.column),
      [...SOCIAL_PROFILE_COLUMNS]
    )
  })
})

describe('socialColumnsFromInformationSchema', () => {
  it('keeps only social columns that appear in information_schema rows', () => {
    const present = socialColumnsFromInformationSchema([
      { column_name: 'first_name' },
      { column_name: 'twitter_url' },
      { column_name: 'website_url' },
      { column_name: 'email' },
    ])

    assert.deepEqual(present, ['twitter_url', 'website_url'])
  })

  it('returns an empty list when none of the social columns exist', () => {
    const present = socialColumnsFromInformationSchema([
      { column_name: 'user_id' },
      { column_name: 'first_name' },
    ])

    assert.deepEqual(present, [])
  })
})

describe('socialColumnsFromSchemaQuery', () => {
  it('falls back when the schema query errors or returns no rows', () => {
    assert.equal(
      socialColumnsFromSchemaQuery([{ column_name: 'twitter_url' }], {
        message: 'permission denied',
      }),
      null
    )
    assert.equal(socialColumnsFromSchemaQuery([], null), null)
    assert.equal(socialColumnsFromSchemaQuery(null, null), null)
  })

  it('treats a non-empty schema snapshot as authoritative', () => {
    assert.deepEqual(
      socialColumnsFromSchemaQuery(
        [{ column_name: 'first_name' }, { column_name: 'github_url' }],
        null
      ),
      ['github_url']
    )
  })
})

describe('socialColumnsFromRow', () => {
  it('treats object keys from a user_data row as the live column set', () => {
    const present = socialColumnsFromRow({
      user_id: 'abc',
      first_name: 'Ada',
      github_url: 'https://github.com/ada',
      youtube_url: null,
    })

    assert.deepEqual(present, ['github_url', 'youtube_url'])
  })
})

describe('isUndefinedColumnError', () => {
  it('recognizes PostgREST and Postgres missing-column errors', () => {
    assert.equal(isUndefinedColumnError({ code: 'PGRST204' }), true)
    assert.equal(isUndefinedColumnError({ code: '42703' }), true)
    assert.equal(
      isUndefinedColumnError({
        message: 'column user_data.twitter_url does not exist',
      }),
      true
    )
    assert.equal(
      isUndefinedColumnError({
        message: "Could not find the 'linkedin_url' column of 'user_data' in the schema cache",
      }),
      true
    )
  })

  it('does not treat auth or network failures as missing columns', () => {
    assert.equal(isUndefinedColumnError(null), false)
    assert.equal(isUndefinedColumnError({ code: '42501', message: 'permission denied' }), false)
    assert.equal(isUndefinedColumnError({ message: 'JWT expired' }), false)
  })
})

describe('validateSocialProfileUrl', () => {
  it('allows blank values so a user can clear a field', () => {
    assert.deepEqual(validateSocialProfileUrl('twitter_url', '   '), {
      ok: true,
      value: null,
    })
  })

  it('accepts http(s) URLs', () => {
    assert.deepEqual(
      validateSocialProfileUrl('website_url', 'https://example.com/me'),
      { ok: true, value: 'https://example.com/me' }
    )
  })

  it('rejects non-http schemes and malformed URLs', () => {
    assert.equal(validateSocialProfileUrl('github_url', 'javascript:alert(1)').ok, false)
    assert.equal(validateSocialProfileUrl('linkedin_url', 'not-a-url').ok, false)
    assert.equal(validateSocialProfileUrl('instagram_url', 'ftp://files.example').ok, false)
  })
})

describe('assertProfileRowUpdated', () => {
  it('rejects a missing user_data row so save cannot silently no-op', () => {
    assert.throws(() => assertProfileRowUpdated(null), /Profile not found/)
    assert.throws(() => assertProfileRowUpdated({}), /Profile not found/)
  })

  it('accepts an updated row for the current user', () => {
    assert.doesNotThrow(() => assertProfileRowUpdated({ user_id: 'abc' }))
  })
})

describe('buildSocialProfileUpdate', () => {
  it('only includes columns that exist at runtime and ignores unknown keys', () => {
    const result = buildSocialProfileUpdate(
      {
        twitter_url: 'https://x.com/ada',
        website_url: 'https://ada.dev',
        github_url: 'https://github.com/ada',
        extra: 'nope',
      },
      ['twitter_url', 'website_url']
    )

    assert.equal(result.ok, true)
    if (result.ok) {
      assert.deepEqual(result.value, {
        twitter_url: 'https://x.com/ada',
        website_url: 'https://ada.dev',
      })
    }
  })

  it('fails when a present column has an invalid URL', () => {
    const result = buildSocialProfileUpdate(
      { twitter_url: 'notaurl' },
      ['twitter_url']
    )

    assert.equal(result.ok, false)
  })

  it('fails when no social columns exist on the table', () => {
    const result = buildSocialProfileUpdate(
      { twitter_url: 'https://x.com/ada' },
      []
    )

    assert.equal(result.ok, false)
  })
})
