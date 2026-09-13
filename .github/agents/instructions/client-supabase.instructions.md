---
name: Client-side Supabase Code
description: "Apply to client components ('use client') that interact with Supabase. Ensures proper auth handling, uses anon key only, implements real-time subscriptions safely, and follows React best practices for data fetching."
applyTo:
  - "**/components/**/*client*.tsx"
  - "**/*'use client'*"
---

# Client-side Supabase Code

## Key Principles

1. **Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` only** — Never send service role key to browser
2. **RLS policies protect data** — Browser makes requests with `anon` key; RLS restricts which rows are visible
3. **Server actions for mutations** — Use server actions instead of direct client mutations when possible
4. **Handle auth state changes** — Listen for session changes and refresh UI
5. **Minimize state updates** — Prefer server-side data fetching in server components

## Client Supabase Setup

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

## Handling Authentication

```typescript
// components/AuthButton.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function AuthButton() {
  const [user, setUser] = useState(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
        
        // Refresh data when auth state changes
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          router.refresh()
        }
      }
    )

    return () => {
      subscription?.unsubscribe()
    }
  }, [router])

  if (!user) {
    return <a href="/login">Sign in</a>
  }

  return (
    <div>
      <p>Signed in as {user.email}</p>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  )
}
```

## Real-time Subscriptions

Use client components for Realtime features:

```typescript
// components/TodoList.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Todo } from '@/lib/types'

export function TodoList({ initialTodos }: { initialTodos: Todo[] }) {
  const [todos, setTodos] = useState(initialTodos)
  const supabase = createClient()

  useEffect(() => {
    // Set up real-time subscription
    const channel = supabase
      .channel('todos')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTodos(prev => [...prev, payload.new as Todo])
          } else if (payload.eventType === 'UPDATE') {
            setTodos(prev =>
              prev.map(t => t.id === payload.new.id ? payload.new as Todo : t)
            )
          } else if (payload.eventType === 'DELETE') {
            setTodos(prev => prev.filter(t => t.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    // Clean up subscription
    return () => {
      channel.unsubscribe()
    }
  }, [])

  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  )
}
```

## Form Handling with Server Actions

Prefer server actions over direct API calls:

```typescript
// components/AddTodoForm.tsx
'use client'

import { useState } from 'react'
import { addTodo } from '@/app/actions'

export function AddTodoForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)

    const result = await addTodo({
      title: formData.get('title') as string,
    })

    if (result.error) {
      setError(result.error)
    }

    setIsLoading(false)
  }

  return (
    <form action={handleSubmit}>
      <input
        name="title"
        placeholder="Add a todo..."
        required
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Adding...' : 'Add'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
```

## Direct Client Mutations (when necessary)

Only use direct client mutations when server actions aren't suitable:

```typescript
// components/ToggleTodo.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Todo } from '@/lib/types'

export function ToggleTodo({ todo }: { todo: Todo }) {
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  async function toggleTodo() {
    setIsLoading(true)

    const { error } = await supabase
      .from('todos')
      .update({ completed: !todo.completed })
      .eq('id', todo.id)

    if (error) {
      console.error('Failed to update todo:', error)
    }

    setIsLoading(false)
  }

  return (
    <button onClick={toggleTodo} disabled={isLoading}>
      {todo.completed ? '✓' : '○'} {todo.title}
    </button>
  )
}
```

## Fetching Data from Client

Minimize client-side data fetching. Use server components and pass data as props instead:

```typescript
// ❌ Avoid: Fetching in client component
'use client'

export function BadTodoList() {
  const [todos, setTodos] = useState([])

  useEffect(() => {
    // This fetches on every render!
    supabase.from('todos').select().then(({ data }) => setTodos(data))
  }, [])

  return <div>{todos.length}</div>
}

// ✅ Good: Fetch in server component, pass data
async function GoodTodoList() {
  const supabase = await createClient()
  const { data: todos } = await supabase.from('todos').select()

  return <TodoListClient todos={todos} />
}
```

## Checklist for Client Code

- [ ] **Using anon key only** — Never send service role key to browser
- [ ] **Auth state handling** — Listen for `onAuthStateChange` to refresh UI
- [ ] **Error handling** — Display user-friendly error messages
- [ ] **Loading states** — Show feedback while requests are pending
- [ ] **RLS assumptions** — Assume RLS filters data, don't trust row access
- [ ] **Cleanup subscriptions** — Unsubscribe from channels in cleanup function
- [ ] **Prefer server actions** — Use `app/actions.ts` for mutations when possible
- [ ] **Type safety** — Use TypeScript types for Supabase responses

## Common Mistakes to Avoid

❌ **Exposing service role key** — `SUPABASE_SERVICE_ROLE_KEY` must stay server-only  
✅ **Use anon key in browser** — RLS policies handle authorization

❌ **Not listening to auth changes** — UI might be stale after sign-in/sign-out  
✅ **Use `onAuthStateChange`** — Keep UI in sync with auth state

❌ **Forgetting to unsubscribe** — Realtime subscriptions leak memory  
✅ **Return cleanup function** — Call `channel.unsubscribe()` in useEffect cleanup

❌ **Multiple independent fetches** — Causes waterfalls and N+1 queries  
✅ **Fetch in server component** — Pass data as props to client components

❌ **Storing sensitive data in state** — Persists in browser memory  
✅ **Keep tokens in cookies** — Managed by Supabase client automatically

## Performance Patterns

### Optimistic updates

```typescript
// Update UI immediately, revert if error
async function optimisticUpdate(todo: Todo) {
  const oldTodo = todo
  
  // Update UI immediately
  setTodos(prev => 
    prev.map(t => t.id === todo.id ? { ...t, completed: true } : t)
  )
  
  // Update database
  const { error } = await supabase
    .from('todos')
    .update({ completed: true })
    .eq('id', todo.id)
  
  // Revert on error
  if (error) {
    setTodos(prev =>
      prev.map(t => t.id === todo.id ? oldTodo : t)
    )
  }
}
```

### Debounced search

```typescript
const [search, setSearch] = useState('')
const [results, setResults] = useState<Todo[]>([])

useEffect(() => {
  const timer = setTimeout(async () => {
    if (search.length > 2) {
      const { data } = await supabase
        .from('todos')
        .select('*')
        .ilike('title', `%${search}%`)
        .limit(10)
      
      setResults(data || [])
    }
  }, 300)

  return () => clearTimeout(timer)
}, [search])
```

## Security Reminders

- **Never log auth tokens** — They're sensitive credentials
- **Don't trust client-side validation** — RLS protects data, client validation is UX
- **Test RLS in development** — Verify unauthorized users can't access rows
- **Use HTTPS only** — Don't expose credentials over unencrypted connections
- **Review Supabase Security Guide** — Keep up with auth best practices
