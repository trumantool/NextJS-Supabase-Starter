import { createSSRClient } from '@/lib/supabase/server'
import {
  SOCIAL_PROFILE_COLUMNS,
  buildSocialProfileUpdate,
  isUndefinedColumnError,
  socialColumnsFromRow,
  socialColumnsFromSchemaQuery,
  socialProfileValuesFromRow,
  assertProfileRowUpdated,
  type SocialProfileColumn,
  type SocialProfileValues,
} from '@/lib/social-profile'

type QueryError = { code?: string; message?: string } | null

type InformationSchemaClient = {
  schema: (name: string) => {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => Promise<{
            data: Array<{ column_name: string }> | null
            error: QueryError
          }>
        }
      }
    }
  }
}

export type SocialProfileState = {
  columns: SocialProfileColumn[]
  values: Record<string, string>
}

async function requireAuthenticatedClient() {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return { supabase, user }
}

async function listSocialColumnsFromInformationSchema(
  supabase: InformationSchemaClient
): Promise<SocialProfileColumn[] | null> {
  try {
    const { data, error } = await supabase
      .schema('information_schema')
      .from('columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'user_data')

    return socialColumnsFromSchemaQuery(data, error)
  } catch {
    return null
  }
}

async function listSocialColumnsByProbe(
  supabase: Awaited<ReturnType<typeof createSSRClient>>
): Promise<SocialProfileColumn[]> {
  const results = await Promise.all(
    SOCIAL_PROFILE_COLUMNS.map(async (column) => {
      const { error } = await supabase.from('user_data').select(column).limit(1)
      if (!error) return column
      if (isUndefinedColumnError(error)) return null
      throw new Error(error.message)
    })
  )

  return results.filter((column): column is SocialProfileColumn => column !== null)
}

async function listExistingSocialColumns(
  supabase: Awaited<ReturnType<typeof createSSRClient>>
): Promise<SocialProfileColumn[]> {
  const fromSchema = await listSocialColumnsFromInformationSchema(
    supabase as unknown as InformationSchemaClient
  )
  if (fromSchema) return fromSchema
  return listSocialColumnsByProbe(supabase)
}

export async function getSocialProfileForCurrentUser(): Promise<SocialProfileState> {
  const { supabase, user } = await requireAuthenticatedClient()
  const fromSchema = await listSocialColumnsFromInformationSchema(
    supabase as unknown as InformationSchemaClient
  )

  if (fromSchema) {
    if (fromSchema.length === 0) {
      return { columns: [], values: {} }
    }

    const { data, error } = await supabase
      .from('user_data')
      .select(fromSchema.join(','))
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      if (isUndefinedColumnError(error)) {
        return { columns: [], values: {} }
      }
      throw new Error(error.message)
    }

    return {
      columns: fromSchema,
      values: socialProfileValuesFromRow(
        data as Record<string, unknown> | null,
        fromSchema
      ),
    }
  }

  const { data, error } = await supabase
    .from('user_data')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (data) {
    const columns = socialColumnsFromRow(data as Record<string, unknown>)
    return {
      columns,
      values: socialProfileValuesFromRow(data as Record<string, unknown>, columns),
    }
  }

  const columns = await listSocialColumnsByProbe(supabase)
  return { columns, values: {} }
}

export async function updateSocialProfileForCurrentUser(
  input: Record<string, unknown>
): Promise<{ success: true; values: SocialProfileValues }> {
  const { supabase, user } = await requireAuthenticatedClient()
  const columns = await listExistingSocialColumns(supabase)
  const built = buildSocialProfileUpdate(input, columns)
  if (!built.ok) {
    throw new Error(built.error)
  }

  if (Object.keys(built.value).length === 0) {
    return { success: true, values: built.value }
  }

  const { data, error } = await supabase
    .from('user_data')
    .update(built.value)
    .eq('user_id', user.id)
    .select('user_id')
    .maybeSingle()

  if (error) {
    if (isUndefinedColumnError(error)) {
      throw new Error('Social profile columns are not available')
    }
    throw new Error(error.message)
  }

  assertProfileRowUpdated(data)
  return { success: true, values: built.value }
}
