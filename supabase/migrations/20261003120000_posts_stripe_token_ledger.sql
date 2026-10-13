-- Posts, Stripe billing columns, and the shared OpenRouter token ledger.
-- NEVER apply this file to production project glplvrljdgowcwuubkau.
-- It has not been applied there. The Stripe and token-ledger half would run
-- against live objects. A fresh starter database is the only target.
-- Seeds empty admin_settings rows only. No secret values. No course_post_id.

-- ============================================================================
-- user_data: plan, Stripe, token totals
-- ============================================================================

ALTER TABLE public.user_data
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS total_input_tokens bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_output_tokens bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_tokens bigint NOT NULL DEFAULT 0;

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

CREATE UNIQUE INDEX IF NOT EXISTS user_data_stripe_customer_id_idx
  ON public.user_data (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_data_stripe_subscription_id_idx
  ON public.user_data (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- A column REVOKE does not remove a table-level UPDATE grant. Drop table
-- UPDATE, then grant only the columns authenticated may write.
REVOKE UPDATE ON public.user_data FROM PUBLIC, anon, authenticated;
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

-- ============================================================================
-- Turn token columns
-- ============================================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS input_tokens bigint,
  ADD COLUMN IF NOT EXISTS output_tokens bigint;

COMMENT ON COLUMN public.messages.input_tokens IS
  'Prompt tokens for this turn. Set by record_llm_turn_usage.';
COMMENT ON COLUMN public.messages.output_tokens IS
  'Completion tokens for this turn. Set by record_llm_turn_usage.';

-- Table-level INSERT/UPDATE would still allow token columns. Replace them
-- with column lists, and freeze the token columns in a trigger.
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

DROP TRIGGER IF EXISTS trg_messages_protect_token_columns ON public.messages;
CREATE TRIGGER trg_messages_protect_token_columns
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.protect_message_token_columns();

ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS input_tokens bigint,
  ADD COLUMN IF NOT EXISTS output_tokens bigint;

COMMENT ON COLUMN public.automation_runs.input_tokens IS
  'Prompt tokens for this run. Set by record_llm_turn_usage.';
COMMENT ON COLUMN public.automation_runs.output_tokens IS
  'Completion tokens for this run. Set by record_llm_turn_usage.';

-- ============================================================================
-- Privileged-column guards
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

DROP TRIGGER IF EXISTS trg_user_data_protect_privileged ON public.user_data;
CREATE TRIGGER trg_user_data_protect_privileged
BEFORE UPDATE ON public.user_data
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_data_privileged_columns();

REVOKE ALL ON FUNCTION public.protect_user_data_privileged_columns() FROM PUBLIC, anon, authenticated;

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
-- llm_models + picker view + llm_turn_rates
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
  'Price snapshot for one recorded turn. Parent is a chat message or an automation run. No course post.';

CREATE INDEX IF NOT EXISTS llm_turn_rates_user_id_idx ON public.llm_turn_rates (user_id);
CREATE INDEX IF NOT EXISTS llm_turn_rates_message_id_idx ON public.llm_turn_rates (message_id);
CREATE INDEX IF NOT EXISTS llm_turn_rates_automation_run_id_idx ON public.llm_turn_rates (automation_run_id);
CREATE INDEX IF NOT EXISTS llm_turn_rates_model_id_idx ON public.llm_turn_rates (model_id);

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
    SELECT option_value
    INTO v_markup_text
    FROM public.admin_settings
    WHERE option_name = 'openrouter_cost_markup';

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
-- posts
-- Fresh starter databases only. NEVER apply this section, or this file, to
-- production project glplvrljdgowcwuubkau. The shape matches the live posts
-- contract (checks, root slug uniqueness, nullable author). It does not add
-- the live hierarchy triggers. Those already exist on prod and must not be
-- replayed from here.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website text NOT NULL,
  type text NOT NULL,
  parent_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  summary text,
  body text,
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

DROP TRIGGER IF EXISTS trg_posts_set_updated_at ON public.posts;
CREATE TRIGGER trg_posts_set_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.llm_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_turn_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Users can view own turn rates" ON public.llm_turn_rates;
CREATE POLICY "Users can view own turn rates"
ON public.llm_turn_rates FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage turn rates" ON public.llm_turn_rates;
CREATE POLICY "Service role can manage turn rates"
ON public.llm_turn_rates FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Replaces the old "any published row" policy. No website literal: a fresh
-- starter database is not the shared project. The app filters by POSTS_WEBSITE.
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.llm_models TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.llm_models TO service_role;

GRANT SELECT ON public.llm_models_picker TO authenticated, service_role;

GRANT SELECT ON public.llm_turn_rates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.llm_turn_rates TO service_role;

GRANT SELECT ON public.posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO service_role;

-- ============================================================================
-- Hide secret admin settings from anon and authenticated SELECT
-- ============================================================================

DROP POLICY IF EXISTS "Admin settings are readable by anyone" ON public.admin_settings;
DROP POLICY IF EXISTS "Public can read non-secret admin settings" ON public.admin_settings;

CREATE POLICY "Public can read non-secret admin settings"
ON public.admin_settings FOR SELECT TO anon, authenticated
USING (option_field_type IS DISTINCT FROM 'secret');

-- FOR ALL included SELECT, which would show secret rows to admins.
DROP POLICY IF EXISTS "Only admins can manage admin settings" ON public.admin_settings;

DROP POLICY IF EXISTS "Admins can insert admin settings" ON public.admin_settings;
CREATE POLICY "Admins can insert admin settings"
ON public.admin_settings FOR INSERT TO authenticated
WITH CHECK (authenticative.is_admin());

DROP POLICY IF EXISTS "Admins can update admin settings" ON public.admin_settings;
CREATE POLICY "Admins can update admin settings"
ON public.admin_settings FOR UPDATE TO authenticated
USING (authenticative.is_admin())
WITH CHECK (authenticative.is_admin());

DROP POLICY IF EXISTS "Admins can delete admin settings" ON public.admin_settings;
CREATE POLICY "Admins can delete admin settings"
ON public.admin_settings FOR DELETE TO authenticated
USING (authenticative.is_admin());

-- Secret writes go through the service role after an admin check. Authenticated
-- UPDATE of a secret row does not apply, because no SELECT policy exposes it.

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
ON CONFLICT (option_name) DO NOTHING;

-- Profile inserts must survive a storage.objects failure. The baseline
-- function caught every error and still returned NEW, which committed the
-- auth user with no user_data row.
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

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
