import { defineConfig } from 'tsup';

// Bundles the API (and the workspace TS packages it imports) into dist/ for production.
// Workspace packages ship as TS source, so they must be bundled rather than externalized.
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: [/^@carevoice\//],
});
