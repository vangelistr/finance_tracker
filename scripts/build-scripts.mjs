// Bundles the worker and the CLIs into dist/*.mjs for the production image. Node built-ins and the native
// argon2 package stay external; everything else is bundled so the image needs no extra node_modules.
import { build } from 'esbuild';

await build({
  entryPoints: { worker: 'src/worker/main.ts', migrate: 'src/cli/migrate.ts', admin: 'src/cli/admin.ts' },
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  tsconfig: 'tsconfig.json',
  alias: { 'server-only': './scripts/empty-module.js' },
  external: ['@node-rs/argon2'],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: 'info',
});
