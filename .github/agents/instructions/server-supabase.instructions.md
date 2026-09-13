---
name: Server-side Supabase Code
description: "Apply to server actions, API routes, and server components that interact with Supabase. Ensures proper auth validation, type safety, error handling, and follows Next.js best practices for server-side data fetching."
applyTo:
  - "**/actions.ts"
  - "**/app/api/**/*.ts"
  - "**/server/**/*.ts"
  - "**/*server*.ts"
---

# Server-side Supabase Code

## When Writing Server Code

1. **Always validate auth context** — Get the current user before any database mutation
2. **Use the server Supabase client** — Must have access to `SUPABASE_SERVICE_ROLE_KEY` (server-only)
3. **Add explicit error handling** — Log errors server-side, return safe messages to client
4. **Invalidate cache appropriately** — Use `revalidatePath()` or `revalidateTag()` after mutations
5. **Type all responses** — Use TypeScript types for request/response validation

## Server Action Pattern

```typescript
// app/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Todo } from '@/lib/types'

// Define input types
interface AddTodoInput {
  title: string
  description?: string
}

// Define response type
interface ActionResponse<T> {
  data?: T
  error?: string
}

export async function addTodo(input: AddTodoInput): Promise<ActionResponse<Todo>> {
  try {
    // 1. Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { error: 'Unauthorized' }
    }
    
    // 2. Validate input
    if (!input.title.trim()) {
      return { error: 'Title is required' }
    }
    
    // 3. Create in database
    const { data, error } = await supabase
      .from('todos')
      .insert({
        title: input.title,
        description: input.description,
        user_id: user.id,
      })
      .select()
      .single()
    
    if (error) {
      console.error('Database error:', error)
      return { error: 'Failed to create todo' }
    }
    
    // 4. Invalidate cache
    revalidatePath('/todos')
    
    // 5. Return result
    return { data }
    
  } catch (error) {
    console.error('Unexpected error:', error)
    return { error: 'An unexpected error occurred' }
  }
}
```

## API Route Pattern

```typescript
// app/api/todos/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    // 1. Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // 2. Parse and validate request body
    const body = await request.json()
    const { title } = body as { title: string }
    
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }
    
    // 3. Create in database
    const { data, error } = await supabase
      .from('todos')
      .insert({
        title,
        user_id: user.id,
      })
      .select()
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create todo' },
        { status: 500 }
      )
    }
    
    return NextResponse.json(data, { status: 201 })
    
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // RLS will automatically filter to user's todos
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## Checklist for Server Code

- [ ] **Auth validation** — Always call `getUser()` before mutations
- [ ] **Error handling** — Catch database errors and return safe messages
- [ ] **Type safety** — Use TypeScript types for inputs and responses
- [ ] **Logging** — Log errors server-side (not exposed to client)
- [ ] **Cache invalidation** — Call `revalidatePath()` after mutations
- [ ] **RLS verification** — Confirm RLS policies protect sensitive data
- [ ] **Input validation** — Validate required fields before database operations
- [ ] **HTTP status codes** — Use correct codes (201 for created, 400 for validation, 401 for auth, 500 for server errors)

## Supabase Client Setup

Always use `await createClient()` for server-side code:

```typescript
// lib/supabase/server.ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function createClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}
```

## Common Patterns

### Getting current user in server action

```typescript
const supabase = await createClient()
const { data: { user }, error } = await supabase.auth.getUser()

if (error || !user) {
  throw new Error('Not authenticated')
}

// Now safe to use user.id
```

### Updating with RLS validation

RLS policies are automatically enforced, but verify behavior:

```typescript
const { data, error } = await supabase
  .from('todos')
  .update({ completed: true })
  .eq('id', todoId)
  .select()  // Important: verify at least 1 row was updated

// If RLS blocks the update, no error is thrown
// But data will be empty array
if (!data || data.length === 0) {
  throw new Error('Not found or unauthorized')
}
```

### Batch operations

```typescript
const todos = [
  { title: 'First', user_id: user.id },
  { title: 'Second', user_id: user.id },
  { title: 'Third', user_id: user.id },
]

const { data, error } = await supabase
  .from('todos')
  .insert(todos)
  .select()
```

### Transactions (advanced)

Use Postgres transactions within `rpc()` calls for multi-step operations:

```typescript
const { data, error } = await supabase.rpc('create_user_and_profile', {
  email: 'user@example.com',
  name: 'John',
})
```

## Security Reminders

- **Never log sensitive data** — Remove passwords, tokens, personal info from logs
- **Validate on server** — Client validation is for UX; server validation is for security
- **Use anon key in browser** — RLS policies protect data access
- **Use service role only in server actions** — Keep `SUPABASE_SERVICE_ROLE_KEY` server-only
- **Check RLS in production** — Test that unauthorized users can't access data
- **Handle auth state** — Expired sessions should be re-authenticated

## Debugging

```typescript
// Log query details without exposing to client
console.log('Query:', {
  table: 'todos',
  userId: user.id,
  method: 'select',
})

// Log error details server-side
if (error) {
  console.error('Supabase error details:', {
    message: error.message,
    code: error.code,
    hint: error.hint,
  })
}
```
