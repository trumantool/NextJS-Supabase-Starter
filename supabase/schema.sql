-- ============================================================================
-- Slim starter keep-only schema (Phase 1)
-- ============================================================================
-- Consolidated view of supabase/migrations (baseline + later keep-set patches).
-- NEVER apply this file to production project glplvrljdgowcwuubkau.
-- A second SQL Editor paste of this file is safe on a fresh starter project:
-- tables and indexes use IF NOT EXISTS, triggers and policies are dropped
-- first, and seeds use ON CONFLICT DO NOTHING. Fresh-project results are unchanged.
-- Apply this file on a NEW empty Supabase project via SQL Editor, or prefer:
--
--   npx supabase db push --linked
--
-- Keep tables:
--   user_data, user_settings, user_roles, admin_settings, app_settings,
--   user_files, todo_list, documents, posts,
--   chats, messages, session_tags, chat_tags,
--   user_agents, agent_templates, agent_skills,
--   automations, automation_runs,
--   llm_models, llm_turn_rates
--
-- Keep buckets:
--   user-files  — My Files UI ({userId}/…)
--   files       — chat attachments ({userId}/chat-attachments/{chatId}/…)
--   agent-skills — skill markdown (shared/ + per-user)
--   agent-memory — per-user agent memory
--
-- No dedicated documents/resumes storage bucket: document content lives in
-- documents.doc_json.
--
-- Dropped vs the previous dump:
--   resumes (replaced by documents), contact_submissions, text_assessments,
--   text_assessment_answers, and any Composio / SEO / brand tables.
--
-- Chat / agents / automations tables exist for Phases 4–6. They may stay empty.
-- Composio is out of v1: no composio_session_id, integrations, or toolkit seeds.
-- ============================================================================

-- ============================================================================
-- 1. SCHEMA + HELPERS
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS authenticative;

SET check_function_bodies = OFF;

CREATE OR REPLACE FUNCTION authenticative.is_user_authenticated()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ARRAY[(SELECT auth.jwt()->>'aal')] <@ (
    SELECT
      CASE
        WHEN count(id) > 0 THEN ARRAY['aal2']
        ELSE ARRAY['aal1', 'aal2']
      END
    FROM auth.mfa_factors
    WHERE (SELECT auth.uid()) = user_id
      AND status = 'verified'
  );
$$;

-- Body references public.user_data; plpgsql is parsed at call time so this
-- can be created before the table exists.
CREATE OR REPLACE FUNCTION authenticative.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_data
    WHERE user_id = (SELECT auth.uid())
      AND user_role = 'admin'
  );
END;
$$;

REVOKE ALL ON FUNCTION authenticative.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authenticative.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION authenticative.is_admin() TO service_role;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;

-- Seeds required user rows + storage folders for the keep buckets.
-- SECURITY DEFINER: the auth trigger runs as supabase_auth_admin, which cannot
-- INSERT into public profile tables.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_first_name text;
  v_last_name text;
BEGIN
  v_first_name := NEW.raw_user_meta_data->>'first_name';
  v_last_name := NEW.raw_user_meta_data->>'last_name';

  INSERT INTO public.user_data (user_id, first_name, last_name, email, user_role)
  VALUES (NEW.id, v_first_name, v_last_name, NEW.email, 'free');

  INSERT INTO public.user_settings (user_id, first_name, last_name, email)
  VALUES (NEW.id, v_first_name, v_last_name, NEW.email);

  -- Folder markers are best-effort. Their failure must not roll back the profile rows above.
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES
      ('user-files', NEW.id::text || '/', NEW.id, '{"eTag": true}'),
      ('files', NEW.id::text || '/', NEW.id, '{"eTag": true}'),
      ('agent-skills', NEW.id::text || '/', NEW.id, '{"eTag": true}'),
      ('agent-memory', NEW.id::text || '/', NEW.id, '{"eTag": true}');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user storage markers skipped: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- ============================================================================
-- 2. CORE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  slug text PRIMARY KEY,
  display_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 100,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_roles IS
  'Simple role catalog. user_data.user_role stores the slug. v1 uses free/admin; BYOK is preferred over platform credits.';

CREATE TABLE IF NOT EXISTS public.user_data (
  user_id uuid NOT NULL PRIMARY KEY
    REFERENCES auth.users(id) ON DELETE CASCADE,
  user_role text NOT NULL DEFAULT 'free'
    REFERENCES public.user_roles(slug),
  first_name text,
  last_name text,
  email text,
  twitter_url text,
  linkedin_url text,
  github_url text,
  instagram_url text,
  youtube_url text,
  website_url text,
  plan text NOT NULL DEFAULT 'free',
  plan_status text NOT NULL DEFAULT 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  total_input_tokens bigint NOT NULL DEFAULT 0,
  total_output_tokens bigint NOT NULL DEFAULT 0,
  total_tokens bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.user_data.twitter_url IS
  'Optional X/Twitter profile URL.';
COMMENT ON COLUMN public.user_data.linkedin_url IS
  'Optional LinkedIn profile URL.';
COMMENT ON COLUMN public.user_data.github_url IS
  'Optional GitHub profile URL.';
COMMENT ON COLUMN public.user_data.instagram_url IS
  'Optional Instagram profile URL.';
COMMENT ON COLUMN public.user_data.youtube_url IS
  'Optional YouTube channel or video URL.';
COMMENT ON COLUMN public.user_data.website_url IS
  'Optional personal or company website URL.';
COMMENT ON COLUMN public.user_data.plan IS
  'Billing plan slug synced from Stripe. free until a subscription is active.';
COMMENT ON COLUMN public.user_data.plan_status IS
  'Stripe subscription status (inactive, active, trialing, past_due, canceled, …). Read-only in the app.';
COMMENT ON COLUMN public.user_data.stripe_customer_id IS
  'Stripe Customer id. Written by checkout and the webhook.';
COMMENT ON COLUMN public.user_data.stripe_subscription_id IS
  'Stripe Subscription id. Written by the webhook.';
COMMENT ON COLUMN public.user_data.current_period_end IS
  'End of the current Stripe billing period.';
COMMENT ON COLUMN public.user_data.total_input_tokens IS
  'Cumulative prompt tokens. Only record_llm_turn_usage (or service role) may change this.';
COMMENT ON COLUMN public.user_data.total_output_tokens IS
  'Cumulative completion tokens. Only record_llm_turn_usage (or service role) may change this.';
COMMENT ON COLUMN public.user_data.total_tokens IS
  'Cumulative total tokens. Only record_llm_turn_usage (or service role) may change this.';

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid NOT NULL PRIMARY KEY
    REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text,
  openrouter_api_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.user_settings.openrouter_api_key IS
  'Optional user OpenRouter API key (BYOK). Server-only. Never return to the browser after save.';

CREATE TABLE IF NOT EXISTS public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_key text,
  option_name text NOT NULL,
  option_value text NOT NULL DEFAULT '',
  option_field_type text NOT NULL DEFAULT 'text',
  option_title text NOT NULL,
  option_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.admin_settings.app_key IS
  'Deployment scope for a shared database. NULL is the single-app starter (ADMIN_SETTINGS_APP_KEY unset).';

-- Upgrade path for a database created before app_key, and a second paste of
-- this file. NULLS NOT DISTINCT keeps one row per option_name when app_key is NULL.
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS app_key text;

ALTER TABLE public.admin_settings DROP CONSTRAINT IF EXISTS admin_settings_option_name_key;

ALTER TABLE public.admin_settings DROP CONSTRAINT IF EXISTS admin_settings_app_key_option_name_key;

ALTER TABLE public.admin_settings
  ADD CONSTRAINT admin_settings_app_key_option_name_key
  UNIQUE NULLS NOT DISTINCT (app_key, option_name);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

-- ============================================================================
-- 3. PRODUCT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.todo_list (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  urgent boolean NOT NULL DEFAULT false,
  description text,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  owner uuid NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_id uuid NOT NULL,
  file_name text NOT NULL,
  file_description text,
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_files IS
  'Optional metadata for objects in the user-files bucket. file_id is the random id used as the storage object name.';

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Document',
  template text NOT NULL DEFAULT 'classic',
  doc_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text NOT NULL DEFAULT 'poolside/laguna-s-2.1:free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.documents IS
  'TipTap/ProseMirror documents. Content is doc_json in Postgres — no documents storage bucket.';

-- ============================================================================
-- 4. AGENT PLATFORM TABLES (empty until Phases 4–6)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  skill_description text,
  skill_url text NOT NULL,
  source text NOT NULL DEFAULT 'upload'
    CHECK (source IN ('upload', 'github')),
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_skills IS
  'Skill file metadata in the agent-skills bucket. user_id NULL = shared/default. skill_url is the bucket-relative object key.';

CREATE TABLE IF NOT EXISTS public.agent_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
    CHECK (char_length(name) BETWEEN 1 AND 80),
  slug text NOT NULL
    CHECK (char_length(slug) BETWEEN 2 AND 64)
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text
    CHECK (char_length(coalesce(description, '')) <= 2000),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  system_prompt text NOT NULL DEFAULT ''
    CHECK (char_length(system_prompt) <= 8000),
  skill_ids uuid[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(skill_ids) <= 8),
  required_toolkits text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(required_toolkits) <= 16),
  mcp_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  cloned_from_template_id uuid REFERENCES public.agent_templates(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.agent_templates.required_toolkits IS
  'Reserved for a future generic-tools stub. v1 does not use Composio; leave empty.';

CREATE TABLE IF NOT EXISTS public.user_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL
    CHECK (char_length(name) BETWEEN 1 AND 80),
  source_template_id uuid REFERENCES public.agent_templates(id) ON DELETE SET NULL,
  source_template_name text NOT NULL DEFAULT ''
    CHECK (char_length(source_template_name) <= 80),
  system_prompt text NOT NULL DEFAULT ''
    CHECK (char_length(system_prompt) <= 8000),
  skill_ids uuid[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(skill_ids) <= 8),
  required_toolkits text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(required_toolkits) <= 16),
  mcp_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  model_id text NOT NULL DEFAULT 'poolside/laguna-s-2.1:free',
  agent_id uuid REFERENCES public.user_agents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.chats.agent_id IS
  'Optional user_agents.id. NULL = general chat. Deleting the agent cascades these threads.';

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  role text NOT NULL
    CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_tokens bigint,
  output_tokens bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.messages.input_tokens IS
  'Prompt tokens for this turn. Set by record_llm_turn_usage.';
COMMENT ON COLUMN public.messages.output_tokens IS
  'Completion tokens for this turn. Set by record_llm_turn_usage.';

CREATE TABLE IF NOT EXISTS public.session_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_tags_user_name_unique UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS public.chat_tags (
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.session_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  prompt text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused')),
  frequency text NOT NULL
    CHECK (frequency IN ('once', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly')),
  timezone text NOT NULL,
  local_time time NOT NULL,
  weekday smallint CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6),
  monthday smallint CHECK (monthday IS NULL OR monthday BETWEEN 1 AND 31),
  month smallint CHECK (month IS NULL OR month BETWEEN 1 AND 12),
  once_on date,
  next_run_at timestamptz,
  allow_mutations boolean NOT NULL DEFAULT false,
  model_id text NOT NULL DEFAULT 'poolside/laguna-s-2.1:free',
  skill_ids uuid[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(skill_ids) <= 8),
  agent_id uuid REFERENCES public.user_agents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.automations IS
  'Scheduled OpenRouter + skills jobs. No Composio integrations column.';

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger text NOT NULL
    CHECK (trigger IN ('schedule', 'manual')),
  status text NOT NULL
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'skipped')),
  error text,
  output text,
  started_at timestamptz,
  finished_at timestamptz,
  input_tokens bigint,
  output_tokens bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.automation_runs.input_tokens IS
  'Prompt tokens for this run. Set by record_llm_turn_usage.';
COMMENT ON COLUMN public.automation_runs.output_tokens IS
  'Completion tokens for this run. Set by record_llm_turn_usage.';


-- ============================================================================
-- 4b. POSTS, MODEL CATALOG, TURN RATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.llm_models (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  provider text,
  prompt_price numeric,
  completion_price numeric,
  total_input_tokens bigint NOT NULL DEFAULT 0,
  total_output_tokens bigint NOT NULL DEFAULT 0,
  total_tokens bigint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.llm_models IS
  'OpenRouter model catalog. record_llm_turn_usage does not insert missing models. Empty catalog still increments user_data totals and skips aggregates and llm_turn_rates.';
COMMENT ON COLUMN public.llm_models.prompt_price IS
  'USD per 1M prompt tokens, snapshotted onto llm_turn_rates.';
COMMENT ON COLUMN public.llm_models.completion_price IS
  'USD per 1M completion tokens, snapshotted onto llm_turn_rates.';

CREATE OR REPLACE VIEW public.llm_models_picker
WITH (security_invoker = true) AS
SELECT id, display_name, provider, is_active
FROM public.llm_models
WHERE is_active;

COMMENT ON VIEW public.llm_models_picker IS
  'Active models for pickers. Prices and token aggregates stay on llm_models.';

CREATE TABLE IF NOT EXISTS public.llm_turn_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id text NOT NULL REFERENCES public.llm_models(id) ON DELETE RESTRICT,
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  automation_run_id uuid REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  prompt_price numeric,
  completion_price numeric,
  markup numeric NOT NULL DEFAULT 0,
  provider text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT llm_turn_rates_one_parent CHECK (
    num_nonnulls(message_id, automation_run_id) = 1
  )
);

COMMENT ON TABLE public.llm_turn_rates IS
  'Price snapshot for one recorded turn. Parent is a chat message or an automation run.';

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website text NOT NULL,
  type text NOT NULL,
  parent_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  summary text,
  body text,
  body_doc jsonb,
  video_url text,
  cover_image_url text,
  sort_order integer,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  origin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT posts_type_check CHECK (
    type IN ('course', 'lesson', 'blog')
  ),
  CONSTRAINT posts_title_length_check CHECK (
    char_length(btrim(title)) BETWEEN 1 AND 200
  ),
  CONSTRAINT posts_slug_format_check CHECK (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  CONSTRAINT posts_slug_length_check CHECK (
    char_length(slug) BETWEEN 2 AND 80
  ),
  CONSTRAINT posts_status_check CHECK (
    status IN ('draft', 'published')
  ),
  CONSTRAINT posts_parent_by_type_check CHECK (
    (type = 'lesson' AND parent_id IS NOT NULL)
    OR (type IN ('course', 'blog') AND parent_id IS NULL)
  ),
  CONSTRAINT posts_origin_owner_check CHECK (
    (type = 'blog' AND origin IS NULL)
    OR (
      type IN ('course', 'lesson')
      AND (
        (author_id IS NULL AND origin IS NULL)
        OR (author_id IS NOT NULL AND origin IN ('ai', 'user', 'fork'))
      )
    )
  ),
  CONSTRAINT posts_website_check CHECK (
    website IN ('edu', 'marketing-agent', 'afterallcare')
  )
);

COMMENT ON TABLE public.posts IS
  'Shared posts table. Blog rows are type blog, parent_id null, origin null. A published blog is publicly readable only after published_at.';

COMMENT ON COLUMN public.posts.website IS
  'Site that owns the post. Allowed values: edu, marketing-agent, afterallcare. No column default; the deploying app sets POSTS_WEBSITE.';

-- ============================================================================
-- 5. AUTOMATION WORKER HELPERS (Phase 6; service_role only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_automation_run(
  p_automation_id uuid,
  p_trigger text,
  p_next_run_at timestamptz,
  p_new_status text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_next timestamptz;
  v_user_id uuid;
  v_run_id uuid;
  v_inflight integer;
BEGIN
  IF COALESCE(auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF p_trigger IS DISTINCT FROM 'schedule' THEN
    RAISE EXCEPTION 'invalid trigger';
  END IF;

  IF p_new_status IS NULL OR p_new_status NOT IN ('active', 'paused') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  SELECT a.status, a.next_run_at, a.user_id
  INTO v_status, v_next, v_user_id
  FROM public.automations a
  WHERE a.id = p_automation_id
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_status IS DISTINCT FROM 'active' OR v_next IS NULL OR v_next > now() THEN
    RETURN NULL;
  END IF;

  SELECT count(*)::integer INTO v_inflight
  FROM public.automation_runs
  WHERE automation_id = p_automation_id
    AND status IN ('queued', 'running');

  IF v_inflight > 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.automation_runs (automation_id, user_id, trigger, status)
  VALUES (p_automation_id, v_user_id, 'schedule', 'queued')
  RETURNING id INTO v_run_id;

  UPDATE public.automations
  SET
    status = p_new_status,
    next_run_at = CASE WHEN p_new_status = 'paused' THEN NULL ELSE p_next_run_at END,
    updated_at = now()
  WHERE id = p_automation_id;

  RETURN v_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_automation_run(uuid, text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_automation_run(uuid, text, timestamptz, text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_queued_automation_runs(p_limit integer DEFAULT 5)
RETURNS SETOF public.automation_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer;
BEGIN
  IF COALESCE(auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 5), 5));

  RETURN QUERY
  UPDATE public.automation_runs u
  SET status = 'running',
      started_at = now()
  WHERE u.id IN (
    SELECT r.id
    FROM public.automation_runs r
    WHERE r.status = 'queued'
      AND (
        SELECT count(*)
        FROM public.automation_runs r2
        WHERE r2.user_id = r.user_id
          AND r2.status = 'running'
      ) < 2
    ORDER BY r.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  )
  RETURNING u.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_queued_automation_runs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_queued_automation_runs(integer) TO service_role;

-- ============================================================================
-- 5b. TOKEN LEDGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_user_data_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Service role (Stripe webhook, admin client) may write billing and totals.
  IF COALESCE((SELECT auth.jwt() ->> 'role'), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- record_llm_turn_usage sets this for the current transaction only.
  IF current_setting('app.allow_token_update', true) IS DISTINCT FROM 'on' THEN
    NEW.total_input_tokens := OLD.total_input_tokens;
    NEW.total_output_tokens := OLD.total_output_tokens;
    NEW.total_tokens := OLD.total_tokens;
  END IF;

  NEW.plan := OLD.plan;
  NEW.plan_status := OLD.plan_status;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  NEW.current_period_end := OLD.current_period_end;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_user_data_privileged_columns() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_message_token_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF COALESCE((SELECT auth.jwt() ->> 'role'), '') = 'service_role'
     OR current_setting('app.allow_token_update', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.input_tokens := OLD.input_tokens;
    NEW.output_tokens := OLD.output_tokens;
  ELSE
    NEW.input_tokens := NULL;
    NEW.output_tokens := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_message_token_columns() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_llm_models_aggregates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF COALESCE((SELECT auth.jwt() ->> 'role'), '') = 'service_role'
     OR current_setting('app.allow_token_update', true) = 'on' THEN
    RETURN NEW;
  END IF;

  NEW.total_input_tokens := OLD.total_input_tokens;
  NEW.total_output_tokens := OLD.total_output_tokens;
  NEW.total_tokens := OLD.total_tokens;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_llm_models_aggregates() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- record_llm_turn_usage — 10 args, no course_post_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_llm_turn_usage(
  p_user_id uuid,
  p_model_id text,
  p_input_tokens bigint,
  p_output_tokens bigint,
  p_message_id uuid,
  p_automation_run_id uuid,
  p_prompt_price numeric,
  p_completion_price numeric,
  p_markup numeric,
  p_provider text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_uid uuid;
  v_owner uuid;
  v_model_id text;
  v_prompt numeric;
  v_completion numeric;
  v_markup numeric;
  v_provider text;
  v_total bigint;
  v_markup_text text;
BEGIN
  v_role := COALESCE((SELECT auth.jwt() ->> 'role'), '');
  v_uid := (SELECT auth.uid());
  v_model_id := NULLIF(btrim(COALESCE(p_model_id, '')), '');

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user id required';
  END IF;

  IF p_input_tokens IS NULL OR p_input_tokens < 0
     OR p_output_tokens IS NULL OR p_output_tokens < 0 THEN
    RAISE EXCEPTION 'token counts must be zero or positive';
  END IF;

  IF num_nonnulls(p_message_id, p_automation_run_id) <> 1 THEN
    RAISE EXCEPTION 'exactly one of message_id or automation_run_id is required';
  END IF;

  IF p_message_id IS NOT NULL THEN
    SELECT c.user_id
    INTO v_owner
    FROM public.messages m
    JOIN public.chats c ON c.id = m.chat_id
    WHERE m.id = p_message_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'message not found';
    END IF;
  ELSE
    SELECT r.user_id
    INTO v_owner
    FROM public.automation_runs r
    WHERE r.id = p_automation_run_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'automation run not found';
    END IF;
  END IF;

  IF v_owner IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'user does not own this turn';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role'
     AND (v_uid IS NULL OR v_uid IS DISTINCT FROM p_user_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  v_total := p_input_tokens + p_output_tokens;

  PERFORM set_config('app.allow_token_update', 'on', true);

  UPDATE public.user_data
  SET
    total_input_tokens = total_input_tokens + p_input_tokens,
    total_output_tokens = total_output_tokens + p_output_tokens,
    total_tokens = total_tokens + v_total
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_data row missing';
  END IF;

  IF p_message_id IS NOT NULL THEN
    UPDATE public.messages
    SET input_tokens = p_input_tokens,
        output_tokens = p_output_tokens
    WHERE id = p_message_id;
  ELSE
    UPDATE public.automation_runs
    SET input_tokens = p_input_tokens,
        output_tokens = p_output_tokens
    WHERE id = p_automation_run_id;
  END IF;

  -- Missing catalog row: user totals and the parent token columns already moved.
  -- Do not invent a model row, and do not write llm_turn_rates.
  IF v_model_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.llm_models WHERE id = v_model_id
  ) THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(p_prompt_price, prompt_price),
    COALESCE(p_completion_price, completion_price),
    COALESCE(NULLIF(btrim(COALESCE(p_provider, '')), ''), provider)
  INTO v_prompt, v_completion, v_provider
  FROM public.llm_models
  WHERE id = v_model_id;

  UPDATE public.llm_models
  SET
    total_input_tokens = total_input_tokens + p_input_tokens,
    total_output_tokens = total_output_tokens + p_output_tokens,
    total_tokens = total_tokens + v_total
  WHERE id = v_model_id;

  IF p_markup IS NULL THEN
    -- NULL app_key is the unset ADMIN_SETTINGS_APP_KEY scope. A clone that sets
    -- a key passes p_markup from the app so this fallback does not read another row.
    SELECT option_value
    INTO v_markup_text
    FROM public.admin_settings
    WHERE option_name = 'openrouter_cost_markup'
      AND app_key IS NULL;

    IF v_markup_text IS NOT NULL AND btrim(v_markup_text) ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
      v_markup := btrim(v_markup_text)::numeric;
    ELSE
      v_markup := 0;
    END IF;
  ELSE
    v_markup := p_markup;
  END IF;

  INSERT INTO public.llm_turn_rates (
    user_id,
    model_id,
    message_id,
    automation_run_id,
    input_tokens,
    output_tokens,
    prompt_price,
    completion_price,
    markup,
    provider
  ) VALUES (
    p_user_id,
    v_model_id,
    p_message_id,
    p_automation_run_id,
    p_input_tokens,
    p_output_tokens,
    v_prompt,
    v_completion,
    COALESCE(v_markup, 0),
    v_provider
  );
END;
$$;

COMMENT ON FUNCTION public.record_llm_turn_usage(
  uuid, text, bigint, bigint, uuid, uuid, numeric, numeric, numeric, text
) IS
  'Record one LLM turn. 10 arguments. No course_post_id. Always bumps user_data totals. Updates llm_models and inserts llm_turn_rates only when the model id is already in the catalog.';

REVOKE EXECUTE ON FUNCTION public.record_llm_turn_usage(
  uuid, text, bigint, bigint, uuid, uuid, numeric, numeric, numeric, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_llm_turn_usage(
  uuid, text, bigint, bigint, uuid, uuid, numeric, numeric, numeric, text
) TO authenticated, service_role;

-- ============================================================================
-- 6. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_data_created_at ON public.user_data (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_data_user_role ON public.user_data (user_role);
CREATE INDEX IF NOT EXISTS idx_user_settings_created_at ON public.user_settings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_settings_option_name ON public.admin_settings (option_name);
CREATE INDEX IF NOT EXISTS idx_admin_settings_app_key ON public.admin_settings (app_key);
CREATE INDEX IF NOT EXISTS idx_admin_settings_created_at ON public.admin_settings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_sort_order ON public.user_roles (sort_order);

CREATE INDEX IF NOT EXISTS idx_todo_list_owner ON public.todo_list (owner);
CREATE INDEX IF NOT EXISTS idx_user_files_user_id ON public.user_files (user_id);
CREATE INDEX IF NOT EXISTS idx_user_files_created_at ON public.user_files (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents (user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_updated ON public.documents (user_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS agent_skills_skill_url_key ON public.agent_skills (skill_url);
CREATE UNIQUE INDEX IF NOT EXISTS agent_skills_personal_name_unique
  ON public.agent_skills (user_id, lower(skill_name))
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS agent_skills_shared_name_unique
  ON public.agent_skills (lower(skill_name))
  WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS agent_skills_user_created_at_idx
  ON public.agent_skills (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_skills_shared_skill_name_idx
  ON public.agent_skills (skill_name)
  WHERE user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS agent_templates_slug_lower_key ON public.agent_templates (lower(slug));
CREATE INDEX IF NOT EXISTS agent_templates_status_created_at_idx ON public.agent_templates (status, created_at DESC);
CREATE INDEX IF NOT EXISTS user_agents_user_created_at_idx ON public.user_agents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_agents_source_template_id_idx ON public.user_agents (source_template_id);

CREATE INDEX IF NOT EXISTS chats_user_id_idx ON public.chats (user_id);
CREATE INDEX IF NOT EXISTS chats_user_updated_idx ON public.chats (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS chats_agent_id_idx ON public.chats (agent_id);
CREATE INDEX IF NOT EXISTS messages_chat_id_idx ON public.messages (chat_id);
CREATE INDEX IF NOT EXISTS messages_chat_created_idx ON public.messages (chat_id, created_at);
CREATE INDEX IF NOT EXISTS session_tags_user_id_idx ON public.session_tags (user_id);
CREATE INDEX IF NOT EXISTS chat_tags_tag_id_idx ON public.chat_tags (tag_id);

CREATE INDEX IF NOT EXISTS automations_user_id_idx ON public.automations (user_id);
CREATE INDEX IF NOT EXISTS automations_agent_id_idx ON public.automations (agent_id);
CREATE INDEX IF NOT EXISTS automations_due_idx ON public.automations (next_run_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS automation_runs_automation_created_idx ON public.automation_runs (automation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS automation_runs_user_id_idx ON public.automation_runs (user_id);
CREATE INDEX IF NOT EXISTS automation_runs_queued_idx ON public.automation_runs (created_at) WHERE status = 'queued';
CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_inflight_idx
  ON public.automation_runs (automation_id)
  WHERE status IN ('queued', 'running');


CREATE UNIQUE INDEX IF NOT EXISTS user_data_stripe_customer_id_idx
  ON public.user_data (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_data_stripe_subscription_id_idx
  ON public.user_data (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS llm_turn_rates_user_id_idx ON public.llm_turn_rates (user_id);
CREATE INDEX IF NOT EXISTS llm_turn_rates_message_id_idx ON public.llm_turn_rates (message_id);
CREATE INDEX IF NOT EXISTS llm_turn_rates_automation_run_id_idx ON public.llm_turn_rates (automation_run_id);
CREATE INDEX IF NOT EXISTS llm_turn_rates_model_id_idx ON public.llm_turn_rates (model_id);

CREATE INDEX IF NOT EXISTS posts_author_id_idx ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS posts_parent_id_idx ON public.posts (parent_id);
CREATE INDEX IF NOT EXISTS posts_status_published_idx
  ON public.posts (sort_order, published_at DESC)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS posts_website_type_status_idx
  ON public.posts (website, type, status);

CREATE UNIQUE INDEX IF NOT EXISTS posts_root_type_slug_key
  ON public.posts (type, slug)
  WHERE parent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS posts_lesson_parent_slug_key
  ON public.posts (parent_id, slug)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS posts_blog_public_idx
  ON public.posts (website, published_at DESC)
  WHERE type = 'blog' AND status = 'published';

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trg_user_data_set_updated_at ON public.user_data;
CREATE TRIGGER trg_user_data_set_updated_at
BEFORE UPDATE ON public.user_data
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_settings_set_updated_at ON public.user_settings;
CREATE TRIGGER trg_user_settings_set_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_roles_set_updated_at ON public.user_roles;
CREATE TRIGGER trg_user_roles_set_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_system_role_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.is_system THEN
    RAISE EXCEPTION 'System role "%" cannot be deleted', OLD.slug;
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_system_role_slug_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.is_system AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'System role slug cannot be changed';
  END IF;
  IF OLD.is_system AND NEW.is_system IS DISTINCT FROM OLD.is_system THEN
    RAISE EXCEPTION 'System role flag cannot be cleared';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_system_role_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_system_role_slug_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_system_role_delete() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prevent_system_role_slug_change() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_user_roles_prevent_system_delete ON public.user_roles;
CREATE TRIGGER trg_user_roles_prevent_system_delete
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_system_role_delete();

DROP TRIGGER IF EXISTS trg_user_roles_prevent_system_slug_change ON public.user_roles;
CREATE TRIGGER trg_user_roles_prevent_system_slug_change
BEFORE UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_system_role_slug_change();

DROP TRIGGER IF EXISTS trg_admin_settings_set_updated_at ON public.admin_settings;
CREATE TRIGGER trg_admin_settings_set_updated_at
BEFORE UPDATE ON public.admin_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_files_set_updated_at ON public.user_files;
CREATE TRIGGER trg_user_files_set_updated_at
BEFORE UPDATE ON public.user_files
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_documents_set_updated_at ON public.documents;
CREATE TRIGGER trg_documents_set_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_agent_skills_set_updated_at ON public.agent_skills;
CREATE TRIGGER trg_agent_skills_set_updated_at
BEFORE UPDATE ON public.agent_skills
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_agent_templates_set_updated_at ON public.agent_templates;
CREATE TRIGGER trg_agent_templates_set_updated_at
BEFORE UPDATE ON public.agent_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_agents_set_updated_at ON public.user_agents;
CREATE TRIGGER trg_user_agents_set_updated_at
BEFORE UPDATE ON public.user_agents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_chats_set_updated_at ON public.chats;
CREATE TRIGGER trg_chats_set_updated_at
BEFORE UPDATE ON public.chats
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_automations_set_updated_at ON public.automations;
CREATE TRIGGER trg_automations_set_updated_at
BEFORE UPDATE ON public.automations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS trg_user_data_protect_privileged ON public.user_data;
CREATE TRIGGER trg_user_data_protect_privileged
BEFORE UPDATE ON public.user_data
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_data_privileged_columns();

DROP TRIGGER IF EXISTS trg_messages_protect_token_columns ON public.messages;
CREATE TRIGGER trg_messages_protect_token_columns
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.protect_message_token_columns();

DROP TRIGGER IF EXISTS trg_llm_models_set_updated_at ON public.llm_models;
CREATE TRIGGER trg_llm_models_set_updated_at
BEFORE UPDATE ON public.llm_models
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_llm_models_protect_aggregates ON public.llm_models;
CREATE TRIGGER trg_llm_models_protect_aggregates
BEFORE UPDATE ON public.llm_models
FOR EACH ROW
EXECUTE FUNCTION public.protect_llm_models_aggregates();

DROP TRIGGER IF EXISTS trg_posts_set_updated_at ON public.posts;
CREATE TRIGGER trg_posts_set_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_turn_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- user_data
DROP POLICY IF EXISTS "Users can view own data" ON public.user_data;
CREATE POLICY "Users can view own data"
ON public.user_data FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own data" ON public.user_data;
CREATE POLICY "Users can update own data"
ON public.user_data FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage user_data" ON public.user_data;
CREATE POLICY "Service role can manage user_data"
ON public.user_data FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- user_settings
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings"
ON public.user_settings FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
ON public.user_settings FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage user_settings" ON public.user_settings;
CREATE POLICY "Service role can manage user_settings"
ON public.user_settings FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- user_roles
DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.user_roles;
CREATE POLICY "Authenticated users can read roles"
ON public.user_roles FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (authenticative.is_admin());

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (authenticative.is_admin())
WITH CHECK (authenticative.is_admin());

DROP POLICY IF EXISTS "Admins can delete non-system roles" ON public.user_roles;
CREATE POLICY "Admins can delete non-system roles"
ON public.user_roles FOR DELETE TO authenticated
USING (is_system = false AND authenticative.is_admin());

DROP POLICY IF EXISTS "Service role can manage user_roles" ON public.user_roles;
CREATE POLICY "Service role can manage user_roles"
ON public.user_roles FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- admin_settings
-- Non-secret, non-password rows stay public (site title, contact info,
-- privacy and terms, login_redirect_url, markup flag, and similar).
-- secret and password rows are hidden from anon and authenticated SELECT.
-- admin_settings_select_public does not call is_admin() or any SECURITY DEFINER.
-- There is no admin_settings_select_admin policy: authenticated SELECT must
-- not return secret or password values. The admin UI reads those rows with
-- the service role after an application is_admin check, then blanks them.
DROP POLICY IF EXISTS "Admin settings are readable by anyone" ON public.admin_settings;
DROP POLICY IF EXISTS "Public can read non-secret admin settings" ON public.admin_settings;
DROP POLICY IF EXISTS admin_settings_select_public ON public.admin_settings;
DROP POLICY IF EXISTS admin_settings_select_admin ON public.admin_settings;

CREATE POLICY admin_settings_select_public
ON public.admin_settings FOR SELECT TO anon, authenticated
USING (
  option_field_type IS DISTINCT FROM 'secret'
  AND option_field_type IS DISTINCT FROM 'password'
);

DROP POLICY IF EXISTS "Admins can insert admin settings" ON public.admin_settings;
CREATE POLICY "Admins can insert admin settings"
ON public.admin_settings FOR INSERT TO authenticated
WITH CHECK (
  authenticative.is_admin()
  AND option_field_type IS DISTINCT FROM 'secret'
  AND option_field_type IS DISTINCT FROM 'password'
);

DROP POLICY IF EXISTS "Admins can update admin settings" ON public.admin_settings;
CREATE POLICY "Admins can update admin settings"
ON public.admin_settings FOR UPDATE TO authenticated
USING (
  authenticative.is_admin()
  AND option_field_type IS DISTINCT FROM 'secret'
  AND option_field_type IS DISTINCT FROM 'password'
)
WITH CHECK (
  authenticative.is_admin()
  AND option_field_type IS DISTINCT FROM 'secret'
  AND option_field_type IS DISTINCT FROM 'password'
);

DROP POLICY IF EXISTS "Admins can delete admin settings" ON public.admin_settings;
CREATE POLICY "Admins can delete admin settings"
ON public.admin_settings FOR DELETE TO authenticated
USING (
  authenticative.is_admin()
  AND option_field_type IS DISTINCT FROM 'secret'
  AND option_field_type IS DISTINCT FROM 'password'
);

DROP POLICY IF EXISTS "Service role can manage admin_settings" ON public.admin_settings;
CREATE POLICY "Service role can manage admin_settings"
ON public.admin_settings FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- app_settings
DROP POLICY IF EXISTS "app_settings read" ON public.app_settings;
CREATE POLICY "app_settings read"
ON public.app_settings FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert app_settings" ON public.app_settings;
CREATE POLICY "Admins can insert app_settings"
ON public.app_settings FOR INSERT TO authenticated
WITH CHECK (authenticative.is_admin());

DROP POLICY IF EXISTS "Admins can update app_settings" ON public.app_settings;
CREATE POLICY "Admins can update app_settings"
ON public.app_settings FOR UPDATE TO authenticated
USING (authenticative.is_admin())
WITH CHECK (authenticative.is_admin());

DROP POLICY IF EXISTS "Admins can delete app_settings" ON public.app_settings;
CREATE POLICY "Admins can delete app_settings"
ON public.app_settings FOR DELETE TO authenticated
USING (authenticative.is_admin());

-- todo_list (MFA-aware)
DROP POLICY IF EXISTS "Owner can do everything" ON public.todo_list;
CREATE POLICY "Owner can do everything"
ON public.todo_list FOR ALL TO authenticated
USING (authenticative.is_user_authenticated() AND owner = (SELECT auth.uid()))
WITH CHECK (authenticative.is_user_authenticated() AND owner = (SELECT auth.uid()));

-- user_files
DROP POLICY IF EXISTS "Users can view own user_files" ON public.user_files;
CREATE POLICY "Users can view own user_files"
ON public.user_files FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own user_files" ON public.user_files;
CREATE POLICY "Users can insert own user_files"
ON public.user_files FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own user_files" ON public.user_files;
CREATE POLICY "Users can update own user_files"
ON public.user_files FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own user_files" ON public.user_files;
CREATE POLICY "Users can delete own user_files"
ON public.user_files FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage user_files" ON public.user_files;
CREATE POLICY "Service role can manage user_files"
ON public.user_files FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- documents
DROP POLICY IF EXISTS "document owner read" ON public.documents;
CREATE POLICY "document owner read"
ON public.documents FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "document owner write" ON public.documents;
CREATE POLICY "document owner write"
ON public.documents FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "document owner update" ON public.documents;
CREATE POLICY "document owner update"
ON public.documents FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "document owner delete" ON public.documents;
CREATE POLICY "document owner delete"
ON public.documents FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- agent_skills
DROP POLICY IF EXISTS "Read own and shared agent_skills" ON public.agent_skills;
CREATE POLICY "Read own and shared agent_skills"
ON public.agent_skills FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR user_id IS NULL);

DROP POLICY IF EXISTS "Insert own agent_skills" ON public.agent_skills;
CREATE POLICY "Insert own agent_skills"
ON public.agent_skills FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Update own agent_skills" ON public.agent_skills;
CREATE POLICY "Update own agent_skills"
ON public.agent_skills FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Delete own agent_skills" ON public.agent_skills;
CREATE POLICY "Delete own agent_skills"
ON public.agent_skills FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins manage shared agent_skills" ON public.agent_skills;
CREATE POLICY "Admins manage shared agent_skills"
ON public.agent_skills FOR ALL TO authenticated
USING (user_id IS NULL AND authenticative.is_admin())
WITH CHECK (user_id IS NULL AND authenticative.is_admin());

DROP POLICY IF EXISTS "Service role manages agent_skills" ON public.agent_skills;
CREATE POLICY "Service role manages agent_skills"
ON public.agent_skills FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- agent_templates
DROP POLICY IF EXISTS "Read published agent_templates" ON public.agent_templates;
CREATE POLICY "Read published agent_templates"
ON public.agent_templates FOR SELECT TO authenticated
USING (status = 'published');

DROP POLICY IF EXISTS "Admins manage agent_templates" ON public.agent_templates;
CREATE POLICY "Admins manage agent_templates"
ON public.agent_templates FOR ALL TO authenticated
USING (authenticative.is_admin())
WITH CHECK (authenticative.is_admin());

DROP POLICY IF EXISTS "Service role manages agent_templates" ON public.agent_templates;
CREATE POLICY "Service role manages agent_templates"
ON public.agent_templates FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- user_agents
DROP POLICY IF EXISTS "Users can view own user_agents" ON public.user_agents;
CREATE POLICY "Users can view own user_agents"
ON public.user_agents FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own user_agents" ON public.user_agents;
CREATE POLICY "Users can insert own user_agents"
ON public.user_agents FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own user_agents" ON public.user_agents;
CREATE POLICY "Users can update own user_agents"
ON public.user_agents FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own user_agents" ON public.user_agents;
CREATE POLICY "Users can delete own user_agents"
ON public.user_agents FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Service role manages user_agents" ON public.user_agents;
CREATE POLICY "Service role manages user_agents"
ON public.user_agents FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- chats
DROP POLICY IF EXISTS "Users can view own chats" ON public.chats;
CREATE POLICY "Users can view own chats"
ON public.chats FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own chats" ON public.chats;
CREATE POLICY "Users can insert own chats"
ON public.chats FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own chats" ON public.chats;
CREATE POLICY "Users can update own chats"
ON public.chats FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own chats" ON public.chats;
CREATE POLICY "Users can delete own chats"
ON public.chats FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage chats" ON public.chats;
CREATE POLICY "Service role can manage chats"
ON public.chats FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- messages (via parent chat)
DROP POLICY IF EXISTS "Users can view messages in own chats" ON public.messages;
CREATE POLICY "Users can view messages in own chats"
ON public.messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = messages.chat_id
      AND chats.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can insert messages in own chats" ON public.messages;
CREATE POLICY "Users can insert messages in own chats"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = messages.chat_id
      AND chats.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update messages in own chats" ON public.messages;
CREATE POLICY "Users can update messages in own chats"
ON public.messages FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = messages.chat_id
      AND chats.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = messages.chat_id
      AND chats.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can delete messages in own chats" ON public.messages;
CREATE POLICY "Users can delete messages in own chats"
ON public.messages FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = messages.chat_id
      AND chats.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Service role can manage messages" ON public.messages;
CREATE POLICY "Service role can manage messages"
ON public.messages FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- session_tags
DROP POLICY IF EXISTS "Users can view own session tags" ON public.session_tags;
CREATE POLICY "Users can view own session tags"
ON public.session_tags FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own session tags" ON public.session_tags;
CREATE POLICY "Users can insert own session tags"
ON public.session_tags FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own session tags" ON public.session_tags;
CREATE POLICY "Users can update own session tags"
ON public.session_tags FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own session tags" ON public.session_tags;
CREATE POLICY "Users can delete own session tags"
ON public.session_tags FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage session tags" ON public.session_tags;
CREATE POLICY "Service role can manage session tags"
ON public.session_tags FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- chat_tags
DROP POLICY IF EXISTS "Users can view own chat tags" ON public.chat_tags;
CREATE POLICY "Users can view own chat tags"
ON public.chat_tags FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = chat_tags.chat_id
      AND chats.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can insert own chat tags" ON public.chat_tags;
CREATE POLICY "Users can insert own chat tags"
ON public.chat_tags FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = chat_tags.chat_id
      AND chats.user_id = (SELECT auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.session_tags
    WHERE session_tags.id = chat_tags.tag_id
      AND session_tags.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can delete own chat tags" ON public.chat_tags;
CREATE POLICY "Users can delete own chat tags"
ON public.chat_tags FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = chat_tags.chat_id
      AND chats.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Service role can manage chat tags" ON public.chat_tags;
CREATE POLICY "Service role can manage chat tags"
ON public.chat_tags FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- automations
DROP POLICY IF EXISTS "Users can view own automations" ON public.automations;
CREATE POLICY "Users can view own automations"
ON public.automations FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own automations" ON public.automations;
CREATE POLICY "Users can insert own automations"
ON public.automations FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own automations" ON public.automations;
CREATE POLICY "Users can update own automations"
ON public.automations FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own automations" ON public.automations;
CREATE POLICY "Users can delete own automations"
ON public.automations FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage automations" ON public.automations;
CREATE POLICY "Service role can manage automations"
ON public.automations FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- automation_runs
DROP POLICY IF EXISTS "Users can view own automation runs" ON public.automation_runs;
CREATE POLICY "Users can view own automation runs"
ON public.automation_runs FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own automation runs" ON public.automation_runs;
CREATE POLICY "Users can insert own automation runs"
ON public.automation_runs FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND status = 'queued'
  AND EXISTS (
    SELECT 1 FROM public.automations a
    WHERE a.id = automation_id
      AND a.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Service role can manage automation runs" ON public.automation_runs;
CREATE POLICY "Service role can manage automation runs"
ON public.automation_runs FOR ALL TO service_role
USING (true) WITH CHECK (true);


-- llm_models
DROP POLICY IF EXISTS "Authenticated can read llm_models" ON public.llm_models;
CREATE POLICY "Authenticated can read llm_models"
ON public.llm_models FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can manage llm_models" ON public.llm_models;
CREATE POLICY "Admins can manage llm_models"
ON public.llm_models FOR ALL TO authenticated
USING (authenticative.is_admin())
WITH CHECK (authenticative.is_admin());

DROP POLICY IF EXISTS "Service role can manage llm_models" ON public.llm_models;
CREATE POLICY "Service role can manage llm_models"
ON public.llm_models FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- llm_turn_rates
DROP POLICY IF EXISTS "Users can view own turn rates" ON public.llm_turn_rates;
CREATE POLICY "Users can view own turn rates"
ON public.llm_turn_rates FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage turn rates" ON public.llm_turn_rates;
CREATE POLICY "Service role can manage turn rates"
ON public.llm_turn_rates FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- posts
-- No website literal: a fresh starter database is not the shared project.
DROP POLICY IF EXISTS "Anyone can read published posts" ON public.posts;
DROP POLICY IF EXISTS posts_select_published_blog ON public.posts;
CREATE POLICY posts_select_published_blog
ON public.posts
FOR SELECT
TO anon, authenticated
USING (
  type = 'blog'
  AND status = 'published'
  AND published_at IS NOT NULL
  AND published_at <= now()
);

DROP POLICY IF EXISTS "Authors can read own posts" ON public.posts;
CREATE POLICY "Authors can read own posts"
ON public.posts FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = author_id);

DROP POLICY IF EXISTS "Admins can read all posts" ON public.posts;
CREATE POLICY "Admins can read all posts"
ON public.posts FOR SELECT TO authenticated
USING (authenticative.is_admin());

DROP POLICY IF EXISTS "Authors can insert own posts" ON public.posts;
CREATE POLICY "Authors can insert own posts"
ON public.posts FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = author_id);

DROP POLICY IF EXISTS "Authors can update own posts" ON public.posts;
CREATE POLICY "Authors can update own posts"
ON public.posts FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = author_id)
WITH CHECK ((SELECT auth.uid()) = author_id);

DROP POLICY IF EXISTS "Authors can delete own posts" ON public.posts;
CREATE POLICY "Authors can delete own posts"
ON public.posts FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = author_id);

DROP POLICY IF EXISTS "Admins can manage posts" ON public.posts;
CREATE POLICY "Admins can manage posts"
ON public.posts FOR ALL TO authenticated
USING (authenticative.is_admin())
WITH CHECK (authenticative.is_admin());

DROP POLICY IF EXISTS "Service role can manage posts" ON public.posts;
CREATE POLICY "Service role can manage posts"
ON public.posts FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ============================================================================
-- 9. GRANTS
-- ============================================================================

-- A column REVOKE does not remove a table-level UPDATE grant (including grants
-- applied by default privileges at CREATE TABLE). Drop table UPDATE, then grant
-- only the columns authenticated may write. Billing and token totals stay with
-- service_role and record_llm_turn_usage.
REVOKE UPDATE ON public.user_data FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_data TO authenticated;
GRANT UPDATE (
  user_id,
  user_role,
  first_name,
  last_name,
  email,
  twitter_url,
  linkedin_url,
  github_url,
  instagram_url,
  youtube_url,
  website_url,
  created_at,
  updated_at
) ON public.user_data TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_data TO service_role;

-- Profile fields are readable/updatable by the owner (RLS). The BYOK key
-- column is service-role only — never granted to authenticated.
REVOKE SELECT, UPDATE ON public.user_settings FROM authenticated;
GRANT SELECT (user_id, first_name, last_name, email, created_at, updated_at)
  ON public.user_settings TO authenticated;
GRANT UPDATE (first_name, last_name, email, updated_at)
  ON public.user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO service_role;

GRANT SELECT ON public.admin_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings TO service_role;

GRANT SELECT ON public.app_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.todo_list TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todo_list TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.todo_list_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.todo_list_id_seq TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_files TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_skills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_skills TO service_role;

REVOKE ALL ON public.agent_templates FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_templates TO authenticated;
GRANT ALL ON public.agent_templates TO service_role;

REVOKE ALL ON public.user_agents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_agents TO authenticated;
GRANT ALL ON public.user_agents TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO service_role;

-- Token columns are omitted. Drop any table-level INSERT/UPDATE first (a column
-- REVOKE does not remove them), then grant only the non-token columns.
GRANT SELECT, DELETE ON public.messages TO authenticated;
REVOKE INSERT, UPDATE ON public.messages FROM PUBLIC, anon, authenticated;
GRANT INSERT (
  id,
  chat_id,
  role,
  content,
  created_at
) ON public.messages TO authenticated;
GRANT UPDATE (
  id,
  chat_id,
  role,
  content,
  created_at
) ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_tags TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_tags TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO service_role;

GRANT SELECT, INSERT ON public.automation_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_runs TO service_role;


GRANT SELECT, INSERT, UPDATE, DELETE ON public.llm_models TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.llm_models TO service_role;

GRANT SELECT ON public.llm_models_picker TO authenticated, service_role;

GRANT SELECT ON public.llm_turn_rates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.llm_turn_rates TO service_role;

GRANT SELECT ON public.posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO service_role;

-- ============================================================================
-- 10. STORAGE BUCKETS + POLICIES
-- ============================================================================
-- Choice: four private buckets.
--   user-files  — My Files ({userId}/…)
--   files       — chat attachments ({userId}/chat-attachments/{chatId}/…)
--   agent-skills — shared/ + per-user skill markdown
--   agent-memory — per-user agent memory
-- No documents/resumes bucket (content in documents.doc_json).

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('user-files', 'user-files', false),
  ('files', 'files', false),
  ('agent-skills', 'agent-skills', false),
  ('agent-memory', 'agent-memory', false)
ON CONFLICT (id) DO NOTHING;

-- Shared folder marker for default/admin skills
INSERT INTO storage.objects (bucket_id, name, owner, metadata)
SELECT 'agent-skills', 'shared/', NULL, '{"eTag": true}'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.objects
  WHERE bucket_id = 'agent-skills' AND name = 'shared/'
);

DROP POLICY IF EXISTS "user-files owner objects" ON storage.objects;
CREATE POLICY "user-files owner objects"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'user-files'
  AND authenticative.is_user_authenticated()
  AND name ~ ('^' || (SELECT auth.uid())::text || '/')
)
WITH CHECK (
  bucket_id = 'user-files'
  AND authenticative.is_user_authenticated()
  AND name ~ ('^' || (SELECT auth.uid())::text || '/')
);

DROP POLICY IF EXISTS "files owner objects" ON storage.objects;
CREATE POLICY "files owner objects"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'files'
  AND authenticative.is_user_authenticated()
  AND name ~ ('^' || (SELECT auth.uid())::text || '/')
)
WITH CHECK (
  bucket_id = 'files'
  AND authenticative.is_user_authenticated()
  AND name ~ ('^' || (SELECT auth.uid())::text || '/')
);

DROP POLICY IF EXISTS "agent-skills owner objects" ON storage.objects;
CREATE POLICY "agent-skills owner objects"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'agent-skills'
  AND authenticative.is_user_authenticated()
  AND name ~ ('^' || (SELECT auth.uid())::text || '/')
)
WITH CHECK (
  bucket_id = 'agent-skills'
  AND authenticative.is_user_authenticated()
  AND name ~ ('^' || (SELECT auth.uid())::text || '/')
);

DROP POLICY IF EXISTS "Authenticated users can read shared agent-skills" ON storage.objects;
CREATE POLICY "Authenticated users can read shared agent-skills"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'agent-skills'
  AND authenticative.is_user_authenticated()
  AND (storage.foldername(name))[1] = 'shared'
);

DROP POLICY IF EXISTS "Admins can write shared agent-skills" ON storage.objects;
CREATE POLICY "Admins can write shared agent-skills"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'agent-skills'
  AND authenticative.is_user_authenticated()
  AND (storage.foldername(name))[1] = 'shared'
  AND authenticative.is_admin()
)
WITH CHECK (
  bucket_id = 'agent-skills'
  AND authenticative.is_user_authenticated()
  AND (storage.foldername(name))[1] = 'shared'
  AND authenticative.is_admin()
);

DROP POLICY IF EXISTS "agent-memory owner objects" ON storage.objects;
CREATE POLICY "agent-memory owner objects"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'agent-memory'
  AND authenticative.is_user_authenticated()
  AND name ~ ('^' || (SELECT auth.uid())::text || '/')
)
WITH CHECK (
  bucket_id = 'agent-memory'
  AND authenticative.is_user_authenticated()
  AND name ~ ('^' || (SELECT auth.uid())::text || '/')
);

-- ============================================================================
-- 11. SEED
-- ============================================================================

INSERT INTO public.user_roles (slug, display_name, sort_order, is_system)
VALUES
  ('free', 'Free', 10, true),
  ('admin', 'Admin', 20, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.admin_settings (option_name, option_value, option_field_type, option_title, option_description)
VALUES
  ('site_title', 'Starter', 'text', 'Site Title', 'The name of your site shown in the browser tab and header.'),
  ('site_tagline', 'A Next.js + Supabase starter', 'text', 'Site Tagline', 'A short tagline shown on the homepage.'),
  ('support_email', 'support@example.com', 'text', 'Support Email', 'The email address used for support inquiries.'),
  ('company_name', 'Starter', 'text', 'Company Name', 'The legal company name. Available as the [company_name] shortcode.'),
  ('contact_address', '', 'text', 'Contact Address', 'Available as the [contact_address] shortcode.'),
  ('support_hours', '', 'text', 'Support Hours', 'Available as the [support_hours] shortcode.'),
  ('phone_number', '', 'text', 'Phone Number', 'Available as the [phone_number] shortcode.'),
  ('privacy_policy', '<h1>Privacy Policy</h1><p>This Privacy Policy explains how [site_title] ("we", "us", or "our") collects, uses, discloses, and safeguards your information when you use our services.</p>', 'textarea', 'Privacy Policy', 'The privacy policy content shown on the /privacy page. Supports shortcodes like [site_title], [company_name], and [support_email].'),
  ('terms_of_service', '<h1>Terms of Service</h1><p>Welcome to [site_title] ("we", "us", or "our"). By accessing or using our services, you agree to be bound by these Terms of Service.</p>', 'textarea', 'Terms of Service', 'The Terms of Service content shown on the /terms page. Supports shortcodes like [site_title], [company_name], and [support_email].')
ON CONFLICT (app_key, option_name) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES ('openrouter_model', '"poolside/laguna-s-2.1:free"')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.admin_settings (
  option_name,
  option_value,
  option_field_type,
  option_title,
  option_description
)
VALUES
  (
    'openrouter_api_key',
    '',
    'secret',
    'OpenRouter API key',
    'Platform OpenRouter key. Leave empty to use the OPENROUTER_API_KEY environment variable. Never commit a real key.'
  ),
  (
    'openrouter_force_platform_key',
    'false',
    'boolean',
    'Force platform OpenRouter key',
    'When true, ignore per-user BYOK keys and use the platform key (admin setting, then OPENROUTER_API_KEY).'
  ),
  (
    'openrouter_cost_markup',
    '0',
    'text',
    'OpenRouter cost markup',
    'Markup stored on llm_turn_rates when a turn is recorded. 0 means no markup. Not a secret.'
  )
ON CONFLICT (app_key, option_name) DO NOTHING;

-- ============================================================================
-- 12. BLOG TAXONOMY AND AUTHORS
-- Mirrored from migrations/20261009140200_blog_taxonomy_and_authors.sql.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.blog_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    website text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT blog_categories_website_check
        CHECK (website = ANY (ARRAY['edu', 'marketing-agent', 'afterallcare'])),
    CONSTRAINT blog_categories_slug_check
        CHECK (char_length(slug) BETWEEN 2 AND 80 AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT blog_categories_name_check
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
    CONSTRAINT blog_categories_website_slug_key UNIQUE (website, slug)
);

CREATE TABLE IF NOT EXISTS public.blog_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    website text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT blog_tags_website_check
        CHECK (website = ANY (ARRAY['edu', 'marketing-agent', 'afterallcare'])),
    CONSTRAINT blog_tags_slug_check
        CHECK (char_length(slug) BETWEEN 2 AND 80 AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT blog_tags_name_check
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
    CONSTRAINT blog_tags_website_slug_key UNIQUE (website, slug)
);

CREATE TABLE IF NOT EXISTS public.post_categories (
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES public.blog_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, category_id)
);

CREATE TABLE IF NOT EXISTS public.post_tags (
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.blog_author_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    website text NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slug text NOT NULL,
    display_name text NOT NULL,
    bio text,
    avatar_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT blog_author_profiles_website_check
        CHECK (website = ANY (ARRAY['edu', 'marketing-agent', 'afterallcare'])),
    CONSTRAINT blog_author_profiles_slug_check
        CHECK (char_length(slug) BETWEEN 2 AND 80 AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT blog_author_profiles_name_check
        CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
    CONSTRAINT blog_author_profiles_website_user_key UNIQUE (website, user_id),
    CONSTRAINT blog_author_profiles_website_slug_key UNIQUE (website, slug)
);

ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_author_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.blog_categories FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.blog_tags FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.post_categories FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.post_tags FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.blog_author_profiles FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.blog_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.blog_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_categories TO service_role;

GRANT SELECT ON TABLE public.blog_tags TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.blog_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_tags TO service_role;

GRANT SELECT ON TABLE public.post_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.post_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.post_categories TO service_role;

GRANT SELECT ON TABLE public.post_tags TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.post_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.post_tags TO service_role;

GRANT SELECT ON TABLE public.blog_author_profiles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.blog_author_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_author_profiles TO service_role;

DROP POLICY IF EXISTS blog_categories_select ON public.blog_categories;
CREATE POLICY blog_categories_select
ON public.blog_categories
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS blog_categories_write ON public.blog_categories;
CREATE POLICY blog_categories_write
ON public.blog_categories
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL OR authenticative.is_admin())
WITH CHECK ((SELECT auth.uid()) IS NOT NULL OR authenticative.is_admin());

DROP POLICY IF EXISTS blog_tags_select ON public.blog_tags;
CREATE POLICY blog_tags_select
ON public.blog_tags
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS blog_tags_write ON public.blog_tags;
CREATE POLICY blog_tags_write
ON public.blog_tags
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL OR authenticative.is_admin())
WITH CHECK ((SELECT auth.uid()) IS NOT NULL OR authenticative.is_admin());

DROP POLICY IF EXISTS post_categories_select ON public.post_categories;
CREATE POLICY post_categories_select
ON public.post_categories
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND (
            (
                p.type = 'blog'
                AND p.status = 'published'
                AND p.published_at IS NOT NULL
                AND p.published_at <= now()
            )
            OR p.author_id = (SELECT auth.uid())
            OR authenticative.is_admin()
          )
    )
);

DROP POLICY IF EXISTS post_categories_write ON public.post_categories;
CREATE POLICY post_categories_write
ON public.post_categories
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND p.type = 'blog'
          AND (p.author_id = (SELECT auth.uid()) OR authenticative.is_admin())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND p.type = 'blog'
          AND (p.author_id = (SELECT auth.uid()) OR authenticative.is_admin())
    )
);

DROP POLICY IF EXISTS post_tags_select ON public.post_tags;
CREATE POLICY post_tags_select
ON public.post_tags
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND (
            (
                p.type = 'blog'
                AND p.status = 'published'
                AND p.published_at IS NOT NULL
                AND p.published_at <= now()
            )
            OR p.author_id = (SELECT auth.uid())
            OR authenticative.is_admin()
          )
    )
);

DROP POLICY IF EXISTS post_tags_write ON public.post_tags;
CREATE POLICY post_tags_write
ON public.post_tags
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND p.type = 'blog'
          AND (p.author_id = (SELECT auth.uid()) OR authenticative.is_admin())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND p.type = 'blog'
          AND (p.author_id = (SELECT auth.uid()) OR authenticative.is_admin())
    )
);

DROP POLICY IF EXISTS blog_author_profiles_select ON public.blog_author_profiles;
CREATE POLICY blog_author_profiles_select
ON public.blog_author_profiles
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS blog_author_profiles_insert ON public.blog_author_profiles;
CREATE POLICY blog_author_profiles_insert
ON public.blog_author_profiles
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    OR authenticative.is_admin()
);

DROP POLICY IF EXISTS blog_author_profiles_update ON public.blog_author_profiles;
CREATE POLICY blog_author_profiles_update
ON public.blog_author_profiles
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()) OR authenticative.is_admin())
WITH CHECK (user_id = (SELECT auth.uid()) OR authenticative.is_admin());

DROP POLICY IF EXISTS blog_author_profiles_delete ON public.blog_author_profiles;
CREATE POLICY blog_author_profiles_delete
ON public.blog_author_profiles
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()) OR authenticative.is_admin());

DROP TRIGGER IF EXISTS trg_blog_author_profiles_set_updated_at ON public.blog_author_profiles;
CREATE TRIGGER trg_blog_author_profiles_set_updated_at
BEFORE UPDATE ON public.blog_author_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 13. BLOG REVISIONS
-- Fresh starter databases only. NEVER apply to glplvrljdgowcwuubkau.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.blog_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    editor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    title text NOT NULL,
    slug text NOT NULL,
    summary text,
    body text,
    body_doc jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_revisions_post_created_idx
    ON public.blog_revisions (post_id, created_at DESC);

ALTER TABLE public.blog_revisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.blog_revisions FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.blog_revisions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_revisions TO service_role;

DROP POLICY IF EXISTS blog_revisions_select ON public.blog_revisions;
CREATE POLICY blog_revisions_select
ON public.blog_revisions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND (p.author_id = (SELECT auth.uid()) OR authenticative.is_admin())
    )
);

DROP POLICY IF EXISTS blog_revisions_insert ON public.blog_revisions;
CREATE POLICY blog_revisions_insert
ON public.blog_revisions
FOR INSERT
TO authenticated
WITH CHECK (
    editor_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND p.type = 'blog'
          AND p.author_id = (SELECT auth.uid())
    )
);

-- =============================================================================
-- 14. BLOG MEDIA
-- Fresh starter databases only. NEVER apply to glplvrljdgowcwuubkau.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'blog-media',
    'blog-media',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.blog_media (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    website text NOT NULL,
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
    path text NOT NULL,
    public_url text NOT NULL,
    mime text NOT NULL,
    byte_size integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT blog_media_website_check
        CHECK (website = ANY (ARRAY['edu', 'marketing-agent', 'afterallcare'])),
    CONSTRAINT blog_media_mime_check
        CHECK (mime = ANY (ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])),
    CONSTRAINT blog_media_size_check
        CHECK (byte_size > 0 AND byte_size <= 5242880),
    CONSTRAINT blog_media_path_key UNIQUE (path)
);

ALTER TABLE public.blog_media ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.blog_media FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.blog_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_media TO service_role;

DROP POLICY IF EXISTS blog_media_owner_select ON public.blog_media;
CREATE POLICY blog_media_owner_select
ON public.blog_media
FOR SELECT
TO authenticated
USING (owner_id = (SELECT auth.uid()) OR authenticative.is_admin());

DROP POLICY IF EXISTS blog_media_owner_insert ON public.blog_media;
CREATE POLICY blog_media_owner_insert
ON public.blog_media
FOR INSERT
TO authenticated
WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS blog_media_public_read ON storage.objects;
CREATE POLICY blog_media_public_read
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'blog-media');

DROP POLICY IF EXISTS blog_media_owner_write ON storage.objects;
CREATE POLICY blog_media_owner_write
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'blog-media'
    AND (storage.foldername(name))[1] IN ('edu', 'marketing-agent', 'afterallcare')
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS blog_media_owner_update ON storage.objects;
CREATE POLICY blog_media_owner_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'blog-media'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
)
WITH CHECK (
    bucket_id = 'blog-media'
    AND (storage.foldername(name))[1] IN ('edu', 'marketing-agent', 'afterallcare')
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS blog_media_owner_delete ON storage.objects;
CREATE POLICY blog_media_owner_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'blog-media'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
);

-- ============================================================================
-- 15. BLOG COMMENTS
-- Mirrored from migrations/20261009140500_blog_comments.sql.
-- Fresh starter databases only. NEVER apply to production project glplvrljdgowcwuubkau.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.blog_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT blog_comments_body_check
        CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
    CONSTRAINT blog_comments_status_check
        CHECK (status = ANY (ARRAY['pending', 'visible', 'hidden']))
);

ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.blog_comments FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.blog_comments TO anon, authenticated;
GRANT INSERT ON TABLE public.blog_comments TO authenticated;
GRANT UPDATE (status) ON TABLE public.blog_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_comments TO service_role;

DROP POLICY IF EXISTS blog_comments_public_select ON public.blog_comments;
CREATE POLICY blog_comments_public_select
ON public.blog_comments
FOR SELECT
TO anon, authenticated
USING (
    status = 'visible'
    AND EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND p.type = 'blog'
          AND p.status = 'published'
          AND p.published_at IS NOT NULL
          AND p.published_at <= now()
    )
);

DROP POLICY IF EXISTS blog_comments_author_select ON public.blog_comments;
CREATE POLICY blog_comments_author_select
ON public.blog_comments
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS blog_comments_admin_select ON public.blog_comments;
CREATE POLICY blog_comments_admin_select
ON public.blog_comments
FOR SELECT
TO authenticated
USING (authenticative.is_admin());

DROP POLICY IF EXISTS blog_comments_insert ON public.blog_comments;
CREATE POLICY blog_comments_insert
ON public.blog_comments
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'pending'
    AND EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND p.type = 'blog'
          AND p.status = 'published'
          AND p.published_at IS NOT NULL
          AND p.published_at <= now()
    )
);

DROP POLICY IF EXISTS blog_comments_admin_update ON public.blog_comments;
CREATE POLICY blog_comments_admin_update
ON public.blog_comments
FOR UPDATE
TO authenticated
USING (authenticative.is_admin())
WITH CHECK (
    authenticative.is_admin()
    AND status = ANY (ARRAY['pending', 'visible', 'hidden'])
);

-- ============================================================================
-- 16. NEWSLETTER SUBSCRIBERS
-- Mirrored from migrations/20261009140600_newsletter_subscribers.sql.
-- Fresh starter databases only. NEVER apply to production project glplvrljdgowcwuubkau.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    website text NOT NULL,
    email text NOT NULL,
    status text NOT NULL DEFAULT 'confirmed',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT newsletter_subscribers_website_check
        CHECK (website = ANY (ARRAY['edu', 'marketing-agent', 'afterallcare'])),
    CONSTRAINT newsletter_subscribers_email_check
        CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT newsletter_subscribers_status_check
        CHECK (status = ANY (ARRAY['confirmed', 'unsubscribed'])),
    CONSTRAINT newsletter_subscribers_website_email_key UNIQUE (website, email)
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.newsletter_subscribers FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.newsletter_subscribers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.newsletter_subscribers TO service_role;

DROP POLICY IF EXISTS newsletter_subscribers_admin_select ON public.newsletter_subscribers;
CREATE POLICY newsletter_subscribers_admin_select
ON public.newsletter_subscribers
FOR SELECT
TO authenticated
USING (authenticative.is_admin());
