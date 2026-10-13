-- Additive posts editor columns, soft-delete policies, and legal setting keys.
-- Idempotent. Does not DROP a policy, constraint, index, trigger, or column.
-- Does not UPDATE an existing admin_settings value.
-- Do not apply this file. Not against glplvrljdgowcwuubkau. Not against cyczlgdaocwueaacqxsh.

ALTER TABLE public.posts
    ADD COLUMN IF NOT EXISTS body_doc jsonb,
    ADD COLUMN IF NOT EXISTS cover_image_alt text,
    ADD COLUMN IF NOT EXISTS seo_title text,
    ADD COLUMN IF NOT EXISTS meta_description text,
    ADD COLUMN IF NOT EXISTS og_image_url text,
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.posts.body_doc IS
    'TipTap document for blog rows. Null on rows that only have markdown in body.';

COMMENT ON COLUMN public.posts.cover_image_alt IS
    'Alt text for the cover image. Null when the cover has no description.';

COMMENT ON COLUMN public.posts.seo_title IS
    'Optional document title for search results. Null uses the post title.';

COMMENT ON COLUMN public.posts.meta_description IS
    'Optional search snippet. Null uses the post summary.';

COMMENT ON COLUMN public.posts.og_image_url IS
    'Optional Open Graph image. Null uses the cover image.';

COMMENT ON COLUMN public.posts.deleted_at IS
    'Set when a blog row is soft-deleted. Null keeps the row visible to the policies that already allow it.';

CREATE INDEX IF NOT EXISTS posts_not_deleted_idx
    ON public.posts (website, type, status)
    WHERE deleted_at IS NULL;

-- authenticated keeps EXECUTE: existing policies call this function as the signed-in role.
-- anon must not be able to execute it. The anon soft-delete policy below does not call it.
REVOKE ALL ON FUNCTION authenticative.is_admin() FROM PUBLIC, anon;

-- anon SELECT. Does not call is_admin. type <> 'blog' leaves courses and lessons alone.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'posts'
          AND policyname = 'posts_hide_soft_deleted_anon'
    ) THEN
        CREATE POLICY posts_hide_soft_deleted_anon
            ON public.posts
            AS RESTRICTIVE
            FOR SELECT
            TO anon
            USING (type <> 'blog' OR deleted_at IS NULL);
    END IF;
END
$$;

-- authenticated SELECT. A soft-deleted blog stays visible to its author and to an admin.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'posts'
          AND policyname = 'posts_hide_soft_deleted'
    ) THEN
        CREATE POLICY posts_hide_soft_deleted
            ON public.posts
            AS RESTRICTIVE
            FOR SELECT
            TO authenticated
            USING (
                type <> 'blog'
                OR deleted_at IS NULL
                OR authenticative.is_admin()
                OR author_id = (SELECT auth.uid())
            );
    END IF;
END
$$;

-- authenticated DELETE of a blog row fails. Courses and lessons stay on the existing delete policies.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'posts'
          AND policyname = 'posts_no_authenticated_blog_hard_delete'
    ) THEN
        CREATE POLICY posts_no_authenticated_blog_hard_delete
            ON public.posts
            AS RESTRICTIVE
            FOR DELETE
            TO authenticated
            USING (type <> 'blog');
    END IF;
END
$$;

-- Insert a legal key only when that option_name is absent. Existing copy is left as stored.
INSERT INTO public.admin_settings (
    option_name,
    option_value,
    option_field_type,
    option_title,
    option_description
)
SELECT
    v.option_name,
    v.option_value,
    v.option_field_type,
    v.option_title,
    v.option_description
FROM (
    VALUES
        (
            'company_name',
            '',
            'text',
            'Company name',
            'Legal name of the operator. Shortcode [company_name].'
        ),
        (
            'site_url',
            '',
            'text',
            'Site URL',
            'Public address of this site. Shortcode [site_url].'
        ),
        (
            'contact_email',
            '',
            'text',
            'Contact email',
            'Public contact email. Shortcode [contact_email].'
        ),
        (
            'effective_date',
            '',
            'text',
            'Effective date',
            'Date these legal pages take effect. Shortcode [effective_date].'
        ),
        (
            'terms_of_service',
            '<h1>Terms of Service</h1><p>These terms govern use of the service operated by [company_name]. They are effective [effective_date].</p><p>The service is available at [site_url]. Questions about these terms can be sent to [contact_email].</p><p>By using the service, you agree to these terms. If you do not agree, do not use the service.</p>',
            'textarea',
            'Terms of Service',
            'HTML shown on /terms. Supports [company_name], [site_url], [contact_email], and [effective_date].'
        ),
        (
            'privacy_policy',
            '<h1>Privacy Policy</h1><p>[company_name] describes here how information is collected, used, and protected when you use the service at [site_url].</p><p>This policy is effective [effective_date]. Privacy questions can be sent to [contact_email].</p>',
            'textarea',
            'Privacy Policy',
            'HTML shown on /privacy. Supports [company_name], [site_url], [contact_email], and [effective_date].'
        )
) AS v(option_name, option_value, option_field_type, option_title, option_description)
WHERE NOT EXISTS (
    SELECT 1
    FROM public.admin_settings existing
    WHERE existing.option_name = v.option_name
);
