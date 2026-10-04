import type { Database } from '@/lib/types'

type UsageRpc = {
  rpc: (
    fn: 'record_llm_turn_usage',
    args: Database['public']['Functions']['record_llm_turn_usage']['Args']
  ) => PromiseLike<{ error: { message: string } | null }>
}

export type LlmTurnUsage = {
  inputTokens: number
  outputTokens: number
}

/**
 * Persist one chat or automation turn through record_llm_turn_usage.
 * Exactly one parent id is sent. Prices and markup are left null so the
 * function snapshots the catalog and admin markup.
 * Failures are logged and do not throw — the reply is already saved.
 */
export async function recordLlmTurnUsage(
  supabase: UsageRpc,
  args: {
    userId: string
    modelId: string
    usage: LlmTurnUsage
    messageId?: string | null
    automationRunId?: string | null
  }
): Promise<void> {
  const { error } = await supabase.rpc('record_llm_turn_usage', {
    p_user_id: args.userId,
    p_model_id: args.modelId,
    p_input_tokens: args.usage.inputTokens,
    p_output_tokens: args.usage.outputTokens,
    p_message_id: args.messageId ?? null,
    p_automation_run_id: args.automationRunId ?? null,
    p_prompt_price: null,
    p_completion_price: null,
    p_markup: null,
    p_provider: null,
  })
  if (error) {
    console.error('record_llm_turn_usage failed:', error.message)
  }
}
