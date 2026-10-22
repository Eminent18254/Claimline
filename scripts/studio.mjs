import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient, createAccount } from '../frontend/node_modules/genlayer-js/dist/index.js';
import { studionet } from '../frontend/node_modules/genlayer-js/dist/chains/index.js';
import { TransactionStatus } from '../frontend/node_modules/genlayer-js/dist/types/index.js';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const evidenceDir = path.join(root, 'verification');
fs.mkdirSync(evidenceDir, { recursive: true });
export const insurer = createAccount(fs.readFileSync(path.join(root, '.deployer-key'), 'utf8').trim());
export const client = createClient({ chain: studionet, account: insurer });
export const source = fs.readFileSync(path.join(root, 'contracts/Claimline.py'));
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function save(name, value) {
  fs.writeFileSync(path.join(evidenceDir, name), JSON.stringify(value, (k, v) => /private.?key|secret|api.?key/i.test(k) ? '[REDACTED]' : typeof v === 'bigint' ? String(v) : v, 2) + '\n');
}
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function retryRead(work) {
  for (let attempt = 0; ; attempt++) {
    try { return await work(); }
    catch (error) {
      if (attempt >= 8 || !/fetch failed|timeout|timed out|ECONNRESET|socket|Unexpected token|not valid JSON|502|503|504/i.test(error.message + ' ' + error.details)) throw error;
      console.log('Retrying interrupted RPC read');
      await sleep(2000);
    }
  }
}
export async function finalized(hash, allowUndetermined = false) {
  let lastStatus;
  for (let i = 0; i < 600; i++) {
    let tx;
    try { tx = await client.getTransaction({ hash }); }
    catch (error) { if (i === 599) throw error; await sleep(3000); continue; }
    if (tx.statusName !== lastStatus) {
      console.log(hash, tx.statusName);
      lastStatus = tx.statusName;
    }
    if (tx.statusName === 'FINALIZED') {
      return retryRead(() => client.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED, fullTransaction: true }));
    }
    if (allowUndetermined && tx.statusName === 'UNDETERMINED') {
      return retryRead(() => client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, fullTransaction: true }));
    }
    // StudioNet rejected consensus rounds pass through UNDETERMINED before
    // receiving a finalized failure receipt; keep polling that transition.
    if (['CANCELED', 'LEADER_TIMEOUT', 'VALIDATORS_TIMEOUT'].includes(tx.statusName)) {
      throw new Error(`Transaction ${hash} ended at ${tx.statusName}`);
    }
    await sleep(3000);
  }
  throw new Error(`Transaction ${hash} did not finalize within 30 minutes`);
}
export async function read(address, method = 'get_state', args = []) {
  return JSON.parse(await retryRead(() => client.readContract({ address, functionName: method, args, transactionHashVariant: 'latest-final' })));
}
export async function balances(addresses) {
  const entries = await Promise.all(addresses.map(async address => [address, String(await retryRead(() => client.getBalance({ address })))]));
  return Object.fromEntries(entries);
}
