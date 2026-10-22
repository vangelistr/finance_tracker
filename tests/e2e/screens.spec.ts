import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { a11yIssues, captureAll, OWNER } from './helpers';

// Screenshot tour over a fresh database (run with `npm run screenshots`). Steps depend on each other.
test.describe.configure({ mode: 'serial' });

test('setup wizard → onboarding → dashboard → settings → login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/setup$/);
  await captureAll(page, 'setup');

  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByLabel('Όνομα').fill(OWNER.name);
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Κωδικός').fill(OWNER.password);
  await page.getByRole('button', { name: 'Συνέχεια' }).click();
  await page.getByRole('button', { name: 'Συνέχεια' }).click();
  await page.getByRole('button', { name: 'Δημιουργία λογαριασμού' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await captureAll(page, 'onboarding');

  await page.getByRole('button', { name: 'Πάμε στην επισκόπηση' }).click();
  await expect(page).toHaveURL(/\/$/);
  await captureAll(page, 'dashboard');

  // Money uses tabular figures: every digit must have the same advance width in the app font.
  const widths = await page.evaluate(() => {
    const measure = (text: string) => {
      const el = document.createElement('span');
      el.className = 'num';
      el.style.cssText = 'position:absolute;visibility:hidden;font-size:40px;white-space:nowrap';
      el.textContent = text;
      document.body.append(el);
      const w = el.getBoundingClientRect().width;
      el.remove();
      return w;
    };
    return ['1111111111', '0000000000', '7777777777'].map(measure);
  });
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(0.5);

  await page.goto('/settings');
  await captureAll(page, 'settings');

  // PWA installability: a valid manifest and a service worker that controls the page.
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ display: 'standalone', start_url: '/', scope: '/' });
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons as Array<{ src: string }>) expect((await page.request.get(icon.src)).ok()).toBe(true);
  await page.reload();
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { active: !!reg.active, scope: new URL(reg.scope).pathname };
  });
  expect(sw).toEqual({ active: true, scope: '/' });

  await page.context().clearCookies();
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await captureAll(page, 'login');

  await page.goto('/offline');
  await captureAll(page, 'offline');

  writeFileSync('artifacts/screenshots/a11y.json', JSON.stringify(a11yIssues, null, 2));
  const blocking = a11yIssues.filter((i) => i.impact === 'serious' || i.impact === 'critical');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});
