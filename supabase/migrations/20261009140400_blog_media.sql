-- Public blog images. Fresh starter databases only.
-- NEVER apply this file to production project glplvrljdgowcwuubkau.
-- The first path folder may be any posts website. The second folder is the owner.
-- Admin checks use authenticative.is_admin(). The starter has no edu schema.

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
