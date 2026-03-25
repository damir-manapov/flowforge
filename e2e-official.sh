#!/bin/bash
set -euo pipefail

# Run e2e compat tests against the official Flowise Docker image.
#
# What it does:
#   1. Starts the Flowise container on port 3001 (if not already running)
#   2. Waits for it to become healthy
#   3. Runs the compat-tests suite
#   4. Stops the container (unless it was already running)
#
# Usage:
#   bash e2e-official.sh

PORT=3001
BASE_URL="http://localhost:${PORT}/api/v1"
COMPOSE_FILE="compose/docker-compose.flowise.yml"
MAX_WAIT=60
ALREADY_RUNNING=false

cleanup() {
  if [[ "$ALREADY_RUNNING" == "false" ]]; then
    echo ""
    echo "=== Stopping Flowise container ==="
    docker compose -f "$COMPOSE_FILE" down
  fi
}
trap cleanup EXIT

# Check if Flowise is already listening
if curl -sf "${BASE_URL}/ping" >/dev/null 2>&1; then
  echo "=== Flowise already running on port ${PORT} ==="
  ALREADY_RUNNING=true
else
  echo "=== Starting Flowise container on port ${PORT} ==="
  docker compose -f "$COMPOSE_FILE" up -d --wait

  echo -n "Waiting for Flowise"
  elapsed=0
  until curl -sf "${BASE_URL}/ping" >/dev/null 2>&1; do
    if [[ $elapsed -ge $MAX_WAIT ]]; then
      echo " TIMEOUT after ${MAX_WAIT}s"
      docker compose -f "$COMPOSE_FILE" logs --tail=30
      exit 1
    fi
    echo -n "."
    sleep 1
    ((elapsed++))
  done
  echo " ready (${elapsed}s)"
fi

echo ""
echo "=== Running compat tests against official Flowise ==="
cd apps/compat-tests
pnpm test:official
