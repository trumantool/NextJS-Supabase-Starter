-- Admin-configurable post-login / auth-callback base URL.
-- Schema files only: this migration is not applied to a live database by this change.
--
-- login_redirect_url is the base (no trailing slash) for OAuth, email
-- confirmation, and password recovery redirects. It is not a canonical site URL.
-- Re-running this insert does not overwrite an existing value.

INSERT INTO public.admin_settings (
  option_name,
  option_value,
  option_field_type,
  option_title,
  option_description
)
VALUES (
  'login_redirect_url',
  'https://nextjs-supabase-starter-two.vercel.app',
  'text',
  'Post-login redirect URL',
  'Full base URL used after sign-in, email confirmation, and password recovery (OAuth callback, confirm link, and reset link). Paste the URL with no trailing slash.'
)
ON CONFLICT (option_name) DO NOTHING;
