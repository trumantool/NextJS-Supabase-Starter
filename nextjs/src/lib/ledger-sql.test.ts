import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const files = [
  join(root, 'supabase/schema.sql'),
  join(root, 'supabase/migrations/20261003120000_posts_stripe_token_ledger.sql'),
]

const ARGS = [
  'p_user_id uuid',
  'p_model_id text',
  'p_input_tokens bigint',
  'p_output_tokens bigint',
  'p_message_id uuid',
  'p_automation_run_id uuid',
  'p_prompt_price numeric',
  'p_completion_price numeric',
  'p_markup numeric',
  'p_provider text',
]

describe('token ledger SQL', () => {
  for (const file of files) {
    it(`${file} defines the 10-arg record_llm_turn_usage function`, () => {
      const sql = readFileSync(file, 'utf8')
      const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.record_llm_turn_usage')
      assert.notEqual(start, -1)
      const signature = sql.slice(start, start + 700)
      for (const arg of ARGS) {
        assert.equal(signature.includes(arg), true, arg)
      }
      assert.equal(signature.includes('p_course_post_id'), false)
      assert.equal(sql.includes('increment_user_token_usage'), false)
      assert.equal(sql.includes('tech_edu_openrouter'), false)
    })
  }

  it('seeds empty generic OpenRouter admin settings', () => {
    const sql = readFileSync(files[1], 'utf8')
    assert.match(sql, /'openrouter_api_key',\s*'',\s*'secret'/)
    assert.match(sql, /'openrouter_force_platform_key',\s*'false',\s*'boolean'/)
    assert.match(sql, /'openrouter_cost_markup',\s*'0',\s*'text'/)
  })

  it('does not use a column REVOKE as the privilege boundary', () => {
    for (const file of files) {
      const sql = readFileSync(file, 'utf8')
      assert.equal(sql.includes('REVOKE UPDATE ('), false, file)
      assert.match(sql, /GRANT UPDATE \(\s*user_id/)
      assert.match(sql, /GRANT UPDATE \(\s*id,\s*chat_id/)
      assert.match(sql, /protect_message_token_columns/)
    }
  })
})