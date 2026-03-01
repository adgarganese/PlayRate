#!/usr/bin/env node
/**
 * EAS Build: ensure .expo/web exists before prebuild to avoid EACCES during icon generation.
 * Run by eas-build-pre-install in package.json.
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), '.expo', 'web');
try {
  fs.mkdirSync(dir, { recursive: true });
} catch (e) {
  console.warn('[eas-ensure-expo-cache] mkdir .expo/web failed:', e.message);
}
