import { NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'

export type AgentSkillListItem = {
  id: string
  user_id: string | null
  skill_name: string
  skill_description: string | null
}

/**
 * GET /api/agent-skills
 * Own + shared skills (RLS). Shared first, then mine, by name.
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

    const skills: AgentSkillListItem[] = [...(data || [])].toSorted((a, b) => {
      const aShared = a.user_id == null ? 0 : 1
      const bShared = b.user_id == null ? 0 : 1
      if (aShared !== bShared) return aShared - bShared
      return a.skill_name.localeCompare(b.skill_name)
    })

    return NextResponse.json({ skills })
  } catch (err) {
    console.error('Agent skills GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
