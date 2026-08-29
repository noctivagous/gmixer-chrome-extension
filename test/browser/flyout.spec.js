import { test, expect } from '@playwright/test';
import { build } from 'esbuild';

let controllerBundle = '';

test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['src/content/flyout-controller.js'],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'GmixerFlyout',
    platform: 'browser',
  });
  controllerBundle = result.outputFiles[0].text;
});

async function installController(page) {
  await page.addScriptTag({ content: controllerBundle });
  await page.evaluate(() => {
    window.stopGmixerFlyout = window.GmixerFlyout.startFlyoutAnalysis();
  });
}

test('themes a CSS-only Windows Central-shaped hover flyout', async ({ page }) => {
  await page.setContent(`
    <style>
      nav { width: 700px; height: 44px; background: rgb(20, 20, 20); }
      li { position: relative; width: 140px; height: 44px; }
      .meganav-item-list {
        display: none;
        position: absolute;
        width: 260px;
        height: 180px;
        background: transparent;
      }
      li:hover > .meganav-item-list { display: block; }
      [data-gmixer-role="surface"] { background: rgb(49, 49, 49) !important; }
    </style>
    <nav>
      <ul><li><a href="#">Features</a>
        <ul class="meganav-item-list"><li>Windows Central LIVE</li></ul>
      </li></ul>
    </nav>
  `);
  await installController(page);

  await page.getByRole('link', { name: 'Features' }).hover();
  const panel = page.locator('.meganav-item-list');
  await expect(panel).toHaveAttribute('data-gmixer-role', 'surface');
  await expect(panel).toHaveAttribute('data-gmixer-overlay', '');
  await expect(panel).toHaveCSS('background-color', 'rgb(49, 49, 49)');
});

test('finds an aria-controlled portal after dynamic SPA replacement', async ({ page }) => {
  await page.route('https://fixture.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<main id="app"></main>' })
  );
  await page.goto('https://fixture.test/first');
  await installController(page);
  await page.evaluate(() => {
    history.pushState({}, '', '/second');
    document.querySelector('#app').innerHTML = `
      <button aria-controls="portal-menu">Open menu</button>
      <div id="portal-menu" role="menu" hidden style="position:fixed;width:180px;height:120px">
        <button role="menuitem">Settings</button>
      </div>`;
    const button = document.querySelector('[aria-controls="portal-menu"]');
    button.addEventListener('click', () => {
      document.querySelector('#portal-menu').hidden = false;
    });
  });

  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('#portal-menu')).toHaveAttribute('data-gmixer-role', 'surface');
});
