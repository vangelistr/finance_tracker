import { writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { MongoClient } from 'mongodb';
import { a11yIssues, captureAll, OWNER } from './helpers';

// Screenshot and accessibility tour over a fresh database (run with `npm run screenshots`). Steps depend on each other.
test.describe.configure({ mode: 'serial' });

async function quickAdd(page: Page, amount: string, category: string) {
  await page.getByRole('button', { name: 'Νέο έξοδο' }).filter({ visible: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Νέο έξοδο' }).filter({ visible: true });
  await dialog.getByLabel('Ποσό').fill(amount);
  await dialog.getByRole('button', { name: category, exact: true }).click();
  await dialog.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(dialog).toBeHidden();
}

test('first run, onboarding, every main screen, offline queue', async ({ page, context }) => {
  test.setTimeout(300_000);
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

  // Onboarding: income source → categories → accounts → notifications
  await page.getByRole('button', { name: 'Νέα πηγή' }).click();
  const sourceSheet = page.getByRole('dialog', { name: 'Νέα πηγή' });
  await sourceSheet.getByLabel('Όνομα').fill('Wheelsys');
  await sourceSheet.getByLabel('Αναμενόμενο καθαρό').fill('1.450');
  await sourceSheet.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(page.getByText('Wheelsys')).toBeVisible();
  await captureAll(page, 'onboarding-income');
  await page.getByRole('button', { name: 'Επόμενο' }).click();
  await captureAll(page, 'onboarding-categories');
  await page.getByRole('button', { name: 'Επόμενο' }).click();
  await page.getByRole('button', { name: 'Δημιουργία' }).click();
  await expect(page.getByRole('heading', { name: 'Ειδοποιήσεις' })).toBeVisible();
  await page.getByRole('button', { name: 'Πάμε στην επισκόπηση' }).click();
  await expect(page).toHaveURL(/\/$/);

  // Quick-add from the bottom bar
  await quickAdd(page, '12,40', 'Σούπερ μάρκετ');
  await quickAdd(page, '3,20', 'Φαγητό έξω');

  // Fixed cost with a subscription
  await page.goto('/fixed');
  await page.getByRole('button', { name: 'Νέο πάγιο' }).click();
  const fixed = page.getByRole('dialog', { name: 'Νέο πάγιο' });
  await fixed.getByLabel('Όνομα').fill('Netflix');
  await fixed.getByLabel('Ποσό').fill('13,99');
  await fixed.getByRole('switch', { name: /Συνδρομή/ }).click();
  await fixed.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(page.getByText('Netflix')).toBeVisible();

  // Budgets: overall and one category, so the dashboard shows progress.
  await page.goto('/budgets');
  await page.getByLabel('Συνολικός μηνιαίος προϋπολογισμός').fill('800');
  await page.getByLabel('Σούπερ μάρκετ').fill('15');
  await page.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(page.getByText('Αποθηκεύτηκε')).toBeVisible();

  // An in-app notification, as the worker would leave it, so the banner is part of the tour.
  if (process.env.MONGO_URL) {
    const client = await MongoClient.connect(process.env.MONGO_URL);
    const db = client.db();
    const owner = await db.collection('users').findOne({ role: 'owner' });
    await db.collection('notifications').insertOne({ userId: owner!._id, type: 'renewal', titleKey: 'renewalTitle', bodyKey: 'renewalBody', params: { name: 'Netflix', amount: '13,99 €', date: '25 Οκτωβρίου' }, url: '/fixed', createdAt: new Date(), readAt: null });
    await client.close();
  }
  await page.goto('/');
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

  for (const [path, name] of [
    ['/transactions', 'transactions'],
    ['/budgets', 'budgets'],
    ['/monthly', 'monthly'],
    ['/income', 'income'],
    ['/fixed', 'fixed'],
    ['/accounts', 'accounts'],
    ['/categories', 'categories'],
    ['/calendar', 'calendar'],
    ['/settings', 'settings'],
  ] as const) {
    await page.goto(path);
    await captureAll(page, name);
  }

  // Quick-add sheet itself
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Νέο έξοδο' }).filter({ visible: true }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'artifacts/screenshots/quick-add-375-light.png', animations: 'disabled' });
  await page.keyboard.press('Escape');

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

  // Offline queue: save while offline, then come back online and see it synced exactly once.
  await page.reload();
  await context.setOffline(true);
  await quickAdd(page, '7,77', 'Δώρα');
  await expect(page.getByText('Αποθηκεύτηκε στη συσκευή', { exact: false }).first()).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.goto('/transactions');
  await expect(page.getByText('−7,77', { exact: false })).toHaveCount(1, { timeout: 15_000 });

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
