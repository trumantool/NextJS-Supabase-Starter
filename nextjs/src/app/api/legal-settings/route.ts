import { NextResponse, type NextRequest } from 'next/server'
import { upsertLegalSettings } from '@/lib/actions/legal-settings'
import { legalFieldMeta } from '@/lib/legal-pages'

/**
 * POST /api/legal-settings
 * Saves the admin-editable identity fields used by /terms and /privacy.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { fields?: Record<string, unknown> }
    const raw = body.fields ?? {}
    const fields: Record<string, string> = {}
    for (const [name, value] of Object.entries(raw)) {
      if (!legalFieldMeta(name) || legalFieldMeta(name)?.option_field_type === 'textarea') {
        return NextResponse.json({ error: 'Setting not found' }, { status: 400 })
      }
      if (typeof value !== 'string') {
        return NextResponse.json({ error: 'Each value must be text.' }, { status: 400 })
      }
      fields[name] = value
    }
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'No settings to save' }, { status: 400 })
    }

    const settings = await upsertLegalSettings(fields)
    return NextResponse.json({ success: true, settings }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save legal settings'
    const status = message === 'Unauthorized' ? 401 : message.includes('admin') ? 403 : 500
    console.error('Legal settings save error:', err)
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
