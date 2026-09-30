#!/bin/bash
set -e

echo "🔨 Installing dependencies..."
npm ci

echo "📥 Installing Chrome browser for Puppeteer..."
npx puppeteer browsers install chrome

echo "✅ Build complete - Chrome installed successfully"
