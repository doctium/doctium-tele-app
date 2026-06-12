// Metro config for an npm-workspaces monorepo (canonical Expo setup). Lets Metro
// resolve + transpile workspace packages like @doctium/mobile-ui from the repo
// root, and forces a single copy of React/React Native via nodeModulesPaths.
// Docs: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so changes in packages/* are picked up.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Don't walk up the tree past nodeModulesPaths — avoids duplicate React copies.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
