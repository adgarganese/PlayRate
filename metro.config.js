// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ignore parent directory's node_modules to prevent ENOENT errors
config.watchFolders = [__dirname];
config.resolver.blockList = [
  // Block parent directory's node_modules if it exists
  /.*\/App\/node_modules\/.*/,
];
// Force Metro to resolve modules from this project's node_modules (fixes "Unable to resolve" on Windows)
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

module.exports = config;
