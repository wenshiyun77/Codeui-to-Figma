#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_DIR"
mkdir -p var/bridge

echo "Starting CodeUi-to-Figma Bridge..."
echo "Project: $PROJECT_DIR"
echo "URL: http://localhost:39217"
echo

npm run bridge
