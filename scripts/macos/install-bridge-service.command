#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LABEL="com.codeui.to-figma.bridge"
LEGACY_LABEL="com.codex.figma-activity-bridge"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LEGACY_PLIST="$HOME/Library/LaunchAgents/$LEGACY_LABEL.plist"
NPM_PATH="$(command -v npm)"

if [[ ! -x "$NPM_PATH" ]]; then
  echo "npm was not found in PATH. Install Node.js first."
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$PROJECT_DIR/var/bridge"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd "$PROJECT_DIR" && "$NPM_PATH" run bridge</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$PROJECT_DIR/var/bridge/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>$PROJECT_DIR/var/bridge/launchd.err.log</string>
  <key>WorkingDirectory</key>
  <string>$PROJECT_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>BRIDGE_HOST</key>
    <string>localhost</string>
    <key>BRIDGE_PORT</key>
    <string>39217</string>
  </dict>
</dict>
</plist>
EOF

launchctl unload "$LEGACY_PLIST" >/dev/null 2>&1 || true
launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl load "$PLIST"

echo "Installed and started $LABEL"
echo "Bridge URL: http://localhost:39217"
echo "Logs:"
echo "  $PROJECT_DIR/var/bridge/launchd.out.log"
echo "  $PROJECT_DIR/var/bridge/launchd.err.log"
