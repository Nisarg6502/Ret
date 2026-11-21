// Renders fixed views with headless Chromium for visual review / regression.
// Usage: node tools/shots.mjs [name ...]   (outputs to shots/)
import { createRequire } from 'node:module';
// Playwright may be installed globally (resolved via NODE_PATH), so load it through require.
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'shots');
fs.mkdirSync(out, { recursive: true });
const url = 'file://' + path.join(root, 'dist/index.html');

const VIEWS = {
  golden: 'shot&t=16.9',
  noon: 'shot&t=12.5&pitch=-0.15',
  sunset: 'shot&t=17.55&pitch=0',
  dawn: 'shot&t=6.6&pitch=0',
  night: 'shot&t=22&pitch=0.35',
  high: 'shot&t=16.4&h=180&pitch=-0.25',
  ground: 'shot&t=16.2&pitch=-0.6',
  phone: 'shot&t=16.9',
};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VIEWS);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const name of names) {
  const ctx = await browser.newContext(
    name === 'phone' ? { ...devices['Pixel 7 landscape'] } : { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url + '#' + VIEWS[name]);
  try {
    const t0 = Date.now();
    for (;;) {
      await new Promise((r) => setTimeout(r, 1000));
      const f = await page.evaluate(() => (window.__ret ? window.__ret.frames : -1));
      if (f >= 10) break;
      if (errors.length) throw new Error('page error');
      if (Date.now() - t0 > 240000) throw new Error('timeout');
    }
  } catch (e) {
    console.log(name, e.message, errors.join('\n').slice(-3000));
  }
  const file = path.join(out, name + '.png');
  await page.screenshot({ path: file });
  const info = await page.evaluate(() => window.__ret && { sun: window.__ret.sun, cam: window.__ret.cam });
  console.log(name, file, errors.length ? 'ERRORS:\n' + errors.join('\n').slice(0, 3000) : 'ok', JSON.stringify(info?.sun?.elev));
  await ctx.close();
}
await browser.close();
