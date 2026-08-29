import { test, expect } from '@playwright/test';
import { build } from 'esbuild';

let styleBundle = '';

test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['src/content/style-injector.js'],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'GmixerStyle',
    platform: 'browser',
    define: {
      __GMIXER_DEBUG__: 'false',
    },
  });
  styleBundle = result.outputFiles[0].text;
});

test('does not adopt the page theme into nested gMixer UI shadows', async ({ page }) => {
  await page.setContent(`
    <div id="gmixer-settings" popover="manual" role="dialog">
      <gmixer-settings></gmixer-settings>
    </div>
  `);
  await page.addScriptTag({ content: styleBundle });
  await page.evaluate(() => {
    const host = document.querySelector('gmixer-settings');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<gmixer-color-panel></gmixer-color-panel>';
    const nestedHost = shadow.querySelector('gmixer-color-panel');
    const nested = nestedHost.attachShadow({ mode: 'open' });
    nested.innerHTML = '<button class="inner">Settings</button>';
    window.GmixerStyle.injectStyle('button { color: rgb(1, 2, 3) !important; }');
  });
  const color = await page.locator('gmixer-settings').evaluate((host) =>
    getComputedStyle(
      host.shadowRoot.querySelector('gmixer-color-panel').shadowRoot.querySelector('.inner')
    ).color
  );
  expect(color).not.toBe('rgb(1, 2, 3)');
});

test('does not adopt the page theme into gMixer UI shadows', async ({ page }) => {
  await page.setContent(`
    <div id="gmixer-settings" popover="manual" role="dialog">
      <gmixer-settings></gmixer-settings>
    </div>
  `);
  await page.addScriptTag({ content: styleBundle });
  await page.evaluate(() => {
    const host = document.querySelector('gmixer-settings');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button class="inner">Settings</button>';
    window.GmixerStyle.injectStyle('button { color: rgb(1, 2, 3) !important; }');
  });
  const color = await page.locator('gmixer-settings').evaluate((host) =>
    getComputedStyle(host.shadowRoot.querySelector('.inner')).color
  );
  expect(color).not.toBe('rgb(1, 2, 3)');
});

test('adopts the active theme into a late open shadow root', async ({ page }) => {
  await page.setContent('<x-widget></x-widget>');
  await page.addScriptTag({ content: styleBundle });
  await page.evaluate(() => {
    window.GmixerStyle.injectStyle(
      '[data-gmixer-role="header"] { background-color: rgb(31, 31, 31) !important; }'
    );
    const shadow = document.querySelector('x-widget').attachShadow({ mode: 'open' });
    shadow.innerHTML = '<header data-gmixer-role="header">Widget</header>';
    window.GmixerStyle.syncAdoptedTheme();
  });

  const color = await page.locator('x-widget').evaluate((host) =>
    getComputedStyle(host.shadowRoot.querySelector('header')).backgroundColor
  );
  expect(color).toBe('rgb(31, 31, 31)');
});

test('reasserts the theme after a later page stylesheet', async ({ page }) => {
  await page.setContent('<div class="target">Target</div>');
  await page.addScriptTag({ content: styleBundle });
  await page.evaluate(() => {
    window.GmixerStyle.injectStyle('.target { color: rgb(240, 240, 240) !important; }');
    const late = document.createElement('style');
    late.textContent = '.target { color: rgb(10, 10, 10) !important; }';
    document.head.appendChild(late);
    window.GmixerStyle.injectStyle('.target { color: rgb(240, 240, 240) !important; }');
  });
  await expect(page.locator('.target')).toHaveCSS('color', 'rgb(240, 240, 240)');
});

test('supports independent theming in same-origin frames', async ({ page }) => {
  await page.setContent('<iframe srcdoc="<main>Frame</main>"></iframe><main>Top</main>');
  await page.addScriptTag({ content: styleBundle });
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  await frame.addScriptTag({ content: styleBundle });
  await page.evaluate(() => {
    window.GmixerStyle.injectStyle('main { background: rgb(25, 25, 25) !important; }');
  });
  await frame.evaluate(() => {
    window.GmixerStyle.injectStyle('main { background: rgb(25, 25, 25) !important; }');
  });
  await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(25, 25, 25)');
  await expect(frame.locator('main')).toHaveCSS('background-color', 'rgb(25, 25, 25)');
});
