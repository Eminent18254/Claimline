/**
 * The only module that talks to GenLayer.
 *
 * Built on `genlayer-js` 1.x, the same SDK line the GenLayer CLI bundles. The
 * 2.0.0-rc.1 release encodes a call with an empty method key, which Studionet
 * rejects, so every read and write against a CLI-deployed contract fails.
 *
 * Three failure modes are handled here, all observed against deployed contracts:
 *
 *   1. A write is not finished when the hash comes back. Nothing is reported as
 *      done until the transaction reaches FINALIZED and the leader receipt says
 *      SUCCESS.
 *   2. The RPC occasionally drops a connection, so the transport is retried
 *      instead of failing the whole write.
 *   3. Contract failures arrive as a decoded `{payload}` on the leader receipt,
 *      so the human message is recovered before it is shown.
 *
 * Wallets are injected EIP-1193 providers. Keys are never created or held here.
 * Reads work without a wallet; writes require a connection.
 */
import { createClient } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';
import { GENLAYER, GENLAYER_CHAIN, isConfigured } from '@/config/genlayer';
import type { ClaimlineState, Policy, Claim } from '@/lib/claimline';

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};

export type WalletState = {
  address: string | null;
  isConnecting: boolean;
  isWrongChain: boolean;
};

const CHAIN_HEX = `0x${GENLAYER_CHAIN.id.toString(16)}`;
const MODE_KEY = 'claimline.wallet.mode';

let provider: Eip1193Provider | null = null;
let state: WalletState = { address: null, isConnecting: false, isWrongChain: false };
let cachedClient: ReturnType<typeof createClient> | null = null;
const listeners = new Set<(next: WalletState) => void>();

function emit(): void {
  for (const listener of listeners) listener({ ...state });
}

function setState(next: Partial<WalletState>): void {
  state = { ...state, ...next };
  cachedClient = null;
  emit();
}

export function subscribe(listener: (next: WalletState) => void): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => listeners.delete(listener);
}

export function walletState(): WalletState {
  return { ...state };
}

function injected(): Eip1193Provider | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { ethereum?: Eip1193Provider }).ethereum ?? null;
}

export function hasBrowserWallet(): boolean {
  return Boolean(injected());
}

function getClient() {
  if (cachedClient) return cachedClient;
  cachedClient = provider
    ? createClient({ chain: GENLAYER_CHAIN, provider: provider as never })
    : createClient({ chain: GENLAYER_CHAIN });
  return cachedClient;
}

function activeAccount() {
  return state.address
    ? { address: state.address as `0x${string}`, type: 'json-rpc' as const }
    : undefined;
}

async function currentChainId(): Promise<string | null> {
  if (!provider) return null;
  try {
    return String(await provider.request({ method: 'eth_chainId' }));
  } catch {
    return null;
  }
}

async function syncChain(): Promise<void> {
  const active = await currentChainId();
  setState({ isWrongChain: Boolean(active && active.toLowerCase() !== CHAIN_HEX) });
}

async function switchToGenLayer(): Promise<void> {
  if (!provider) return;
  const active = await currentChainId();
  if (String(active).toLowerCase() === CHAIN_HEX) {
    setState({ isWrongChain: false });
    return;
  }
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
  } catch {
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: CHAIN_HEX,
          chainName: GENLAYER_CHAIN.name,
          nativeCurrency: GENLAYER_CHAIN.nativeCurrency,
          rpcUrls: [...GENLAYER_CHAIN.rpcUrls.default.http],
        },
      ],
    });
  }
  await syncChain();
}

export async function connect(): Promise<void> {
  const found = injected();
  if (!found) throw new Error('No browser wallet found. Install MetaMask to continue.');

  setState({ isConnecting: true });
  try {
    provider = found;
    const accounts = (await found.request({ method: 'eth_requestAccounts' })) as string[];
    const address = Array.isArray(accounts) ? accounts[0] ?? null : null;
    if (!address) throw new Error('The wallet did not share an account.');

    window.localStorage.setItem(MODE_KEY, 'browser');
    found.on?.('accountsChanged', (accounts: string[]) => {
      setState({ address: Array.isArray(accounts) ? accounts[0] ?? null : null });
    });
    found.on?.('chainChanged', () => void syncChain());

    setState({ address, isConnecting: false });
    await syncChain();
  } catch (error) {
    setState({ isConnecting: false });
    throw new Error(readError(error));
  }
}

export async function disconnect(): Promise<void> {
  window.localStorage.removeItem(MODE_KEY);
  provider = null;
  setState({ address: null, isWrongChain: false });
}

export async function restore(): Promise<void> {
  const found = injected();
  if (!found || window.localStorage.getItem(MODE_KEY) !== 'browser') return;
  try {
    const accounts = (await found.request({ method: 'eth_accounts' })) as string[];
    const address = Array.isArray(accounts) ? accounts[0] ?? null : null;
    if (!address) return;
    provider = found;
    setState({ address });
    await syncChain();
  } catch {
    // A locked wallet is not an error; the user can connect again.
  }
}

// ------------------------------------------------------------------- errors

type Receipt = {
  status?: number | string;
  statusName?: string;
  triggered_transactions?: string[];
  execution_result?: string;
  result?: string | { payload?: string };
  result_name?: string;
  stderr?: string;
  error?: string;
  genvm_result?: { stderr?: string; stdout?: string };
  consensus_data?: { leader_receipt?: Receipt[] };
};

function lastTracebackLine(text: string): string {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : '';
}

function decodeContractError(error: unknown): string {
  let node = error as
    | { data?: { receipt?: Receipt }; receipt?: Receipt; cause?: unknown }
    | undefined;
  for (let depth = 0; node && depth < 6; depth += 1) {
    const receipt = node.data?.receipt ?? node.receipt;
    if (receipt && receipt.execution_result && receipt.execution_result !== 'SUCCESS') {
      const payload = (receipt.result as { payload?: unknown } | undefined)?.payload;
      if (typeof payload === 'string' && payload.trim()) return payload.trim();

      const encoded = receipt.result;
      if (typeof encoded === 'string' && encoded.length > 0) {
        try {
          const decoded =
            typeof atob === 'function'
              ? atob(encoded)
              : Buffer.from(encoded, 'base64').toString('utf8');
          if (decoded && /[a-zA-Z]/.test(decoded)) {
            return decoded.replace(/^[\u0000-\u001f]+/, '').trim();
          }
        } catch {
          // Not base64 after all; fall through to the traceback.
        }
      }
      const traceback = receipt.genvm_result?.stderr || receipt.stderr;
      if (typeof traceback === 'string' && traceback.trim()) {
        const line = lastTracebackLine(traceback);
        if (line) return line;
      }
    }
    node = node.cause as typeof node;
  }
  return '';
}

const TRANSIENT_RPC =
  /Unexpected token|unknown RPC error|failed to fetch|fetch failed|load failed|ECONNRESET|socket hang up|network error|timed out|timeout|502|503|504/i;

function isTransientRpc(value: unknown): boolean {
  const node = value as { details?: string; shortMessage?: string; message?: string };
  const raw = node?.details || node?.shortMessage || node?.message || String(value);
  return TRANSIENT_RPC.test(String(raw));
}

export function readError(error: unknown): string {
  const node = error as { details?: string; shortMessage?: string; message?: string };
  const raw = node?.details || node?.shortMessage || node?.message || String(error);
  const text = decodeContractError(error) || String(raw);

  if (/undetermined|VALIDATORS_TIMEOUT|LEADER_TIMEOUT/i.test(text)) {
    return 'The validator committee could not reach agreement. Nothing was changed - try again.';
  }
  if (/digest mismatch/i.test(text)) {
    return 'The document at that URL does not hash to the digest on record. Re-commit the file with its current digest.';
  }
  if (/answered HTTP|did not return a file|document is empty/i.test(text)) {
    return 'The claim document could not be read. Check the URL is public and serves the file itself.';
  }
  if (/already been judged/i.test(text)) {
    return 'This revision has already been judged. Commit a new document revision for another review.';
  }
  if (/already been settled/i.test(text)) return 'This claim is settled and final.';
  if (/already been approved/i.test(text)) {
    return 'This claim was approved. An approved claim cannot be re-judged or have its document replaced.';
  }
  if (/already on record/i.test(text)) {
    return 'That document revision is already on record, so there is nothing new to review.';
  }
  if (/can be replaced at most/i.test(text)) return 'This claim has used all of its evidence revisions.';
  if (/appealed only once/i.test(text)) return 'A declined claim may be appealed only once.';
  if (/Only the recorded holder/i.test(text)) return 'Only the recorded holder can file a claim on this policy.';
  if (/Only the holder or the insurer/i.test(text)) return 'Only the holder or the insurer can request a decision.';
  if (/Only the holder/i.test(text)) return 'Only the holder can replace the document on this claim.';
  if (/Only the insurer/i.test(text)) return 'Only the insurer can perform that action.';
  if (/reporting period must end/i.test(text)) return 'The reporting deadline must pass before the policy can close.';
  if (/reserved claim collateral/i.test(text)) return 'These GEN are reserved for an existing claim or appeal.';
  if (/Close the policy before/i.test(text)) return 'Close the policy after its reporting deadline before recovering unused GEN.';
  if (/Only an approved claim/i.test(text)) return 'Only an approved claim can be settled.';
  if (/does not cover/i.test(text)) return 'The policy pool does not hold enough GEN to cover this payout.';
  if (/outside the covered period/i.test(text)) return 'The incident date falls outside the policy period.';
  if (/pool/i.test(text) && /holds/i.test(text)) return 'The policy pool does not cover this payout.';
  if (/must report on all/i.test(text)) return 'The committee returned an incomplete condition report. Try again.';
  if (/Unsupported|unsupported/i.test(text)) return 'The committee returned a value outside the supported set. Try again.';
  if (/must be connected|No account/i.test(text)) return 'Connect a wallet before continuing.';
  if (/chainId should be same|wrong network|Chain mismatch|does not match the target chain/i.test(text)) {
    return `Your wallet is on a different network than ${GENLAYER_CHAIN.name} (chain ${GENLAYER_CHAIN.id}). Switch networks and try again.`;
  }
  if (/user rejected|User denied|4001/i.test(text)) return 'You rejected the request in your wallet.';
  if (isTransientRpc(text)) {
    return 'The RPC dropped the connection before it answered. Check the latest state and try again.';
  }
  return text;
}

// ------------------------------------------------------------------- writes

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type WriteResult = { hash: string; receipt: Receipt };
let lastWrite: WriteResult | null = null;
export function latestWrite(): WriteResult | null { return lastWrite; }

function checkReceipt(receipt: Receipt): void {
  const leader = receipt.consensus_data?.leader_receipt?.[0];
  if (leader?.execution_result !== 'SUCCESS') {
    throw new Error(leader ? readError({ data: { receipt: leader } }) : 'The transaction has no successful execution receipt.');
  }
  if (receipt.result_name === 'MAJORITY_DISAGREE') {
    throw new Error('The validator committee did not reach agreement on this document.');
  }
}

async function send(functionName: string, args: unknown[], value = 0n): Promise<WriteResult> {
  if (!isConfigured()) throw new Error('The Claimline contract is not configured.');
  if (!state.address) throw new Error('Connect a wallet before continuing.');

  if (provider) {
    await switchToGenLayer();
    const active = await currentChainId();
    if (String(active).toLowerCase() !== CHAIN_HEX) {
      throw new Error(
        `Your wallet is on a different network than ${GENLAYER_CHAIN.name} (chain ${GENLAYER_CHAIN.id}).`,
      );
    }
  }

  const client = getClient();
  let hash: string | null = null;
  // Retry polling only. A lost submission response can hide a committed write.
  try {
    hash = (await client.writeContract({
      account: activeAccount(),
      address: GENLAYER.contract as `0x${string}`,
      functionName,
      args: args as never[],
      value,
    })) as unknown as string;
  } catch (error) {
    throw new Error(readError(error));
  }

  let receipt: Receipt | null = null;
  for (let attempt = 0; ; attempt += 1) {
    try {
      receipt = (await client.waitForTransactionReceipt({
        hash: hash as never,
        status: TransactionStatus.ACCEPTED,
        retries: 400,
        interval: 3000,
      })) as unknown as Receipt;
      checkReceipt(receipt);
      receipt = (await client.waitForTransactionReceipt({
        hash: hash as never,
        status: TransactionStatus.FINALIZED,
        retries: 600,
        interval: 3000,
      })) as unknown as Receipt;
      receipt = (await client.getTransaction({ hash: hash as never })) as unknown as Receipt;
      checkReceipt(receipt);
      if (receipt.statusName !== 'FINALIZED' && String(receipt.status) !== '7') {
        throw new Error('The transaction has not finalized yet.');
      }
      for (const childHash of receipt.triggered_transactions ?? []) {
        const child = (await client.waitForTransactionReceipt({
          hash: childHash as never, status: TransactionStatus.FINALIZED,
          retries: 600, interval: 3000,
        })) as unknown as Receipt;
        if (child.consensus_data?.leader_receipt?.length) checkReceipt(child);
        if (child.result_name === 'MAJORITY_DISAGREE') {
          throw new Error('The emitted GEN transfer failed. Check the transaction before continuing.');
        }
      }
      break;
    } catch (error) {
      if (attempt >= 3 || !isTransientRpc(error)) throw new Error(readError(error));
      await sleep(2500);
    }
  }

  lastWrite = { hash: hash as string, receipt: receipt as Receipt };
  window.dispatchEvent(new CustomEvent('claimline:finalized', { detail: { hash, functionName } }));
  return lastWrite;
}

// -------------------------------------------------------------------- reads

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function read(functionName: string, args: unknown[] = []): Promise<string> {
  if (!isConfigured()) throw new Error('The Claimline contract is not configured.');
  const raw = await getClient().readContract({
    account: activeAccount(),
    address: GENLAYER.contract as `0x${string}`,
    functionName,
    args: args as never[],
    transactionHashVariant: 'latest-final' as never,
  });
  return typeof raw === 'string' ? raw : JSON.stringify(raw);
}

export async function fetchState(): Promise<ClaimlineState> {
  const parsed = parseJson<ClaimlineState | null>(await read('get_state'), null);
  if (!parsed || !Array.isArray(parsed.policies) || !Array.isArray(parsed.claims)) {
    throw new Error('The contract state could not be read.');
  }
  return parsed;
}

export async function fetchPolicy(id: string): Promise<Policy> {
  const parsed = parseJson<Policy | null>(await read('get_policy', [id]), null);
  if (!parsed || !parsed.id) throw new Error('That policy could not be found.');
  return parsed;
}

export async function fetchClaim(id: string): Promise<Claim> {
  const parsed = parseJson<Claim | null>(await read('get_claim', [id]), null);
  if (!parsed || !parsed.id) throw new Error('That claim could not be found.');
  return parsed;
}

function requireAddress(value: string, label: string): string {
  const clean = value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(clean)) throw new Error(`${label} must be a valid address`);
  return clean;
}

export async function createPolicy(input: {
  holder: string;
  coverage: string;
  wording: string;
  conditions: string[];
  limitWei: string;
  deductibleWei: string;
  startsAt: string;
  endsAt: string;
  poolWei: string;
}): Promise<string> {
  const result = await send(
    'create_policy',
    [
      requireAddress(input.holder, 'Holder'),
      input.coverage,
      input.wording,
      JSON.stringify(input.conditions),
      input.limitWei,
      input.deductibleWei,
      input.startsAt,
      input.endsAt,
    ],
    BigInt(input.poolWei),
  );
  const state = await fetchState();
  const created = state.policies.find(
    (policy) => policy.insurer.toLowerCase() === (stateAddress() ?? '').toLowerCase() && policy.holder.toLowerCase() === input.holder.toLowerCase(),
  );
  return created?.id ?? result.hash;
}

export async function fundPolicy(policyId: string, wei: string): Promise<void> {
  await send('fund_policy', [policyId], BigInt(wei));
}

export async function fileClaim(input: {
  policyId: string;
  incidentAt: string;
  claimedWei: string;
  evidenceUri: string;
  evidenceDigest: string;
}): Promise<void> {
  await send('file_claim', [
    input.policyId,
    input.incidentAt,
    input.claimedWei,
    input.evidenceUri.trim(),
    input.evidenceDigest.trim().toLowerCase(),
  ]);
}

export async function adjudicate(claimId: string): Promise<void> {
  await send('adjudicate', [claimId]);
}

export async function replaceEvidence(
  claimId: string,
  evidenceUri: string,
  evidenceDigest: string,
): Promise<void> {
  await send('replace_evidence', [
    claimId,
    evidenceUri.trim(),
    evidenceDigest.trim().toLowerCase(),
  ]);
}

export async function settle(claimId: string): Promise<void> {
  await send('settle', [claimId]);
}

export async function closePolicy(policyId: string): Promise<void> {
  await send('close_policy', [policyId]);
}

export async function withdrawUnused(policyId: string, wei: string): Promise<void> {
  await send('withdraw_unused', [policyId, wei]);
}

export function stateAddress(): string | null {
  return state.address;
}
