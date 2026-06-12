// Preloaded via `node -r ./load-env.cjs` (dev and prod) so environment
// variables are populated BEFORE any module code runs. This matters because
// some modules read process.env at import time (e.g. JwtModule.register reads
// JWT_SECRET in auth.module.ts), which happens before Nest's bootstrap.
//
// Loads the monorepo root .env first, then an app-local .env as an override.
// dotenv does not overwrite already-set vars, so real process env (in
// production/CI) always wins over the files.
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });
