-- Registration provenance on public.user_data.
-- Schema files only: this migration is not applied to a live database by this change.
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

-- Same body as supabase/schema.sql handle_new_user(). Replacing the function
-- keeps the existing on_auth_user_created trigger pointed at this definition.
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

-- Table-level UPDATE would let the owner rewrite the signup stamp. Keep
-- profile and social columns editable; leave application_name and website
-- off this list. Service role is unchanged (full UPDATE from the baseline).
REVOKE UPDATE ON TABLE public.user_data FROM authenticated;

GRANT UPDATE (
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
