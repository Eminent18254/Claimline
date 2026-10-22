/**
 * Claimline domain types and display helpers.
 *
 * Every amount on chain is wei (1 GEN = 10^18 wei). Nothing here does money
 * arithmetic that decides a payout - the contract does that - these helpers only
 * format what the chain already decided.
 */

export type Policy = {
  id: string;
  insurer: string;
  holder: string;
  coverage: string;
  wording: string;
  conditions: string[];
  limitWei: string;
  deductibleWei: string;
  startsAt: string;
  endsAt: string;
  poolWei: string;
  paidWei: string;
  withdrawnWei: string;
  reservedWei: string;
  recoverableWei: string;
  reportingEndsAt: string;
  claimCount: number;
  status: string;
  policyVersion: string;
};

export type ClaimCondition = {
  condition: string;
  passed: boolean;
  reason: string;
};

export type Claim = {
  id: string;
  policyId: string;
  claimant: string;
  incidentAt: string;
  claimedWei: string;
  evidenceUri: string;
  evidenceDigest: string;
  status: string;
  outcome: string;
  payoutBand: number;
  confidenceBand: string;
  reason: string;
  conditions: ClaimCondition[];
  inconsistencies: string[];
  contentDigest: string;
  payoutWei: string;
  policyVersion: string;
  evidenceRevision: number;
  evaluatedRevision: number;
  decisionRevision: number;
  appeals: number;
  decisionIsCurrent: boolean;
};

export type ClaimlineState = {
  policies: Policy[];
  claims: Claim[];
  policyVersion: string;
  policyCount: number;
  claimCount: number;
};

export const MAX_EVIDENCE_REVISIONS = 3;
export const MAX_APPEALS = 1;

const WEI = 10n ** 18n;

/** Format wei as GEN, grouped, with a fixed number of decimals. */
export function formatGen(wei: string | number | bigint, decimals = 2): string {
  let value: bigint;
  try {
    value = BigInt(wei);
  } catch {
    return '0.00';
  }
  if (value === 0n) return '0.00';

  const whole = value / WEI;
  const fraction = value % WEI;
  const fractionText = fraction.toString().padStart(18, '0').slice(0, decimals);
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (decimals > 0 && whole === 0n && /^0+$/.test(fractionText)) return '<0.01';
  return decimals > 0 ? `${wholeText}.${fractionText}` : wholeText;
}

/** Parse a GEN amount typed by a user into a wei string. */
export function parseGen(input: string): string {
  const clean = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{0,18})?$/.test(clean)) {
    throw new Error('Enter an amount in GEN with up to 18 decimals');
  }
  const [whole, fraction = ''] = clean.split('.');
  const padded = (fraction + '0'.repeat(18)).slice(0, 18);
  return (BigInt(whole) * WEI + BigInt(padded || '0')).toString();
}

export function shortAddress(address: string): string {
  if (!address || address.length < 12) return address || 'unknown';
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}

export function formatDate(unix: string | number): string {
  const seconds = Number(unix);
  if (!Number.isFinite(seconds) || seconds <= 0) return 'unknown';
  return new Date(seconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function toUnix(value: string): string {
  const millis = new Date(value).getTime();
  if (!Number.isFinite(millis)) throw new Error('Choose a valid date');
  return String(Math.floor(millis / 1000));
}

export function sameAddress(left: string, right: string | null | undefined): boolean {
  return Boolean(right) && left.toLowerCase() === String(right).toLowerCase();
}

export type Tone = 'approved' | 'partial' | 'declined' | 'pending' | 'settled' | 'neutral';

export function statusTone(status: string): Tone {
  switch (status) {
    case 'APPROVED':
      return 'approved';
    case 'PARTIALLY_APPROVED':
      return 'partial';
    case 'DECLINED':
      return 'declined';
    case 'SETTLED':
      return 'settled';
    case 'FILED':
    case 'MORE_EVIDENCE_REQUIRED':
      return 'pending';
    default:
      return 'neutral';
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'MORE_EVIDENCE_REQUIRED':
      return 'More evidence needed';
    case 'PARTIALLY_APPROVED':
      return 'Partially approved';
    case 'APPROVED':
      return 'Approved';
    case 'DECLINED':
      return 'Declined';
    case 'SETTLED':
      return 'Settled';
    case 'FILED':
      return 'Filed';
    case 'ACTIVE':
      return 'Active';
    case 'CLOSED':
      return 'Closed';
    default:
      return status;
  }
}

export function pendingPayout(claim: Claim): string {
  return formatGen(claim.payoutWei);
}

export function canAdjudicate(claim: Claim): boolean {
  if (claim.status === 'SETTLED') return false;
  if (claim.status === 'APPROVED' || claim.status === 'PARTIALLY_APPROVED') return false;
  return claim.evaluatedRevision !== claim.evidenceRevision;
}

export function canReplace(claim: Claim): boolean {
  if (claim.status === 'SETTLED') return false;
  if (claim.status === 'APPROVED' || claim.status === 'PARTIALLY_APPROVED') return false;
  if (claim.evidenceRevision >= MAX_EVIDENCE_REVISIONS) return false;
  if (claim.status === 'DECLINED' && claim.appeals >= MAX_APPEALS) return false;
  return true;
}

export function canSettle(claim: Claim): boolean {
  if (claim.status !== 'APPROVED' && claim.status !== 'PARTIALLY_APPROVED') return false;
  return claim.evaluatedRevision === claim.evidenceRevision;
}

/** Browser-side SHA-256 of a file or text, in the sha256: form the contract wants. */
export async function sha256Digest(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}
