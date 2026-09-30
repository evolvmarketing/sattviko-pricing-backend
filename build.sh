#!/bin/bash
set -e
export PUPPETEER_CACHE_DIR="$(pwd)/.cache/puppeteer"
echo "🔨 Installing dependencies (Node $(node -v))..."
npm install --omit=dev
echo "📥 Installing Chrome into $PUPPETEER_CACHE_DIR ..."
npx puppeteer browsers install chrome
ls "$PUPPETEER_CACHE_DIR"
echo "✅ Build complete"
