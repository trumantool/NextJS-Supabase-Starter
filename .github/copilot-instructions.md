---
name: NextJS Supabase Developer Instructions
description: "Project-wide instructions for Next.js + Supabase development. Defines conventions, workflow, and best practices for this full-stack application."
applyTo: "**"
scope: "project"
---

# Next.js + Supabase Developer Instructions

This project is built with **Next.js 14+ App Router** and **Supabase backend**. These instructions guide development to maintain consistency, security, and performance.

## Project Architecture

```
┌─────────────────────┐
│   Next.js App       │ (App Router, React 19)
│  - Server Components│ (pages, layouts, streaming)
│  - Server Actions   │ (mutations, revalidation)
│  - Middleware       │ (auth, session refresh)
└──────────┬──────────┘
           │
┌──────────▼──────────────────────┐
│  Supabase SDK + MCP Server      │
│  - supabase-js client library   │
│  - @supabase/ssr for Next.js    │
│  - MCP for direct SQL execution │
└──────────┬──────────────────────┘
           │
┌──────────▼──────────────────────┐
│   Supabase Backend              │
│  - PostgreSQL (public schema)    │ (RLS enabled)
│  - Auth (Supabase Auth)          │ (sessions, JWT)
│  - Storage (file uploads)        │ (bucket policies)
│  - Edge Functions (serverless)   │ (webhooks, custom logic)
│  - Realtime (WebSocket subscriptions)
└─────────────────────────────────┘
```

## Key Files and Their Purpose

```
nextjs/
├── src/
│   ├── middleware.ts                 # Auth session refresh, route protection
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser client (anon key)
│   │   │   ├── server.ts             # Server client (session-aware)
│   │   │   ├── middleware.ts         # Session refresh utilities
│   │   │   └── types.ts              # TypeScript types from schema
│   │   ├── types.ts                  # App-wide type definitions
│   │   └── utils.ts                  # Helper functions
│   ├── app/
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Home page
│   │   ├── actions.ts                # Server actions for mutations
│   │   ├── api/                      # API routes (if needed)
│   │   ├── auth/                     # Auth pages (login, register, etc)
│   │   ├── app/                      # Protected app routes
│   │   └── middleware.ts             # Next.js middleware
│   └── components/
│       ├── (client components)       # Marked with 'use client'
│       └── ui/                       # Reusable UI components
│
├── public/
│   └── terms/                        # Legal documents
│
├── tsconfig.json                     # TypeScript config (strict mode)
├── next.config.ts                    # Next.js config
├── tailwind.config.ts                # Tailwind CSS config
└── package.json                      # Dependencies

supabase/
├── config.toml                       # Local dev config
└── migrations/                       # SQL migration files
    ├── 20250107210416_MFA.sql
    ├── 20250130165844_example_storage.sql
    └── ...
```

## Development Workflow

### 1. Adding a New Feature

**Step 1: Design the database schema**
```bash
# Review existing tables first
supabase db query -- "\dt public.*"

# Create a migration file
supabase migration new add_feature_table

# Edit the migration with your schema
# Remember: RLS, indexes, foreign keys, timestamps
```

**Step 2: Create type-safe client utilities**
```typescript
// lib/supabase/client.ts - browser client
export function createClient() { /* ... */ }

// lib/supabase/server.ts - server client
export async function createClient() { /* ... */ }

// lib/types.ts - types generated from schema
export type Database = { /* ... */ }
export type YourTable = Database['public']['Tables']['your_table']['Row']
```

**Step 3: Implement server-side logic**
```typescript
// app/actions.ts - server actions for mutations
'use server'

export async function createItem(data: ItemData) {
  // Validate auth, create in DB, revalidate cache
}

// OR app/api/items/route.ts - API route
export async function POST(request: NextRequest) {
  // Validate request, auth, create in DB
}
```

**Step 4: Build client UI**
```typescript
// components/ItemForm.tsx - client component
'use client'

export function ItemForm() {
  return <form action={createItem}>{/* ... */}</form>
}

// OR for real-time, subscribe in useEffect
```

**Step 5: Test and deploy**
```bash
# Test locally
npm run dev

# Push to Vercel
git push origin main
```

### 2. Auth and Session Handling

All auth flows go through Supabase Auth. Sessions are stored in cookies and refreshed via middleware:

```typescript
// middleware.ts automatically refreshes session on each request
// No additional session management needed

// Access user in server components/actions:
const { data: { user } } = await supabase.auth.getUser()

// Access user in client components:
// Set up via onAuthStateChange, or fetch from server component
```

### 3. RLS Policy Development

Every table in `public` schema MUST have RLS enabled:

```sql
-- 1. Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- 2. Create policies for each operation
CREATE POLICY "Users can read own data"
  ON table_name FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Verify policies with EXPLAIN
EXPLAIN SELECT * FROM table_name WHERE condition;
```

## Coding Standards

### TypeScript

- **Use strict mode** — `tsconfig.json` has `"strict": true`
- **Type all function parameters and returns** — No implicit `any`
- **Use discriminated unions** — For complex state
- **Create branded types** — For domain modeling (UserId, OrderId, etc)

```typescript
// ✅ Good
export type UserId = Brand<string, 'UserId'>
export async function getUser(userId: UserId): Promise<User> { }

// ❌ Bad
export async function getUser(userId: any): Promise<any> { }
```

### React Components

- **Use Server Components by default** — Only add `'use client'` when needed for interactivity
- **Fetch data server-side** — Pass as props to client components
- **Use Suspense boundaries** — For async operations
- **Minimize bundle size** — Lazy load heavy components

```typescript
// ✅ Good: server component fetches, passes to client
async function Page() {
  const data = await fetchData()
  return <ClientComponent data={data} />
}

// ❌ Bad: client fetches, causing waterfall
'use client'
function Page() {
  const [data, setData] = useState(null)
  useEffect(() => {
    fetchData().then(setData)
  }, [])
}
```

### Server Actions

- **Always validate auth** — Get current user first
- **Add error handling** — Catch and log errors
- **Validate input** — Check required fields
- **Invalidate cache** — Call `revalidatePath()` or `revalidateTag()`
- **Return typed responses** — Define shape of response

```typescript
export async function myAction(input: Input): Promise<ActionResult<Output>> {
  const user = await getAuthenticatedUser()
  validateInput(input)
  const result = await database.insert(input)
  revalidatePath('/page')
  return { data: result }
}
```

## Security Checklist

Use this before any deployment:

- [ ] **RLS policies** — All public tables have RLS enabled and tested
- [ ] **Auth validation** — All mutations validate `auth.uid()` on server
- [ ] **Secret keys** — `SUPABASE_SERVICE_ROLE_KEY` never exposed in client code
- [ ] **Input validation** — Server validates all user input before database operations
- [ ] **Error handling** — Errors logged server-side, safe messages returned to client
- [ ] **Session security** — Sessions stored in secure, HTTP-only cookies
- [ ] **HTTPS** — All production traffic is encrypted
- [ ] **Rate limiting** — Consider implementing for API routes
- [ ] **CORS policy** — Only allow requests from trusted domains

## Performance Guidelines

### Database

- **Use `select()`** to fetch only needed columns
- **Add indexes** on foreign keys, search columns, and filter predicates
- **Limit results** — Use `.range()` or `.limit()` for pagination
- **Avoid N+1** — Use joins instead of separate queries

### Frontend

- **Use `next/image`** — Never plain `<img>` for content images
- **Lazy load components** — Use `next/dynamic` for heavy UI
- **Cache aggressively** — Leverage Next.js `fetch` caching
- **Monitor Core Web Vitals** — Use Vercel Analytics

## Deployment Checklist

Before pushing to production:

```bash
# 1. Run build
npm run build

# 2. Check for errors
npm run lint
npm run type-check

# 3. Run tests (if available)
npm test

# 4. Verify environment variables
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# (No secrets in NEXT_PUBLIC_*)

# 5. Push to git
git add .
git commit -m "Feature: [description]"
git push origin main

# 6. Vercel auto-deploys from main branch
# Monitor: https://vercel.com/dashboard
```

## MCP Server Integration

The Supabase MCP server is configured for this project. Use it to:

```
- Execute SQL queries directly
- Check schema and RLS policies
- Run migrations
- View database logs
- Manage functions and triggers
```

Ask Copilot: *"Execute this query on my Supabase database"*

## Common Commands

```bash
# Development
npm run dev                    # Start dev server (http://localhost:3000)
npm run build                  # Production build
npm run lint                   # ESLint

# Supabase
supabase start                 # Start local dev environment
supabase db pull              # Pull schema from remote
supabase db push              # Push schema to remote
supabase migration new <name> # Create migration
supabase db query             # Run SQL query

# Git
git status                     # Check changes
git diff                       # Review changes
git commit -am "message"       # Commit with message
git push origin main          # Push to main
```

## Documentation

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Supabase + Next.js Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vercel Docs](https://vercel.com/docs)

## Getting Help

When you need help:

1. **Schema questions** — Reference `supabase-postgres-best-practices` skill
2. **Next.js architecture** — Reference `nextjs-developer` skill
3. **Supabase features** — Reference `supabase` skill
4. **Type safety** — Reference `typescript-pro` skill
5. **Performance** — Reference `react-best-practices` skill
