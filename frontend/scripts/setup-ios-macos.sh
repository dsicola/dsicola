#!/usr/bin/env bash
# DSICOLA — Gera pasta ios/, instala pods e sincroniza Capacitor (macOS).
# Uso: npm run setup:ios   ou   bash scripts/setup-ios-macos.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Este script é só para macOS (Xcode + iOS)."
  exit 1
fi

ensure_pod() {
  if command -v pod >/dev/null 2>&1; then
    return 0
  fi
  echo ">>> CocoaPods não está no PATH. A tentar instalar…"
  if command -v brew >/dev/null 2>&1; then
    export HOMEBREW_NO_AUTO_UPDATE=1
    brew install cocoapods
  else
    echo "Instale CocoaPods manualmente:"
    echo "  https://guides.cocoapods.org/using/getting-started.html"
    echo "  ou: sudo gem install cocoapods"
    exit 1
  fi
}

ensure_pod

if [[ ! -d ios ]]; then
  echo ">>> A adicionar plataforma iOS (Capacitor)…"
  npx cap add ios
fi

echo ">>> Build móvel + cap sync (iOS + Android)…"
npm run cap:sync

echo ""
echo "Pronto. Abrir Xcode:  npm run cap:open:ios"
echo "Abrir Android Studio: npm run cap:open:android"
