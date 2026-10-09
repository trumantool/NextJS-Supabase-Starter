import { createSSRClient } from '@/lib/supabase/server'

export type ProfileView = {
  first_name: string
  last_name: string
  email: string | null
  plan: string
  plan_status: string
  current_period_end: string | null
  stripe_customer_id: string | null
}

const NAME_MAX = 80

function cleanName(value: unknown, label: string): string | null {
  if (value == null) return null
  if (typeof value !== 'string') throw new Error(`${label} must be text`)
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > NAME_MAX) throw new Error(`${label} must be ${NAME_MAX} characters or fewer`)
  return trimmed
}

async function requireUser() {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return { supabase, user }
}

export async function getProfileForCurrentUser(): Promise<ProfileView> {
  const { supabase, user } = await requireUser()
  const [{ data: settings, error: settingsError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase
        .from('user_settings')
        .select('first_name, last_name, email')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_data')
        .select('first_name, last_name, email, plan, plan_status, current_period_end, stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])
  if (settingsError) throw new Error(settingsError.message)
  if (profileError) throw new Error(profileError.message)

  return {
    first_name: settings?.first_name ?? profile?.first_name ?? '',
    last_name: settings?.last_name ?? profile?.last_name ?? '',
    email: settings?.email ?? profile?.email ?? user.email ?? null,
    plan: profile?.plan ?? 'free',
    plan_status: profile?.plan_status ?? 'inactive',
    current_period_end: profile?.current_period_end ?? null,
    stripe_customer_id: profile?.stripe_customer_id ?? null,
  }
}

export async function updateProfileNames(input: {
  first_name?: unknown
  last_name?: unknown
}): Promise<ProfileView> {
  const { supabase, user } = await requireUser()
  const first_name = cleanName(input.first_name, 'First name')
  const last_name = cleanName(input.last_name, 'Last name')

  const { error: settingsError } = await supabase
    .from('user_settings')
    .update({ first_name, last_name })
    .eq('user_id', user.id)
  if (settingsError) throw new Error(settingsError.message)

  const { error: dataError } = await supabase
    .from('user_data')
    .update({ first_name, last_name })
    .eq('user_id', user.id)
  if (dataError) throw new Error(dataError.message)

  return getProfileForCurrentUser()
}
