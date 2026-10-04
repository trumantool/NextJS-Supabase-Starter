import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isHttpUrl, isPostSlug, isPostType, slugifyTitle } from './posts.ts'

describe('slugifyTitle', () => {
  it('builds a lowercase hyphenated slug', () => {
    assert.equal(slugifyTitle('Hello, World!'), 'hello-world')
    assert.equal(slugifyTitle('  Café Notes  '), 'cafe-notes')
    assert.equal(slugifyTitle('***'), 'post')
  })
})

describe('post validators', () => {
  it('accepts slugs and types within length', () => {
    assert.equal(isPostSlug('hello-world'), true)
    assert.equal(isPostSlug('Hello'), false)
    assert.equal(isPostSlug(''), false)
    assert.equal(isPostType('post'), true)
    assert.equal(isPostType('a'.repeat(41)), false)
  })

  it('accepts only http(s) URLs', () => {
    assert.equal(isHttpUrl('https://example.com/a'), true)
    assert.equal(isHttpUrl('http://example.com'), true)
    assert.equal(isHttpUrl('javascript:alert(1)'), false)
    assert.equal(isHttpUrl('not a url'), false)
  })
})
