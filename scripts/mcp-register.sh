#!/usr/bin/env bash
#
# MCP directory registration helper for the TensorFlow Social MCP server.
#
# Usage:
#   ./scripts/mcp-register.sh check [origin]
#       Verify the server is live and reachable as a remote MCP server:
#         - /health returns 200
#         - /openapi.json returns 200
#         - a JSON-RPC initialize probe against /http returns serverInfo
#       check works against localhost so you can validate before deploying.
#
#   ./scripts/mcp-register.sh submit [origin] [--dir mcpso|smithery]
#       Run check, then submit the MCP endpoint to each configured public
#       directory. Refuses non-public/localhost origins: directories cannot
#       crawl them.
#
#   ./scripts/mcp-register.sh status
#       Print past submissions recorded in data/submissions.json.
#
# Origin resolution: 1st CLI arg > PUBLIC_ORIGIN env > default
#   check default:  http://127.0.0.1:6350 (local validation)
#   submit default: (none) - requires an explicit public https origin
#
# Directories:
#   mcp.so    authenticated web submission for remote servers; the legacy
#             unauthenticated /api/submit-project endpoint is no longer live
#   smithery  api.smithery.ai, needs SMITHERY_API_KEY and SMITHERY_NAMESPACE
#             (skip to the next directory when not configured)
#   registry.modelcontextprotocol.io + Glama indicate a GitHub-repo or
#   domain-ownership flow and cannot be auto-submitted from a bare URL; see
#   the NOTES printed at the end of "submit".
#
set -euo pipefail

cmd="${1:-}"
ORIGIN_VAR="${2:-${PUBLIC_ORIGIN:-}}"
FILTER=""
if [[ "${3:-}" == "--dir" && -n "${4:-}" ]]; then
  FILTER="$4"
fi

SERVER_NAME="tensorflow-social-mcp"
SERVER_VERSION="2.0.0"
SERVER_DESCRIPTION="TensorFlow.js Social Media MCP Server - 168 ML analytics tools for YouTube, Instagram, TikTok, Twitter, Facebook, Discord, Twitch, Reddit, LinkedIn, Threads, Bluesky, Mastodon, GitHub, Spotify, Pinterest, payable via x402."

SMITHERY_API="https://api.smithery.ai"
STATE_FILE="$(cd "$(dirname "$0")/.." && pwd)/data/submissions.json"

LOCALHOST_RE='(^|://)(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|/|$)'

say() { printf '%s\n' "$*" >&2; }
die() { say "ERROR: $*"; exit 1; }

is_public_https() {
  local o="$1"
  [[ "$o" =~ ^https:// ]] || return 1
  [[ "$o" =~ $LOCALHOST_RE ]] && return 1
  return 0
}

http_status() {
  # $1 = method, $2 = url, [$3 = json body (also sets content-type)]
  local method="$1" url="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -s -o /tmp/mcp_register_body.$$ -m 15 -w "%{http_code}" -X "$method" "$url" \
      -H 'Content-Type: application/json' \
      -H 'Accept: application/json, text/event-stream' \
      -d "$body" 2>/dev/null || true
  else
    curl -s -o /tmp/mcp_register_body.$$ -m 15 -w "%{http_code}" "$url" 2>/dev/null || true
  fi
}

check_http() {
  # $1 = method, $2 = url, $3 = expected status. Returns 0 on match, 1 otherwise.
  local method="$1" url="$2" want="$3" body="${4:-}"
  local code
  code="$(http_status "$method" "$url" "$body")"
  if [[ "$code" == "$want" ]]; then
    return 0
  fi
  say "    -> $method $url returned HTTP $code (expected $want)"
  return 1
}

INIT_BODY='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"mcp-register-check","version":"1.0.0"}}}'

has_server_info() {
  # $1 = origin. Tries the streamable HTTP initialize probe on /http first,
  # then falls back to the SSE handshake on GET /mcp.
  local origin="$1"; origin="${origin%/}"
  local url="$origin/http" code
  code="$(http_status POST "$url" "$INIT_BODY")"
  if [[ "$code" == "200" ]] && grep -q '"serverInfo"' /tmp/mcp_register_body.$$; then
    return 0
  fi
  say "    -> streamable probe on $url did not yield serverInfo (HTTP $code);"
  say "       falling back to SSE handshake on $origin/mcp"
  code="$(http_status GET "$origin/mcp")"
  if [[ "$code" == "200" ]] && grep -q 'event: endpoint' /tmp/mcp_register_body.$$; then
    say "    -> SSE handshake on $origin/mcp OK"
    return 0
  fi
  say "    -> SSE handshake on $origin/mcp returned HTTP $code (expected 200)"
  return 1
}

state_read() {
  node -e 'const fs=require("fs");const f=process.argv[1];try{process.stdout.write(JSON.stringify(JSON.parse(fs.readFileSync(f,"utf8"))))}catch(e){process.stdout.write("{}")}' "$STATE_FILE"
}

state_write() {
  # $1 = JSON patch object
  node -e 'const fs=require("fs");const f=process.argv[1];const patch=JSON.parse(process.argv[2]);let s={};try{s=JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){}Object.assign(s,patch);try{fs.mkdirSync(require("path").dirname(f),{recursive:true})}catch(e){}fs.writeFileSync(f,JSON.stringify(s,null,2))' "$STATE_FILE" "$1"
}

record_local() {
  # $1 = directory key, $2 = status, $3 = note
  local key="$1" status="$2" note="$3"
  local entry
  entry="$(node -e 'const fs=require("fs");const f=process.argv[1];const k=process.argv[2],s=process.argv[3],n=process.argv[4];let cur={};try{cur=JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){}cur[k]=cur[k]||{};cur[k].status=s;cur[k].submittedAt=new Date().toISOString();cur[k].note=n;fs.writeFileSync(f,JSON.stringify(cur,null,2))' "$STATE_FILE" "$key" "$status" "$note")"
}

cmd_check() {
  local origin="$1"
  say "==> Checking MCP + discovery endpoints for $origin"

  local pass=1 ok=1

  say "  [health]"
  check_http GET "$origin/health" 200 || ok=0

  say "  [openapi.json]"
  check_http GET "$origin/openapi.json" 200 || ok=0

  say "  [x402 discovery]"
  check_http GET "$origin/.well-known/x402" 200 || ok=0

  say "  [MCP streamable HTTP initialize probe]"
  has_server_info "$origin" || ok=0

  [[ "$ok" == "1" ]] || die "Checks FAILED. Fix the server before submitting."
  say "==> All checks GREEN."
}

cmd_submit_mcpso() {
  local origin="$1" url="$origin/http"
  say "==> mcp.so: MANUAL (authenticated submission required)."
  say "    Submit the remote endpoint at:"
  say "    https://mcp.so/submit?type=remote-server"
  say "    Endpoint URL: $url"
  record_local mcp.so manual "Submit $url at https://mcp.so/submit?type=remote-server"
}

cmd_submit_smithery() {
  local origin="$1" url="$origin/http"
  if [[ -z "${SMITHERY_API_KEY:-}" ]]; then
    say "==> smithery: SKIPPED (SMITHERY_API_KEY not set)."
    record_local smithery skipped "SMITHERY_API_KEY not set"
    return 0
  fi
  local ns="${SMITHERY_NAMESPACE:-}"
  [[ -n "$ns" ]] || die "SMITHERY_API_KEY is set but SMITHERY_NAMESPACE is missing."

  local qname="$ns/$SERVER_NAME"
  local qname_enc="${qname//\//%2F}"
  local server_url="$SMITHERY_API/servers/$qname_enc"
  local release_url="$SMITHERY_API/servers/$qname_enc/releases"

  say "==> smithery: creating server $qname"
  local code resp
  code="$(curl -s -o /tmp/mcp_register_body.$$ -m 30 -w "%{http_code}" -X PUT "$server_url" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $SMITHERY_API_KEY" \
    -d "{\"displayName\":\"TensorFlow Social MCP\",\"description\":\"$SERVER_DESCRIPTION\"}" 2>/dev/null || true)"
  resp="$(LC_ALL=C tr -d '\000' < /tmp/mcp_register_body.$$ 2>/dev/null | head -c 4096 || true)"
  say "    -> PUT $server_url HTTP $code"
  if [[ "$code" == "0" ]]; then
    record_local smithery failed "no response from smithery API"
    say "==> smithery: no response. Aborting smithery submit."
    return 1
  fi

  say "==> smithery: publishing external URL release ($url)"
  code="$(curl -s -o /tmp/mcp_register_body.$$ -m 60 -w "%{http_code}" -X PUT "$release_url" \
    -H "Authorization: Bearer $SMITHERY_API_KEY" \
    -F "payload={\"type\":\"external\",\"upstreamUrl\":\"$url\",\"configSchema\":{}}" 2>/dev/null || true)"
  resp="$(LC_ALL=C tr -d '\000' < /tmp/mcp_register_body.$$ 2>/dev/null | head -c 4096 || true)"
  rm -f /tmp/mcp_register_body.$$
  say "    -> HTTP $code"
  if [[ -n "$resp" ]]; then
    say "    response:"
    printf '%s\n' "$resp" | sed 's/^/    /'
  fi
  if [[ "$code" == "202" || "$code" == "200" || "$code" == "201" ]]; then
    record_local smithery ok "$qname -> $code"
    say "==> smithery: release accepted (WORKING; check the server page for scan results)."
  else
    record_local smithery failed "$qname -> $code $resp"
    say "==> smithery: release FAILED (HTTP $code)."
  fi
}

cmd_submit() {
  local origin="$1"
  say "==> Registering $origin on MCP directories"

  is_public_https "$origin" || die \
"Origin must be a public HTTPS URL (not localhost) for MCP directories to index it.
Got: $origin
Deploy the server behind a public HTTPS origin, set PUBLIC_ORIGIN=https://your-domain,
then run: ./scripts/mcp-register.sh submit https://your-domain"

  cmd_check "$origin"

  local failed=0
  if [[ -z "$FILTER" || "$FILTER" == "mcpso" ]]; then
    cmd_submit_mcpso "$origin" || failed=1
  fi
  if [[ -z "$FILTER" || "$FILTER" == "smithery" ]]; then
    cmd_submit_smithery "$origin" || failed=1
  fi

  say ""
  say "==> Not auto-submitted (manual only):"
  say "    - mcp.so: sign in and submit the remote endpoint at"
  say "      https://mcp.so/submit?type=remote-server"
  say "    - Official MCP Registry (registry.modelcontextprotocol.io): requires"
  say "      GitHub-repo/domain ownership verification. See"
  say "      https://github.com/modelcontextprotocol/registry - publish via mcp-publisher CLI."
  say "    - Glama (glama.ai): indexes GitHub repositories; submit your repo at"
  say "      https://glama.ai/mcp/servers after publishing the server source on GitHub."
  say "    - x402scan: use ./scripts/x402-register.sh register $origin"

  [[ "$failed" == "0" ]]
}

cmd_status() {
  if [[ ! -f "$STATE_FILE" ]]; then
    say "No submissions recorded yet (data/submissions.json missing)."
    return 0
  fi
  say "==> Past submissions (data/submissions.json):"
  cat "$STATE_FILE" | sed 's/^/    /'
}

case "$cmd" in
  check)
    origin="${ORIGIN_VAR:-http://127.0.0.1:6350}"
    cmd_check "$origin"
    ;;
  submit)
    [[ -n "$ORIGIN_VAR" ]] || die "No origin given. Usage: $0 submit https://your-domain (or set PUBLIC_ORIGIN)"
    cmd_submit "$ORIGIN_VAR"
    ;;
  status)
    cmd_status
    ;;
  "")
    say "Usage: $0 {check|submit|status} [origin] [--dir mcpso|smithery]"
    exit 1
    ;;
  *)
    die "Unknown command: $cmd (expected check|submit|status)"
    ;;
esac