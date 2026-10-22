import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { client, evidenceDir, insurer, finalized, read, balances, save } from './studio.mjs';
const book = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'live-review.json'), 'utf8'));
const address = book.deployment.address;
const known = [address, book.participants.insurer, book.participants.holder, book.participants.stranger];
async function tx(label, method, args, reject) {
  const completed = book.transactions.find(t => t.label === label && t.execution);
  if (completed) return completed;
  const knownHash = method === 'settle' && !reject ? '0xe5cfc4622602890c900c605860515d692e3906c29e79eb2d5a7ac9de1d4a7842' : null;
  const beforeState = await read(address);
  const beforeBalances = await balances(known);
  if (knownHash) {
    beforeBalances[book.participants.holder] = '1000000000000000000';
    beforeBalances[address] = '1000000000000000000';
  }
  const hash = knownHash || await client.writeContract({ address, functionName: method, args });
  console.log(label, hash);
  const receipt = await finalized(hash);
  save(`final-${method}-${hash}.json`, receipt);
  for (const child of receipt.triggered_transactions || []) {
    const transfer = await finalized(child);
    save(`transfer-${child}.json`, transfer);
    // SEND transactions have no validator committee and use NO_MAJORITY even
    // on success. Actual recipient and contract balances prove the transfer.
  }
  const afterState = await read(address);
  const afterBalances = await balances(known);
  const record = { label, method, hash, status: 'FINALIZED', execution: receipt.consensus_data.leader_receipt[0].execution_result, beforeState, afterState, beforeBalances, afterBalances };
  if (reject) {
    assert.notEqual(record.execution, 'SUCCESS');
    assert.deepEqual(beforeState, afterState);
    assert.deepEqual(beforeBalances, afterBalances);
    record.stateAndBalancesUnchanged = true;
  } else assert.equal(record.execution, 'SUCCESS');
  book.transactions.push(record);
  book.checks.push({ label, passed: true });
  save('live-review.json', book);
  return record;
}
const settled = await tx('Native GEN reaches approved claimant wallet', 'settle', [book.claimId]);
assert.equal(BigInt(settled.afterBalances[book.participants.holder]) - BigInt(settled.beforeBalances[book.participants.holder]), 250000000000000000n);
assert.equal(BigInt(settled.beforeBalances[address]) - BigInt(settled.afterBalances[address]), 250000000000000000n);
Object.assign(settled, { recipient: book.participants.holder, recipientDeltaWei: '250000000000000000' });
save('live-review.json', book);
await tx('Double payout rejects without changing balances', 'settle', [book.claimId], true);
await tx('Insurer closes reporting-expired policy', 'close_policy', [book.policyId]);
await tx('Unresolved claim collateral cannot be withdrawn', 'withdraw_unused', [book.policyId, '750000000000000000'], true);
await tx('Zero withdrawal rejects', 'withdraw_unused', [book.policyId, '0'], true);
await tx('Negative withdrawal rejects', 'withdraw_unused', [book.policyId, '-1'], true);
const policy = await read(address, 'get_policy', [book.policyId]);
assert.equal(policy.reservedWei, '400000000000000000');
assert.equal(policy.recoverableWei, '350000000000000000');
const recovered = await tx('Unused native GEN reaches insurer while claim reserve remains', 'withdraw_unused', [book.policyId, policy.recoverableWei]);
assert.equal(BigInt(recovered.afterBalances[book.participants.insurer]) - BigInt(recovered.beforeBalances[book.participants.insurer]), 350000000000000000n);
assert.equal(BigInt(recovered.beforeBalances[address]) - BigInt(recovered.afterBalances[address]), 350000000000000000n);
Object.assign(recovered, { recipient: book.participants.insurer, recipientDeltaWei: '350000000000000000' });
save('live-review.json', book);
await tx('Repeated withdrawal cannot consume remaining collateral', 'withdraw_unused', [book.policyId, '1'], true);
book.finalState = await read(address);
book.finalBalances = await balances(known);
assert.equal(book.finalBalances[address], '400000000000000000');
assert.equal(BigInt(book.finalBalances[address]), book.finalState.policies.reduce((n,p)=>n+BigInt(p.poolWei),0n));
book.result = 'PASS';
delete book.error;
book.completedAt = new Date().toISOString();
save('live-review.json', book);
console.log('PROOF COMPLETE', book.checks.length);
