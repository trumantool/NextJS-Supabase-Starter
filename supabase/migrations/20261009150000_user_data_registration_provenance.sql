-- Registration provenance on public.user_data.
-- Schema files only: this migration is not applied to a live database by this change.
--
-- Runs after 20261003120000, which replaces handle_new_user. This definition
-- keeps that storage-marker exception and stamps application_name / website.
--
-- user_data.website is the site stamped at signup. It is not user_data.website_url
-- (social profile) and it is not an OAuth/canonical site_url admin option.
-- Editing the admin_settings rows below does not rewrite existing user_data rows.

ALTER TABLE public.user_data
  ADD COLUMN IF NOT EXISTS application_name text;

ALTER TABLE public.user_data
  ADD COLUMN IF NOT EXISTS website text;

COMMENT ON COLUMN public.user_data.application_name IS
  'Registration provenance: app name copied from admin_settings.application_name at signup. Fallback boilerplate. Admin edits do not rewrite this value.';
COMMENT ON COLUMN public.user_data.website IS
  'Registration provenance website copied from admin_settings.website at signup. Fallback nexjsboilerplate.com. Not website_url, and not an OAuth or canonical site URL. Admin edits do not rewrite this value.';

-- Preserve updated_at. The set_updated_at trigger would otherwise stamp every
-- backfilled row as changed.
ALTER TABLE public.user_data DISABLE TRIGGER trg_user_data_set_updated_at;

UPDATE public.user_data
SET
  application_name = CASE
    WHEN application_name IS NULL OR btrim(application_name) = '' THEN 'boilerplate'
    ELSE application_name
  END,
  website = CASE
    WHEN website IS NULL OR btrim(website) = '' THEN 'nexjsboilerplate.com'
    ELSE website
  END
WHERE application_name IS NULL
   OR btrim(application_name) = ''
   OR website IS NULL
   OR btrim(website) = '';

ALTER TABLE public.user_data ENABLE TRIGGER trg_user_data_set_updated_at;

ALTER TABLE public.user_data
  ALTER COLUMN application_name SET DEFAULT 'boilerplate';

ALTER TABLE public.user_data
  ALTER COLUMN website SET DEFAULT 'nexjsboilerplate.com';

-- Same body as supabase/schema.sql handle_new_user().
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_first_name text;
  v_last_name text;
  v_application_name text;
  v_website text;
BEGIN
  v_first_name := NEW.raw_user_meta_data->>'first_name';
  v_last_name := NEW.raw_user_meta_data->>'last_name';

  -- Missing rows and blank values fall back to the starter defaults.
  -- SELECT INTO with no match assigns NULL, so COALESCE runs after the lookup.
  SELECT NULLIF(btrim(option_value), '')
  INTO v_application_name
  FROM public.admin_settings
  WHERE option_name = 'application_name';

  SELECT NULLIF(btrim(option_value), '')
  INTO v_website
  FROM public.admin_settings
  WHERE option_name = 'website';

  v_application_name := COALESCE(v_application_name, 'boilerplate');
  v_website := COALESCE(v_website, 'nexjsboilerplate.com');

  INSERT INTO public.user_data (
    user_id,
    first_name,
    last_name,
    email,
    user_role,
    application_name,
    website
  )
  VALUES (
    NEW.id,
    v_first_name,
    v_last_name,
    NEW.email,
    'free',
    v_application_name,
    v_website
  );

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
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- Same privilege shape as schema.sql. Revoke first, then restore the roles
-- that RLS or the app actually call. handle_new_user stays trigger-only.
REVOKE EXECUTE ON FUNCTION authenticative.is_user_authenticated() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION authenticative.is_user_authenticated() TO authenticated;
GRANT EXECUTE ON FUNCTION authenticative.is_user_authenticated() TO service_role;

REVOKE ALL ON FUNCTION authenticative.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION authenticative.is_admin() FROM PUBLIC, anon, authenticated;
-- Public post_categories and post_tags policies are TO anon and call this.
GRANT EXECUTE ON FUNCTION authenticative.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION authenticative.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION authenticative.is_admin() TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_automation_run(uuid, text, timestamptz, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_automation_run(uuid, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_automation_run(uuid, text, timestamptz, text) TO service_role;

REVOKE ALL ON FUNCTION public.claim_queued_automation_runs(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_queued_automation_runs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_queued_automation_runs(integer) TO service_role;

REVOKE ALL ON FUNCTION public.record_llm_turn_usage(
  uuid, text, bigint, bigint, uuid, uuid, numeric, numeric, numeric, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_llm_turn_usage(
  uuid, text, bigint, bigint, uuid, uuid, numeric, numeric, numeric, text
) TO authenticated, service_role;

INSERT INTO public.admin_settings (option_name, option_value, option_field_type, option_title, option_description)
VALUES
  (
    'application_name',
    'boilerplate',
    'text',
    'Application Name',
    'Stamped onto user_data.application_name for new signups. Changing this does not rewrite existing users. If this value is blank, signup falls back to boilerplate.'
  ),
  (
    'website',
    'nexjsboilerplate.com',
    'text',
    'Registration Website',
    'Stamped onto user_data.website for new signups. This is registration provenance, not the social profile website_url and not an OAuth or canonical site URL. Changing this does not rewrite existing users. If this value is blank, signup falls back to nexjsboilerplate.com.'
  )
ON CONFLICT (option_name) DO NOTHING;

-- Table-level UPDATE would let the owner rewrite the signup stamp, billing
-- columns, or token totals. Match schema.sql: profile and social columns
-- only. Service role keeps full UPDATE from the baseline.
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
