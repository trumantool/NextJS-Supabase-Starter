-- ============================================================================
-- Slim starter keep-only schema (Phase 1)
-- ============================================================================
-- Consolidated view of supabase/migrations (baseline + later keep-set patches).
-- Apply this file on a NEW empty Supabase project via SQL Editor, or prefer:
--
--   npx supabase db push --linked
--
-- Keep tables:
--   user_data, user_settings, user_roles, admin_settings, app_settings,
--   user_files, todo_list, documents,
--   chats, messages, session_tags, chat_tags,
--   user_agents, agent_templates, agent_skills,
--   automations, automation_runs
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

  -- Folder markers so storage policies can scope {auth.uid()}/…
  INSERT INTO storage.objects (bucket_id, name, owner, metadata)
  VALUES
    ('user-files', NEW.id::text || '/', NEW.id, '{"eTag": true}'),
    ('files', NEW.id::text || '/', NEW.id, '{"eTag": true}'),
    ('agent-skills', NEW.id::text || '/', NEW.id, '{"eTag": true}'),
    ('agent-memory', NEW.id::text || '/', NEW.id, '{"eTag": true}');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- ============================================================================
-- 2. CORE TABLES
-- ============================================================================

CREATE TABLE public.user_roles (
  slug text PRIMARY KEY,
  display_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 100,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_roles IS
  'Simple role catalog. user_data.user_role stores the slug. v1 uses free/admin; BYOK is preferred over platform credits.';

CREATE TABLE public.user_data (
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

CREATE TABLE public.user_settings (
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

CREATE TABLE public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_name text NOT NULL UNIQUE,
  option_value text NOT NULL DEFAULT '',
  option_field_type text NOT NULL DEFAULT 'text',
  option_title text NOT NULL,
  option_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

-- ============================================================================
-- 3. PRODUCT TABLES
-- ============================================================================

CREATE TABLE public.todo_list (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  urgent boolean NOT NULL DEFAULT false,
  description text,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  owner uuid NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE public.user_files (
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

CREATE TABLE public.documents (
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

CREATE TABLE public.agent_skills (
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

CREATE TABLE public.agent_templates (
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

CREATE TABLE public.user_agents (
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

CREATE TABLE public.chats (
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

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  role text NOT NULL
    CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.session_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_tags_user_name_unique UNIQUE (user_id, name)
);

CREATE TABLE public.chat_tags (
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.session_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, tag_id)
);

CREATE TABLE public.automations (
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

CREATE TABLE public.automation_runs (
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
  created_at timestamptz NOT NULL DEFAULT now()
);

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
-- 6. INDEXES
-- ============================================================================

CREATE INDEX idx_user_data_created_at ON public.user_data (created_at DESC);
CREATE INDEX idx_user_data_user_role ON public.user_data (user_role);
CREATE INDEX idx_user_settings_created_at ON public.user_settings (created_at DESC);
CREATE INDEX idx_admin_settings_option_name ON public.admin_settings (option_name);
CREATE INDEX idx_admin_settings_created_at ON public.admin_settings (created_at DESC);
CREATE INDEX idx_user_roles_sort_order ON public.user_roles (sort_order);

CREATE INDEX idx_todo_list_owner ON public.todo_list (owner);
CREATE INDEX idx_user_files_user_id ON public.user_files (user_id);
CREATE INDEX idx_user_files_created_at ON public.user_files (created_at DESC);
CREATE INDEX idx_documents_user_id ON public.documents (user_id);
CREATE INDEX idx_documents_user_updated ON public.documents (user_id, updated_at DESC);

CREATE UNIQUE INDEX agent_skills_skill_url_key ON public.agent_skills (skill_url);
CREATE UNIQUE INDEX agent_skills_personal_name_unique
  ON public.agent_skills (user_id, lower(skill_name))
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX agent_skills_shared_name_unique
  ON public.agent_skills (lower(skill_name))
  WHERE user_id IS NULL;
CREATE INDEX agent_skills_user_created_at_idx
  ON public.agent_skills (user_id, created_at DESC);
CREATE INDEX agent_skills_shared_skill_name_idx
  ON public.agent_skills (skill_name)
  WHERE user_id IS NULL;

CREATE UNIQUE INDEX agent_templates_slug_lower_key ON public.agent_templates (lower(slug));
CREATE INDEX agent_templates_status_created_at_idx ON public.agent_templates (status, created_at DESC);
CREATE INDEX user_agents_user_created_at_idx ON public.user_agents (user_id, created_at DESC);
CREATE INDEX user_agents_source_template_id_idx ON public.user_agents (source_template_id);

CREATE INDEX chats_user_id_idx ON public.chats (user_id);
CREATE INDEX chats_user_updated_idx ON public.chats (user_id, updated_at DESC);
CREATE INDEX chats_agent_id_idx ON public.chats (agent_id);
CREATE INDEX messages_chat_id_idx ON public.messages (chat_id);
CREATE INDEX messages_chat_created_idx ON public.messages (chat_id, created_at);
CREATE INDEX session_tags_user_id_idx ON public.session_tags (user_id);
CREATE INDEX chat_tags_tag_id_idx ON public.chat_tags (tag_id);

CREATE INDEX automations_user_id_idx ON public.automations (user_id);
CREATE INDEX automations_agent_id_idx ON public.automations (agent_id);
CREATE INDEX automations_due_idx ON public.automations (next_run_at) WHERE status = 'active';
CREATE INDEX automation_runs_automation_created_idx ON public.automation_runs (automation_id, created_at DESC);
CREATE INDEX automation_runs_user_id_idx ON public.automation_runs (user_id);
CREATE INDEX automation_runs_queued_idx ON public.automation_runs (created_at) WHERE status = 'queued';
CREATE UNIQUE INDEX automation_runs_inflight_idx
  ON public.automation_runs (automation_id)
  WHERE status IN ('queued', 'running');

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trg_user_data_set_updated_at
BEFORE UPDATE ON public.user_data
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_user_settings_set_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

CREATE TRIGGER trg_user_roles_prevent_system_delete
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_system_role_delete();

CREATE TRIGGER trg_user_roles_prevent_system_slug_change
BEFORE UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_system_role_slug_change();

CREATE TRIGGER trg_admin_settings_set_updated_at
BEFORE UPDATE ON public.admin_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_user_files_set_updated_at
BEFORE UPDATE ON public.user_files
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_documents_set_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_agent_skills_set_updated_at
BEFORE UPDATE ON public.agent_skills
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_agent_templates_set_updated_at
BEFORE UPDATE ON public.agent_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_user_agents_set_updated_at
BEFORE UPDATE ON public.user_agents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_chats_set_updated_at
BEFORE UPDATE ON public.chats
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_automations_set_updated_at
BEFORE UPDATE ON public.automations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

-- user_data
CREATE POLICY "Users can view own data"
ON public.user_data FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own data"
ON public.user_data FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Service role can manage user_data"
ON public.user_data FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- user_settings
CREATE POLICY "Users can view own settings"
ON public.user_settings FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own settings"
ON public.user_settings FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Service role can manage user_settings"
ON public.user_settings FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- user_roles
CREATE POLICY "Authenticated users can read roles"
ON public.user_roles FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (authenticative.is_admin());

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (authenticative.is_admin())
WITH CHECK (authenticative.is_admin());

CREATE POLICY "Admins can delete non-system roles"
ON public.user_roles FOR DELETE TO authenticated
USING (is_system = false AND authenticative.is_admin());

CREATE POLICY "Service role can manage user_roles"
ON public.user_roles FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- admin_settings (public read for site title/legal shortcodes)
CREATE POLICY "Admin settings are readable by anyone"
ON public.admin_settings FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Only admins can manage admin settings"
ON public.admin_settings FOR ALL TO authenticated
USING (authenticative.is_admin())
WITH CHECK (authenticative.is_admin());

CREATE POLICY "Service role can manage admin_settings"
ON public.admin_settings FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- app_settings
CREATE POLICY "app_settings read"
ON public.app_settings FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can insert app_settings"
ON public.app_settings FOR INSERT TO authenticated
WITH CHECK (authenticative.is_admin());

CREATE POLICY "Admins can update app_settings"
ON public.app_settings FOR UPDATE TO authenticated
USING (authenticative.is_admin())
WITH CHECK (authenticative.is_admin());

CREATE POLICY "Admins can delete app_settings"
ON public.app_settings FOR DELETE TO authenticated
USING (authenticative.is_admin());

-- todo_list (MFA-aware)
CREATE POLICY "Owner can do everything"
ON public.todo_list FOR ALL TO authenticated
USING (authenticative.is_user_authenticated() AND owner = (SELECT auth.uid()))
WITH CHECK (authenticative.is_user_authenticated() AND owner = (SELECT auth.uid()));

-- user_files
CREATE POLICY "Users can view own user_files"
ON public.user_files FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own user_files"
ON public.user_files FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own user_files"
ON public.user_files FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own user_files"
ON public.user_files FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Service role can manage user_files"
ON public.user_files FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- documents
CREATE POLICY "document owner read"
ON public.documents FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "document owner write"
ON public.documents FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "document owner update"
ON public.documents FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "document owner delete"
ON public.documents FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- agent_skills
CREATE POLICY "Read own and shared agent_skills"
ON public.agent_skills FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR user_id IS NULL);

CREATE POLICY "Insert own agent_skills"
ON public.agent_skills FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Update own agent_skills"
ON public.agent_skills FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Delete own agent_skills"
ON public.agent_skills FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Admins manage shared agent_skills"
ON public.agent_skills FOR ALL TO authenticated
USING (user_id IS NULL AND authenticative.is_admin())
WITH CHECK (user_id IS NULL AND authenticative.is_admin());

CREATE POLICY "Service role manages agent_skills"
ON public.agent_skills FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- agent_templates
CREATE POLICY "Read published agent_templates"
ON public.agent_templates FOR SELECT TO authenticated
USING (status = 'published');

CREATE POLICY "Admins manage agent_templates"
ON public.agent_templates FOR ALL TO authenticated
USING (authenticative.is_admin())
WITH CHECK (authenticative.is_admin());

CREATE POLICY "Service role manages agent_templates"
ON public.agent_templates FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- user_agents
CREATE POLICY "Users can view own user_agents"
ON public.user_agents FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own user_agents"
ON public.user_agents FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own user_agents"
ON public.user_agents FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own user_agents"
ON public.user_agents FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Service role manages user_agents"
ON public.user_agents FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- chats
CREATE POLICY "Users can view own chats"
ON public.chats FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own chats"
ON public.chats FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own chats"
ON public.chats FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own chats"
ON public.chats FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Service role can manage chats"
ON public.chats FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- messages (via parent chat)
CREATE POLICY "Users can view messages in own chats"
ON public.messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = messages.chat_id
      AND chats.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Users can insert messages in own chats"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = messages.chat_id
      AND chats.user_id = (SELECT auth.uid())
  )
);

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

CREATE POLICY "Users can delete messages in own chats"
ON public.messages FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = messages.chat_id
      AND chats.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Service role can manage messages"
ON public.messages FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- session_tags
CREATE POLICY "Users can view own session tags"
ON public.session_tags FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own session tags"
ON public.session_tags FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own session tags"
ON public.session_tags FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own session tags"
ON public.session_tags FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Service role can manage session tags"
ON public.session_tags FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- chat_tags
CREATE POLICY "Users can view own chat tags"
ON public.chat_tags FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = chat_tags.chat_id
      AND chats.user_id = (SELECT auth.uid())
  )
);

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

CREATE POLICY "Users can delete own chat tags"
ON public.chat_tags FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = chat_tags.chat_id
      AND chats.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Service role can manage chat tags"
ON public.chat_tags FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- automations
CREATE POLICY "Users can view own automations"
ON public.automations FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own automations"
ON public.automations FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own automations"
ON public.automations FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own automations"
ON public.automations FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Service role can manage automations"
ON public.automations FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- automation_runs
CREATE POLICY "Users can view own automation runs"
ON public.automation_runs FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

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

CREATE POLICY "Service role can manage automation runs"
ON public.automation_runs FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ============================================================================
-- 9. GRANTS
-- ============================================================================

GRANT SELECT, UPDATE ON public.user_data TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_data TO service_role;

-- Profile fields are readable/updatable by the owner (RLS). The BYOK key
-- column is service-role only — never granted to authenticated.
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_tags TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_tags TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO service_role;

GRANT SELECT, INSERT ON public.automation_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_runs TO service_role;

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

CREATE POLICY "Authenticated users can read shared agent-skills"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'agent-skills'
  AND authenticative.is_user_authenticated()
  AND (storage.foldername(name))[1] = 'shared'
);

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
  ('admin', 'Admin', 20, true);

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
  ('terms_of_service', '<h1>Terms of Service</h1><p>Welcome to [site_title] ("we", "us", or "our"). By accessing or using our services, you agree to be bound by these Terms of Service.</p>', 'textarea', 'Terms of Service', 'The Terms of Service content shown on the /terms page. Supports shortcodes like [site_title], [company_name], and [support_email].');

INSERT INTO public.app_settings (key, value)
VALUES ('openrouter_model', '"poolside/laguna-s-2.1:free"');
