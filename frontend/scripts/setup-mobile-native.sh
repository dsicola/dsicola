#!/usr/bin/env bash
# DSICOLA — Um comando: em macOS configura iOS (se faltar) e sincroniza; senão só Android.
# Uso: npm run setup:mobile
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" == "Darwin" ]]; then
  bash "$ROOT/scripts/setup-ios-macos.sh"
else
  echo ">>> Sistema não é macOS — apenas sincronização Android (pasta android/)."
  npm run cap:sync
fi
