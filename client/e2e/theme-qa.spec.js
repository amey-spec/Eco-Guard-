import { test, expect } from '@playwright/test';

/**
 * Dark-theme QA audit.
 * Renders key routes with `.dark` forced on and inspects the painted DOM for
 * readability regressions: text whose contrast against its effective
 * background is too low, or large surfaces that stayed light while `.dark`
 * is active. Screenshots land in test-results/theme-shots for eyeballing.
 */

const PUBLIC_ROUTES = ['/', '/hazards', '/education', '/safety', '/quiz', '/login', '/register', '/map'];
const FULL_ROUTES = ['/', '/hazards', '/education', '/safety', '/quiz', '/map', '/dashboard', '/report', '/notifications', '/profile', '/admin'];

const AUDIT = () => {
  const issues = [];
  const hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);

  const parseColor = (str) => {
    const m = str.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  };
  const toLinear = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luminance = (c) => 0.2126 * toLinear(c[0]) + 0.7152 * toLinear(c[1]) + 0.0722 * toLinear(c[2]);
  const contrast = (a, b) => {
    const l1 = luminance(a);
    const l2 = luminance(b);
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
  };

  const rootBg = getComputedStyle(document.body).backgroundColor;

  document.querySelectorAll('body *').forEach((el) => {
    if (!visible(el)) return;
    if (el.closest('svg, .leaflet-tile-pane, .leaflet-control-attribution')) return;

    // Effective background: walk up until an opaque color is found.
    let bg = null;
    let node = el;
    while (node && node !== document.body) {
      const c = parseColor(getComputedStyle(node).backgroundColor || '');
      if (c && c[3] === 255) { bg = c; break; }
      node = node.parentElement;
    }
    if (!bg) bg = parseColor(rootBg);

    // Text on an element that paints it directly.
    if (bg && hasOwnText(el)) {
      const fg = parseColor(getComputedStyle(el).color);
      if (fg && fg[3] === 255) {
        const r = contrast(fg, bg);
        if (r < 2.5) {
          issues.push({
            kind: 'low-contrast',
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || '').trim().slice(0, 60),
            fg: getComputedStyle(el).color,
            bg: `rgb(${bg[0]},${bg[1]},${bg[2]})`,
            ratio: r.toFixed(2),
            cls: (el.className && String(el.className).slice(0, 120)) || '',
          });
        }
      }
    }

    // Large light surfaces that should not exist in dark mode (cards etc).
    if (bg && bg[0] > 230 && bg[1] > 230 && bg[2] > 225) {
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > 30000) {
        const cs = getComputedStyle(el);
        if (!/gradient/.test(cs.backgroundImage)) {
          issues.push({
            kind: 'light-surface',
            tag: el.tagName.toLowerCase(),
            cls: (el.className && String(el.className).slice(0, 120)) || '',
            bg: `rgb(${bg[0]},${bg[1]},${bg[2]})`,
            area: Math.round(area),
          });
        }
      }
    }
  });
  return issues;
};

async function forceDark(page) {
  await page.addInitScript(() => {
    localStorage.setItem('ecoguard_theme', 'dark');
    document.documentElement.classList.add('dark');
  });
}

async function walkPage(page) {
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 900) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 700));
  });
}

test.setTimeout(150_000);

test('theme menu switches day / night / follow-system and persists', async ({ page }) => {
  // Fresh context has no saved preference → follows the (light) system theme.
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).not.toHaveClass(/dark/);

  const openMenu = async () => page.getByRole('button', { name: 'Change color theme' }).click();

  // Night
  await openMenu();
  await page.getByRole('menuitemradio', { name: /Night/ }).click();
  await expect(html).toHaveClass(/dark/);

  // Reload — the explicit choice persists.
  await page.reload();
  await expect(html).toHaveClass(/dark/);

  // Day
  await openMenu();
  await page.getByRole('menuitemradio', { name: /Day/ }).click();
  await expect(html).not.toHaveClass(/dark/);

  // Follow system — headless Chromium reports light, so day is resolved.
  await openMenu();
  await page.getByRole('menuitemradio', { name: /Follow system/ }).click();
  await expect(html).not.toHaveClass(/dark/);
  await page.reload();
  await expect(html).not.toHaveClass(/dark/);
});

test('account theme follows the user across devices', async ({ page }) => {
  const email = `themeqa-${Date.now()}@ecoguard.com`;
  const password = 'ThemeTest123';
  const html = page.locator('html');

  // Register a brand-new account; a fresh device starts by following the
  // (light) system theme.
  await page.goto('/register');
  await page.fill('#name', 'Theme QA');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.fill('#confirmPassword', password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await expect(html).not.toHaveClass(/dark/);

  // Choose Night — this saves to the account (after the debounce).
  await page.getByRole('button', { name: 'Change color theme' }).click();
  await page.getByRole('menuitemradio', { name: /Night/ }).click();
  await expect(html).toHaveClass(/dark/);
  await page.waitForTimeout(1600);

  // Sign out (this device keeps its dark choice for guest browsing).
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(html).toHaveClass(/dark/);

  // Simulate a brand-new device: reset the local preference to "follow
  // system" and reload — the guest view is light again.
  await page.evaluate(() => localStorage.removeItem('ecoguard_theme'));
  await page.reload();
  await expect(html).not.toHaveClass(/dark/);

  // Sign in from this "new device": the account's Night preference applies
  // automatically — no menu interaction needed.
  await page.getByRole('banner').getByRole('link', { name: 'Sign in' }).click();
  await page.waitForURL(/\/login/);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await expect(html).toHaveClass(/dark/);
});

test('dark theme audit — public routes', async ({ page }) => {
  await forceDark(page);
  const all = [];
  for (const route of PUBLIC_ROUTES) {
    await page.goto(route, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(900);
    await walkPage(page);
    const issues = await page.evaluate(AUDIT);
    issues.forEach((i) => all.push({ route, ...i }));
    await page.screenshot({ path: `test-results/theme-shots/dark-${route.replace(/\//g, '_') || 'home'}.png`, fullPage: true }).catch(() => {});
  }
  expect(all, JSON.stringify(all.slice(0, 60), null, 1)).toEqual([]);
});

test('dark theme audit — full (authed as admin)', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await forceDark(page);
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@ecoguard.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|\//, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);

  // The admin account carries its own theme preference (defaults to "follow
  // system", which headless Chromium resolves to light) — pick Night so the
  // audits below run against the dark theme as intended.
  const html = page.locator('html');
  await page.getByRole('button', { name: 'Change color theme' }).click();
  await page.getByRole('menuitemradio', { name: /Night/ }).click();
  await expect(html).toHaveClass(/dark/);
  // Let the debounced account save land before any reload, or the account's
  // still-stored "system" preference would pull the theme back to light.
  await page.waitForTimeout(1600);

  const all = [];
  for (const route of FULL_ROUTES) {
    await page.goto(route, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(900);
    await walkPage(page);
    const issues = await page.evaluate(AUDIT);
    issues.forEach((i) => all.push({ route, ...i }));
    await page.screenshot({ path: `test-results/theme-shots/dark-auth-${route.replace(/\//g, '_') || 'home'}.png`, fullPage: true }).catch(() => {});
  }
  await context.close();
  expect(all, JSON.stringify(all.slice(0, 60), null, 1)).toEqual([]);
});
