import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect } from '../frontend/node_modules/@playwright/test/index.mjs';
import { createAccount } from '../frontend/node_modules/genlayer-js/dist/index.js';
import { generatePrivateKey } from '../frontend/node_modules/viem/_esm/accounts/index.js';
import { client, insurer, root, evidenceDir, save, finalized, read, balances, digest, retryRead } from './studio.mjs';

const deployment = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'deployment.json'), 'utf8'));
const address = deployment.address;
const quick = process.argv.includes('--quick');
function testAccount(name) {
  const file = path.join(root, `.deployer-review-${name}`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, generatePrivateKey());
  return createAccount(fs.readFileSync(file, 'utf8').trim());
}
const holder = testAccount('holder');
const stranger = testAccount('stranger');
for (const account of [holder, stranger]) {
  if (await retryRead(() => client.getBalance({ address: account.address })) === 0n) {
    const funding = await client.sendTransaction({ account: insurer, to: account.address, value: 10n ** 18n, chain: client.chain });
    save(`funding-${account.address}.json`, { hash: funding, recipient: account.address, amountWei: String(10n ** 18n) });
    await finalized(funding);
  }
}
const bookFile = path.join(evidenceDir, 'live-review.json');
const previous = fs.existsSync(bookFile) ? JSON.parse(fs.readFileSync(bookFile, 'utf8')) : null;
const book = previous?.deployment.address === address ? previous : { deployment, participants: { insurer: insurer.address, holder: holder.address, stranger: stranger.address }, checks: [], transactions: [] };
function persist() { save('live-review.json', book); }
persist();
const known = [address, insurer.address, holder.address, stranger.address];
async function write(label, account, method, args, value = 0n, failurePattern) {
  let record = book.transactions.find(t => t.label === label);
  if (book.checks.some(c => c.label === label && c.passed)) {
    console.log('RESUME PASS', label);
    return { before: record.beforeState, after: record.afterState || await read(address), beforeBalances: record.beforeBalances, afterBalances: record.afterBalances, record };
  }
  const before = record?.beforeState || await read(address);
  const beforeBalances = record?.beforeBalances || await balances(known);
  let hash = record?.hash;
  if (!hash) {
    console.log('SUBMIT', label);
    hash = await client.writeContract({ account, address, functionName: method, args, value });
    record = { label, hash, method, args, value: String(value), sender: account.address, status: 'SUBMITTED', beforeState: before, beforeBalances };
    book.transactions.push(record);
  } else console.log('RESUME RECEIPT', label, hash);
  persist();
  const receipt = await finalized(hash);
  for (const child of receipt.triggered_transactions || []) {
    const transferReceipt = await finalized(child);
    save(`transfer-${child}.json`, transferReceipt);
    assert.notEqual(transferReceipt.result_name, 'MAJORITY_DISAGREE');
  }
  save(`${String(book.transactions.indexOf(record) + 1).padStart(2, '0')}-${method}.json`, receipt);
  const after = await read(address);
  const afterBalances = await balances(known);
  const leader = receipt.consensus_data.leader_receipt[0];
  Object.assign(record, { status: receipt.statusName, execution: leader.execution_result, beforeState: before, afterState: after, beforeBalances, afterBalances });
  if (failurePattern) {
    assert.notEqual(leader.execution_result, 'SUCCESS', `${label} must reject`);
    assert.match(JSON.stringify(receipt.consensus_data.leader_receipt.map(r => ({ result: r.result, genvm: r.genvm_result }))), failurePattern);
    assert.deepEqual(after, before, `${label} must preserve contract state`);
    assert.deepEqual(afterBalances, beforeBalances, `${label} must preserve all balances`);
    record.rejection = leader.result;
    record.stateAndBalancesUnchanged = true;
  } else {
    assert.equal(leader.execution_result, 'SUCCESS', JSON.stringify(leader.result));
  }
  book.checks.push({ label, passed: true });
  persist();
  console.log('PASS', label, hash);
  return { hash, receipt, before, after, beforeBalances, afterBalances, record };
}

const goodUrl = 'https://raw.githubusercontent.com/Eminent18254/Claimline/d2832d2/demo/evidence/equipment-damage-report.txt';
const badUrl = 'https://raw.githubusercontent.com/Eminent18254/Claimline/d2832d2/demo/evidence/out-of-scope-report.txt';
async function document(url) {
  const cached = path.join(evidenceDir, url === goodUrl ? 'approved-evidence.txt' : 'declined-evidence.txt');
  if (fs.existsSync(cached)) return 'sha256:' + digest(fs.readFileSync(cached));
  const response = await retryRead(() => fetch(url));
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(path.join(evidenceDir, url === goodUrl ? 'approved-evidence.txt' : 'declined-evidence.txt'), bytes);
  return 'sha256:' + digest(bytes);
}
const goodDigest = await document(goodUrl);
const badDigest = await document(badUrl);

const browser = await chromium.launch({ headless: true, ...(process.env.CLAIMLINE_BROWSER ? { executablePath: process.env.CLAIMLINE_BROWSER } : { channel: 'msedge' }) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'UTC' });
let wallet = insurer;
let walletWrites = [];
await page.exposeFunction('reviewWalletRequest', async ({ method, params = [] }) => {
  if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return [wallet.address];
  if (method === 'eth_chainId') return '0xf22f';
  if (['wallet_switchEthereumChain', 'wallet_addEthereumChain'].includes(method)) return null;
  if (method === 'eth_sendTransaction') {
    const tx = params[0];
    const signed = await wallet.signTransaction({ to: tx.to, data: tx.data, value: BigInt(tx.value || '0'), gas: BigInt(tx.gas),
      gasPrice: BigInt(tx.gasPrice || '0'), nonce: Number(BigInt(tx.nonce)), chainId: 61999, type: 'legacy' });
    const hash = await client.sendRawTransaction({ serializedTransaction: signed });
    walletWrites.push(hash);
    console.log('FRONTEND SUBMIT', hash);
    save('frontend-submitted.json', walletWrites);
    return hash;
  }
  return client.request({ method, params });
});
await page.addInitScript(() => {
  window.ethereum = { request: args => window.reviewWalletRequest(args), on: () => {}, removeListener: () => {} };
  window.__reviewFinalized = [];
  window.addEventListener('claimline:finalized', event => window.__reviewFinalized.push(event.detail));
});
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
async function openApp(account) {
  wallet = account;
  await page.goto('http://127.0.0.1:5173/app', { waitUntil: 'networkidle' });
  // The wallet-mode preference allows restore; connect on the first visit.
  if (await page.getByRole('button', { name: 'Connect wallet', exact: true }).count()) {
    await page.getByRole('banner').getByRole('button', { name: 'Connect wallet', exact: true }).click();
  }
  await expect(page.getByRole('button', { name: 'Write a policy', exact: true }).first()).toBeVisible({ timeout: 30000 });
}
async function frontendDone(label, action) {
  const existing = book.transactions.find(t => t.label === label && t.actualFrontendWrite);
  if (book.checks.some(c => c.label === label && c.passed) && existing) {
    return { before: existing.beforeState, after: existing.afterState, beforeBalances: existing.beforeBalances, afterBalances: existing.afterBalances, record: existing };
  }
  const before = await read(address);
  const beforeBalances = await balances(known);
  const count = walletWrites.length;
  await action();
  await expect.poll(() => walletWrites.length, { timeout: 120000 }).toBe(count + 1);
  const hash = walletWrites.at(-1);
  const receipt = await finalized(hash);
  for (const child of receipt.triggered_transactions || []) {
    const transferReceipt = await finalized(child);
    save(`transfer-${child}.json`, transferReceipt);
    assert.notEqual(transferReceipt.result_name, 'MAJORITY_DISAGREE');
  }
  assert.equal(receipt.consensus_data.leader_receipt[0].execution_result, 'SUCCESS');
  assert.equal(receipt.statusName, 'FINALIZED');
  await page.waitForFunction(hash => window.__reviewFinalized.some(event => event.hash === hash), hash, { timeout: 90000 });
  const event = await page.evaluate(hash => window.__reviewFinalized.find(event => event.hash === hash), hash);
  const after = await read(address);
  const afterBalances = await balances(known);
  const record = { label, hash, method: event.functionName, sender: wallet.address, status: 'FINALIZED', execution: 'SUCCESS', beforeState: before, afterState: after,
    actualFrontendWrite: true, browserFinalizedEvent: event, beforeBalances, afterBalances };
  book.transactions.push(record);
  save(`${String(book.transactions.length).padStart(2, '0')}-frontend-${event.functionName}.json`, receipt);
  book.checks.push({ label, passed: true });
  persist();
  await page.screenshot({ path: path.join(evidenceDir, `frontend-${event.functionName}.png`), fullPage: true });
  console.log('FRONTEND PASS', label, hash);
  return { before, after, beforeBalances, afterBalances, record, receipt };
}

try {
  await openApp(insurer);
  // Deadline is twelve minutes ahead; the fixed evidence incident is 15 October.
  const now = Math.floor(Date.now() / 1000);
  const ends = now - 7 * 86400 + 12 * 60;
  const conditions = [
    'The incident occurred inside the covered period.',
    'The document describes accidental liquid damage to insured equipment.',
    'An authorised repair inspection confirms physical damage.',
    'A repair estimate supports the claimed amount of 0.35 GEN.',
  ];
  const wording = 'This policy covers accidental liquid damage to equipment owned by the insured. A repair centre inspection and estimate must support the claim. Software subscriptions and voluntary cancellations are excluded.';
  if (!book.policyId) {
  await page.getByRole('button', { name: 'Write a policy', exact: true }).first().click();
  await page.getByLabel('Holder address').fill(holder.address);
  await page.getByLabel('Coverage', { exact: true }).fill('Steward review: liquid damage');
  await page.getByLabel('Coverage limit (GEN)').fill('1');
  await page.getByLabel('Deductible (GEN)').fill('0.10');
  await page.getByLabel('Fund the pool now (GEN)').fill('1');
  const inputDate = seconds => new Date(seconds * 1000).toISOString().slice(0, 16);
  await page.getByLabel('Covers from').fill('2026-10-01T00:00');
  await page.getByLabel('Covers until').fill(inputDate(ends));
  await page.getByLabel('Policy wording').fill(wording);
  const fields = page.locator('.condition-inputs input');
  for (let i = 0; i < conditions.length; i++) await fields.nth(i).fill(conditions[i]);
  const created = await frontendDone('Browser creates funded policy and waits for FINALIZED', () => page.getByRole('button', { name: 'Write policy on chain' }).click());
  book.policyId = created.after.policies.at(-1).id;
  const policy = created.after.policies.at(-1);
  book.reportingDeadline = policy.reportingEndsAt;
  persist();
  }
  const policyId = book.policyId;
  const policy = await read(address, 'get_policy', [policyId]);
  const incident = String(Date.parse('2026-10-15T00:00:00Z') / 1000);
  // File both revisions immediately before any lengthy committee rounds.
  const approvedFile = await write('Holder files authenticated liquid damage', holder, 'file_claim', [policyId, incident, '350000000000000000', goodUrl, goodDigest]);
  const claimId = book.claimId || approvedFile.after.claims.at(-1).id;
  book.claimId = claimId;
  const declinedFile = await write('Holder files out-of-scope evidence', holder, 'file_claim', [policyId, incident, '500000000000000000', badUrl, badDigest]);
  const declinedId = book.declinedId || declinedFile.after.claims.at(-1).id;
  book.declinedId = declinedId;
  persist();
  await write('Cannot recover an active policy pool', insurer, 'withdraw_unused', [policyId, '1'], 0n, /Close the policy/);
  if (Math.floor(Date.now() / 1000) < Number(book.reportingDeadline)) {
    await write('Cannot close before the reporting deadline', insurer, 'close_policy', [policyId], 0n, /reporting period must end/);
  } else if (!book.earlyClosurePolicyId && !book.checks.some(c => c.label === 'Cannot close before the reporting deadline' && c.passed)) {
    const active = await write('Create active policy for early-closure guard', insurer, 'create_policy', [holder.address, 'Early closure guard', wording, JSON.stringify(conditions), '1000000000000000000', '100000000000000000', '1790812800', String(Math.floor(Date.now() / 1000) + 86400)]);
    book.earlyClosurePolicyId = active.after.policies.at(-1).id;
    persist();
  }
  if (book.earlyClosurePolicyId) await write('Cannot close before the reporting deadline', insurer, 'close_policy', [book.earlyClosurePolicyId], 0n, /reporting period must end/);
  await write('Cannot settle an unadjudicated claim', insurer, 'settle', [claimId], 0n, /Only an approved/);
  if (!quick) {
  await write('Holder commits a deliberately wrong digest for the adverse test', holder, 'replace_evidence', [claimId, goodUrl, 'sha256:' + '0'.repeat(64)]);
  await write('Committee refuses bytes that differ from committed digest', insurer, 'adjudicate', [claimId], 0n, /digest mismatch/);
  await write('Holder restores authentic new evidence revision', holder, 'replace_evidence', [claimId, goodUrl, goodDigest]);
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: /Claims/ }).click();
  await page.getByRole('button', { name: `Claim ${claimId}`, exact: true }).click();
  const decision = await frontendDone('Browser requests real committee decision and waits for FINALIZED', () => page.getByRole('button', { name: 'Ask the committee' }).click());
  const adjudicated = decision.after.claims.find(c => c.id === claimId);
  assert.equal(adjudicated.outcome, 'APPROVED');
  assert.equal(adjudicated.payoutWei, '250000000000000000');
  assert.equal(adjudicated.contentDigest, goodDigest);
  assert.ok(adjudicated.conditions.every(c => c.passed));
  await page.keyboard.press('Escape');
  await write('Unrelated wallet cannot settle approved claim', stranger, 'settle', [claimId], 0n, /Only the insurer/);
  await write('Holder cannot redirect or authorize settlement', holder, 'settle', [claimId], 0n, /Only the insurer/);
  await page.getByRole('button', { name: `Claim ${claimId}`, exact: true }).click();
  const paid = await frontendDone('Browser pays claimant native GEN on finalization', () => page.getByRole('button', { name: 'Settle payout' }).click());
  const paidAmount = 250000000000000000n;
  assert.equal(BigInt(paid.afterBalances[holder.address]) - BigInt(paid.beforeBalances[holder.address]), paidAmount);
  assert.equal(BigInt(paid.beforeBalances[address]) - BigInt(paid.afterBalances[address]), paidAmount);
  paid.record.recipient = holder.address;
  paid.record.recipientDeltaWei = String(paidAmount);
  paid.record.contractDeltaWei = String(-paidAmount);
  persist();
  await page.keyboard.press('Escape');
  await write('Double settlement cannot transfer twice', insurer, 'settle', [claimId], 0n, /already been settled/);
  await write('Settled claim cannot replace evidence', holder, 'replace_evidence', [claimId, badUrl, badDigest], 0n, /settled and is final/);
  await write('Same evidence bytes at another URL cannot reroll', holder, 'replace_evidence', [declinedId, goodUrl, badDigest], 0n, /already on record/);
  const declined = await write('Real committee declines excluded software cancellation', insurer, 'adjudicate', [declinedId]);
  assert.equal(declined.after.claims.find(c => c.id === declinedId).outcome, 'DECLINED');
  await write('Declined claim cannot pay', insurer, 'settle', [declinedId], 0n, /Only an approved/);
  await write('Previously evaluated evidence cannot be adjudicated twice', insurer, 'adjudicate', [declinedId], 0n, /already been judged/);
  if (!quick) {
  // A separate expired policy proves immediate unused-pool recovery without claims.
  const empty = await write('Create expired independent policy with unused GEN', insurer, 'create_policy', [holder.address, 'Expired no-claim collateral', wording, JSON.stringify(conditions), '1000000000000000000', '100000000000000000', '1790812800', '1790899200'], 200000000000000000n);
  const emptyId = empty.after.policies.at(-1).id;
  await write('Insurer closes expired no-claim policy', insurer, 'close_policy', [emptyId]);
  await write('Holder cannot withdraw insurer surplus', holder, 'withdraw_unused', [emptyId, '1'], 0n, /Only the insurer/);
  await write('Unrelated wallet cannot withdraw insurer surplus', stranger, 'withdraw_unused', [emptyId, '1'], 0n, /Only the insurer/);
  await write('Zero withdrawal rejects', insurer, 'withdraw_unused', [emptyId, '0'], 0n, /greater than zero/);
  await write('Negative withdrawal rejects', insurer, 'withdraw_unused', [emptyId, '-1'], 0n, /greater than zero/);
  await write('Cross-policy overdraw rejects', insurer, 'withdraw_unused', [emptyId, '200000000000000001'], 0n, /reserved claim collateral/);
  const recovered = await write('Unused no-claim GEN reaches insurer wallet', insurer, 'withdraw_unused', [emptyId, '200000000000000000']);
  assert.equal(BigInt(recovered.afterBalances[insurer.address]) - BigInt(recovered.beforeBalances[insurer.address]), 200000000000000000n);
  assert.equal(BigInt(recovered.beforeBalances[address]) - BigInt(recovered.afterBalances[address]), 200000000000000000n);
  recovered.record.recipient = insurer.address;
  recovered.record.recipientDeltaWei = '200000000000000000';
  persist();
  await write('Repeated full recovery cannot transfer twice', insurer, 'withdraw_unused', [emptyId, '1'], 0n, /reserved claim collateral/);
  }
  // Main deadline will have elapsed during the adverse cases. If necessary,
  // wait using browser polling so no forged timestamp or test-only method exists.
  await expect.poll(() => Math.floor(Date.now() / 1000), { timeout: 900000, intervals: [10000] }).toBeGreaterThanOrEqual(Number(book.reportingDeadline));
  await openApp(insurer);
  await page.getByRole('button', { name: policy.coverage, exact: true }).click();
  await frontendDone('Browser closes reporting-expired policy at FINALIZED', () => page.getByRole('button', { name: 'Close policy', exact: true }).click());
  await page.keyboard.press('Escape');
  await write('Remaining appeal retains its maximum payout reserve', insurer, 'withdraw_unused', [policyId, '750000000000000000'], 0n, /reserved claim collateral/);
  const reserved = await read(address, 'get_policy', [policyId]);
  assert.equal(reserved.reservedWei, '400000000000000000');
  assert.equal(reserved.recoverableWei, '350000000000000000');
  await page.getByRole('button', { name: policy.coverage, exact: true }).click();
  const surplus = await frontendDone('Browser recovers only surplus while appeal remains protected', () => page.getByRole('button', { name: 'Recover unused GEN' }).click());
  assert.equal(BigInt(surplus.afterBalances[insurer.address]) - BigInt(surplus.beforeBalances[insurer.address]), 350000000000000000n);
  assert.equal(surplus.after.policies.find(p => p.id === policyId).poolWei, '400000000000000000');
  surplus.record.recipient = insurer.address;
  surplus.record.recipientDeltaWei = '350000000000000000';
  persist();
  await page.keyboard.press('Escape');
  await write('Repeated surplus withdrawal cannot consume the remaining reserve', insurer, 'withdraw_unused', [policyId, '350000000000000000'], 0n, /reserved claim collateral/);
  await write('Closed reporting policy refuses new claims', holder, 'file_claim', [policyId, incident, '350000000000000000', goodUrl, goodDigest], 0n, /policy is closed/);
  const appealed = await write('Closed policy still allows the existing holder appeal', holder, 'replace_evidence', [declinedId, goodUrl, goodDigest]);
  assert.equal(appealed.after.claims.find(c => c.id === declinedId).appeals, 1);
  await write('Appeal in progress cannot lose reserved funds', insurer, 'withdraw_unused', [policyId, '1'], 0n, /reserved claim collateral/);
  const appealDecision = await write('Real committee reviews authenticated appeal after closure', insurer, 'adjudicate', [declinedId]);
  const appeal = appealDecision.after.claims.find(c => c.id === declinedId);
  if (['APPROVED', 'PARTIALLY_APPROVED'].includes(appeal.status)) {
    const appealPaid = await write('Reserved GEN pays appeal after surplus withdrawal', insurer, 'settle', [declinedId]);
    assert.equal(BigInt(appealPaid.afterBalances[holder.address]) - BigInt(appealPaid.beforeBalances[holder.address]), BigInt(appeal.payoutWei));
    appealPaid.record.recipient = holder.address;
    appealPaid.record.recipientDeltaWei = appeal.payoutWei;
  } else {
    assert.equal(appeal.status, 'DECLINED');
    await write('Exhausted appeal cannot reopen', holder, 'replace_evidence', [declinedId, badUrl, badDigest], 0n, /only once/);
  }
  const remaining = await read(address, 'get_policy', [policyId]);
  if (BigInt(remaining.recoverableWei) > 0n) {
    const rest = await write('Final remaining surplus reaches insurer', insurer, 'withdraw_unused', [policyId, remaining.recoverableWei]);
    assert.equal(BigInt(rest.afterBalances[insurer.address]) - BigInt(rest.beforeBalances[insurer.address]), BigInt(remaining.recoverableWei));
    rest.record.recipient = insurer.address;
    rest.record.recipientDeltaWei = remaining.recoverableWei;
  }
  book.finalState = await read(address);
  book.finalBalances = await balances(known);
  assert.equal(BigInt(book.finalBalances[address]), book.finalState.policies.reduce((n, p) => n + BigInt(p.poolWei), 0n));
  assert.deepEqual(pageErrors, []);
  book.completedAt = new Date().toISOString();
  book.result = 'PASS';
  persist();
  console.log('LIVE REVIEW COMPLETE', book.checks.length, 'checks');
} catch (error) {
  book.result = 'INCOMPLETE';
  book.error = error.message;
  persist();
  await page.screenshot({ path: path.join(evidenceDir, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
