import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

/** admin_settings.option_name for the post-login / auth-callback base URL. */
export const LOGIN_REDIRECT_OPTION = 'login_redirect_url'

const AUTH_CALLBACK_PATH = '/api/auth/callback'
const PASSWORD_RECOVERY_PATH = '/auth/reset-password'

type RedirectBaseInput = {
  loginRedirectUrl?: string | null
  appUrl?: string | null
  requestOrigin?: string | null
}

/**
 * Trim and drop trailing slashes. `https://example.com/` becomes
 * `https://example.com`. A slash-only value becomes empty.
 */
export function stripTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

/**
 * Keep absolute http(s) bases only. Empty, relative, and non-http values
 * are ignored so a bad admin option falls through to the next candidate.
 */
export function normalizeRedirectBase(value: string | null | undefined): string | null {
  if (!value) return null
  const stripped = stripTrailingSlash(value)
  if (!stripped) return null
  try {
    const url = new URL(stripped)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return stripped
  } catch {
    return null
  }
}

/**
 * Prefer `login_redirect_url` when it is a non-empty http(s) URL.
 * Otherwise `NEXT_PUBLIC_APP_URL`, then the request origin this starter
 * already uses (`window.location.origin` in the browser).
 */
export function resolveAuthRedirectBase(input: RedirectBaseInput): string {
  const candidates = [input.loginRedirectUrl, input.appUrl, input.requestOrigin]
  for (const candidate of candidates) {
    const normalized = normalizeRedirectBase(candidate)
    if (normalized) return normalized
  }
  return ''
}

export function authCallbackUrl(base: string): string {
  return `${stripTrailingSlash(base)}${AUTH_CALLBACK_PATH}`
}

export function passwordRecoveryUrl(base: string): string {
  return `${stripTrailingSlash(base)}${PASSWORD_RECOVERY_PATH}`
}

export async function readLoginRedirectUrl(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('option_value')
    .eq('option_name', LOGIN_REDIRECT_OPTION)
    .maybeSingle()

  if (error) {
    console.error('Failed to read login_redirect_url:', error.message)
    return null
  }

  return data?.option_value ?? null
}

/**
 * Resolve the redirect base for OAuth, email confirmation, and password recovery.
 * A missing or unreadable option falls back; it does not throw.
 */
export async function getAuthRedirectBase(
  supabase: SupabaseClient<Database>,
  requestOrigin: string,
): Promise<string> {
  let loginRedirectUrl: string | null = null
  try {
    loginRedirectUrl = await readLoginRedirectUrl(supabase)
  } catch (error) {
    console.error('Failed to read login_redirect_url:', error)
  }

  return resolveAuthRedirectBase({
    loginRedirectUrl,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    requestOrigin,
  })
}
