import { test, expect } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  for (const resource of ['sessions', 'focus_areas']) {
    const records = await (await request.get(`/api/${resource}`)).json();
    for (const record of records)
      await request.delete(
        `/api/${resource}/${record[resource === 'sessions' ? 'id_session' : 'id_focus_area']}`,
      );
  }
});

test('curriculum, revision recency, confirmation and mobile layout', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create your first Focus Area' }).click();
  await page.getByLabel('Focus Area name', { exact: true }).fill('Systems');
  await page.getByLabel('Track curriculum completion').check();
  await page.getByRole('button', { name: 'Create Focus Area', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Systems', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add subtopic to Systems' }).click();
  await page.getByLabel('Subtopic name', { exact: true }).fill('Caching');
  await page.getByLabel('Status', { exact: true }).selectOption('Completed');
  await page.getByRole('button', { name: 'Save subtopic', exact: true }).click();
  await expect(page.getByText('100% complete', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await page.getByRole('button', { name: 'Review Caching', exact: true }).click();
  await page.getByLabel('Date', { exact: true }).fill(new Date().toISOString().slice(0, 10));
  await page.getByLabel('Slots', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(page.getByText(/Last covered:.*Last reviewed:/)).toBeVisible();
  await page.getByRole('button', { name: 'Sessions', exact: true }).click();
  await expect(page.getByRole('cell', { name: /Revision/ })).toBeVisible();
  await page.getByRole('button', { name: /Delete session on/ }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('cell', { name: /Revision/ })).toBeVisible();
  await page.getByRole('button', { name: /Delete session on/ }).click();
  await page.getByRole('button', { name: 'Delete session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No sessions yet' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('timer completion requires confirmation and supports an extra slot', async ({
  page,
  request,
}) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Log session', exact: true }).first().click();
  await page.getByLabel('Date', { exact: true }).fill(new Date().toISOString().slice(0, 10));
  await page.getByLabel('Slots', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Start timer', exact: true }).click();
  await page.clock.fastForward(30 * 60000);
  await expect(page.getByRole('button', { name: 'Review and save session' })).toBeVisible();
  expect(await (await request.get('/api/sessions')).json()).toHaveLength(0);
  await page.getByRole('button', { name: 'Continue for 30 minutes' }).click();
  await page.clock.fastForward(30 * 60000);
  await page.getByRole('button', { name: 'Review and save session' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await (await request.get('/api/sessions')).json()).toHaveLength(0);
  await page.getByRole('button', { name: 'Review and save session' }).click();
  await page.getByRole('button', { name: 'Confirm and save session' }).click();
  await expect(page.getByRole('region', { name: 'Study timer', exact: true })).toHaveCount(0);
  const sessions = await (await request.get('/api/sessions')).json();
  expect(sessions).toHaveLength(1);
  expect(sessions[0].slots).toBe(2);
});

test('quick 30-minute timer pauses, resumes and prompts a break without logging', async ({
  page,
  request,
}) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Start 30-minute timer', exact: true }).click();
  const timer = page.getByRole('region', { name: 'Study timer', exact: true });
  await expect(timer.getByRole('timer')).toHaveText('30:00');
  await page.clock.fastForward(5 * 60000);
  await timer.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.clock.fastForward(10 * 60000);
  await expect(timer.getByRole('timer')).toHaveText('25:00');
  await timer.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.fastForward(25 * 60000);
  await expect(timer.getByRole('timer')).toHaveText('00:00');
  await expect(timer.getByRole('status')).toContainText('Take a break');
  await expect(page.getByRole('button', { name: 'Dismiss', exact: true })).toBeVisible();
  expect(await (await request.get('/api/sessions')).json()).toHaveLength(0);
});
