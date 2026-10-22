import { expect, test } from '@playwright/test';
import { OWNER } from './helpers';

// CI smoke test against `docker compose` on a fresh database: first run, onboarding, quick-add, data isolation
// of the session (sign-out redirects), health endpoints.
test('fresh install works end to end', async ({ page, request }) => {
  expect((await request.get('/api/health')).ok()).toBe(true);
  expect(await (await request.get('/api/ready')).json()).toMatchObject({ status: 'ready' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page).toHaveURL(/\/setup$/);
  await page.getByLabel('Όνομα').fill(OWNER.name);
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Κωδικός').fill(OWNER.password);
  await page.getByRole('button', { name: 'Συνέχεια' }).click();
  await page.getByRole('button', { name: 'Συνέχεια' }).click();
  await page.getByRole('button', { name: 'Δημιουργία λογαριασμού' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByRole('button', { name: 'Επόμενο' }).click();
  await page.getByRole('button', { name: 'Επόμενο' }).click();
  await page.getByRole('button', { name: 'Δημιουργία' }).click();
  await page.getByRole('button', { name: 'Πάμε στην επισκόπηση' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole('button', { name: 'Νέο έξοδο' }).filter({ visible: true }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Νέο έξοδο' }).filter({ visible: true });
  await sheet.getByLabel('Ποσό').fill('4,50');
  await sheet.getByRole('button', { name: 'Σούπερ μάρκετ', exact: true }).click();
  await sheet.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(sheet).toBeHidden();

  await page.goto('/transactions');
  await expect(page.getByText('−4,50', { exact: false }).first()).toBeVisible();

  // Registration is closed after setup.
  const csrf = (await page.context().cookies()).find((c) => c.name.endsWith('ft_csrf'))?.value ?? '';
  const again = await page.request.post('/api/auth/setup', {
    headers: { origin: new URL(page.url()).origin, 'x-csrf-token': csrf },
    data: { email: 'b@example.com', name: 'B', password: 'another-password-1', locale: 'el', currency: 'EUR', timezone: 'Europe/Athens', investingEnabled: false },
  });
  expect(again.status()).toBe(409);

  await page.context().clearCookies();
  await page.goto('/transactions');
  await expect(page).toHaveURL(/\/login$/);
});
