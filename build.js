// Build script: bundles src/ into extension/ (the unpacked-extension load directory).
// extension/manifest.json and fonts/ are authored directly and are NOT generated.
// src/config/fonts.js IS generated from extension/fonts/ before each bundle.
import { context } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { generateFontsCatalog } from './scripts/generate-fonts-catalog.mjs';

const OUT_DIR = 'extension';
const WATCH = process.argv.includes('--watch');
const MINIFY = process.argv.includes('--minify');
const DEBUG = process.argv.includes('--debug') || process.env.GMIXER_DEBUG === '1';

mkdirSync(OUT_DIR, { recursive: true });
generateFontsCatalog();

const shared = {
  bundle: true,
  minify: MINIFY,
  sourcemap: MINIFY ? 'external' : 'inline',
  target: ['chrome122'], // Opera GX current Chromium engine only
  // Critical: Lit's package exports have a "node" condition that pulls in
  // @lit-labs/ssr-dom-shim and can leave global customElements null/broken.
  // Force the browser build for content/background bundles.
  platform: 'browser',
  conditions: ['browser', 'import', 'module', 'default'],
  mainFields: ['browser', 'module', 'main'],
  logLevel: 'info',
  define: {
    __GMIXER_DEBUG__: DEBUG ? 'true' : 'false',
  },
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
  {
    // Page main-world stub for window.gmixerDebug (debug builds inject it).
    entryPoints: ['src/debug/main-world-bridge.js'],
    outfile: `${OUT_DIR}/debug-bridge.js`,
    format: 'iife',
    ...shared,
  },
  {
    entryPoints: ['src/ui/walkthrough-frame.js'],
    outfile: `${OUT_DIR}/walkthrough-frame.js`,
    format: 'iife',
    ...shared,
  },
  {
    entryPoints: ['src/ui/settings-frame.js'],
    outfile: `${OUT_DIR}/settings-frame.js`,
    format: 'iife',
    ...shared,
  },
];

async function run() {
  const contexts = await Promise.all(entries.map((cfg) => context(cfg)));

  if (WATCH) {
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log(
      `gMixer: watching for changes... debug=${DEBUG} (Ctrl+C to stop)`
    );
  } else {
    for (const ctx of contexts) {
      await ctx.rebuild();
      await ctx.dispose();
    }
    console.log(`gMixer: build complete -> ${OUT_DIR}/ (debug=${DEBUG})`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
