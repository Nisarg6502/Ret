// Builds src/ into a single self-contained dist/index.html and reports its size.
// Usage: node tools/build.mjs [--watch]
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const CAP = 300 * 1024; // hard size cap in bytes (raw file)
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const watch = process.argv.includes('--watch');

// Small, safe GLSL minifier: strips comments, collapses whitespace, removes spaces
// around punctuation. Preprocessor lines keep their own line.
export function minGLSL(src) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const out = [];
  let buf = '';
  for (let line of src.split('\n')) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      if (buf) out.push(buf), (buf = '');
      out.push(line.replace(/\s+/g, ' '));
    } else buf += ' ' + line;
  }
  if (buf) out.push(buf);
  return out
    .map((l) =>
      l.startsWith('#')
        ? l
        : l
            .replace(/\s+/g, ' ')
            .replace(/\s*([{}()\[\];,=*/<>!&|?:^%])\s*/g, '$1')
            // only drop spaces around + and - when that cannot fuse two operators
            .replace(/([^+\-])\s*([+\-])\s*(?![+\-])/g, '$1$2')
            .replace(/(\d)\.0(?!\d)/g, '$1.')
            .replace(/(^|[^\w.])0\.(\d)/g, '$1.$2')
            .trim()
    )
    .join('\n') + '\n';
}

const glslPlugin = {
  name: 'glsl',
  setup(b) {
    b.onLoad({ filter: /\.glsl$/ }, async (a) => ({
      contents: minGLSL(await fs.promises.readFile(a.path, 'utf8')),
      loader: 'text',
    }));
  },
};

function minCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

function assemble(js, meta) {
  let html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
  html = html.replace(/<style>([\s\S]*?)<\/style>/, (_, c) => '<style>' + minCSS(c) + '</style>');
  html = html.replace(/<!--(?!JS-->)[\s\S]*?-->/g, '').replace(/>\s+</g, '><').trim();
  const safe = js.replace(/<\/script/gi, '<\\/script');
  html = html.replace('<!--JS-->', () => '<script>' + safe + '</script>');
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist/index.html'), html);
  report(html, meta);
  return html;
}

function kb(n) {
  return (n / 1024).toFixed(1).padStart(6) + ' KB';
}

function report(html, meta) {
  const raw = Buffer.byteLength(html);
  const gz = zlib.gzipSync(html, { level: 9 }).length;
  const br = zlib.brotliCompressSync(html, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;
  // per-module bytes from esbuild metafile
  const out = Object.values(meta.outputs)[0];
  const groups = {};
  for (const [file, info] of Object.entries(out.inputs)) {
    const key = file.replace(/^src\//, '').replace(/\.(js|glsl)$/, (m) => m);
    groups[key] = (groups[key] || 0) + info.bytesInOutput;
  }
  const rows = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  console.log('\n  module                              size');
  for (const [k, v] of rows) console.log('  ' + k.padEnd(32) + kb(v));
  console.log('  ' + '-'.repeat(40));
  console.log('  dist/index.html (raw)           ' + kb(raw) + `   cap ${kb(CAP).trim()}`);
  console.log('  gzip                            ' + kb(gz));
  console.log('  brotli                          ' + kb(br) + '\n');
  if (raw > CAP) {
    console.error(`  SIZE CAP EXCEEDED: ${raw} > ${CAP} bytes`);
    process.exitCode = 1;
  }
}

const opts = {
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  metafile: true,
  legalComments: 'none',
  plugins: [glslPlugin],
  logLevel: 'warning',
  absWorkingDir: root,
};

if (watch) {
  const ctx = await esbuild.context({
    ...opts,
    plugins: [
      glslPlugin,
      {
        name: 'assemble',
        setup(b) {
          b.onEnd((r) => {
            if (!r.errors.length) assemble(r.outputFiles[0].text, r.metafile);
          });
        },
      },
    ],
  });
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: path.join(root, 'dist'), port: 8080 });
  console.log(`watching src/, serving dist/ at http://localhost:${port}`);
} else {
  const r = await esbuild.build(opts);
  assemble(r.outputFiles[0].text, r.metafile);
}
