'use server'

import { createSSRClient } from '@/lib/supabase/server'
import { Tables } from '@/lib/types'

type AdminSetting = Tables<'admin_settings'>
type ContactSubmission = Tables<'contact_submissions'>

/**
 * Checks whether the current authenticated user has the 'admin' role.
 * Returns false for anonymous users.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('user_data')
    .select('user_role')
    .eq('user_id', user.id)
    .maybeSingle()

  return data?.user_role === 'admin'
}

/**
 * Fetches all admin settings. Only accessible to admin users.
 */
export async function getAdminSettings(): Promise<AdminSetting[]> {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: userData } = await supabase
    .from('user_data')
    .select('user_role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (userData?.user_role !== 'admin') {
    throw new Error('Forbidden: admin access required')
  }

  const { data, error } = await supabase
    .from('admin_settings')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as AdminSetting[]
}

/**
 * Fetches admin settings by option name. Publicly readable (RLS allows anon
 * and authenticated SELECT). Returns a map of option_name -> option_value.
 * Missing options are simply absent from the map so callers can fall back to
 * defaults.
 */
export async function getAdminSettingsByNames(
  names: string[]
): Promise<Record<string, string>> {
  const supabase = await createSSRClient()

  const { data, error } = await supabase
    .from('admin_settings')
    .select('option_name, option_value')
    .in('option_name', names)

  if (error) {
    console.error('Failed to fetch admin settings:', error)
    return {}
  }

  const result: Record<string, string> = {}
  for (const row of data ?? []) {
    result[row.option_name] = row.option_value
  }
  return result
}

/**
 * Updates a single admin setting's value. Only accessible to admin users.
 */
export async function updateAdminSetting(
  id: string,
  optionValue: string
): Promise<AdminSetting> {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: userData } = await supabase
    .from('user_data')
    .select('user_role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (userData?.user_role !== 'admin') {
    throw new Error('Forbidden: admin access required')
  }

  const { data, error } = await supabase
    .from('admin_settings')
    .update({ option_value: optionValue, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as AdminSetting
}

/**
 * Fetches all contact form submissions, newest first. Only accessible to admin
 * users. Returns the rows plus the total count.
 */
export async function getContactSubmissions(): Promise<{
  submissions: ContactSubmission[]
  total: number
}> {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: userData } = await supabase
    .from('user_data')
    .select('user_role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (userData?.user_role !== 'admin') {
    throw new Error('Forbidden: admin access required')
  }

  const { data, error, count } = await supabase
    .from('contact_submissions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return {
    submissions: (data ?? []) as ContactSubmission[],
    total: count ?? 0,
  }
}

/**
 * Updates a contact submission's status (e.g. new → in_progress → resolved).
 * Only accessible to admin users.
 */
export async function updateContactSubmissionStatus(
  id: string,
  status: string
): Promise<ContactSubmission> {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: userData } = await supabase
    .from('user_data')
    .select('user_role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (userData?.user_role !== 'admin') {
    throw new Error('Forbidden: admin access required')
  }

  const { data, error } = await supabase
    .from('contact_submissions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as ContactSubmission
}