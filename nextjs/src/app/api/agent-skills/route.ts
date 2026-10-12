import { NextResponse } from 'next/server'
import { listBuiltinSkills } from '@/lib/builtin-agents'
import { isSkillRowVisible } from '@/lib/starter-catalog-allowlist'
import { createSSRClient } from '@/lib/supabase/server'

export type AgentSkillListItem = {
  id: string
  user_id: string | null
  skill_name: string
  skill_description: string | null
}

/**
 * GET /api/agent-skills
 * Personal skills for the caller, plus built-in Task Management file descriptors.
 * Shared database rows stay hidden. Builtin files are not fake uuids.
 */
export async function GET() {
  try {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('agent_skills')
      .select('id, user_id, skill_name, skill_description')
      .order('skill_name', { ascending: true })

    if (error) {
      console.error('Failed to list agent skills:', error)
      return NextResponse.json({ error: 'Failed to list skills' }, { status: 500 })
    }

    const skills: AgentSkillListItem[] = (data || [])
      .filter((row) => isSkillRowVisible(row, user.id))
      .toSorted((a, b) => a.skill_name.localeCompare(b.skill_name))

    return NextResponse.json({ skills, builtinSkills: listBuiltinSkills() })
  } catch (err) {
    console.error('Agent skills GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
