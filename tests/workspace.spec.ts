import { test, expect } from '@playwright/test';
test('landing menu supports keyboard dismissal and workspace navigation', async ({ page }) => {
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  await menu.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(menu).toBeFocused();
  await menu.click();
  await page.getByRole('dialog').getByRole('link', { name: /Overview/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Financial overview' })).toBeVisible();
});
test('all main pages fit the viewport and have working navigation', async ({ page }) => {
  for (const [path, title] of [
    ['/dashboard', 'Financial overview'],
    ['/budgets', 'Budget intelligence'],
    ['/expenses', 'Employee expenses'],
    ['/knowledge', 'Knowledge base'],
    ['/audit', 'Audit & insights'],
    ['/settings', 'Settings'],
    ['/copilot', 'Clarity starts with a question.'],
    ['/', 'Your finances.'],
    ['/login', 'Sign in to FinSight'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, exact: false }).first()).toBeVisible();
    await page.waitForTimeout(450);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow, `${path} horizontal overflow`).toBe(false);
  }
});
test('department filter updates metrics', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText('₹18.6L', { exact: true })).toBeVisible();
  await page.getByLabel('Filter by department').selectOption('marketing');
  await expect(page.getByText('₹4.3L', { exact: true }).first()).toBeVisible();
});
test('copilot answer opens accessible supporting evidence', async ({ page }) => {
  await page.goto('/copilot');
  await page.getByRole('button', { name: /Find the budget outliers/ }).click();
  await expect(page.getByText('Three departments are above their October budget')).toBeVisible();
  await page.getByRole('button', { name: /October department budgets/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('expense submission validates and persists', async ({ page }) => {
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Submit expense', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Department').selectOption('marketing');
  await dialog.getByLabel('Amount (INR)').fill('1200.50');
  await dialog.getByLabel('Merchant').fill('Demo Merchant');
  await dialog.getByLabel('Business purpose').fill('Client presentation materials');
  await dialog.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel('Search expenses').fill('Demo Merchant');
  await expect(page.getByText('₹1,200.50', { exact: true })).toBeVisible();
});
test('budget allocation updates totals', async ({ page }) => {
  await page.goto('/budgets');
  await page.getByRole('button', { name: 'Allocate budget' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Department').selectOption('marketing');
  await dialog.getByLabel('Allocation (INR)').fill('450000');
  await dialog.getByRole('button', { name: 'Save allocation' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('₹19L', { exact: true })).toBeVisible();
});
test('document upload shows honest indexing state', async ({ page }) => {
  await page.goto('/knowledge');
  await expect(page.getByText('Travel & reimbursement policy', { exact: true })).toBeVisible();
  await page
    .getByLabel('Upload company document')
    .setInputFiles({
      name: 'demo-policy.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This is a synthetic policy document for preview testing.'),
    });
  await expect(page.getByText('demo-policy.txt', { exact: true })).toBeVisible();
  await expect(page.getByText('not indexed', { exact: true })).toBeVisible();
});
