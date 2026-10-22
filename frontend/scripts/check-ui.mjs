import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';

// Run against Vite. Fixtures are injected at the browser's module boundary;
// no test wallet or write can reach the actual contract.
const baseURL = process.env.CLAIMLINE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CLAIMLINE_BROWSER ? { executablePath: process.env.CLAIMLINE_BROWSER } : {}),
});
await mkdir('artifacts/ui', { recursive: true });
const holder = `0x${'1'.repeat(40)}`;
const insurer = `0x${'2'.repeat(40)}`;
const wei = (value) => `${BigInt(value) * 10n ** 18n}`;
const policy = (id, coverage, status = 'ACTIVE') => ({
  id,
  coverage,
  status,
  insurer,
  holder,
  wording: 'Coverage for a documented event within the policy period.',
  conditions: [
    'The incident occurred in the covered period.',
    'A receipt supports the amount claimed.',
  ],
  limitWei: wei(1000),
  deductibleWei: wei(50),
  startsAt: '1767225600',
  endsAt: '1798761600',
  poolWei: wei(2500),
  paidWei: '0',
  claimCount: 1,
  policyVersion: '1',
});
const claim = (id, status) => ({
  id,
  policyId: 'POL-001',
  claimant: holder,
  status,
  outcome: status === 'FILED' ? 'NONE' : status,
  incidentAt: '1770000000',
  claimedWei: wei(250),
  evidenceUri: 'https://example.com/evidence.txt',
  evidenceDigest: `sha256:${'a'.repeat(64)}`,
  payoutBand: status === 'FILED' ? 0 : 100,
  confidenceBand: status === 'FILED' ? 'NONE' : 'HIGH',
  reason: status === 'FILED' ? '' : 'The receipt and dates satisfy the policy conditions.',
  conditions:
    status === 'FILED'
      ? []
      : [
          {
            condition: 'The incident occurred in the covered period.',
            passed: true,
            reason: 'The incident falls within the covered dates.',
          },
        ],
  inconsistencies: [],
  contentDigest: '',
  payoutWei: status === 'FILED' ? '0' : wei(200),
  policyVersion: '1',
  evidenceRevision: 1,
  evaluatedRevision: status === 'FILED' ? 0 : 1,
  decisionRevision: status === 'FILED' ? 0 : 1,
  appeals: 0,
  decisionIsCurrent: status !== 'FILED',
});
const fixture = {
  policies: [
    policy('POL-001', 'Travel disruption'),
    policy('POL-002', 'Equipment protection'),
    policy('POL-003', 'Delivery protection', 'CLOSED'),
  ],
  claims: [claim('CLM-001', 'FILED'), claim('CLM-002', 'APPROVED'), claim('CLM-003', 'SETTLED')],
  policyCount: 3,
  claimCount: 3,
  policyVersion: '1',
};
const errors = [];

async function fixturePage(mode = 'populated', path = '/app') {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/src/lib/genlayer/client.ts*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
    const data = ${JSON.stringify(fixture)};
    let address = ${mode === 'guest' ? 'null' : JSON.stringify(holder)};
    const listeners = new Set();
    export const subscribe = listener => { listeners.add(listener); listener({ address, isConnecting: false, isWrongChain: false }); return () => listeners.delete(listener); };
    export const restore = async () => {};
    export const connect = async () => {
      if (window.__rejectConnect) throw new Error('Wallet connection was cancelled.');
      address = ${JSON.stringify(holder)};
      listeners.forEach(listener => listener({ address, isConnecting: false, isWrongChain: false }));
    };
    export const disconnect = async () => { address = null; listeners.forEach(listener => listener({ address, isConnecting: false, isWrongChain: false })); };
    export const stateAddress = () => address;
    export const readError = error => error.message;
    export const fetchState = async () => {
      window.__reads = (window.__reads || 0) + 1;
      if (${JSON.stringify(mode)} === 'error' && !window.__recover) throw new Error('Network unavailable in test');
      if (${JSON.stringify(mode)} === 'pending') return new Promise(() => {});
      if (${JSON.stringify(mode)} === 'empty') return { ...data, policies: [], claims: [] };
      if (window.__failRead) throw new Error('Refresh failed in test');
      return structuredClone(data);
    };
    export const adjudicate = async id => {
      if (window.__failWrite) throw new Error('The committee could not complete this review.');
      Object.assign(data.claims.find(claim => claim.id === id), { status: 'APPROVED', outcome: 'APPROVED', evaluatedRevision: 1, decisionRevision: 1, decisionIsCurrent: true, payoutWei: '${wei(200)}', payoutBand: 100, reason: 'The submitted evidence meets the policy conditions.' });
    };
    export const settle = async () => { throw new Error('Unexpected settlement in test'); };
    export const closePolicy = async () => {};
    export const withdrawUnused = async () => {};
    export const latestWrite = () => null;
    export const replaceEvidence = async () => {};
    export const createPolicy = async input => { window.__created = input; };
    export const fileClaim = async input => { window.__filed = input; };
  `,
    }),
  );
  await page.goto(new URL(path, baseURL).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

try {
  const docs = await fixturePage('guest', '/docs');
  await expect(docs.getByRole('heading', { name: 'Your guide to Claimline.' })).toBeVisible();
  await expect(docs.locator('.docs-article section')).toHaveCount(12);
  for (const href of await docs.getByRole('navigation', { name: 'Documentation contents' }).locator('a').evaluateAll(links => links.map(link => link.getAttribute('href')))) {
    await expect(docs.locator(href)).toHaveCount(1);
  }
  await docs.getByRole('textbox', { name: 'Find a documentation topic' }).fill('evidence');
  await expect(docs.getByRole('navigation', { name: 'Documentation contents' }).locator('a')).toHaveCount(1);
  await docs.setViewportSize({ width: 320, height: 900 });
  assert.equal(await docs.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Documentation fits mobile');
  await docs.close();
  const visitor = await fixturePage('guest', '/');
  await expect(
    visitor.getByRole('heading', { name: 'Every claim. Clearly decided.' }),
  ).toBeVisible();
  await expect(visitor.locator('.policy-card')).toHaveCount(0);
  await expect(visitor.locator('link[rel=icon][type="image/svg+xml"]')).toHaveAttribute('href', '/favicon.svg');
  await expect(visitor.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', '/docs');
  const navOffset = await visitor.locator('.site-header .site-nav').evaluate(nav => {
    const rect = nav.getBoundingClientRect(); return Math.abs((rect.left + rect.right) / 2 - innerWidth / 2);
  });
  assert.ok(navOffset < 2, 'Header navigation is centered');
  assert.equal(
    await visitor.evaluate(() => window.__reads || 0),
    0,
    'Landing does not fetch the ledger',
  );
  await visitor.screenshot({ path: 'artifacts/ui/landing-desktop.png', fullPage: true });
  await visitor.getByText('Do I need a wallet to use Claimline?', { exact: true }).click();
  await expect(visitor.locator('.faq-list details').first()).toHaveAttribute('open', '');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await visitor.setViewportSize({ width, height: 900 });
    assert.equal(
      await visitor.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `Landing overflows at ${width}px`,
    );
  }
  await visitor.setViewportSize({ width: 390, height: 844 });
  await visitor.screenshot({ path: 'artifacts/ui/landing-mobile.png', fullPage: true });
  await visitor.evaluate(() => {
    window.__rejectConnect = true;
  });
  await visitor.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await expect(visitor.getByRole('alert')).toContainText('cancelled');
  await visitor.getByRole('link', { name: 'Open claims desk', exact: true }).first().click();
  await expect(visitor).toHaveURL(new URL('/app', baseURL).href);
  await expect(visitor.locator('.policy-card')).toHaveCount(3);
  await expect(visitor.getByText('Browsing without a wallet')).toBeVisible();
  await visitor.getByRole('button', { name: 'Write a policy', exact: true }).click();
  await expect(visitor.getByRole('dialog', { name: 'Connect to continue' })).toBeVisible();
  await visitor.getByRole('button', { name: 'Keep browsing' }).click();
  assert.equal(
    await visitor.evaluate(() => window.__created),
    undefined,
    'Browsing makes no write',
  );
  await visitor.getByRole('button', { name: 'Equipment protection' }).click();
  await visitor
    .getByRole('dialog')
    .getByRole('button', { name: 'File a claim', exact: true })
    .click();
  await visitor
    .getByRole('dialog')
    .getByRole('button', { name: 'Connect wallet', exact: true })
    .click();
  await expect(visitor.getByRole('dialog').getByRole('alert')).toContainText('cancelled');
  await visitor.evaluate(() => {
    window.__rejectConnect = false;
  });
  await visitor
    .getByRole('dialog')
    .getByRole('button', { name: 'Connect wallet', exact: true })
    .click();
  await expect(visitor.getByRole('combobox', { name: 'Policy', exact: true })).toHaveValue(
    'POL-002',
  );
  await visitor.keyboard.press('Escape');
  await visitor.getByTitle('Disconnect wallet').click();
  await expect(visitor.getByText('Browsing without a wallet')).toBeVisible();
  await visitor.getByRole('tab', { name: 'Claims 3' }).click();
  await visitor.getByRole('button', { name: 'Claim CLM-001', exact: true }).click();
  await expect(visitor.getByRole('button', { name: 'Ask the committee' })).toBeDisabled();
  await visitor.keyboard.press('Escape');
  await visitor.goBack();
  await expect(
    visitor.getByRole('heading', { name: 'Every claim. Clearly decided.' }),
  ).toBeVisible();
  await visitor.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await expect(visitor).toHaveURL(new URL('/app', baseURL).href);
  await expect(visitor.getByText('Wallet connected', { exact: true })).toBeVisible();
  await visitor.close();

  const page = await fixturePage();
  await expect(page.locator('.policy-card')).toHaveCount(3);
  await page.screenshot({ path: 'artifacts/ui/populated-desktop.png', fullPage: true });
  await page.getByRole('textbox', { name: 'Search policies' }).fill('equipment');
  await expect(page.locator('.policy-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Equipment protection' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'File a claim', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Policy', exact: true })).toHaveValue('POL-002');
  const text = 'Evidence fixture for frontend hashing verification.';
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'evidence.txt', mimeType: 'text/plain', buffer: Buffer.from(text) });
  await expect(page.getByLabel('SHA-256 digest')).toHaveValue(
    `sha256:${createHash('sha256').update(text).digest('hex')}`,
  );
  await page.getByLabel('Claim document URL').fill('https://example.com/evidence.txt');
  await page.getByRole('button', { name: 'File claim on chain' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  assert.equal(await page.evaluate(() => window.__filed.policyId), 'POL-002');

  await page.getByRole('button', { name: 'Settled', exact: true }).click();
  await expect(page.locator('.ledger tbody tr')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Claim CLM-003', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByRole('button', { name: 'Claim CLM-001', exact: true }).click();
  await page.evaluate(() => {
    window.__failWrite = true;
  });
  await page.getByRole('button', { name: 'Ask the committee' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('could not complete');
  await page.evaluate(() => {
    window.__failWrite = false;
  });
  await page.getByRole('button', { name: 'Ask the committee' }).click();
  await expect(page.getByRole('dialog').locator('.pill.approved')).toHaveText('Approved');
  await expect(page.getByRole('dialog')).toContainText('200.00 GEN');
  await expect(page.getByRole('button', { name: 'Settle payout' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'All claims', exact: true }).click();
  await page.screenshot({ path: 'artifacts/ui/claims-desktop.png', fullPage: true });

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByRole('button', { name: /Switch to .* theme/ })).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/ui/workspace-desktop.png', fullPage: true });
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `Page overflows at ${width}px`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/ui/populated-mobile.png', fullPage: true });
  const trigger = page.getByRole('button', { name: 'Write a policy', exact: true }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Write policy on chain' }).focus();
  await page.keyboard.press('Tab');
  assert.equal(
    await page.evaluate(() => Boolean(document.activeElement.closest('dialog'))),
    true,
    'Dialog contains keyboard focus',
  );
  await page.screenshot({ path: 'artifacts/ui/policy-form-mobile.png' });
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.evaluate(() => {
    window.__failRead = true;
  });
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Showing the last loaded records');
  await expect(page.locator('.policy-card')).toHaveCount(3);
  await page.close();

  const errorPage = await fixturePage('error');
  await expect(
    errorPage.getByRole('heading', { name: 'The ledger couldn’t be reached' }),
  ).toBeVisible();
  await expect(
    errorPage.getByRole('heading', { name: 'The first policy starts here' }),
  ).toHaveCount(0);
  await errorPage.screenshot({ path: 'artifacts/ui/connection-error.png', fullPage: true });
  await errorPage.evaluate(() => {
    window.__recover = true;
  });
  await errorPage.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(errorPage.locator('.policy-card')).toHaveCount(3);
  await errorPage.close();

  const emptyPage = await fixturePage('empty');
  await expect(
    emptyPage.getByRole('heading', { name: 'The first policy starts here' }),
  ).toBeVisible();
  await emptyPage.getByRole('tab', { name: 'Claims 0' }).click();
  await emptyPage.getByRole('button', { name: 'File a claim', exact: true }).first().click();
  await expect(emptyPage.getByRole('button', { name: 'File claim on chain' })).toBeDisabled();
  await emptyPage.close();

  const pendingPage = await fixturePage('pending');
  await expect(pendingPage.getByText('Reading the public ledger', { exact: true })).toBeVisible();
  await pendingPage.clock.install();
  await pendingPage.reload({ waitUntil: 'networkidle' });
  await pendingPage.clock.fastForward(21_000);
  await expect(
    pendingPage.getByRole('heading', { name: 'The ledger couldn’t be reached' }),
  ).toBeVisible();
  await pendingPage.close();
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log(
    'PASS: landing and app navigation, guest browsing, wallet gates, search, filters, policy handoff, hashing, submission, decision refresh, permissions, dialog focus, white theme, 320-1440px layouts, recovery and timeout.',
  );
} finally {
  await browser.close();
}
