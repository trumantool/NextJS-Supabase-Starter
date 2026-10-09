-- Blog revision snapshots. The app inserts one after a successful post update.
-- Fresh starter databases only.
-- NEVER apply this file to production project glplvrljdgowcwuubkau.
-- No website literal. Admin checks use authenticative.is_admin().

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
