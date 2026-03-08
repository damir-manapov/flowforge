#!/bin/bash
set -euo pipefail

# Scan Docker images for critical/high vulnerabilities using Trivy.
# Exit 1 if any critical or high CVEs are found.
#
# Usage:
#   bash compose/scan.sh          # build & scan flowforge-server
#   bash compose/scan.sh --all    # also scan flowise & caddy images used in UI profile

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SERVER_IMAGE="compose-flowforge-server"
FLOWISE_IMAGE="flowiseai/flowise:3.0.13"
CADDY_IMAGE="caddy:alpine"

SEVERITY="CRITICAL,HIGH"

scan_image() {
  local image=$1
  echo ""
  echo "=== Scanning $image ==="
  trivy image --severity "$SEVERITY" --exit-code 1 --quiet "$image"
}

# Build the server image so there's something to scan
echo "=== Building server image ==="
docker compose -f "$SCRIPT_DIR/docker-compose.yml" build flowforge-server --quiet

images=("$SERVER_IMAGE")

if [[ "${1:-}" == "--all" ]]; then
  echo "=== Pulling UI profile images ==="
  docker pull --quiet "$FLOWISE_IMAGE"
  docker pull --quiet "$CADDY_IMAGE"
  images+=("$FLOWISE_IMAGE" "$CADDY_IMAGE")
fi

failed=0
for img in "${images[@]}"; do
  if ! scan_image "$img"; then
    failed=1
  fi
done

echo ""
if [[ $failed -ne 0 ]]; then
  echo "Vulnerability scan FAILED — critical/high CVEs found."
  exit 1
fi

echo "Vulnerability scan passed — no critical/high CVEs."
