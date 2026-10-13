# Legal pages and shortcodes

## What already exists

`/terms` and `/privacy` already render admin settings with shortcodes. This is not a new feature.

- `getTermsSettings` and `getPrivacySettings` read `admin_settings` (public, no auth). They drop `secret` and `password` field types and do not select `app_key` when `ADMIN_SETTINGS_APP_KEY` is blank.
- `TermsOfServiceView` and `PrivacyPolicyView` call `resolveShortcodes`.
- Admins can edit the body on the page (`terms_of_service`, `privacy_policy`) and in Admin Settings.
- Shortcodes already mapped: `[site_title]`, `[company_name]`, `[support_email]`, `[site_tagline]`, `[contact_address]`, `[support_hours]`, `[phone_number]`.
- Gaps: no `[site_url]`, `[contact_email]`, or `[effective_date]`. An empty body renders blank HTML. A missing `terms_of_service` or `privacy_policy` row makes save throw `Setting not found`. A missing table or column throws the whole page.

Do not rewrite live privacy or terms copy. The shared database may still say Reach Them AI. That text stays until Truman edits it in Admin Settings. Fallback copy in code is used only when the stored body is missing or blank, and that fallback must not contain Reach Them AI.

## Shortcodes

Keep the existing map. Add:

| Shortcode | Setting | When the value is blank |
|---|---|---|
| `[company_name]` | `company_name` | `the site operator` |
| `[site_url]` | `site_url` | `this website` |
| `[contact_email]` | `contact_email`, then `support_email` | `the contact email published for this site` |
| `[effective_date]` | `effective_date` | `the date this page was last updated` |

Also keep `[site_title]` and `[support_email]`. A blank `[site_title]` becomes `this site`. A blank `[support_email]` uses the same contact-email fallback. Unknown tokens stay unchanged.

## Admin fields

Rows in `admin_settings`, editable by an admin:

- `company_name` (already seeded)
- `site_url`
- `contact_email`
- `effective_date`
- `terms_of_service` and `privacy_policy` (already seeded; page editors stay)

Identity fields are edited on `/terms` and `/privacy` when the viewer is an admin. Saving upserts the row, including when the key was never seeded. Body save does the same. A missing `admin_settings` table or column returns an error on save and an empty list on public read (`42P01`, `42703`, `PGRST200`, `PGRST204`, `PGRST205`). The page then shows the generic fallback.

## SQL (file only, never applied)

One new additive migration, later than `20261010160000_admin_settings_app_scope.sql`:

- `posts.body_doc`, `posts.deleted_at`, `posts.cover_image_alt`, `posts.seo_title`, `posts.meta_description`, `posts.og_image_url` via `ADD COLUMN IF NOT EXISTS`
- Partial index `posts_not_deleted_idx`
- Restrictive policies, created only if missing. Do not drop the existing posts policies.
  - `posts_hide_soft_deleted_anon` — `SELECT` to `anon`. Predicate does not call `is_admin`.
  - `posts_hide_soft_deleted` — `SELECT` to `authenticated`, using `authenticative.is_admin()` (not `edu.is_admin()`)
  - `posts_no_authenticated_blog_hard_delete` — `DELETE` to `authenticated` where `type <> 'blog'`
- `REVOKE EXECUTE` on `authenticative.is_admin()` from `PUBLIC` and `anon`. `authenticated` keeps `EXECUTE` because existing policies call the function.
- Seed `company_name`, `site_url`, `contact_email`, `effective_date`, `terms_of_service`, and `privacy_policy` only when that `option_name` is absent. Do not update an existing value.

Mirror the columns, policies, and seed keys in `supabase/schema.sql`.
