#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

# Load .env from repo root or nextjs/ (the actual location of the .env file)
for ENV_FILE in "$REPO_ROOT/.env" "$REPO_ROOT/nextjs/.env"; do
  if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
  fi
done

TOKEN="${VERCEL_TOKEN:-${VERCEL_MCP_TOKEN:-}}"

if [ -z "$TOKEN" ]; then
  echo "Vercel MCP token not found in .env or environment" >&2
  exit 1
fi

echo "Starting Vercel MCP server (stdio bridge to remote)..."
exec npx -y mcp-remote@0.1.38 \
  --header "Authorization: Bearer ${TOKEN}" \
  https://mcp.vercel.com/