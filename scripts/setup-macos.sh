#!/usr/bin/env bash
set -euo pipefail
command -v node >/dev/null || { echo "Install Node.js 20+ first."; exit 1; }
command -v docker >/dev/null || { echo "Install Docker Desktop first."; exit 1; }
echo "Prerequisites found. Copy .env.example to dashboard/.env.local, then follow START_HERE.md."

