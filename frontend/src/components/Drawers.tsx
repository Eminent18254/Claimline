import { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  FileText,
  Hash,
  Loader2,
  Minus,
  X,
} from 'lucide-react';
import {
  canReplace,
  canSettle,
  formatDate,
  formatGen,
  sameAddress,
  sha256Digest,
  shortAddress,
  statusLabel,
  statusTone,
  type Claim,
  type Policy,
} from '@/lib/claimline';
import { txLink } from '@/config/genlayer';
import { Dialog } from './Dialog';

export function PolicyDrawer({
  policy,
  onClose,
  onFileClaim,
  wallet,
  busy,
  feedback,
  onClosePolicy,
  onWithdraw,
}: {
  policy: Policy;
  onClose: () => void;
  onFileClaim: () => void;
  wallet: string | null;
  busy: string | null;
  feedback?: { kind: 'ok' | 'err'; text: string } | null;
  onClosePolicy: () => void;
  onWithdraw: () => void;
}) {
  return (
    <Dialog title={`Policy ${policy.id}: ${policy.coverage}`} variant="drawer" onClose={onClose}>
      <header className="drawer-head">
        <div>
          <span className="kicker">Policy {policy.id}</span>
          <h2>{policy.coverage}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </header>

      <div className="drawer-body">
        <div className="pill-row">
          <span className={`pill ${statusTone(policy.status)}`}>{statusLabel(policy.status)}</span>
          <span className="pill neutral">
            {formatDate(policy.startsAt)} to {formatDate(policy.endsAt)}
          </span>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Coverage limit</dt>
            <dd>{formatGen(policy.limitWei)} GEN</dd>
          </div>
          <div>
            <dt>Deductible</dt>
            <dd>{formatGen(policy.deductibleWei)} GEN</dd>
          </div>
          <div>
            <dt>Pool</dt>
            <dd>{formatGen(policy.poolWei)} GEN</dd>
          </div>
          <div>
            <dt>Settled from pool</dt>
            <dd>{formatGen(policy.paidWei)} GEN</dd>
          </div>
          <div><dt>Reserved for claims</dt><dd>{formatGen(policy.reservedWei || '0')} GEN</dd></div>
          <div><dt>Recovered by insurer</dt><dd>{formatGen(policy.withdrawnWei || '0')} GEN</dd></div>
          <div><dt>Available to recover</dt><dd>{formatGen(policy.recoverableWei || '0')} GEN</dd></div>
          <div><dt>Reporting deadline</dt><dd>{formatDate(policy.reportingEndsAt || policy.endsAt)}</dd></div>
          <div>
            <dt>Claims filed</dt>
            <dd>{policy.claimCount}</dd>
          </div>
          <div>
            <dt>Holder</dt>
            <dd>{shortAddress(policy.holder)}</dd>
          </div>
        </dl>

        <section className="drawer-section">
          <h3>Policy wording</h3>
          <p className="wording">{policy.wording}</p>
        </section>

        <section className="drawer-section">
          <h3>Conditions ({policy.conditions.length})</h3>
          <ol className="conditions">
            {policy.conditions.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ol>
        </section>

        <section className="drawer-section">
          <h3>Parties</h3>
          <p className="mono-line">Insurer {policy.insurer}</p>
          <p className="mono-line">Holder {policy.holder}</p>
        </section>
      </div>

      <footer className="drawer-foot">
        {feedback && <p role={feedback.kind === 'err' ? 'alert' : 'status'}>{feedback.text}</p>}
        <button className="btn primary" onClick={onFileClaim} disabled={policy.status !== 'ACTIVE'}>
          <FileText size={15} /> File a claim
        </button>
        {policy.status !== 'ACTIVE' && (
          <p className="foot-note">This policy is closed to new claims.</p>
        )}
        {sameAddress(wallet || '', policy.insurer) && (
          <>
            {policy.status === 'ACTIVE' && <button className="btn" onClick={onClosePolicy} disabled={Boolean(busy) || Date.now() / 1000 < Number(policy.reportingEndsAt || policy.endsAt)}>Close policy</button>}
            {policy.status === 'CLOSED' && <button className="btn" onClick={onWithdraw} disabled={Boolean(busy) || BigInt(policy.recoverableWei || '0') <= 0n}>Recover unused GEN</button>}
            <p className="foot-note">Close after the reporting deadline. Unresolved claims and remaining appeals keep their collateral reserved.</p>
          </>
        )}
      </footer>
    </Dialog>
  );
}

export function ClaimDrawer({
  claim,
  canAdjudicate,
  wallet,
  insurer,
  feedback,
  onConnect,
  busy,
  onClose,
  onAdjudicate,
  onSettle,
  onReplace,
}: {
  claim: Claim;
  canAdjudicate: boolean;
  wallet: string | null;
  insurer?: string;
  feedback?: { kind: 'ok' | 'err'; text: string } | null;
  onConnect: () => void;
  busy: string | null;
  onClose: () => void;
  onAdjudicate: () => void;
  onSettle: () => void;
  onReplace: (uri: string, digest: string) => void;
}) {
  const [uri, setUri] = useState(claim.evidenceUri);
  const [digest, setDigest] = useState(claim.evidenceDigest);
  const [hashing, setHashing] = useState(false);
  const [hashError, setHashError] = useState<string | null>(null);

  const isHolder = sameAddress(claim.claimant, wallet);
  const isInsurer = Boolean(insurer && sameAddress(insurer, wallet));
  const approved = claim.status === 'APPROVED' || claim.status === 'PARTIALLY_APPROVED';

  async function pickFile(file: File | null) {
    if (!file) return;
    setHashing(true);
    setHashError(null);
    try {
      setDigest(await sha256Digest(await file.arrayBuffer()));
    } catch {
      setHashError('Could not hash that file.');
    } finally {
      setHashing(false);
    }
  }

  return (
    <Dialog title={`Claim ${claim.id}`} variant="drawer" onClose={onClose}>
      <header className="drawer-head">
        <div>
          <span className="kicker">
            Claim {claim.id} · Policy {claim.policyId}
          </span>
          <h2>{formatGen(claim.claimedWei)} GEN claimed</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </header>

      <div className="drawer-body">
        <div className="pill-row">
          <span className={`pill ${statusTone(claim.status)}`}>{statusLabel(claim.status)}</span>
          {claim.confidenceBand !== 'NONE' && (
            <span className="pill neutral">Confidence {claim.confidenceBand}</span>
          )}
          {!claim.decisionIsCurrent && claim.outcome !== 'NONE' && (
            <span className="pill pending">Stale verdict</span>
          )}
        </div>

        {!claim.decisionIsCurrent && claim.outcome !== 'NONE' && (
          <div className="notice warn">
            <AlertTriangle size={15} />
            This verdict belongs to an earlier evidence revision. The current document has not been
            judged.
          </div>
        )}

        <dl className="detail-grid">
          <div>
            <dt>Payout</dt>
            <dd>{formatGen(claim.payoutWei)} GEN</dd>
          </div>
          <div>
            <dt>Payout band</dt>
            <dd>{claim.payoutBand}%</dd>
          </div>
          <div>
            <dt>Incident date</dt>
            <dd>{formatDate(claim.incidentAt)}</dd>
          </div>
          <div>
            <dt>Evidence revision</dt>
            <dd>{claim.evidenceRevision} of 3</dd>
          </div>
          <div>
            <dt>Judged revision</dt>
            <dd>{claim.evaluatedRevision || 'none'}</dd>
          </div>
          <div>
            <dt>Appeals used</dt>
            <dd>{claim.appeals} of 1</dd>
          </div>
        </dl>

        {claim.reason && (
          <section className="drawer-section">
            <h3>Committee reason</h3>
            <p className="wording">{claim.reason}</p>
          </section>
        )}

        {claim.conditions.length > 0 && (
          <section className="drawer-section">
            <h3>Condition findings</h3>
            <ul className="findings">
              {claim.conditions.map((finding, index) => (
                <li
                  key={`${finding.condition}-${index}`}
                  className={finding.passed ? 'pass' : 'fail'}
                >
                  <span className="finding-icon">
                    {finding.passed ? <Check size={14} /> : <Minus size={14} />}
                  </span>
                  <div>
                    <strong>{finding.condition}</strong>
                    <p>{finding.reason || (finding.passed ? 'Met.' : 'Not met.')}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {claim.inconsistencies.length > 0 && (
          <section className="drawer-section">
            <h3>What the committee flagged</h3>
            <ul className="flags">
              {claim.inconsistencies.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="drawer-section">
          <h3>Evidence</h3>
          <p className="mono-line break">
            <FileText size={13} />{' '}
            <a href={claim.evidenceUri} target="_blank" rel="noreferrer">
              {claim.evidenceUri} <ArrowUpRight size={11} />
            </a>
          </p>
          <p className="mono-line break">
            <Hash size={13} /> {claim.evidenceDigest}
          </p>
          {claim.contentDigest && (
            <p className="mono-line break muted">Judged bytes: {claim.contentDigest}</p>
          )}
        </section>

        {canReplace(claim) && isHolder && (
          <section className="drawer-section">
            <h3>
              {claim.status === 'DECLINED' ? 'Appeal with new evidence' : 'Replace the document'}
            </h3>
            <p className="hint">
              A new revision needs a different document and its digest. Re-committing the current
              revision is refused, and a declined claim can be appealed once.
            </p>
            <label className="field">
              <span>Document URL</span>
              <input
                value={uri}
                onChange={(event) => setUri(event.target.value)}
                placeholder="https://…"
              />
            </label>
            <label className="field">
              <span>SHA-256 digest</span>
              <input
                value={digest}
                onChange={(event) => setDigest(event.target.value)}
                placeholder="sha256:…"
              />
            </label>
            <label className="file-pick">
              <input
                type="file"
                onChange={(event) => void pickFile(event.target.files?.[0] ?? null)}
              />
              <span>{hashing ? 'Hashing…' : 'Hash a file to fill the digest'}</span>
            </label>
            {hashError && <p className="field-error">{hashError}</p>}
            <button
              className="btn ghost"
              disabled={
                Boolean(busy) ||
                hashing ||
                !/^https:\/\//i.test(uri.trim()) ||
                !/^sha256:[a-f0-9]{64}$/i.test(digest.trim())
              }
              onClick={() => onReplace(uri, digest)}
            >
              {busy ? <Loader2 className="spin" size={14} /> : <FileText size={14} />} Commit
              revision
            </button>
          </section>
        )}

        {claim.status === 'SETTLED' && (
          <div className="notice ok">
            <Check size={15} /> Settled. GEN was sent to the claimant wallet on finalization.
          </div>
        )}
      </div>

      <footer className="drawer-foot">
        {feedback && (
          <div
            className={`notice ${feedback.kind === 'err' ? 'error' : 'ok'}`}
            role={feedback.kind === 'err' ? 'alert' : 'status'}
          >
            {feedback.text}
          </div>
        )}
        {canAdjudicate && (
          <button
            className="btn primary"
            disabled={Boolean(busy) || (!isHolder && !isInsurer)}
            onClick={onAdjudicate}
          >
            {busy ? <Loader2 className="spin" size={15} /> : <FileText size={15} />} Ask the
            committee
          </button>
        )}
        {!wallet && (
          <button className="btn ghost" onClick={onConnect}>
            Connect wallet
          </button>
        )}
        {canSettle(claim) && (
          <button className="btn ghost" disabled={Boolean(busy) || !isInsurer} onClick={onSettle}>
            {busy ? <Loader2 className="spin" size={15} /> : <Check size={15} />} Settle payout
          </button>
        )}
        {!canAdjudicate && !approved && claim.status !== 'SETTLED' && (
          <p className="foot-note">No action available for this revision.</p>
        )}
        {canAdjudicate && !isHolder && !isInsurer && (
          <p className="foot-note">
            Connect the policyholder or insurer wallet to request a decision.
          </p>
        )}
        {canSettle(claim) && !isInsurer && (
          <p className="foot-note">Only the insurer can settle this claim.</p>
        )}
      </footer>
    </Dialog>
  );
}

export function TxLink({ hash }: { hash: string }) {
  return (
    <a className="tx-link" href={txLink(hash)} target="_blank" rel="noreferrer">
      {shortAddress(hash)} <ArrowUpRight size={11} />
    </a>
  );
}
