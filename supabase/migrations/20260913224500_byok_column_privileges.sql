-- Phase 2: keep user_settings.openrouter_api_key off the authenticated Data API.
-- The Next.js BYOK route reads/writes this column with the service role after
-- verifying the session. Authenticated clients only receive a masked status.

REVOKE SELECT, UPDATE ON public.user_settings FROM authenticated;

GRANT SELECT (user_id, first_name, last_name, email, created_at, updated_at)
  ON public.user_settings TO authenticated;

GRANT UPDATE (first_name, last_name, email, updated_at)
  ON public.user_settings TO authenticated;
