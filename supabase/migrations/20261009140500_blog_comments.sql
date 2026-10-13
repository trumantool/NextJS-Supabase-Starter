-- Blog comments. Fresh starter databases only.
-- NEVER apply this file to production project glplvrljdgowcwuubkau.
-- This copy does not hard-code a website. The app filters with POSTS_WEBSITE.
-- Admin checks use authenticative.is_admin(). The starter has no edu schema.
-- Signed-in users insert pending rows. Public reads are visible comments on live blogs.

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
