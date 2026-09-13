'use server'

import { createSSRClient } from '@/lib/supabase/server'
import { Tables } from '@/lib/types'

type AdminSetting = Tables<'admin_settings'>

/**
 * Fetches the admin settings needed to render the Terms of Service page.
 * This is intentionally public (no auth required) so the /terms page can be
 * viewed by anyone. Only the specific settings used for rendering are returned.
 */
export async function getTermsSettings(): Promise<AdminSetting[]> {
  const supabase = await createSSRClient()

  const { data, error } = await supabase
    .from('admin_settings')
    .select('*')
    .in('option_name', [
      'terms_of_service',
      'site_title',
      'company_name',
      'support_email',
      'site_tagline',
      'contact_address',
      'support_hours',
      'phone_number',
    ])

  if (error) {
    console.error('Failed to load terms settings:', error)
    throw new Error('Failed to load terms settings')
  }

  return (data ?? []) as AdminSetting[]
}

/**
 * Updates the Terms of Service content. Only accessible to admin users.
 */
export async function updateTermsOfService(
  content: string
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
    .update({ option_value: content, updated_at: new Date().toISOString() })
    .eq('option_name', 'terms_of_service')
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as AdminSetting
}