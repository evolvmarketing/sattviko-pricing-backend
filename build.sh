#!/bin/bash
set -e
echo "🔨 Installing dependencies..."
npm install --omit=dev
echo "📥 Installing Chrome into ./.cache/puppeteer ..."
npx puppeteer browsers install chrome
ls -la .cache/puppeteer || true
echo "✅ Build complete"
