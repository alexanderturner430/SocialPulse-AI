#!/usr/bin/env bash
#
# x402scan registration helper for the TensorFlow Social MCP resource server.
#
# Usage:
#   ./scripts/x402-register.sh check [origin]
#       Verify discovery documents (/openapi.json, /.well-known/x402) are live and
#       that an unauthenticated probe of a gated route returns a valid HTTP 402
#       x402 challenge.
#
#   ./scripts/x402-register.sh register [origin]
#       Register the origin on x402scan (public tRPC registration endpoint).
#       Refuses non-public/localhost origins: x402scan cannot index them.
#
# Origin resolution: 1st CLI arg > PUBLIC_ORIGIN env > default
#   check default:   http://127.0.0.1:9151  (local validation)
#   register default: (none) - requires an explicit public https origin
#
set -euo pipefail

cmd="${1:-}"
ORIGIN_VAR="${2:-${PUBLIC_ORIGIN:-}}"

REGISTER_ENDPOINT="https://www.x402scan.com/api/trpc/public.resources.registerFromOrigin"
LOCALHOST_RE='(^|://)(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|/|$)'

say() { printf '%s\n' "$*" >&2; }
die() { say "ERROR: $*"; exit 1; }

is_public_https() {
  local o="$1"
  [[ "$o" =~ ^https:// ]] || return 1
  [[ "$o" =~ $LOCALHOST_RE ]] && return 1
  return 0
}

check_http() {
  # $1 = url, $2 = expected-status. Returns 0 on match, 1 otherwise.
  local url="$1" want="$2"
  local code
  code="$(curl -s -o /dev/null -m 10 -w "%{http_code}" "$url" 2>/dev/null || true)"
  [[ "$code" == "$want" ]] && return 0
  say "    -> $url returned HTTP $code (expected $want)"
  return 1
}

cmd_check() {
  local origin="$1"
  say "==> Checking discovery + 402 behavior for $origin"

  local pass=1 ok=1

  say "  [openapi.json]"
  check_http "$origin/openapi.json" 200 || ok=0
  if curl -s -m 10 "$origin/openapi.json" 2>/dev/null | grep -q '"x-payment-info"'; then
    say "    -> contains x-payment-info"
  else
    say "    -> WARNING: no x-payment-info found"
    ok=0
  fi

  say "  [.well-known/x402]"
  check_http "$origin/.well-known/x402" 200 || ok=0

  say "  [402 challenge probe]"
  local probe_url="$origin/api/v1/tools/analyze-text/sync"
  local code hdr
  code="$(curl -s -o /tmp/x402_probe_body.$$ -m 15 -w "%{http_code}" -X POST "$probe_url" \
    -H 'Content-Type: application/json' -d '{"text":"hi"}' 2>/dev/null || true)"
  hdr="$(curl -s -o /dev/null -m 15 -D - -X POST "$probe_url" \
    -H 'Content-Type: application/json' -d '{"text":"hi"}' 2>/dev/null | tr -d '\r' | grep -i '^payment-required:' || true)"
  if [[ "$code" == "402" ]] && [[ -n "$hdr" ]]; then
    say "    -> $probe_url returned HTTP 402 with Payment-Required header"
  else
    say "    -> $probe_url returned HTTP $code (expected 402 with Payment-Required header)"
    ok=0
  fi
  rm -f /tmp/x402_probe_body.$$

  [[ "$ok" == "1" ]] || die "Discovery checks FAILED. Fix issues before registering."
  say "==> All checks GREEN."
}

cmd_register() {
  local origin="$1"
  say "==> Registering $origin on x402scan"

  is_public_https "$origin" || die \
"Origin must be a public HTTPS URL (not localhost) for x402scan to index it.
Got: $origin
Deploy the server behind a public HTTPS origin, set PUBLIC_ORIGIN=https://your-domain,
then run: ./scripts/x402-register.sh register https://your-domain"

  cmd_check "$origin"

  say "==> POSTing to $REGISTER_ENDPOINT (auto-register, no prompt)"
  local resp
  resp="$(curl -s -m 30 -X POST "$REGISTER_ENDPOINT" \
    -H 'Content-Type: application/json' \
    -d "{\"json\":{\"origin\":\"$origin\"}}" 2>/dev/null || true)"

  if [[ -z "$resp" ]]; then
    die "No response from x402scan registration endpoint."
  fi

  say "==> Registration response:"
  printf '%s\n' "$resp" | sed 's/^/    /'

  # Heuristic: detect 'failed' in the response and warn loudly.
  if printf '%s\n' "$resp" | grep -qi '"failed":[1-9]'; then
    say ""
    say "WARNING: some or all endpoints failed to register. Inspect failedDetails "
    say "above and fix the listed endpoints, then re-run register."
    exit 1
  fi

  say "==> Registration submitted."
}

case "$cmd" in
  check)
    origin="${ORIGIN_VAR:-http://127.0.0.1:9151}"
    cmd_check "$origin"
    ;;
  register)
    [[ -n "$ORIGIN_VAR" ]] || die "No origin given. Usage: $0 register https://your-domain (or set PUBLIC_ORIGIN)"
    cmd_register "$ORIGIN_VAR"
    ;;
  "")
    say "Usage: $0 {check|register} [origin]"
    exit 1
    ;;
  *)
    die "Unknown command: $cmd (expected check|register)"
    ;;
esac
