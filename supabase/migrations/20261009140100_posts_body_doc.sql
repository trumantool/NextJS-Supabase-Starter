-- Nullable TipTap JSON for blog rows. Existing markdown stays in body.
-- Fresh starter databases only.
-- NEVER apply this file to production project glplvrljdgowcwuubkau.
-- This is an additive column. It does not change existing checks or policies.

ALTER TABLE public.posts
    ADD COLUMN IF NOT EXISTS body_doc jsonb;

COMMENT ON COLUMN public.posts.body_doc IS
    'TipTap document for blog rows. Null on rows that only have markdown in body.';
