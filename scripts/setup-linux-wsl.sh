#!/usr/bin/env bash
set -euo pipefail
command -v node >/dev/null || { echo "Install Node.js 20+ first."; exit 1; }
command -v docker >/dev/null || { echo "Install Docker Engine/Desktop integration first."; exit 1; }
if grep -qi microsoft /proc/version 2>/dev/null; then
  echo "WSL2 detected. Native Windows is unsupported; continue inside this shell."
fi
echo "Prerequisites found. Copy .env.example to dashboard/.env.local, then follow START_HERE.md."

