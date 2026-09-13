import type { SupabaseClient } from '@supabase/supabase-js'
import { modelIdFromDefaults } from '@/lib/agent-templates'
import { getValidChatModel, streamChatCompletion } from '@/lib/chat-openrouter'
import { loadAgentSkills } from '@/lib/load-agent-skills'
import type { Automation, AutomationRun } from '@/lib/types'

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful workspace assistant running as an unattended scheduled automation. There is no human present to approve actions.\n' +
  'Complete the job from the instructions. Follow any loaded skills as instructions.\n' +
  'External tools and write actions are not available. If you cannot fetch live data, say so and still produce the best text answer you can.'

export async function executeQueuedRun(opts: {
  supabase: SupabaseClient
  runId: string
}): Promise<void> {
  const { supabase, runId } = opts

  const { data: run, error: runError } = await supabase
    .from('automation_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle()

  if (runError || !run) {
    console.error('executeQueuedRun: run not found', runId, runError)
    return
  }

  const typedRun = run as AutomationRun
  if (
    typedRun.status === 'succeeded' ||
    typedRun.status === 'failed' ||
    typedRun.status === 'skipped'
  ) {
    return
  }

  if (typedRun.status === 'queued') {
    await supabase
      .from('automation_runs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', runId)
  }

  const fail = async (error: string, output?: string) => {
    await supabase
      .from('automation_runs')
      .update({
        status: 'failed',
        error,
        output: output ?? typedRun.output,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId)
  }

  const { data: automation, error: autoError } = await supabase
    .from('automations')
    .select('*')
    .eq('id', typedRun.automation_id)
    .maybeSingle()

  if (autoError || !automation) {
    await fail('Automation not found.')
    return
  }

  const typedAuto = automation as Automation
  const userId = typedAuto.user_id

  let systemPrompt = DEFAULT_SYSTEM_PROMPT
  let skillIds = [...(typedAuto.skill_ids || [])]
  let modelId = getValidChatModel(typedAuto.model_id)

  if (typedAuto.agent_id) {
    const { data: agent } = await supabase
      .from('user_agents')
      .select('id, system_prompt, skill_ids, defaults')
      .eq('id', typedAuto.agent_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (agent) {
      const agentPrompt = agent.system_prompt?.trim()
      if (agentPrompt) {
        systemPrompt = `${agentPrompt}\n\n${DEFAULT_SYSTEM_PROMPT}`
      }
      skillIds = [...new Set([...(agent.skill_ids || []), ...skillIds])]
      if (!typedAuto.model_id) {
        modelId = getValidChatModel(modelIdFromDefaults(agent.defaults), modelId)
      }
    } else {
      systemPrompt += '\n\nNote: The selected agent was not found. Running with the default assistant prompt.'
    }
  }

  let loadedSkills = { promptSection: '', notes: [] as string[] }
  try {
    loadedSkills = await loadAgentSkills({
      supabase,
      ownerUserId: userId,
      skillIds,
    })
  } catch (err) {
    console.error('executeQueuedRun: failed to load skills', err)
    loadedSkills = {
      promptSection: '',
      notes: ['Skipped skills: could not load skill files.'],
    }
  }
  systemPrompt += loadedSkills.promptSection
  if (loadedSkills.notes.length > 0) {
    systemPrompt += `\n\nSkill loader notes:\n- ${loadedSkills.notes.join('\n- ')}`
  }

  // allow_mutations is stored for a future tools phase. v1 has no tool loop.
  if (!typedAuto.allow_mutations) {
    systemPrompt +=
      '\n\nWrite actions are disabled for this automation (allow_mutations=false). Produce a text transcript only.'
  }

  try {
    const text = (
      await streamChatCompletion({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: typedAuto.prompt },
        ],
        onChunk: () => {},
        userId,
      })
    ).trim()

    const transcript =
      text ||
      'The run finished without a text transcript. The model returned an empty reply.'
    const output = loadedSkills.notes.length
      ? `${loadedSkills.notes.join('\n')}\n\n${transcript}`
      : transcript

    await supabase
      .from('automation_runs')
      .update({
        status: 'succeeded',
        output,
        error: null,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId)
  } catch (err) {
    console.error('executeQueuedRun failed:', err)
    const message = err instanceof Error ? err.message : 'Run failed'
    const outputWithNotes = loadedSkills.notes.length
      ? `${loadedSkills.notes.join('\n')}\n\n${message}`
      : undefined
    await fail(message, outputWithNotes)
  }
}
