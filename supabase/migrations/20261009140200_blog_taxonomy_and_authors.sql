-- Blog categories, tags, and author profiles.
-- Fresh starter databases only.
-- NEVER apply this file to production project glplvrljdgowcwuubkau.
-- This copy does not hard-code a website. The app filters with POSTS_WEBSITE.
-- Admin checks use authenticative.is_admin(). The starter has no edu schema.

CREATE TABLE IF NOT EXISTS public.blog_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    website text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT blog_categories_website_check
        CHECK (website = ANY (ARRAY['edu', 'marketing-agent', 'afterallcare'])),
    CONSTRAINT blog_categories_slug_check
        CHECK (char_length(slug) BETWEEN 2 AND 80 AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT blog_categories_name_check
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
    CONSTRAINT blog_categories_website_slug_key UNIQUE (website, slug)
);

CREATE TABLE IF NOT EXISTS public.blog_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    website text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT blog_tags_website_check
        CHECK (website = ANY (ARRAY['edu', 'marketing-agent', 'afterallcare'])),
    CONSTRAINT blog_tags_slug_check
        CHECK (char_length(slug) BETWEEN 2 AND 80 AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT blog_tags_name_check
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
    CONSTRAINT blog_tags_website_slug_key UNIQUE (website, slug)
);

CREATE TABLE IF NOT EXISTS public.post_categories (
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES public.blog_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, category_id)
);

CREATE TABLE IF NOT EXISTS public.post_tags (
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.blog_author_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    website text NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slug text NOT NULL,
    display_name text NOT NULL,
    bio text,
    avatar_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT blog_author_profiles_website_check
        CHECK (website = ANY (ARRAY['edu', 'marketing-agent', 'afterallcare'])),
    CONSTRAINT blog_author_profiles_slug_check
        CHECK (char_length(slug) BETWEEN 2 AND 80 AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT blog_author_profiles_name_check
        CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
    CONSTRAINT blog_author_profiles_website_user_key UNIQUE (website, user_id),
    CONSTRAINT blog_author_profiles_website_slug_key UNIQUE (website, slug)
);

ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_author_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.blog_categories FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.blog_tags FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.post_categories FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.post_tags FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.blog_author_profiles FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.blog_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.blog_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_categories TO service_role;

GRANT SELECT ON TABLE public.blog_tags TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.blog_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_tags TO service_role;

GRANT SELECT ON TABLE public.post_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.post_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.post_categories TO service_role;

GRANT SELECT ON TABLE public.post_tags TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.post_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.post_tags TO service_role;

GRANT SELECT ON TABLE public.blog_author_profiles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.blog_author_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_author_profiles TO service_role;

DROP POLICY IF EXISTS blog_categories_select ON public.blog_categories;
CREATE POLICY blog_categories_select
ON public.blog_categories
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS blog_categories_write ON public.blog_categories;
CREATE POLICY blog_categories_write
ON public.blog_categories
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL OR authenticative.is_admin())
WITH CHECK ((SELECT auth.uid()) IS NOT NULL OR authenticative.is_admin());

DROP POLICY IF EXISTS blog_tags_select ON public.blog_tags;
CREATE POLICY blog_tags_select
ON public.blog_tags
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS blog_tags_write ON public.blog_tags;
CREATE POLICY blog_tags_write
ON public.blog_tags
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL OR authenticative.is_admin())
WITH CHECK ((SELECT auth.uid()) IS NOT NULL OR authenticative.is_admin());

-- Split so the anon policy never calls authenticative.is_admin().
DROP POLICY IF EXISTS post_categories_select ON public.post_categories;
DROP POLICY IF EXISTS post_categories_select_public ON public.post_categories;
CREATE POLICY post_categories_select_public
ON public.post_categories
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND p.type = 'blog'
          AND p.status = 'published'
          AND p.published_at IS NOT NULL
          AND p.published_at <= now()
    )
);

DROP POLICY IF EXISTS post_categories_select_admin ON public.post_categories;
CREATE POLICY post_categories_select_admin
ON public.post_categories
FOR SELECT
TO authenticated
USING (authenticative.is_admin());

DROP POLICY IF EXISTS post_categories_select_author ON public.post_categories;
CREATE POLICY post_categories_select_author
ON public.post_categories
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND p.author_id = (SELECT auth.uid())
    )
);

DROP POLICY IF EXISTS post_categories_write ON public.post_categories;
CREATE POLICY post_categories_write
ON public.post_categories
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND p.type = 'blog'
          AND (p.author_id = (SELECT auth.uid()) OR authenticative.is_admin())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND p.type = 'blog'
          AND (p.author_id = (SELECT auth.uid()) OR authenticative.is_admin())
    )
);

DROP POLICY IF EXISTS post_tags_select ON public.post_tags;
DROP POLICY IF EXISTS post_tags_select_public ON public.post_tags;
CREATE POLICY post_tags_select_public
ON public.post_tags
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND p.type = 'blog'
          AND p.status = 'published'
          AND p.published_at IS NOT NULL
          AND p.published_at <= now()
    )
);

DROP POLICY IF EXISTS post_tags_select_admin ON public.post_tags;
CREATE POLICY post_tags_select_admin
ON public.post_tags
FOR SELECT
TO authenticated
USING (authenticative.is_admin());

DROP POLICY IF EXISTS post_tags_select_author ON public.post_tags;
CREATE POLICY post_tags_select_author
ON public.post_tags
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND p.author_id = (SELECT auth.uid())
    )
);

DROP POLICY IF EXISTS post_tags_write ON public.post_tags;
CREATE POLICY post_tags_write
ON public.post_tags
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND p.type = 'blog'
          AND (p.author_id = (SELECT auth.uid()) OR authenticative.is_admin())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND p.type = 'blog'
          AND (p.author_id = (SELECT auth.uid()) OR authenticative.is_admin())
    )
);

DROP POLICY IF EXISTS blog_author_profiles_select ON public.blog_author_profiles;
CREATE POLICY blog_author_profiles_select
ON public.blog_author_profiles
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS blog_author_profiles_insert ON public.blog_author_profiles;
CREATE POLICY blog_author_profiles_insert
ON public.blog_author_profiles
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    OR authenticative.is_admin()
);

DROP POLICY IF EXISTS blog_author_profiles_update ON public.blog_author_profiles;
CREATE POLICY blog_author_profiles_update
ON public.blog_author_profiles
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()) OR authenticative.is_admin())
WITH CHECK (user_id = (SELECT auth.uid()) OR authenticative.is_admin());

DROP POLICY IF EXISTS blog_author_profiles_delete ON public.blog_author_profiles;
CREATE POLICY blog_author_profiles_delete
ON public.blog_author_profiles
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()) OR authenticative.is_admin());

DROP TRIGGER IF EXISTS trg_blog_author_profiles_set_updated_at ON public.blog_author_profiles;
CREATE TRIGGER trg_blog_author_profiles_set_updated_at
BEFORE UPDATE ON public.blog_author_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
