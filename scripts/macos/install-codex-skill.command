#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SKILL_NAME="codeui-to-figma"
LEGACY_SKILL_NAME="codex-activity-figma"
SOURCE_DIR="$PROJECT_DIR/skills/$SKILL_NAME"
TARGET_ROOT="${CODEX_HOME:-$HOME/.codex}/skills"
TARGET_DIR="$TARGET_ROOT/$SKILL_NAME"
LEGACY_TARGET_DIR="$TARGET_ROOT/$LEGACY_SKILL_NAME"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Skill source not found: $SOURCE_DIR"
  exit 1
fi

mkdir -p "$TARGET_ROOT"
rm -rf "$LEGACY_TARGET_DIR"
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
rsync -a \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude '.DS_Store' \
  "$SOURCE_DIR"/ "$TARGET_DIR"/

echo "Installed Codex skill:"
echo "  $TARGET_DIR"
echo
echo "Restart Codex or start a new thread if the skill list was already loaded."
