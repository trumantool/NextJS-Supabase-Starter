'use server'

import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { Tables } from '@/lib/types'

type AdminSetting = Tables<'admin_settings'>

export type AdminSettingView = AdminSetting & { secret_is_set: boolean }

function presentAdminSetting(row: AdminSetting): AdminSettingView {
  if (row.option_field_type === 'secret') {
    return {
      ...row,
      option_value: '',
      secret_is_set: row.option_value.trim().length > 0,
    }
  }
  return { ...row, secret_is_set: false }
}

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
export async function getAdminSettings(): Promise<AdminSettingView[]> {
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

  // Service role sees secret rows. They are masked before leaving the server.
  const admin = await createServerAdminClient()
  const { data, error } = await admin
    .from('admin_settings')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as AdminSetting[]).map(presentAdminSetting)
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
  optionValue: string,
  options?: { clearSecret?: boolean }
): Promise<AdminSettingView> {
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

  const admin = await createServerAdminClient()
  const { data: existing, error: readError } = await admin
    .from('admin_settings')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (readError) throw new Error(readError.message)
  if (!existing) throw new Error('Setting not found')

  const row = existing as AdminSetting
  let nextValue = optionValue
  if (row.option_field_type === 'secret') {
    if (options?.clearSecret) {
      nextValue = ''
    } else if (!optionValue.trim()) {
      return presentAdminSetting(row)
    } else {
      nextValue = optionValue.trim()
    }
  }

  const writer = row.option_field_type === 'secret' ? admin : supabase
  const { data, error } = await writer
    .from('admin_settings')
    .update({ option_value: nextValue, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return presentAdminSetting(data as AdminSetting)
}
