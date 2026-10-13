import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseTaskId, parseTaskToolRequest } from './chat-task-protocol.ts'
import {
  ALLOWED_SHARED_SKILL_IDS,
  HIDDEN_TEMPLATE_SLUGS,
  builtinKeyFromDefaults,
  isAllowedTemplateSlug,
  isHiddenTemplate,
  isRejectedTemplateClone,
  isSharedSkillAllowed,
  isSkillRowVisible,
  isUserAgentVisible,
} from './starter-catalog-allowlist.ts'

describe('starter catalog allow-list', () => {
  it('hides the 12 marketing slugs and allows only general', () => {
    assert.equal(HIDDEN_TEMPLATE_SLUGS.length, 12)
    for (const slug of HIDDEN_TEMPLATE_SLUGS) {
      assert.equal(isAllowedTemplateSlug(slug), false)
      assert.equal(isHiddenTemplate(null, slug), true)
    }
    assert.equal(isAllowedTemplateSlug('general'), true)
    assert.equal(isAllowedTemplateSlug('starter-assistant'), false)
    assert.equal(isHiddenTemplate('8b57e722-6e18-4862-aa5b-acf5cd39acd3', 'something-else'), true)
  })

  it('hides every shared skill id and shows the caller\'s rows', () => {
    assert.deepEqual([...ALLOWED_SHARED_SKILL_IDS], [])
    assert.equal(isSharedSkillAllowed('goal-isolate'), false)
    assert.equal(isSkillRowVisible({ id: 'shared-1', user_id: null }, 'user-1'), false)
    assert.equal(isSkillRowVisible({ id: 'mine', user_id: 'user-1' }, 'user-1'), true)
    assert.equal(isSkillRowVisible({ id: 'theirs', user_id: 'user-2' }, 'user-1'), false)
  })

  it('hides a user agent cloned from the Google Ads Analyst template', () => {
    assert.equal(
      isUserAgentVisible({
        source_template_id: '8b57e722-6e18-4862-aa5b-acf5cd39acd3',
        source_template_name: 'Google Ads Analyst',
        defaults: {},
      }),
      false
    )
  })

  it('shows a task-management builtin row with an empty template name', () => {
    assert.equal(
      isUserAgentVisible({
        source_template_id: null,
        source_template_name: '',
        defaults: { builtinKey: 'task-management' },
      }),
      true
    )
  })

  it('rejects clone requests including starter and general', () => {
    assert.equal(isRejectedTemplateClone({ starter: true }), true)
    assert.equal(isRejectedTemplateClone({ template_id: 'general' }), true)
    assert.equal(isRejectedTemplateClone({ template_id: 'starter-assistant' }), true)
    assert.equal(isRejectedTemplateClone({ template_id: '8b57e722-6e18-4862-aa5b-acf5cd39acd3' }), true)
    assert.equal(isRejectedTemplateClone({ name: 'Untitled agent' } as { starter?: unknown }), false)
  })
})

describe('builtinKeyFromDefaults', () => {
  it('returns null for empty defaults and for a model id alone', () => {
    assert.equal(builtinKeyFromDefaults({}), null)
    assert.equal(builtinKeyFromDefaults({ model_id: 'poolside/laguna-s-2.1:free' }), null)
    assert.equal(builtinKeyFromDefaults({ builtinKey: 'general' }), 'general')
    assert.equal(builtinKeyFromDefaults({ builtinKey: 'task-management' }), 'task-management')
    assert.equal(builtinKeyFromDefaults({ builtinKey: 'starter-assistant' }), null)
    assert.equal(builtinKeyFromDefaults(null), null)
  })
})

describe('task tool request parsing', () => {
  it('accepts tool, name, and MCP tools/call bodies', () => {
    assert.deepEqual(parseTaskToolRequest({ tool: 'list_tasks', arguments: { done: false } }), {
      name: 'list_tasks',
      arguments: { done: false },
    })
    assert.deepEqual(
      parseTaskToolRequest({
        method: 'tools/call',
        params: { name: 'create_task', arguments: { title: 'Ship' } },
      }),
      { name: 'create_task', arguments: { title: 'Ship' } }
    )
    assert.equal('error' in parseTaskToolRequest({ tool: 'seo-agent' }), true)
  })

  it('parses positive task ids only', () => {
    assert.equal(parseTaskId(12), 12)
    assert.equal(parseTaskId('4'), 4)
    assert.equal(parseTaskId(0), null)
    assert.equal(parseTaskId(-3), null)
    assert.equal(parseTaskId('1.5'), null)
  })
})
