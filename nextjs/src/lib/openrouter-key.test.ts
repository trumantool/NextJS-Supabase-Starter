import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isForcePlatformKey, pickOpenRouterKey } from './openrouter-key-resolve.ts'

describe('pickOpenRouterKey', () => {
  it('prefers a user key, then the admin key, then the environment key', () => {
    assert.equal(
      pickOpenRouterKey({
        byok: 'user-key',
        adminKey: 'admin-key',
        envKey: 'env-key',
        forcePlatform: false,
      }),
      'user-key'
    )
    assert.equal(
      pickOpenRouterKey({
        byok: '  ',
        adminKey: 'admin-key',
        envKey: 'env-key',
        forcePlatform: false,
      }),
      'admin-key'
    )
    assert.equal(
      pickOpenRouterKey({
        byok: '',
        adminKey: '',
        envKey: 'env-key',
        forcePlatform: false,
      }),
      'env-key'
    )
  })

  it('skips the user key when the platform key is forced', () => {
    assert.equal(
      pickOpenRouterKey({
        byok: 'user-key',
        adminKey: 'admin-key',
        envKey: 'env-key',
        forcePlatform: true,
      }),
      'admin-key'
    )
    assert.equal(
      pickOpenRouterKey({
        byok: 'user-key',
        adminKey: '',
        envKey: 'env-key',
        forcePlatform: true,
      }),
      'env-key'
    )
  })
})

describe('isForcePlatformKey', () => {
  it('treats true, 1, and yes as forced', () => {
    assert.equal(isForcePlatformKey('true'), true)
    assert.equal(isForcePlatformKey('1'), true)
    assert.equal(isForcePlatformKey(' YES '), true)
    assert.equal(isForcePlatformKey('false'), false)
    assert.equal(isForcePlatformKey(''), false)
    assert.equal(isForcePlatformKey(null), false)
  })
})
