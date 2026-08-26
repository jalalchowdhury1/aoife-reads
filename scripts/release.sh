#!/usr/bin/env bash
# Aoife Puzzles release gate (AGENTS.md §3, owner decision #14: nothing
# deploys unless every puzzle demonstrably works). Runs lint, typecheck,
# unit tests, the production build, and the Playwright play-through of every
# genre (e2e/playthrough.spec.ts, via the hidden QA level lib/levels/levelQa.ts)
# — in that order. Only deploys to Vercel if every one of those is green.
#
# ALWAYS deploy with `npm run release` (this script); never call
# `vercel --prod` directly — see AGENTS.md §3.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

run_step() {
  local name="$1"
  shift
  echo
  echo "-> ${name} (${*})"
  if "$@"; then
    echo "✅ ${name}"
  else
    echo "❌ ${name} FAILED"
    echo
    echo "Release gate failed at: ${name}. Nothing was deployed."
    exit 1
  fi
}

echo "== Aoife Puzzles release gate =="

run_step "Lint" npm run lint
run_step "Typecheck" npx tsc --noEmit
run_step "Unit tests" npm test
run_step "Build" npm run build
run_step "E2E play-through" npm run e2e

echo
echo "All gates green — deploying to production."
vercel --prod --yes

echo
echo "Recent deployments:"
vercel ls | head -3

echo
echo "✅ Deployed."
