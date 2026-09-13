import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const API = 'http://localhost:5000/api';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '../../server');

async function loginAs(pageOrRequest, email, password) {
  const res = await pageOrRequest.post(`${API}/auth/login`, {
    data: { email, password },
  });
  const body = await res.json();
  return body.token;
}

async function removeTestNotifications(reportId) {
  try {
    const script =
      `const sqlite3 = require('sqlite3');` +
      `const db = new sqlite3.Database('database.sqlite');` +
      `db.run("DELETE FROM notifications WHERE message LIKE '%${reportId}%'", () => db.close());`;
    // execFileSync avoids the shell entirely, so no quoting can mangle the SQL.
    execFileSync('node', ['-e', script], { cwd: SERVER_DIR });
  } catch (err) {
    console.warn('Notification cleanup skipped:', err.message);
  }
}

test('a submitted report appears as an unread inbox notification and can be marked read', async ({ page, request }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // Sign in through the real UI so the app has a token in localStorage.
  await page.goto('/login');
  await page.locator('#email').fill('user@ecoguard.com');
  await page.locator('#password').fill('user123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/dashboard/);

  const token = await page.evaluate(() => localStorage.getItem('ecoguard_token'));
  expect(token).toBeTruthy();

  // Submit a report as that user to trigger a real "report received" notification.
  const submitRes = await request.post(`${API}/reports/submit`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      title: 'Inbox UI test signal',
      hazard_type: 'Air Pollution',
      severity: 'Moderate',
      location: 'Inbox test location',
      description: 'Automated Playwright test to verify the interactive notification inbox.',
    },
  });
  expect(submitRes.ok()).toBeTruthy();
  const { reportId } = await submitRes.json();

  try {
    // The milestone should appear in the inbox as an unread row.
    await page.goto('/notifications');
    await expect(page.getByText(new RegExp(reportId))).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Mark read' }).first()).toBeVisible();

    // Mark every message read — the unread indicator should clear.
    const markAll = page.getByRole('button', { name: 'Mark all read' });
    if (await markAll.isVisible()) {
      await markAll.click();
      await expect(page.getByText('All caught up')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Mark read' })).toHaveCount(0);
    }
    expect(pageErrors).toEqual([]);
  } finally {
    // Remove the test report (admin) and its notification rows.
    const adminToken = await loginAs(request, 'admin@ecoguard.com', 'admin123');
    await request.delete(`${API}/admin/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    removeTestNotifications(reportId);
  }
});
