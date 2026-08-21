// Build script: bundles src/ into extension/ (the unpacked-extension load directory).
// extension/manifest.json and fonts/ are authored directly and are NOT generated.
import { context } from 'esbuild';
import { mkdirSync } from 'node:fs';

const OUT_DIR = 'extension';
const WATCH = process.argv.includes('--watch');
const MINIFY = process.argv.includes('--minify');

mkdirSync(OUT_DIR, { recursive: true });

const shared = {
  bundle: true,
  minify: MINIFY,
  sourcemap: MINIFY ? false : 'inline',
  target: ['chrome122'], // Opera GX current Chromium engine only
  // Critical: Lit's package exports have a "node" condition that pulls in
  // @lit-labs/ssr-dom-shim and can leave global customElements null/broken.
  // Force the browser build for content/background bundles.
  platform: 'browser',
  conditions: ['browser', 'import', 'module', 'default'],
  mainFields: ['browser', 'module', 'main'],
  logLevel: 'info',
};

const entries = [
  {
    entryPoints: ['src/content/content-start.js'],
    outfile: `${OUT_DIR}/content-start.js`,
    format: 'iife',
    ...shared,
  },
  {
    // Includes settings UI (Lit) via dynamic import from settings-host.
    entryPoints: ['src/content/content-end.js'],
    outfile: `${OUT_DIR}/content-end.js`,
    format: 'iife',
    ...shared,
  },
  {
    entryPoints: ['src/background.js'],
    outfile: `${OUT_DIR}/background.js`,
    format: 'esm',
    ...shared,
  },
];

async function run() {
  const contexts = await Promise.all(entries.map((cfg) => context(cfg)));

  if (WATCH) {
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log('gMixer: watching for changes... (Ctrl+C to stop)');
  } else {
    for (const ctx of contexts) {
      await ctx.rebuild();
      await ctx.dispose();
    }
    console.log(`gMixer: build complete -> ${OUT_DIR}/`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
