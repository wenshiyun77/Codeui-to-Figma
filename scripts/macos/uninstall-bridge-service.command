#!/bin/zsh
set -euo pipefail

LABEL="com.codeui.to-figma.bridge"
LEGACY_LABEL="com.codex.figma-activity-bridge"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LEGACY_PLIST="$HOME/Library/LaunchAgents/$LEGACY_LABEL.plist"

if [[ -f "$PLIST" ]]; then
  launchctl unload "$PLIST" >/dev/null 2>&1 || true
  rm "$PLIST"
  echo "Uninstalled $LABEL"
else
  echo "$LABEL is not installed"
fi

if [[ -f "$LEGACY_PLIST" ]]; then
  launchctl unload "$LEGACY_PLIST" >/dev/null 2>&1 || true
  rm "$LEGACY_PLIST"
  echo "Uninstalled legacy $LEGACY_LABEL"
fi
