#!/bin/bash
set -euo pipefail

# Run e2e compat tests against the FlowForge reimplementation.
#
# What it does:
#   1. Starts the dev server on port 3000 (if not already running)
#   2. Waits for it to become healthy
#   3. Runs the compat-tests suite
#   4. Stops the dev server (unless it was already running)
#
# Usage:
#   bash e2e-reimpl.sh

PORT=3000
BASE_URL="http://localhost:${PORT}/api/v1"
MAX_WAIT=30
ALREADY_RUNNING=false
DEV_PID=""

cleanup() {
  if [[ "$ALREADY_RUNNING" == "false" && -n "$DEV_PID" ]]; then
    echo ""
    echo "=== Stopping dev server (pid $DEV_PID) ==="
    kill "$DEV_PID" 2>/dev/null || true
    wait "$DEV_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Check if server is already listening
if curl -sf "${BASE_URL}/ping" >/dev/null 2>&1; then
  echo "=== Dev server already running on port ${PORT} ==="
  ALREADY_RUNNING=true
else
  echo "=== Starting dev server on port ${PORT} ==="
  cd apps/server
  pnpm dev > /dev/null 2>&1 &
  DEV_PID=$!
  cd - > /dev/null

  echo -n "Waiting for server"
  elapsed=0
  until curl -sf "${BASE_URL}/ping" >/dev/null 2>&1; do
    if [[ $elapsed -ge $MAX_WAIT ]]; then
      echo " TIMEOUT after ${MAX_WAIT}s"
      exit 1
    fi
    echo -n "."
    sleep 1
    ((elapsed++))
  done
  echo " ready (${elapsed}s)"
fi

echo ""
echo "=== Running compat tests against reimpl ==="
cd apps/compat-tests
pnpm test:reimpl
