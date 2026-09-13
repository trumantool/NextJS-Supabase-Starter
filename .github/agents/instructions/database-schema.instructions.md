---
name: Database Schema Files
description: "Apply to SQL migration files and schema definitions. Ensures schema design follows Supabase Postgres best practices, includes RLS policies, proper indexing, and security guidelines."
applyTo: 
  - "**/migrations/**/*.sql"
  - "**/schemas/**/*.sql"
  - "**/db/**/*.sql"
---

# Database Schema Files

## Before Creating or Modifying

1. **Load the supabase-postgres-best-practices skill** — Review rules on indexes, RLS, types, foreign keys
2. **Check existing RLS policies** — Ensure new tables follow established patterns
3. **Plan performance** — Add indexes for frequently filtered columns before data volume grows
4. **Consider constraints** — Use `NOT NULL`, defaults, and foreign key constraints to enforce data integrity

## Schema Design Checklist

- [ ] **Primary Key** — Use `uuid primary key default gen_random_uuid()` (not integer IDs)
- [ ] **Timestamps** — Include `created_at` and `updated_at` with automatic defaults
- [ ] **Row-Level Security** — Enable RLS and create policies for every exposed table
- [ ] **Indexes** — Add B-tree indexes on foreign keys, search columns, and filter predicates
- [ ] **Foreign Keys** — Link to related tables with `ON DELETE CASCADE` or `ON DELETE RESTRICT`
- [ ] **Types** — Use appropriate column types: `text` vs `varchar`, `jsonb` for flexible data, `enum` for fixed sets
- [ ] **Constraints** — Use `UNIQUE`, `CHECK`, defaults to enforce data integrity
- [ ] **Documentation** — Add comments explaining complex columns or constraints

## RLS Policy Pattern

Every table in `public` schema must have RLS enabled:

```sql
-- 1. Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- 2. Create SELECT policy
CREATE POLICY "users_can_read_own_records"
  ON table_name FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Create INSERT policy
CREATE POLICY "users_can_create_own_records"
  ON table_name FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4. Create UPDATE policy (must have both USING and WITH CHECK)
CREATE POLICY "users_can_update_own_records"
  ON table_name FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Create DELETE policy
CREATE POLICY "users_can_delete_own_records"
  ON table_name FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

## Common Mistakes to Avoid

❌ **Bad:** Using `auth.role() = 'authenticated'` (deprecated, breaks with anonymous auth)  
✅ **Good:** Using `TO authenticated` clause instead

❌ **Bad:** UPDATE policy without `WITH CHECK` clause (allows users to reassign ownership)  
✅ **Good:** Include both `USING` and `WITH CHECK` for UPDATE policies

❌ **Bad:** Skipping indexes on frequently queried columns (causes slow queries at scale)  
✅ **Good:** Add B-tree indexes on foreign keys, filter columns, and join predicates

❌ **Bad:** Storing sensitive data in `raw_user_metadata` (user-editable in some auth flows)  
✅ **Good:** Use `raw_app_metadata` or `app_metadata` for authorization data

## Testing Schema Changes

After creating a migration:

```bash
# Run the migration locally
supabase migration list --local

# Query the schema to verify
supabase db query -- "SELECT * FROM information_schema.tables WHERE table_schema='public'"

# Check RLS policies were created
supabase db query -- "SELECT tablename, policyname FROM pg_policies WHERE tablename='your_table'"

# Review indexes
supabase db query -- "SELECT indexname FROM pg_indexes WHERE tablename='your_table'"
```

## Performance Best Practices

1. **Indexes for WHERE clauses** — Add B-tree indexes on columns used in `WHERE` predicates
2. **Indexes for foreign keys** — Supabase doesn't auto-index FK columns; add them explicitly
3. **Partial indexes** — Use `WHERE clause` in index for large tables with frequent filters
4. **EXPLAIN ANALYZE** — Run on slow queries to identify missing indexes or poor query plans
5. **Avoid N+1** — Fetch related data in single query using joins, not separate queries

## Security Checklist

- [ ] **RLS enabled** on all tables in `public` schema
- [ ] **Policies use `TO authenticated`** (not deprecated `auth.role()`)
- [ ] **UPDATE policies include `WITH CHECK`** to prevent privilege escalation
- [ ] **Views use `security_invoker`** (Postgres 15+) if exposing sensitive data
- [ ] **No `SECURITY DEFINER` functions** unless absolutely necessary and audited
- [ ] **Foreign keys use `ON DELETE CASCADE`** appropriately or restrict deletions
- [ ] **No hardcoded sensitive data** in migrations
- [ ] **Run `supabase db advisors`** before committing to catch security issues

## Migration File Naming

Use descriptive names for new migrations:

```
20250101000000_create_todos_table.sql
20250101000001_add_rls_to_todos.sql
20250101000002_create_indexes.sql
20250102000000_add_tags_column.sql
```

Format: `YYYYMMDDHHMMSS_description.sql`
