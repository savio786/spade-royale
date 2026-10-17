// Renders public/icons/icon.svg to PNGs (192, 512) with the preinstalled Chromium via Playwright.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const svg = readFileSync('public/icons/icon.svg', 'utf8');
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const size of [192, 512, 1024]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0}</style>${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}`);
  await page.screenshot({ path: `public/icons/icon-${size}.png` });
}
await browser.close();
console.log('icons written');
