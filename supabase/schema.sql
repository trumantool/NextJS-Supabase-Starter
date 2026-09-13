-- ============================================================================
-- Supabase Schema Dump
-- ============================================================================
-- This file represents the CURRENT state of the database schema, including:
--   - Tables
--   - Row Level Security (RLS) policies
--   - Functions
--   - Triggers
--   - Storage buckets and storage policies
--
-- It is written to be idempotent: every statement uses IF NOT EXISTS / DROP IF
-- EXISTS guards so it can be re-run safely without erroring on existing items.
-- ============================================================================

-- ============================================================================
-- 1. SCHEMA SETUP
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS "authenticative";

SET check_function_bodies = OFF;

-- ============================================================================
-- 2. FUNCTIONS
-- ============================================================================

-- Function to check if user is authenticated (MFA-aware)
CREATE OR REPLACE FUNCTION authenticative.is_user_authenticated()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT array[(select auth.jwt()->>'aal')] <@ (
    SELECT
      CASE
        WHEN count(id) > 0 THEN array['aal2']
        ELSE array['aal1', 'aal2']
      END as aal
    FROM auth.mfa_factors
    WHERE (auth.uid() = user_id)
    AND status = 'verified'
  );
$function$;

-- Function to handle new user creation (inserting into user_data and user_settings)
-- IMPORTANT: Must be SECURITY DEFINER so it runs as its owner (postgres), which has
-- INSERT on the profile tables. With SECURITY INVOKER, the auth trigger fires as
-- supabase_auth_admin, which lacks INSERT, and the EXCEPTION handler silently swallows
-- the failure — new users would get no profile rows.
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
    -- Extract first_name and last_name from raw_user_meta_data if available
    -- raw_user_meta_data is JSON, so we use ->> to get text values
    v_first_name := NEW.raw_user_meta_data->>'first_name';
    v_last_name := NEW.raw_user_meta_data->>'last_name';

    -- Insert the new user into user_data with default role 'free'
    INSERT INTO public.user_data (user_id, first_name, last_name, email, user_role)
    VALUES (NEW.id, v_first_name, v_last_name, NEW.email, 'free');

    -- Insert the new user into user_settings (email = NEW.email, works for both
    -- email and Google signups since NEW.email is always populated by Auth)
    INSERT INTO public.user_settings (user_id, first_name, last_name, email)
    VALUES (NEW.id, v_first_name, v_last_name, NEW.email);

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the auth trigger
    -- This prevents auth failures if the profile inserts fail
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Restrict execution of handle_new_user to the roles that need it for security.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- ============================================================================
-- 3. TABLES
-- ============================================================================

-- user_data: stores per-user profile and role
CREATE TABLE IF NOT EXISTS public.user_data (
    user_id uuid NOT NULL PRIMARY KEY,
    user_role text NOT NULL DEFAULT 'free',
    first_name text,
    last_name text,
    email text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add foreign key constraint to auth.users with ON DELETE CASCADE
ALTER TABLE public.user_data
    DROP CONSTRAINT IF EXISTS user_data_user_id_fkey;
ALTER TABLE public.user_data
    ADD CONSTRAINT user_data_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE
    NOT VALID;

-- Validate the constraint (safe on existing data if table is empty)
ALTER TABLE public.user_data
    VALIDATE CONSTRAINT user_data_user_id_fkey;

-- user_settings: per-user settings / profile fields
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id uuid NOT NULL PRIMARY KEY,
    first_name text,
    last_name text,
    email text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add foreign key constraint to auth.users with ON DELETE CASCADE
ALTER TABLE public.user_settings
    DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;
ALTER TABLE public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE
    NOT VALID;

-- Validate the constraint
ALTER TABLE public.user_settings
    VALIDATE CONSTRAINT user_settings_user_id_fkey;

-- todo_list: per-user to-do items
CREATE TABLE IF NOT EXISTS public.todo_list (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    title text NOT NULL,
    urgent boolean NOT NULL DEFAULT false,
    description text,
    done boolean NOT NULL DEFAULT false,
    done_at timestamptz,
    owner uuid NOT NULL
);

ALTER TABLE public.todo_list
    DROP CONSTRAINT IF EXISTS todo_list_owner_fkey;
ALTER TABLE public.todo_list
    ADD CONSTRAINT todo_list_owner_fkey FOREIGN KEY (owner)
    REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE
    NOT VALID;

ALTER TABLE public.todo_list
    VALIDATE CONSTRAINT todo_list_owner_fkey;

-- resumes: metadata for user resumes
CREATE TABLE IF NOT EXISTS public.resumes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL DEFAULT 'Untitled Resume',
    template text NOT NULL DEFAULT 'classic',
    doc_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    model text NOT NULL DEFAULT 'poolside/laguna-s-2.1:free',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- app_settings: key/value store for app-wide settings
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL
);

-- contact_submissions: contact form submissions (anonymous + authenticated)
CREATE TABLE IF NOT EXISTS public.contact_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name text NOT NULL,
    last_name text NOT NULL,
    email_address text NOT NULL,
    phone_number text,
    message text NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'new',
    source text NOT NULL DEFAULT 'web',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Check constraints for contact_submissions
ALTER TABLE public.contact_submissions
    DROP CONSTRAINT IF EXISTS contact_submissions_status_check;
ALTER TABLE public.contact_submissions
    ADD CONSTRAINT contact_submissions_status_check
    CHECK (status IN ('new', 'in_progress', 'resolved', 'closed'));

ALTER TABLE public.contact_submissions
    DROP CONSTRAINT IF EXISTS contact_submissions_source_check;
ALTER TABLE public.contact_submissions
    ADD CONSTRAINT contact_submissions_source_check
    CHECK (source IN ('web', 'mobile', 'email', 'admin'));

-- admin_settings: admin-configurable options (one row per option)
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    option_name text NOT NULL UNIQUE,
    option_value text NOT NULL DEFAULT '',
    option_field_type text NOT NULL DEFAULT 'text',
    option_title text NOT NULL,
    option_description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- text_assessments: named text-only assessment sessions
CREATE TABLE IF NOT EXISTS public.text_assessments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    name text NOT NULL DEFAULT 'Untitled Assessment',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.text_assessments
    DROP CONSTRAINT IF EXISTS text_assessments_user_id_fkey;
ALTER TABLE public.text_assessments
    ADD CONSTRAINT text_assessments_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.text_assessments
    VALIDATE CONSTRAINT text_assessments_user_id_fkey;

-- text_assessment_answers: individual text answers within an assessment
CREATE TABLE IF NOT EXISTS public.text_assessment_answers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id uuid NOT NULL,
    question_number integer NOT NULL,
    question_text text NOT NULL,
    section_title text NOT NULL,
    section_index integer NOT NULL DEFAULT 0,
    answer_text text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.text_assessment_answers
    DROP CONSTRAINT IF EXISTS text_assessment_answers_assessment_id_fkey;
ALTER TABLE public.text_assessment_answers
    ADD CONSTRAINT text_assessment_answers_assessment_id_fkey FOREIGN KEY (assessment_id)
    REFERENCES public.text_assessments(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.text_assessment_answers
    VALIDATE CONSTRAINT text_assessment_answers_assessment_id_fkey;

ALTER TABLE public.text_assessment_answers
    DROP CONSTRAINT IF EXISTS text_assessment_answers_assessment_id_question_number_key;
ALTER TABLE public.text_assessment_answers
    ADD CONSTRAINT text_assessment_answers_assessment_id_question_number_key UNIQUE (assessment_id, question_number);

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.text_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.text_assessment_answers ENABLE ROW LEVEL SECURITY;

-- Enable RLS on all tables
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- user_data policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own data" ON public.user_data;
CREATE POLICY "Users can view own data"
ON public.user_data
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own data" ON public.user_data;
CREATE POLICY "Users can update own data"
ON public.user_data
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all" ON public.user_data;
CREATE POLICY "Service role can manage all"
ON public.user_data
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- user_settings policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings"
ON public.user_settings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
ON public.user_settings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all user settings" ON public.user_settings;
CREATE POLICY "Service role can manage all user settings"
ON public.user_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- todo_list policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owner can do everything" ON public.todo_list;
CREATE POLICY "Owner can do everything"
ON public.todo_list
AS PERMISSIVE
FOR ALL
TO authenticated
USING (authenticative.is_user_authenticated() AND (owner = auth.uid()));

-- ----------------------------------------------------------------------------
-- resumes policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "resume owner read" ON public.resumes;
CREATE POLICY "resume owner read"
ON public.resumes
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "resume owner write" ON public.resumes;
CREATE POLICY "resume owner write"
ON public.resumes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "resume owner update" ON public.resumes;
CREATE POLICY "resume owner update"
ON public.resumes
FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "resume owner delete" ON public.resumes;
CREATE POLICY "resume owner delete"
ON public.resumes
FOR DELETE
USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- app_settings policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "app_settings read" ON public.app_settings;
CREATE POLICY "app_settings read"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert app_settings" ON public.app_settings;
CREATE POLICY "Admins can insert app_settings"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_data
    WHERE user_data.user_id = auth.uid()
      AND user_data.user_role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can update app_settings" ON public.app_settings;
CREATE POLICY "Admins can update app_settings"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_data
    WHERE user_data.user_id = auth.uid()
      AND user_data.user_role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_data
    WHERE user_data.user_id = auth.uid()
      AND user_data.user_role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can delete app_settings" ON public.app_settings;
CREATE POLICY "Admins can delete app_settings"
ON public.app_settings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_data
    WHERE user_data.user_id = auth.uid()
      AND user_data.user_role = 'admin'
  )
);

-- ----------------------------------------------------------------------------
-- contact_submissions policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Contact submissions are insertable by anyone" ON public.contact_submissions;
CREATE POLICY "Contact submissions are insertable by anyone"
ON public.contact_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own contact submissions" ON public.contact_submissions;
CREATE POLICY "Users can view own contact submissions"
ON public.contact_submissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all contact submissions" ON public.contact_submissions;
CREATE POLICY "Admins can view all contact submissions"
ON public.contact_submissions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_data
        WHERE user_data.user_id = auth.uid()
        AND user_data.user_role = 'admin'
    )
);

DROP POLICY IF EXISTS "Admins can update all contact submissions" ON public.contact_submissions;
CREATE POLICY "Admins can update all contact submissions"
ON public.contact_submissions
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_data
        WHERE user_data.user_id = auth.uid()
        AND user_data.user_role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_data
        WHERE user_data.user_id = auth.uid()
        AND user_data.user_role = 'admin'
    )
);

DROP POLICY IF EXISTS "Service role can manage all contact submissions" ON public.contact_submissions;
CREATE POLICY "Service role can manage all contact submissions"
ON public.contact_submissions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- text_assessments policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own text assessments" ON public.text_assessments;
CREATE POLICY "Users can view own text assessments"
ON public.text_assessments FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own text assessments" ON public.text_assessments;
CREATE POLICY "Users can create own text assessments"
ON public.text_assessments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own text assessments" ON public.text_assessments;
CREATE POLICY "Users can update own text assessments"
ON public.text_assessments FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own text assessments" ON public.text_assessments;
CREATE POLICY "Users can delete own text assessments"
ON public.text_assessments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all text assessments" ON public.text_assessments;
CREATE POLICY "Service role can manage all text assessments"
ON public.text_assessments FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- text_assessment_answers policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own text assessment answers" ON public.text_assessment_answers;
CREATE POLICY "Users can view own text assessment answers"
ON public.text_assessment_answers FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.text_assessments
        WHERE text_assessments.id = text_assessment_answers.assessment_id
        AND text_assessments.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can insert own text assessment answers" ON public.text_assessment_answers;
CREATE POLICY "Users can insert own text assessment answers"
ON public.text_assessment_answers FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.text_assessments
        WHERE text_assessments.id = text_assessment_answers.assessment_id
        AND text_assessments.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can update own text assessment answers" ON public.text_assessment_answers;
CREATE POLICY "Users can update own text assessment answers"
ON public.text_assessment_answers FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.text_assessments
        WHERE text_assessments.id = text_assessment_answers.assessment_id
        AND text_assessments.user_id = auth.uid()
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.text_assessments
        WHERE text_assessments.id = text_assessment_answers.assessment_id
        AND text_assessments.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can delete own text assessment answers" ON public.text_assessment_answers;
CREATE POLICY "Users can delete own text assessment answers"
ON public.text_assessment_answers FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.text_assessments
        WHERE text_assessments.id = text_assessment_answers.assessment_id
        AND text_assessments.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Service role can manage all text assessment answers" ON public.text_assessment_answers;
CREATE POLICY "Service role can manage all text assessment answers"
ON public.text_assessment_answers FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- admin_settings policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin settings are readable by anyone" ON public.admin_settings;
CREATE POLICY "Admin settings are readable by anyone"
ON public.admin_settings
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Only admins can manage admin settings" ON public.admin_settings;
CREATE POLICY "Only admins can manage admin settings"
ON public.admin_settings
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_data
        WHERE user_data.user_id = auth.uid()
        AND user_data.user_role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_data
        WHERE user_data.user_id = auth.uid()
        AND user_data.user_role = 'admin'
    )
);

DROP POLICY IF EXISTS "Service role can manage all admin settings" ON public.admin_settings;
CREATE POLICY "Service role can manage all admin settings"
ON public.admin_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- Trigger to add new users to user_data on registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 6. STORAGE BUCKETS
-- ============================================================================

-- files bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', false)
ON CONFLICT (id) DO NOTHING;

-- resumes bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. STORAGE POLICIES
-- ============================================================================

-- resumes bucket: users only touch their own folder
DROP POLICY IF EXISTS "resume owner storage" ON storage.objects;
CREATE POLICY "resume owner storage"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

-- files bucket: users only access their own folder (MFA-aware)
DROP POLICY IF EXISTS "Give users access to own folder 1m0cqf_0" ON storage.objects;
CREATE POLICY "Give users access to own folder 1m0cqf_0"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'files' AND authenticative.is_user_authenticated() AND name ~ ('^' || auth.uid()::text || '/'));

DROP POLICY IF EXISTS "Give users access to own folder 1m0cqf_1" ON storage.objects;
CREATE POLICY "Give users access to own folder 1m0cqf_1"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'files' AND authenticative.is_user_authenticated() AND name ~ ('^' || auth.uid()::text || '/'))
WITH CHECK (bucket_id = 'files' AND authenticative.is_user_authenticated() AND name ~ ('^' || auth.uid()::text || '/'));

DROP POLICY IF EXISTS "Give users access to own folder 1m0cqf_2" ON storage.objects;
CREATE POLICY "Give users access to own folder 1m0cqf_2"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'files' AND authenticative.is_user_authenticated() AND name ~ ('^' || auth.uid()::text || '/'));

DROP POLICY IF EXISTS "Give users access to own folder 1m0cqf_3" ON storage.objects;
CREATE POLICY "Give users access to own folder 1m0cqf_3"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'files' AND authenticative.is_user_authenticated() AND name ~ ('^' || auth.uid()::text || '/'));

-- ============================================================================
-- 8. GRANTS
-- ============================================================================

-- user_data
GRANT SELECT ON public.user_data TO authenticated;
GRANT UPDATE ON public.user_data TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_data TO service_role;

-- user_settings
GRANT SELECT, UPDATE ON public.user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO service_role;

-- todo_list
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todo_list TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todo_list TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todo_list TO service_role;

-- resumes
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resumes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resumes TO service_role;

-- app_settings
GRANT SELECT ON public.app_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO service_role;

-- contact_submissions
GRANT INSERT ON public.contact_submissions TO anon;
GRANT INSERT, SELECT ON public.contact_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_submissions TO service_role;

-- admin_settings
GRANT SELECT ON public.admin_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings TO service_role;

-- text_assessments
GRANT SELECT, INSERT, UPDATE, DELETE ON public.text_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.text_assessments TO service_role;

-- text_assessment_answers
GRANT SELECT, INSERT, UPDATE, DELETE ON public.text_assessment_answers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.text_assessment_answers TO service_role;

-- ============================================================================
-- 9. INDEXES
-- ============================================================================

-- user_data
CREATE INDEX IF NOT EXISTS idx_user_data_created_at ON public.user_data(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_data_user_role ON public.user_data(user_role);

-- user_settings
CREATE INDEX IF NOT EXISTS idx_user_settings_created_at ON public.user_settings(created_at DESC);

-- contact_submissions
CREATE INDEX IF NOT EXISTS idx_contact_submissions_user_id ON public.contact_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON public.contact_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON public.contact_submissions(status);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email_address ON public.contact_submissions(email_address);

-- admin_settings
CREATE INDEX IF NOT EXISTS idx_admin_settings_option_name ON public.admin_settings(option_name);
CREATE INDEX IF NOT EXISTS idx_admin_settings_created_at ON public.admin_settings(created_at DESC);

-- text_assessments
CREATE INDEX IF NOT EXISTS idx_text_assessments_user_id ON public.text_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_text_assessments_created_at ON public.text_assessments(created_at DESC);

-- text_assessment_answers
CREATE INDEX IF NOT EXISTS idx_text_assessment_answers_assessment_id ON public.text_assessment_answers(assessment_id);

-- ============================================================================
-- 10. SEED DATA
-- ============================================================================

-- Default admin settings options
INSERT INTO public.admin_settings (option_name, option_value, option_field_type, option_title, option_description)
VALUES
    ('site_title', 'Resume Builder', 'text', 'Site Title', 'The name of your site shown in the browser tab and header.'),
    ('site_tagline', 'Create your resume the easy way', 'text', 'Site Tagline', 'A short tagline shown on the homepage.'),
    ('support_email', 'support@example.com', 'text', 'Support Email', 'The email address used for support inquiries.'),
    ('company_name', 'Resume Builder', 'text', 'Company Name', 'The legal company name. Available as the [company_name] shortcode.'),
    ('contact_address', '', 'text', 'Contact Address', 'Available as the [contact_address] shortcode.'),
    ('support_hours', '', 'text', 'Support Hours', 'Available as the [support_hours] shortcode.'),
    ('phone_number', '', 'text', 'Phone Number', 'Available as the [phone_number] shortcode.'),
    ('privacy_policy', '<h1>Privacy Policy</h1><p>Last Updated: August 14, 2026</p><p>This Privacy Policy explains how [site_title] ("we", "us", or "our") collects, uses, discloses, and safeguards your information when you use our services.</p>', 'textarea', 'Privacy Policy', 'The privacy policy content shown on the /privacy page. Supports shortcodes like [site_title], [company_name], and [support_email].'),
    ('terms_of_service', '<h1>Terms of Service</h1><p>Last Updated: August 15, 2026</p><p>Welcome to [site_title] ("we", "us", or "our"). By accessing or using our services, you agree to be bound by these Terms of Service.</p>', 'textarea', 'Terms of Service', 'The Terms of Service content shown on the /terms page. Supports shortcodes like [site_title], [company_name], and [support_email].')

ON CONFLICT (option_name) DO NOTHING;

-- Default OpenRouter model setting
INSERT INTO public.app_settings (key, value)
VALUES ('openrouter_model', '"poolside/laguna-s-2.1:free"')
ON CONFLICT (key) DO NOTHING;