-- Empty YouTube Data API key for a future autoblogging feature.
-- Fresh starter databases only.
-- NEVER apply this file to production project glplvrljdgowcwuubkau.
-- option_field_type = secret keeps this row off anon and authenticated SELECT.
-- This file only inserts a row. It does not add a policy.
-- No real key value belongs in git. Enter the key later in Admin Settings.

INSERT INTO public.admin_settings (
  option_name,
  option_value,
  option_field_type,
  option_title,
  option_description
)
VALUES
  (
    'youtube_data_api_key',
    '',
    'secret',
    'YouTube Data API key',
    'Used for the future autoblogging feature. Never commit a real key.'
  )
ON CONFLICT (option_name) DO NOTHING;
