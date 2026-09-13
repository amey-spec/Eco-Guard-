import { test, expect } from '@playwright/test';

const FIVE_MB = 5 * 1024 * 1024;

async function fillValidReport(page) {
  await page.goto('/report');
  await expect(page.getByText('Leave a signal')).toBeVisible();
  await page.locator('#report-title').fill('Oily sheen on the creek');
  await page.locator('#report-type').selectOption('Water Pollution');
  await page.locator('#report-severity').selectOption('Moderate');
  await page.locator('#report-location').fill('Riverside North, near the old mill bridge');
  await page.locator('#report-description').fill(
    'A rainbow-coloured sheen on the water that smells faintly of fuel.'
  );
}

test('rejects a non-image file with a clear inline message', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await fillValidReport(page);

  // Pick a plain-text file as the "photo".
  await page.locator('#report-image').setInputFiles({
    name: 'field-notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image at all'),
  });

  await expect(page.getByText('Please choose a JPG, PNG or WebP image.')).toBeVisible();
  // No preview should appear and no submit attempt should be made.
  await expect(page.getByAltText('Preview of your upload')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send the signal' })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('rejects an image over the 5 MB limit with a clear inline message', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await fillValidReport(page);

  // A valid PNG mimetype but > 5 MB content.
  await page.locator('#report-image').setInputFiles({
    name: 'huge-photo.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(FIVE_MB + 1, 1),
  });

  await expect(page.getByText('That image is over the 5 MB limit — try a smaller one.')).toBeVisible();
  await expect(page.getByAltText('Preview of your upload')).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});
