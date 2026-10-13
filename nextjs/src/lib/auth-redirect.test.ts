import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  authCallbackUrl,
  normalizeRedirectBase,
  passwordRecoveryUrl,
  resolveAuthRedirectBase,
  stripTrailingSlash,
} from './auth-redirect.ts'

const PRODUCTION = 'https://nextjs-supabase-starter-two.vercel.app'

describe('stripTrailingSlash', () => {
  it('removes one or more trailing slashes and surrounding space', () => {
    assert.equal(stripTrailingSlash(`${PRODUCTION}/`), PRODUCTION)
    assert.equal(stripTrailingSlash(`  ${PRODUCTION}///  `), PRODUCTION)
    assert.equal(stripTrailingSlash('   /   '), '')
  })
})

describe('normalizeRedirectBase', () => {
  it('accepts absolute http(s) URLs and drops a trailing slash', () => {
    assert.equal(normalizeRedirectBase(`${PRODUCTION}/`), PRODUCTION)
    assert.equal(normalizeRedirectBase('http://localhost:3000/'), 'http://localhost:3000')
  })

  it('rejects empty, relative, and non-http values', () => {
    assert.equal(normalizeRedirectBase(''), null)
    assert.equal(normalizeRedirectBase('   '), null)
    assert.equal(normalizeRedirectBase('/'), null)
    assert.equal(normalizeRedirectBase('example.com'), null)
    assert.equal(normalizeRedirectBase('javascript:alert(1)'), null)
  })
})

describe('resolveAuthRedirectBase', () => {
  it('prefers a non-empty login_redirect_url and strips its trailing slash', () => {
    assert.equal(
      resolveAuthRedirectBase({
        loginRedirectUrl: `${PRODUCTION}/`,
        appUrl: 'https://app.example',
        requestOrigin: 'http://localhost:3000',
      }),
      PRODUCTION,
    )
  })

  it('falls back to NEXT_PUBLIC_APP_URL when the admin option is empty', () => {
    assert.equal(
      resolveAuthRedirectBase({
        loginRedirectUrl: '   ',
        appUrl: 'https://app.example/',
        requestOrigin: 'http://localhost:3000',
      }),
      'https://app.example',
    )
  })

  it('falls back to the request origin when the admin option and app URL are empty', () => {
    assert.equal(
      resolveAuthRedirectBase({
        loginRedirectUrl: null,
        appUrl: '',
        requestOrigin: 'http://localhost:3000/',
      }),
      'http://localhost:3000',
    )
  })

  it('skips an invalid admin option and uses the request origin', () => {
    assert.equal(
      resolveAuthRedirectBase({
        loginRedirectUrl: 'not a url',
        appUrl: null,
        requestOrigin: 'http://localhost:3000',
      }),
      'http://localhost:3000',
    )
  })
})

describe('auth redirect paths', () => {
  it('appends the OAuth and email callback path', () => {
    assert.equal(authCallbackUrl(`${PRODUCTION}/`), `${PRODUCTION}/api/auth/callback`)
  })

  it('appends the password recovery path', () => {
    assert.equal(passwordRecoveryUrl(PRODUCTION), `${PRODUCTION}/auth/reset-password`)
  })
})
