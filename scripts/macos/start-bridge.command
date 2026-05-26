#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
export BRIDGE_DATA_DIR="${BRIDGE_DATA_DIR:-$HOME/Library/Application Support/CodeUi-to-Figma/bridge}"

cd "$PROJECT_DIR"
mkdir -p "$BRIDGE_DATA_DIR"

echo "Starting CodeUi-to-Figma Bridge..."
echo "Project: $PROJECT_DIR"
echo "URL: http://localhost:39217"
echo "Data: $BRIDGE_DATA_DIR"
echo

npm run bridge
