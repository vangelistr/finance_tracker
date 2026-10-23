import { writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { MongoClient, ObjectId } from 'mongodb';
import { a11yIssues, captureAll, overflowIssues, OWNER } from './helpers';

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

  // Savings goals: an emergency fund, and a holiday with a deadline and one contribution.
  await page.goto('/goals');
  await page.getByRole('button', { name: 'Δημιουργία αποθεματικού έκτακτης ανάγκης' }).click();
  const efSheet = page.getByRole('dialog', { name: 'Νέος στόχος' });
  await efSheet.getByLabel('Στόχος', { exact: true }).fill('3.000');
  await efSheet.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(efSheet).toBeHidden();
  await page.getByRole('button', { name: 'Νέος στόχος' }).click();
  const goalSheet = page.getByRole('dialog', { name: 'Νέος στόχος' });
  await goalSheet.getByLabel('Όνομα').fill('Διακοπές');
  await goalSheet.getByLabel('Στόχος', { exact: true }).fill('900');
  await goalSheet.getByLabel('Προθεσμία (προαιρετική)').fill('2027-06-30');
  await goalSheet.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(goalSheet).toBeHidden();
  await page.getByRole('listitem').filter({ hasText: 'Διακοπές' }).getByRole('button', { name: 'Κατάθεση' }).click();
  const contribution = page.getByRole('dialog', { name: /Νέα κατάθεση/ });
  await contribution.getByLabel('Ποσό').fill('180');
  await contribution.getByRole('button', { name: 'Κατάθεση' }).click();
  await expect(contribution).toBeHidden();
  await expect(page.getByText('180,00 € από 900,00 €')).toBeVisible();

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
    ['/goals', 'goals'],
    ['/plan', 'plan'],
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

  // The Smart Plan records this month's amounts on the goals; running it twice is safe.
  await page.goto('/plan');
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Καταχώριση στους στόχους' }).click();
    await expect(page.getByText('Οι καταθέσεις του μήνα καταχωρίστηκαν.')).toBeVisible();
  }

  // Investing module: absent while off, then turned on in Settings with cached prices as the worker would leave them.
  expect((await page.goto('/investing'))!.status()).toBe(404);
  await page.goto('/settings');
  await expect(page.getByRole('link', { name: 'Επενδύσεις' })).toHaveCount(0);
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/settings') && r.request().method() === 'PATCH');
  await page.getByRole('switch', { name: /Ενότητα επενδύσεων/ }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByRole('switch', { name: /Ενότητα επενδύσεων/ })).toHaveAttribute('aria-checked', 'true');
  await page.goto('/investing/watchlist');
  await expect(page.getByText('10 από 40 μέσα')).toBeVisible();
  if (process.env.MONGO_URL) {
    const client = await MongoClient.connect(process.env.MONGO_URL);
    const db = client.db();
    const keys = (await db.collection('watchlist').find({}).toArray()).map((w) => ({ key: w.instrumentKey as string, currency: w.currency as string }));
    const dates: string[] = [];
    for (let d = new Date(Date.now() - 86_400_000); dates.length < 300; d = new Date(d.getTime() - 86_400_000)) {
      if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) dates.unshift(d.toISOString().slice(0, 10));
    }
    // IWDA stays without prices to show the "not enough history" state; SXR8 gets a short manual-like history.
    const docs = keys
      .filter((k) => !k.key.startsWith('IWDA'))
      .flatMap((k, n) =>
        (k.key.startsWith('SXR8') ? dates.slice(-40) : dates).map((date, i) => ({
          instrumentKey: k.key,
          date,
          closeMicros: Math.round((80 + n * 23) * (1 + (0.0002 * (n + 1) - 0.0001)) ** i * (1 + 0.012 * Math.sin(i / (3 + n))) * 1e6),
          currency: k.currency,
          provider: k.currency === 'USD' ? 'twelvedata' : 'eodhd',
          adjusted: k.currency !== 'USD',
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + 400 * 86_400_000),
        })),
      );
    await db.collection('prices').insertMany(docs);
    // No emergency fund in the tour, so the plan would hold investing back; let it through to show a split.
    await db.collection('users').updateOne({ role: 'owner' }, { $set: { 'settings.plan.investWhileEfUnfunded': true } });
    await db.collection('fx_rates').insertOne({ _id: dates.at(-1) as never, base: 'EUR', rates: { USD: 1.1234, GBP: 0.83825 }, fetchedAt: new Date(), expiresAt: new Date(Date.now() + 400 * 86_400_000) });
    await client.close();
  }
  await page.goto('/investing/profile');
  await page.getByLabel('Σε περισσότερα από 10 χρόνια').check();
  await page.getByLabel('Θα κρατούσα το πλάνο όπως είναι').check();
  await page.getByLabel('Έως 3 χρόνια').check();
  await page.getByRole('button', { name: 'Αποθήκευση απαντήσεων' }).click();
  await expect(page.getByText('Αποθηκεύτηκε.')).toBeVisible();
  for (const [path, name] of [
    ['/investing', 'investing-ranking'],
    ['/investing/suggestion', 'investing-suggestion'],
    ['/investing/watchlist', 'investing-watchlist'],
    ['/investing/profile', 'investing-profile'],
  ] as const) {
    await page.goto(path);
    await captureAll(page, name);
  }
  await page.goto('/investing/watchlist');
  await page.getByRole('button', { name: 'Προσθήκη μέσου' }).click();
  await captureAll(page, 'investing-add');
  await page.keyboard.press('Escape');

  // Tax estimator and month-end reports: a freelance source with invoices this year, and an account opened two
  // months ago so closed months exist.
  if (process.env.MONGO_URL) {
    const client = await MongoClient.connect(process.env.MONGO_URL);
    const db = client.db();
    const owner = (await db.collection('users').findOne({ role: 'owner' }))!;
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    await db.collection('users').updateOne({ _id: owner._id }, { $set: { createdAt: new Date(now.getTime() - 70 * 86_400_000), 'settings.tax': { employmentIncomeMinor: 1800000, efkaClassId: 'special', insuranceStartYear: year - 1 } } });
    const sourceId = new ObjectId();
    await db.collection('income_sources').insertOne({ _id: sourceId, userId: owner._id, name: 'Τιμολόγια πελατών', type: 'one_time', categoryId: null, currency: 'EUR', accountId: null, schedule: null, expectedNetMinor: null, expectedGrossMinor: null, freelance: true, active: true, createdAt: now, updatedAt: now });
    const food = await db.collection('categories').findOne({ userId: owner._id, name: 'Σούπερ μάρκετ' });
    const docs = [];
    for (let m = 3; m < month; m++) {
      const mm = String(m).padStart(2, '0');
      docs.push({ kind: 'income', amountMinor: 150000, localDate: `${year}-${mm}-15`, incomeSourceId: sourceId, categoryId: null });
      docs.push({ kind: 'expense', amountMinor: 8000 + m * 900, localDate: `${year}-${mm}-08`, incomeSourceId: null, categoryId: food?._id ?? null });
    }
    await db.collection('transactions').insertMany(
      docs.map((d) => ({ _id: new ObjectId(), userId: owner._id, status: 'done', grossMinor: null, accountId: null, toAccountId: null, recurringExpenseId: null, month: d.localDate.slice(0, 7), note: '', origin: 'manual', occurrenceKey: null, clientId: null, doneAt: now, createdAt: now, updatedAt: now, ...d })),
    );
    await client.close();
  }
  await page.goto('/tax');
  await expect(page.getByRole('heading', { name: /Για μεταφορά στο αποθεματικό φόρων τώρα/ })).toBeVisible();
  await captureAll(page, 'tax');
  await page.getByRole('button', { name: 'Μεταφορά στο αποθεματικό' }).first().click();
  await expect(page.getByText(/^Μεταφέρθηκε /).first()).toBeVisible();
  await page.goto('/reports');
  await captureAll(page, 'reports');
  await page.getByRole('link').filter({ hasText: /\d{4}/ }).first().click();
  await expect(page.getByText(/Στιγμιότυπο της/)).toBeVisible();
  await captureAll(page, 'report');
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
  await page.screenshot({ path: 'artifacts/screenshots/report-print.png', fullPage: true });
  await page.emulateMedia({ media: 'screen' });

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
  writeFileSync('artifacts/screenshots/overflow.json', JSON.stringify(overflowIssues, null, 2));
  // No screen may scroll sideways (Greek text and money never overflow).
  expect(overflowIssues).toEqual([]);
  const blocking = a11yIssues.filter((i) => i.impact === 'serious' || i.impact === 'critical');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});
