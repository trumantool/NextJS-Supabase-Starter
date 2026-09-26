-- Optional social profile URLs on public.user_data.
-- Schema-files only: this migration is not applied to a live database by this change.

ALTER TABLE public.user_data
  ADD COLUMN IF NOT EXISTS twitter_url text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS github_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS website_url text;

COMMENT ON COLUMN public.user_data.twitter_url IS
  'Optional X/Twitter profile URL.';
COMMENT ON COLUMN public.user_data.linkedin_url IS
  'Optional LinkedIn profile URL.';
COMMENT ON COLUMN public.user_data.github_url IS
  'Optional GitHub profile URL.';
COMMENT ON COLUMN public.user_data.instagram_url IS
  'Optional Instagram profile URL.';
COMMENT ON COLUMN public.user_data.youtube_url IS
  'Optional YouTube channel or video URL.';
COMMENT ON COLUMN public.user_data.website_url IS
  'Optional personal or company website URL.';
