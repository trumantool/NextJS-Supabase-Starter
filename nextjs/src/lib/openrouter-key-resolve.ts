export function isForcePlatformKey(value: string | null | undefined): boolean {
  const normalized = (value ?? '').trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

export function pickOpenRouterKey(input: {
  byok?: string | null
  adminKey?: string | null
  envKey?: string | null
  forcePlatform: boolean
}): string {
  const byok = input.byok?.trim() ?? ''
  const adminKey = input.adminKey?.trim() ?? ''
  const envKey = input.envKey?.trim() ?? ''
  if (!input.forcePlatform && byok) return byok
  if (adminKey) return adminKey
  return envKey
}
