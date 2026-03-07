#!/bin/bash
set -euo pipefail

# --write is intentional: auto-fix formatting before commit (check.sh runs as pre-commit via all-checks.sh)
echo "=== Format ==="
pnpm exec biome format --write .

echo ""
echo "=== Lint ==="
pnpm exec biome check --error-on-warnings .

echo ""
echo "=== Typecheck ==="
pnpm typecheck

echo ""
echo "=== Typecheck (tests) ==="
pnpm typecheck:tests

echo ""
echo "=== Tests ==="
pnpm test

echo ""
echo "All checks passed."
