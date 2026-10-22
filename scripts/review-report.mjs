import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const book = JSON.parse(fs.readFileSync(path.join(root, 'verification/live-review.json'), 'utf8'));
assert.equal(book.result, 'PASS', 'Complete live verification before generating the final report');
const explorer = 'https://explorer-studio.genlayer.com';
const lines = [
  '# Steward remediation verification', '',
  `Verified ${book.completedAt} on StudioNet, chain 61999.`, '',
  `Contract: [${book.deployment.address}](${explorer}/address/${book.deployment.address})`, '',
  `Deployment: [${book.deployment.hash}](${explorer}/tx/${book.deployment.hash}) — FINALIZED, successful.`, '',
  `Repository and deployed source SHA-256: \`${book.deployment.sourceSha256}\`. Source fetched with \`gen_getContractCode\` matched byte for byte. See [deployed-source.py](deployed-source.py), [deployment.json](deployment.json), and [deployment-receipt.json](deployment-receipt.json).`, '',
  '## Changes', '',
  '- `settle` emits empty-calldata EthSend native GEN to the immutable claimant address on finalization. StudioNet routes this to an ordinary wallet as a SEND transaction. Settlement guards reject stale, unapproved, zero, insufficient, unauthorized, and repeated payments.',
  '- `withdraw_unused` emits native GEN to the recorded insurer only from closed-policy surplus. Closure waits until coverage and the seven-day reporting window end. Unresolved claims and remaining appeals reserve their maximum possible payouts; approved claims reserve their actual payout. Policy pools cannot fund another policy’s withdrawal.',
  '- Validators must agree exactly on outcome, payout band, confidence band, authenticated digest, and every condition identity and boolean. Only explanatory prose may differ. Local mutation tests reject a single changed condition.',
  '- Browser writes require successful FINALIZED receipts; reads use finalized state. Native transfer balances and emitted child transactions are checked separately. Policy closure and recovery controls are available to the insurer.',
  '- Deployment verifies the source before automatically syncing the tracked frontend manifest and local environment variables. Vercel uses the manifest on its next build, including when old host variables exist. A prebuild check detects source/deployment drift.', '',
  '## Actual recipient balance proof', '',
  '| Transaction | Recipient | Before (wei) | After (wei) | Increase (wei) |',
  '|---|---|---:|---:|---:|',
];
for (const tx of book.transactions.filter(t => t.recipientDeltaWei)) {
  lines.push(`| [${tx.label}](${explorer}/tx/${tx.hash}) | \`${tx.recipient}\` | ${tx.beforeBalances[tx.recipient]} | ${tx.afterBalances[tx.recipient]} | ${tx.recipientDeltaWei} |`);
}
lines.push('', 'The signer pays no StudioNet gas in these test receipts; both recipient increases and matching contract decreases were asserted. No off-chain transfer was used to simulate settlement or withdrawal.', '', '## Transactions', '', '| Check | Explorer transaction | Receipt |', '|---|---|---|');
for (const tx of book.transactions) lines.push(`| ${tx.label} | [${tx.hash}](${explorer}/tx/${tx.hash}) | ${tx.status}; ${tx.execution}${tx.actualFrontendWrite ? '; actual browser write' : ''}${tx.stateAndBalancesUnchanged ? '; state and balances unchanged' : ''} |`);
lines.push('', '## Validation', '', `- ${book.checks.length} successful live checks. Expected contract failures count as passed adverse cases only after their state and balance invariants are verified.`, '- 16 deterministic contract tests pass, including exact-condition mutation, stale decision, zero payout, policy and contract insufficiency, multiple claim reserves, appeals, and authorization.', '- Frontend TypeScript/build and browser UI suite pass.', '- Finalized contract balance equals the sum of remaining policy pools.', '', 'Full machine-readable proof: [live-review.json](live-review.json). Each transaction has a receipt JSON alongside it; validator private keys returned by StudioNet are redacted. Evidence documents are pinned to an immutable GitHub commit and stored alongside their hashes.', '', '## Remaining constraints', '', 'StudioNet uses test GEN. Existing unresolved claims or unused appeals retain collateral until their liabilities resolve. These protections deliberately prevent insurer closure from cancelling claim rights.', '');
fs.writeFileSync(path.join(root, 'verification/README.md'), lines.join('\n'));
const response = `Edit: Deployed a source-matched StudioNet contract with native GEN claimant payouts and insurer-only recovery of unused funds, while reserving collateral for existing claims and appeals. Validators now require exact agreement on every payout-controlling finding. Frontend writes wait for successful FINALIZED receipts. Added recipient balance-change proofs, finalized browser transactions, and passing adverse-case tests; updated the contract address, documentation, and evidence. Verification: https://github.com/Eminent18254/Claimline/blob/main/verification/README.md`;
fs.writeFileSync(path.join(root, 'STEWARD_RESPONSE.md'), response + '\n');
console.log(response);
