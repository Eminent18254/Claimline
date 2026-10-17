import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import {
  canAdjudicate,
  formatDate,
  formatGen,
  shortAddress,
  statusLabel,
  statusTone,
  type Claim,
  type ClaimlineState,
  type Policy,
} from '@/lib/claimline';
import {
  adjudicate,
  connect,
  disconnect,
  fetchState,
  readError,
  replaceEvidence,
  restore,
  settle,
  subscribe,
  type WalletState,
} from '@/lib/genlayer/client';
import { contractLink, GENLAYER } from '@/config/genlayer';
import { ClaimDrawer, PolicyDrawer } from '@/components/Drawers';
import { FileClaimModal, NewPolicyModal } from '@/components/Modals';

type Tab = 'policies' | 'claims';
type Toast = { kind: 'ok' | 'err'; text: string } | null;

export default function App() {
  const [state, setState] = useState<ClaimlineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('policies');
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnecting: false,
    isWrongChain: false,
  });
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [modal, setModal] = useState<'policy' | 'claim' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => subscribe(setWallet), []);
  useEffect(() => {
    void restore();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setState(await fetchState());
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const policies = state?.policies ?? [];
  const claims = state?.claims ?? [];

  const stats = useMemo(() => {
    const open = claims.filter(
      (claim) => claim.status === 'FILED' || claim.status === 'MORE_EVIDENCE_REQUIRED',
    ).length;
    const approved = claims.filter(
      (claim) => claim.status === 'APPROVED' || claim.status === 'PARTIALLY_APPROVED',
    ).length;
    const paid = policies.reduce((sum, policy) => sum + BigInt(policy.paidWei || '0'), 0n);
    return { open, approved, paid: paid.toString() };
  }, [claims, policies]);

  async function act(label: string, work: () => Promise<void>) {
    setBusy(label);
    try {
      await work();
      await load();
      setToast({ kind: 'ok', text: `${label} confirmed on chain.` });
    } catch (cause) {
      setToast({ kind: 'err', text: readError(cause) });
    } finally {
      setBusy(null);
    }
  }

  function refreshSelectedClaim() {
    if (!selectedClaim) return;
    const fresh = claims.find((claim) => claim.id === selectedClaim.id);
    if (fresh) setSelectedClaim(fresh);
  }

  return (
    <div className="shell" id="top">
      <header className="site-header">
        <a className="brand" href="#top">
          <span className="brand-mark">
            <ShieldCheck size={18} strokeWidth={2.1} />
          </span>
          <span className="brand-word">Claimline</span>
        </a>

        <nav className="site-nav">
          <button className={tab === 'policies' ? 'nav-link is-active' : 'nav-link'} onClick={() => setTab('policies')}>
            Policies
          </button>
          <button className={tab === 'claims' ? 'nav-link is-active' : 'nav-link'} onClick={() => setTab('claims')}>
            Claims
          </button>
          <a className="nav-link" href={contractLink()} target="_blank" rel="noreferrer">
            Contract <ArrowUpRight size={13} />
          </a>
        </nav>

        <div className="header-actions">
          <span className="net-pill">
            <span className="dot" /> {GENLAYER.chainName} · {GENLAYER.chainId}
          </span>
          {wallet.address ? (
            <button className="btn ghost" onClick={() => void disconnect()} title="Disconnect">
              {shortAddress(wallet.address)}
            </button>
          ) : (
            <button className="btn primary" onClick={() => void connect().catch((e) => setToast({ kind: 'err', text: readError(e) }))}>
              <Wallet size={15} /> {wallet.isConnecting ? 'Connecting' : 'Connect wallet'}
            </button>
          )}
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Independent claims adjudication</p>
            <h1>
              Claims decided on evidence.
              <span> Not on the insurer&apos;s word.</span>
            </h1>
            <p className="lede">
              The policy is written to chain before the claim exists. The claim document is fetched and
              hash-checked by the committee itself. Every condition comes back with a pass or fail, and
              the payout is arithmetic on chain - not a number the model chose.
            </p>
            <div className="hero-actions">
              <button className="btn primary" onClick={() => setModal('claim')}>
                <FileText size={15} /> File a claim
              </button>
              <button className="btn ghost" onClick={() => setModal('policy')}>
                <Plus size={15} /> Write a policy
              </button>
            </div>
          </div>

          <aside className="how-card">
            <p className="kicker">How a decision is made</p>
            <ol className="steps">
              <li>
                <span className="step-no">01</span>
                <div>
                  <strong>Policy on chain</strong>
                  <p>Coverage, wording, limit, deductible and every condition, fixed before a claim.</p>
                </div>
              </li>
              <li>
                <span className="step-no">02</span>
                <div>
                  <strong>Document committed</strong>
                  <p>The holder files a URL and its SHA-256. The committee downloads those exact bytes.</p>
                </div>
              </li>
              <li>
                <span className="step-no">03</span>
                <div>
                  <strong>Committee rules</strong>
                  <p>Outcome, payout band and one finding per condition. The insurer settles what the policy allows.</p>
                </div>
              </li>
            </ol>
          </aside>
        </section>

        <section className="stats" aria-label="Contract totals">
          <Stat label="Policies" value={String(policies.length)} />
          <Stat label="Claims" value={String(claims.length)} />
          <Stat label="Open reviews" value={String(stats.open)} />
          <Stat label="Paid out" value={`${formatGen(stats.paid)} GEN`} />
        </section>

        <section className="board">
          <div className="board-head">
            <div>
              <h2>{tab === 'policies' ? 'Policies' : 'Claims'}</h2>
              <p>
                {tab === 'policies'
                  ? 'Live from the contract. Open a policy to read its wording and conditions.'
                  : 'Every verdict, payout band and condition finding is stored on chain.'}
              </p>
            </div>
            <div className="board-actions">
              <button className="btn ghost small" onClick={() => void load()} disabled={loading}>
                <RefreshCw size={14} className={loading ? 'spin' : undefined} /> Refresh
              </button>
              {tab === 'policies' ? (
                <button className="btn primary small" onClick={() => setModal('policy')}>
                  <Plus size={14} /> New policy
                </button>
              ) : (
                <button className="btn primary small" onClick={() => setModal('claim')}>
                  <FileText size={14} /> File claim
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="notice error">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {loading && !state ? (
            <div className="empty">
              <Loader2 className="spin" size={22} /> Reading the contract…
            </div>
          ) : tab === 'policies' ? (
            policies.length === 0 ? (
              <Empty
                title="No policies yet"
                body="An insurer writes the first policy: coverage, wording, limit and the conditions a claim will be judged against."
                action={<button className="btn primary" onClick={() => setModal('policy')}>Write a policy</button>}
              />
            ) : (
              <div className="grid">
                {policies.map((policy) => (
                  <PolicyCard key={policy.id} policy={policy} onOpen={() => setSelectedPolicy(policy)} />
                ))}
              </div>
            )
          ) : claims.length === 0 ? (
            <Empty
              title="No claims filed"
              body="A claim commits a document URL and its SHA-256. The committee reads that document itself, so a reworded summary cannot change the result."
              action={<button className="btn primary" onClick={() => setModal('claim')}>File a claim</button>}
            />
          ) : (
            <div className="stack">
              {claims.map((claim) => (
                <ClaimRow key={claim.id} claim={claim} onOpen={() => setSelectedClaim(claim)} />
              ))}
            </div>
          )}
        </section>

        <section className="principle">
          <div>
            <p className="eyebrow">Why this needs GenLayer</p>
            <h2>A judgement, not a lookup.</h2>
            <p>
              Whether a clause covers an incident, and how much of a claim the paperwork supports, is not a
              formula. It is a reading of language against facts. GenLayer lets a validator committee reach
              consensus on that reading and write the result on chain, with the evidence it used still
              verifiable afterwards.
            </p>
          </div>
          <ul className="guarantees">
            <li><strong>Evidence, not assertions.</strong> The committee fetches the document itself and refuses it unless it hashes to the committed digest.</li>
            <li><strong>One verdict per revision.</strong> A judged revision cannot be rerun, and a declined claim gets a single appeal with new evidence.</li>
            <li><strong>Payout from the policy.</strong> The model picks a band; the contract applies the limit and deductible and checks the pool.</li>
          </ul>
        </section>
      </main>

      <footer className="site-footer">
        <span>Claimline · Studionet {GENLAYER.chainId}</span>
        <a href={contractLink()} target="_blank" rel="noreferrer">
          {shortAddress(GENLAYER.contract)} <ArrowUpRight size={12} />
        </a>
      </footer>

      {busy && (
        <div className="busy-bar">
          <Loader2 className="spin" size={15} /> {busy}… waiting for the committee
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.kind}`}>
          {toast.kind === 'ok' ? <ShieldCheck size={16} /> : <AlertCircle size={16} />}
          {toast.text}
        </div>
      )}

      {selectedPolicy && (
        <PolicyDrawer
          policy={selectedPolicy}
          onClose={() => setSelectedPolicy(null)}
          onFileClaim={() => {
            setSelectedPolicy(null);
            setModal('claim');
          }}
        />
      )}

      {selectedClaim && (
        <ClaimDrawer
          claim={selectedClaim}
          canAdjudicate={canAdjudicate(selectedClaim)}
          wallet={wallet.address}
          busy={busy}
          onClose={() => setSelectedClaim(null)}
          onAdjudicate={() =>
            void act('Decision', async () => {
              await adjudicate(selectedClaim.id);
              refreshSelectedClaim();
            })
          }
          onSettle={() =>
            void act('Settlement', async () => {
              await settle(selectedClaim.id);
              refreshSelectedClaim();
            })
          }
          onReplace={(uri, digest) =>
            void act('Evidence revision', async () => {
              await replaceEvidence(selectedClaim.id, uri, digest);
              refreshSelectedClaim();
            })
          }
        />
      )}

      {modal === 'policy' && (
        <NewPolicyModal
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            void load();
          }}
        />
      )}
      {modal === 'claim' && (
        <FileClaimModal
          policies={policies}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function PolicyCard({ policy, onOpen }: { policy: Policy; onOpen: () => void }) {
  return (
    <article className="card policy-card" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <header className="card-head">
        <div>
          <span className="kicker">Policy {policy.id}</span>
          <h3>{policy.coverage}</h3>
        </div>
        <span className={`pill ${statusTone(policy.status)}`}>{statusLabel(policy.status)}</span>
      </header>

      <dl className="facts">
        <div><dt>Limit</dt><dd>{formatGen(policy.limitWei)} GEN</dd></div>
        <div><dt>Pool</dt><dd>{formatGen(policy.poolWei)} GEN</dd></div>
        <div><dt>Deductible</dt><dd>{formatGen(policy.deductibleWei)} GEN</dd></div>
        <div><dt>Claims</dt><dd>{policy.claimCount}</dd></div>
      </dl>

      <ul className="condition-list">
        {policy.conditions.slice(0, 3).map((condition) => (
          <li key={condition}>{condition}</li>
        ))}
        {policy.conditions.length > 3 && <li className="more">+{policy.conditions.length - 3} more</li>}
      </ul>

      <footer className="card-foot">
        <span>Holder {shortAddress(policy.holder)}</span>
        <span>Covers to {formatDate(policy.endsAt)}</span>
      </footer>
    </article>
  );
}

function ClaimRow({ claim, onOpen }: { claim: Claim; onOpen: () => void }) {
  return (
    <article className="card claim-row" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className="claim-main">
        <span className="kicker">
          Claim {claim.id} · Policy {claim.policyId}
        </span>
        <h3>{formatGen(claim.claimedWei)} GEN claimed</h3>
        <p className="claim-sub">
          Revision {claim.evidenceRevision} · {claim.evaluatedRevision > 0 ? `judged rev ${claim.evaluatedRevision}` : 'not judged yet'}
          {claim.appeals > 0 ? ` · appeal ${claim.appeals}` : ''}
        </p>
      </div>

      <div className="claim-metrics">
        <div>
          <span>Payout</span>
          <strong>{formatGen(claim.payoutWei)} GEN</strong>
        </div>
        <div>
          <span>Band</span>
          <strong>{claim.payoutBand}%</strong>
        </div>
        <div>
          <span>Confidence</span>
          <strong>{claim.confidenceBand === 'NONE' ? '—' : claim.confidenceBand}</strong>
        </div>
      </div>

      <div className="claim-status">
        <span className={`pill ${statusTone(claim.status)}`}>{statusLabel(claim.status)}</span>
        {claim.outcome !== 'NONE' && <p className="claim-reason">{claim.reason}</p>}
      </div>
    </article>
  );
}

function Empty({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}