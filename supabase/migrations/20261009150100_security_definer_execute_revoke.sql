-- Align SECURITY DEFINER execute privileges with supabase/schema.sql.
-- Schema files only: this migration is not applied to a live database by this change.
--
-- Runs after the functions exist. Revoke the default public grant, then restore
-- only the roles that call each function. handle_new_user stays trigger-only
-- (service_role and supabase_auth_admin).

REVOKE EXECUTE ON FUNCTION authenticative.is_user_authenticated() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION authenticative.is_user_authenticated() TO authenticated;
GRANT EXECUTE ON FUNCTION authenticative.is_user_authenticated() TO service_role;

REVOKE ALL ON FUNCTION authenticative.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION authenticative.is_admin() FROM PUBLIC, anon, authenticated;
-- Public post_categories and post_tags policies are TO anon and call this.
GRANT EXECUTE ON FUNCTION authenticative.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION authenticative.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION authenticative.is_admin() TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

REVOKE ALL ON FUNCTION public.enqueue_automation_run(uuid, text, timestamptz, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_automation_run(uuid, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_automation_run(uuid, text, timestamptz, text) TO service_role;

REVOKE ALL ON FUNCTION public.claim_queued_automation_runs(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_queued_automation_runs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_queued_automation_runs(integer) TO service_role;

REVOKE ALL ON FUNCTION public.record_llm_turn_usage(
  uuid, text, bigint, bigint, uuid, uuid, numeric, numeric, numeric, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_llm_turn_usage(
  uuid, text, bigint, bigint, uuid, uuid, numeric, numeric, numeric, text
) TO authenticated, service_role;
