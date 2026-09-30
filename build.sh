#!/bin/bash
set -e

echo "🔨 Installing dependencies..."
npm install --omit=dev

echo "✅ Build complete - Chromium bundled with @sparticuz/chromium"
