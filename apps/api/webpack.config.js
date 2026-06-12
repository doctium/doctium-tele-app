const path = require('path');
const nodeExternals = require('webpack-node-externals');

// NestJS webpack builder config. The default Nest config externalizes ALL of
// node_modules, but the internal @doctium/* packages are consumed as raw
// TypeScript source (their package.json `main` points at ./src/index.ts), so
// they MUST be bundled or `node dist/main` can't require them at runtime.
// Everything else (native deps like bcrypt, firebase-admin, etc.) stays
// external and is resolved from node_modules at runtime.
module.exports = (options, webpack) => {
  // Optional peer deps that NestJS references conditionally but this app does
  // not install. Without ignoring the missing ones, webpack fails the build
  // with "Module not found". The try/require.resolve guard means installed
  // packages in this list are left untouched (bundled normally).
  const lazyImports = [
    '@nestjs/microservices',
    '@nestjs/microservices/microservices-module',
    '@nestjs/websockets/socket-module',
    'cache-manager',
    '@fastify/static',
  ];

  return {
    ...options,
    externals: [
      nodeExternals({
        // Deps are hoisted to the monorepo root node_modules, so point
        // webpack-node-externals there too; otherwise native modules like
        // bcrypt get bundled (and break on node-pre-gyp's dynamic requires).
        additionalModuleDirs: [path.resolve(__dirname, '../../node_modules')],
        allowlist: [/^@doctium\//],
      }),
    ],
    plugins: [
      ...options.plugins,
      new webpack.IgnorePlugin({
        checkResource(resource) {
          if (!lazyImports.includes(resource)) {
            return false;
          }
          try {
            require.resolve(resource);
          } catch {
            return true;
          }
          return false;
        },
      }),
    ],
  };
};
