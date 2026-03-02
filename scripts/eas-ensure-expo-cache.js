#!/usr/bin/env node
/**
 * EAS Build: ensure .expo/web exists; remove ios/.xcode.env.local if present;
 * make ios/ writable so CocoaPods and codegen can create Pods/ and build/.
 * Run by eas-build-pre-install in package.json.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const cwd = process.cwd();
const isEAS = cwd.includes('expo/workingdir') || process.env.EAS_BUILD === '1';

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

// Force LF line endings in .xcode.env (CRLF causes "unexpected end of file" when expo-configure-project.sh sources it)
const xcodeEnv = path.join(cwd, 'ios', '.xcode.env');
try {
  if (fs.existsSync(xcodeEnv)) {
    let content = fs.readFileSync(xcodeEnv, 'utf8');
    if (content.includes('\r')) {
      content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      fs.writeFileSync(xcodeEnv, content);
    }
  }
} catch (e) {
  console.warn('[eas-ensure-expo-cache] normalize .xcode.env LF failed:', e.message);
}

// On EAS, make ios/ writable so CocoaPods can create Pods/ and codegen can create build/
if (isEAS && fs.existsSync(path.join(cwd, 'ios'))) {
  try {
    execSync('chmod -R u+w ios', { cwd, stdio: 'inherit' });
  } catch (e) {
    console.warn('[eas-ensure-expo-cache] chmod -R u+w ios failed:', e.message);
  }
}
