-- Scope admin_settings per deployment and hide password rows from anon SELECT.
-- Later than 20261010120000 so a YouTube-key seed that still uses
-- ON CONFLICT (option_name) can run first, while option_name is still unique.
-- NEVER apply this file to hosted projects cyczlgdaocwueaacqxsh or glplvrljdgowcwuubkau.
--
-- Additive on existing data: new column app_key is NULL. NULL is the single-app
-- starter scope (ADMIN_SETTINGS_APP_KEY unset). Uniqueness becomes
-- (app_key, option_name) NULLS NOT DISTINCT, so one NULL-key row per option_name.
--
-- admin_settings_select_public is TO anon, authenticated and does not call
-- is_admin() or any SECURITY DEFINER function. There is no
-- admin_settings_select_admin policy: authenticated SELECT must not return
-- secret or password values. Admins read those rows with the service role.
--
-- record_llm_turn_usage is replaced so its markup fallback reads only the
-- NULL app_key row. EXECUTE is revoked from PUBLIC, anon, and authenticated,
-- then granted back to authenticated and service_role (the roles that call it).

ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS app_key text;

COMMENT ON COLUMN public.admin_settings.app_key IS
  'Deployment scope for a shared database. NULL is the single-app starter (ADMIN_SETTINGS_APP_KEY unset).';

ALTER TABLE public.admin_settings DROP CONSTRAINT IF EXISTS admin_settings_option_name_key;

ALTER TABLE public.admin_settings DROP CONSTRAINT IF EXISTS admin_settings_app_key_option_name_key;

ALTER TABLE public.admin_settings
  ADD CONSTRAINT admin_settings_app_key_option_name_key
  UNIQUE NULLS NOT DISTINCT (app_key, option_name);

CREATE INDEX IF NOT EXISTS idx_admin_settings_app_key ON public.admin_settings (app_key);

-- Public SELECT does not call is_admin(). Write policies are authenticated-only.
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
