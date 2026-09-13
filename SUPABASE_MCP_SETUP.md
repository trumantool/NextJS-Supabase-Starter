# Supabase MCP Server Setup Guide

This workspace is configured to use the Supabase Model Context Protocol (MCP) server for seamless database access through Copilot.

## Configuration Status

✅ **Project Reference:** `mjysxkxsktalulooajfv`  
✅ **Project URL:** `https://mjysxkxsktalulooajfv.supabase.co`  
✅ **Region:** `us-west-2`  
✅ **PostgreSQL Version:** 17  
✅ **Access Token:** Configured in `.env` file  

## What You Can Do with Supabase MCP

The Supabase MCP server allows you to:

1. **Execute SQL Queries** - Run PostgreSQL queries directly via Copilot
   ```
   Query your user_data table, run migrations, inspect schema
   ```

2. **Manage Schema** - View and modify database structure
   ```
   Check tables, columns, indexes, RLS policies
   ```

3. **View Logs** - Access Supabase logs and query results
   ```
   Monitor migrations, check errors, review database operations
   ```

4. **Manage Functions & Triggers** - View PostgreSQL functions and triggers
   ```
   Inspect the handle_new_user() function and on_auth_user_created trigger
   ```

5. **Environment Variables** - Access project configuration
   ```
   SUPABASE_URL, SUPABASE_ANON_KEY, and other project settings
   ```

## How to Use in Copilot

When chatting with Copilot, you can ask to:

- "Execute this SQL query on my Supabase database"
- "Show me the schema of the user_data table"
- "Check the RLS policies on user_data"
- "Run a database migration"
- "Query the auth logs"

## Environment Setup

All necessary credentials are configured:

- **SUPABASE_ACCESS_TOKEN** - Stored in `.env` (never commit this file)
- **SUPABASE_URL** - Configured in `.vscode/settings.json`
- **Project Reference** - Linked via `supabase link` command

## Troubleshooting

### MCP Server Not Connecting

1. Verify the access token is valid:
   ```bash
   export SUPABASE_ACCESS_TOKEN=<your-token>
   supabase projects list
   ```

2. Check that you're in the workspace root directory:
   ```bash
   pwd
   # Should be /workspaces/voiceapp
   ```

3. Verify the .env file has the token:
   ```bash
   grep SUPABASE_ACCESS_TOKEN .env
   ```

### Query Execution Issues

1. Ensure you're using the correct table and column names
2. Check RLS policies don't restrict the query
3. Verify user_role has appropriate permissions

## Quick Reference

- **Created Tables:** `user_data`
- **Triggers:** `on_auth_user_created`
- **Functions:** `handle_new_user()`
- **RLS Policies:** User isolation on SELECT/UPDATE
- **Indexes:** `idx_user_data_created_at`, `idx_user_data_user_role`

## Next Steps

1. Test the MCP connection by asking Copilot to query the user_data table
2. Set up additional tables or functions as needed
3. Monitor database performance using Supabase dashboard

For more information, see:
- [Supabase MCP Setup Guide](https://supabase.com/docs/guides/getting-started/mcp)
- [Supabase Documentation](https://supabase.com/docs)
