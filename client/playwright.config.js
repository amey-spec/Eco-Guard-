import { defineConfig } from '@playwright/test';
import fs from 'fs';

// Reuse the system Chrome (no `npx playwright install` download needed).
// Falls back to Playwright's own `chrome` channel handling if none of the
// usual install locations are present.
// CI can point at a specific binary with PLAYWRIGHT_CHROME_EXECUTABLE
// (e.g. /usr/bin/google-chrome on GitHub-hosted runners).
const chromeCandidates = [
  process.env.PLAYWRIGHT_CHROME_EXECUTABLE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const executablePath = chromeCandidates.find((p) => p && fs.existsSync(p));

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  // Auto-start the Vite dev server when it isn't already running
  // (reuseExistingServer keeps an already-running instance).
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    ...(executablePath ? { launchOptions: { executablePath } } : { channel: 'chrome' }),
  },
});
