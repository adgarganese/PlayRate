#!/usr/bin/env node
/**
 * EAS Build: ensure .expo/web exists; remove ios/.xcode.env.local if present so the
 * Xcode phase only uses .xcode.env (which has NODE_BINARY for EAS) and doesn't hit
 * "Permission denied" when sourcing .xcode.env.local.
 * Run by eas-build-pre-install in package.json.
 */
const fs = require('fs');
const path = require('path');

const cwd = process.cwd();

const dir = path.join(cwd, '.expo', 'web');
try {
  fs.mkdirSync(dir, { recursive: true });
} catch (e) {
  console.warn('[eas-ensure-expo-cache] mkdir .expo/web failed:', e.message);
}

// Remove .xcode.env.local so the build phase only sources .xcode.env (avoids "Permission denied")
const xcodeEnvLocal = path.join(cwd, 'ios', '.xcode.env.local');
try {
  if (fs.existsSync(xcodeEnvLocal)) {
    fs.unlinkSync(xcodeEnvLocal);
  }
} catch (e) {
  console.warn('[eas-ensure-expo-cache] remove ios/.xcode.env.local failed:', e.message);
}

// React Native autolinking writes to ios/build/generated/autolinking/autolinking.json during pod install.
// Create the dir so Ruby's FileUtils.mkdir_p doesn't hit EACCES on EAS.
const autolinkingDir = path.join(cwd, 'ios', 'build', 'generated', 'autolinking');
try {
  fs.mkdirSync(autolinkingDir, { recursive: true });
} catch (e) {
  console.warn('[eas-ensure-expo-cache] mkdir ios/build/generated/autolinking failed:', e.message);
}
