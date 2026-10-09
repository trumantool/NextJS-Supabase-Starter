-- Confirmed newsletter addresses. Fresh starter databases only.
-- NEVER apply this file to production project glplvrljdgowcwuubkau.
-- This copy does not hard-code a website. The app filters with POSTS_WEBSITE.
-- There is no mailer. The route stores a confirmed address with the service role.
-- Admin checks use authenticative.is_admin(). The starter has no edu schema.

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
