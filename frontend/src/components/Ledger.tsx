import type { ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  FileCheck2,
  FileText,
  Scale,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  formatDate,
  formatGen,
  shortAddress,
  statusLabel,
  statusTone,
  type Claim,
  type Policy,
} from '@/lib/claimline';

export function DecisionGuide() {
  return (
    <aside className="decision-guide" aria-label="How a claim is decided">
      <img
        src="/images/architecture.jpg"
        alt="Looking up between glass buildings toward an open sky"
        width="1100"
        height="733"
        fetchPriority="high"
      />
      <div className="guide-content">
        <h2>A clear path to a decision</h2>
        <ol className="guide-steps">
          <li>
            <ShieldCheck size={18} />
            <div>
              <strong>Set the terms</strong>
              <span>Coverage and conditions recorded before a claim.</span>
            </div>
          </li>
          <li>
            <FileCheck2 size={18} />
            <div>
              <strong>Submit your evidence</strong>
              <span>The committee verifies the original document.</span>
            </div>
          </li>
          <li>
            <Scale size={18} />
            <div>
              <strong>Read the decision</strong>
              <span>A finding for every condition, with a reason.</span>
            </div>
          </li>
        </ol>
      </div>
    </aside>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-note">{note}</span>
    </div>
  );
}

export function PolicyCard({ policy, onOpen }: { policy: Policy; onOpen: () => void }) {
  return (
    <article className="policy-card">
      <header className="policy-card-head">
        <span className="policy-icon">
          <ShieldCheck size={20} />
        </span>
        <span className={`pill ${statusTone(policy.status)}`}>{statusLabel(policy.status)}</span>
      </header>
      <span className="kicker">Policy {policy.id}</span>
      <h3>
        <button className="card-link" onClick={onOpen}>
          {policy.coverage}
          <ArrowUpRight size={17} />
        </button>
      </h3>
      <p className="policy-period">
        {formatDate(policy.startsAt)} to {formatDate(policy.endsAt)}
      </p>
      <dl className="policy-figures">
        <div>
          <dt>Coverage limit</dt>
          <dd>
            {formatGen(policy.limitWei)} <small>GEN</small>
          </dd>
        </div>
        <div>
          <dt>Available pool</dt>
          <dd>
            {formatGen(policy.poolWei)} <small>GEN</small>
          </dd>
        </div>
        <div>
          <dt>Deductible</dt>
          <dd>
            {formatGen(policy.deductibleWei)} <small>GEN</small>
          </dd>
        </div>
        <div>
          <dt>Claims filed</dt>
          <dd>{policy.claimCount}</dd>
        </div>
      </dl>
      <footer className="policy-card-foot">
        <span>
          Holder <span className="address">{shortAddress(policy.holder)}</span>
        </span>
        <span>
          {policy.conditions.length} conditions <ArrowRight size={13} />
        </span>
      </footer>
    </article>
  );
}

export function ClaimLedger({
  claims,
  onOpen,
}: {
  claims: Claim[];
  onOpen: (claim: Claim) => void;
}) {
  return (
    <div className="ledger-wrap">
      <table className="ledger">
        <caption className="sr-only">Claims and their committee decisions</caption>
        <thead>
          <tr>
            <th scope="col">Claim / Policy</th>
            <th scope="col">Amount claimed</th>
            <th scope="col">Payout</th>
            <th scope="col">Evidence</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => (
            <tr key={claim.id}>
              <td>
                <button className="claim-link" onClick={() => onOpen(claim)}>
                  Claim {claim.id}
                </button>
                <span className="table-sub">Policy {claim.policyId}</span>
              </td>
              <td className="numeric">
                {formatGen(claim.claimedWei)} <small>GEN</small>
              </td>
              <td className="numeric">
                {claim.decisionIsCurrent ? (
                  <>
                    {formatGen(claim.payoutWei)} <small>GEN</small>
                  </>
                ) : (
                  <span className="muted">Pending review</span>
                )}
              </td>
              <td>
                <span>Revision {claim.evidenceRevision}</span>
                <span className="table-sub">
                  {claim.decisionIsCurrent ? 'Reviewed' : 'Awaiting review'}
                </span>
              </td>
              <td>
                <span className={`pill ${statusTone(claim.status)}`}>
                  {statusLabel(claim.status)}
                </span>
              </td>
              <td>
                <button
                  className="icon-btn"
                  aria-label={`Open claim ${claim.id}`}
                  onClick={() => onOpen(claim)}
                >
                  <ArrowUpRight size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Empty({
  title,
  body,
  action,
  search = false,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  search?: boolean;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">{search ? <Search size={23} /> : <FileText size={23} />}</span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
