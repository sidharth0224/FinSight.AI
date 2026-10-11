import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
const base = process.argv[2] || 'https://13.206.122.144';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.url().startsWith(base + '/api/') && r.status() >= 400)
    errors.push(`${r.request().method()} ${new URL(r.url()).pathname}: ${r.status()}`);
});
let conversationId;
try {
  await page.goto(base + '/login');
  await page.getByLabel('Email address').fill('finance@northstar.demo');
  await page.getByLabel('Password', { exact: true }).fill(process.env.DEMO_SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in to workspace', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByText('₹18.6L', { exact: true })).toBeVisible();
  console.log('PASS: public HTTPS login and live dashboard');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'artifacts/ec2-dashboard-desktop.png', fullPage: true });
  for (const [path, title] of [
    ['/budgets', 'Budget intelligence'],
    ['/expenses', 'Employee expenses'],
    ['/knowledge', 'Knowledge base'],
    ['/audit', 'Audit & insights'],
    ['/settings', 'Settings'],
    ['/copilot', 'Clarity starts with a question.'],
  ]) {
    await page.goto(base + path);
    await expect(page.getByRole('heading', { name: title, exact: false }).first()).toBeVisible();
    await page.waitForTimeout(600);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw Error(path + ' horizontal overflow');
    console.log('PASS: live ' + path);
  }
  const pending = page.waitForResponse(
    (r) => r.url().endsWith('/api/copilot') && r.request().method() === 'POST',
    { timeout: 90000 },
  );
  await page.getByRole('button', { name: /Make policy crystal clear/ }).click();
  const response = await pending;
  if (response.status() !== 201) throw Error('Copilot failed: ' + response.status());
  const result = await response.json();
  conversationId = result.conversationId;
  if (!result.citations?.length || result.warnings?.some((w) => /unavailable|failed/i.test(w)))
    throw Error('Live Copilot evidence unavailable');
  await page.locator('.source-citations button').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  console.log('PASS: public live Copilot and supporting evidence');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/dashboard');
  await expect(page.getByText('₹18.6L', { exact: true })).toBeVisible();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'artifacts/ec2-dashboard-mobile.png', fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw Error('Mobile horizontal overflow');
  console.log('PASS: public mobile dashboard');
  if (errors.length) throw Error(errors.join('; '));
  console.log('PASS: no browser errors or failed API requests');
} finally {
  if (conversationId)
    await page.request.delete(base + '/api/conversations/' + conversationId, {
      headers: { Origin: base },
    });
  await page.request.post(base + '/api/auth/logout', { headers: { Origin: base } });
  await browser.close();
}
