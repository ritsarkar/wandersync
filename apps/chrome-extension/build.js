import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy static assets (HTML, CSS) to dist
function copyAssets() {
  fs.copyFileSync(path.join(__dirname, 'src/popup/index.html'), path.join(distDir, 'popup.html'));
  fs.copyFileSync(path.join(__dirname, 'src/popup/popup.css'), path.join(distDir, 'popup.css'));
  fs.copyFileSync(path.join(__dirname, 'src/options/index.html'), path.join(distDir, 'options.html'));
  fs.copyFileSync(path.join(__dirname, 'src/options/options.css'), path.join(distDir, 'options.css'));
  console.log('[Build] Copied static HTML & CSS assets to dist/');
}

async function build() {
  copyAssets();

  const isWatch = process.argv.includes('--watch');

  const buildOptions = {
    entryPoints: {
      background: path.join(__dirname, 'src/background/index.ts'),
      content: path.join(__dirname, 'src/content/index.ts'),
      popup: path.join(__dirname, 'src/popup/popup.ts'),
      options: path.join(__dirname, 'src/options/options.ts')
    },
    bundle: true,
    outdir: distDir,
    target: ['chrome110'],
    format: 'esm',
    sourcemap: true,
    logLevel: 'info'
  };

  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('[Build] Watching for changes in Chrome extension...');
  } else {
    await esbuild.build(buildOptions);
    console.log('[Build] Chrome Extension built successfully into dist/');
  }
}

build().catch((err) => {
  console.error('[Build Error]', err);
  process.exit(1);
});
