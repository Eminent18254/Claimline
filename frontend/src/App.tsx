import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import {
  adjudicate,
  connect,
  disconnect,
  fetchState,
  readError,
  replaceEvidence,
  settle,
} from '@/lib/genlayer/client';
import { canAdjudicate, formatGen, shortAddress, type ClaimlineState } from '@/lib/claimline';
import { contractLink } from '@/config/genlayer';
import { ClaimDrawer, PolicyDrawer } from '@/components/Drawers';
import { FileClaimModal, NewPolicyModal } from '@/components/Modals';
import { ClaimLedger, Empty, PolicyCard, Stat } from '@/components/Ledger';
import { Landing } from '@/components/Landing';
import { ConnectWalletModal } from '@/components/ConnectWalletModal';
import { useSession } from '@/lib/session';
import { Brand } from '@/components/Brand';
import { Footer } from '@/components/Footer';
import { Documentation } from '@/components/Documentation';

type Tab = 'policies' | 'claims';
type Filter = 'ALL' | 'OPEN' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'DECLINED' | 'SETTLED';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All claims' },
  { key: 'OPEN', label: 'Open' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'PARTIALLY_APPROVED', label: 'Partial' },
  { key: 'DECLINED', label: 'Declined' },
  { key: 'SETTLED', label: 'Settled' },
];

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname);
    window.addEventListener('popstate', updatePath);
    return () => window.removeEventListener('popstate', updatePath);
  }, []);
  const go = (next: string) => {
    window.history.pushState(null, '', next);
    setPath(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  useEffect(() => {
    document.title = path.startsWith('/app')
      ? 'Claims desk | Claimline'
      : path.startsWith('/docs')
        ? 'Documentation | Claimline'
        : 'Claimline - claims decided on evidence';
  }, [path]);
  return path === '/app' || path === '/app/' ? (
    <Workspace onHome={() => go('/')} />
  ) : path === '/docs' || path === '/docs/' ? (
    <Documentation onHome={() => go('/')} onEnter={() => go('/app')} />
  ) : (
    <Landing onEnter={() => go('/app')} />
  );
}

function Workspace({ onHome }: { onHome: () => void }) {
  const { wallet } = useSession();
  const [state, setState] = useState<ClaimlineState | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('policies');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [filingPolicyId, setFilingPolicyId] = useState<string | undefined>();
  const [modal, setModal] = useState<'policy' | 'claim' | null>(null);
  const [connectionIntent, setConnectionIntent] = useState<'policy' | 'claim' | 'browse' | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!wallet.address && modal) {
      setConnectionIntent(modal);
      setModal(null);
    }
  }, [wallet.address, modal]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 8000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const fresh = await Promise.race([
        fetchState(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () =>
              reject(new Error('Studionet did not respond within 20 seconds. Please try again.')),
            20_000,
          );
        }),
      ]);
      setState(fresh);
      setUpdatedAt(new Date());
    } catch (cause) {
      setError(readError(cause));
    } finally {
      clearTimeout(timeout);
      inFlight.current = false;
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const policies = state?.policies ?? [];
  const claims = state?.claims ?? [];
  const selectedPolicy = policies.find((policy) => policy.id === selectedPolicyId);
  const selectedClaim = claims.find((claim) => claim.id === selectedClaimId);
  const selectedClaimPolicy = policies.find((policy) => policy.id === selectedClaim?.policyId);
  const openCount = claims.filter(
    (claim) => claim.status === 'FILED' || claim.status === 'MORE_EVIDENCE_REQUIRED',
  ).length;
  const paid = policies.reduce((sum, policy) => sum + BigInt(policy.paidWei || '0'), 0n);
  const needle = query.trim().toLowerCase();
  const filteredClaims = claims.filter(
    (claim) =>
      (filter === 'ALL' ||
        (filter === 'OPEN'
          ? claim.status === 'FILED' || claim.status === 'MORE_EVIDENCE_REQUIRED'
          : claim.status === filter)) &&
      `${claim.id} ${claim.policyId} ${claim.status} ${claim.claimant}`
        .toLowerCase()
        .includes(needle),
  );
  const filteredPolicies = policies.filter((policy) =>
    `${policy.id} ${policy.coverage} ${policy.holder} ${policy.insurer}`
      .toLowerCase()
      .includes(needle),
  );

  function switchTab(next: Tab) {
    setTab(next);
    setQuery('');
    setFilter('ALL');
  }
  function navigate(next: Tab) {
    switchTab(next);
    document.getElementById('workspace')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start',
    });
  }
  function openClaim(policyId?: string) {
    setFilingPolicyId(policyId);
    if (!wallet.address) setConnectionIntent('claim');
    else setModal('claim');
  }
  function openPolicy() {
    if (!wallet.address) setConnectionIntent('policy');
    else setModal('policy');
  }
  async function act(label: string, work: () => Promise<void>) {
    if (busy) return;
    if (!wallet.address) {
      setConnectionIntent('browse');
      return;
    }
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

  return (
    <div className="shell workspace-shell" id="top">
      <a className="skip-link" href="#workspace">
        Skip to the claims desk
      </a>
      <header className="site-header">
        <Brand onHome={onHome} />
        <nav className="site-nav" aria-label="Main navigation">
          <button
            className={`nav-link ${tab === 'policies' ? 'is-active' : ''}`}
            onClick={() => navigate('policies')}
            aria-pressed={tab === 'policies'}
          >
            Policies
          </button>
          <button
            className={`nav-link ${tab === 'claims' ? 'is-active' : ''}`}
            onClick={() => navigate('claims')}
            aria-pressed={tab === 'claims'}
          >
            Claims
          </button>
          <a className="nav-link" href={contractLink()} target="_blank" rel="noreferrer">
            Contract <ArrowUpRight size={13} />
          </a>
        </nav>
        <div className="header-actions">
          <span className="net-pill">
            Studionet <span>Testnet</span>
          </span>
          {wallet.address ? (
            <button
              className="btn ghost wallet-button"
              onClick={() => void disconnect()}
              title="Disconnect wallet"
            >
              <Wallet size={15} />
              {shortAddress(wallet.address)}
            </button>
          ) : (
            <button
              className="btn primary wallet-button"
              disabled={wallet.isConnecting}
              onClick={() =>
                void connect().catch((cause) => setToast({ kind: 'err', text: readError(cause) }))
              }
            >
              <Wallet size={15} />
              {wallet.isConnecting ? 'Connecting…' : 'Connect wallet'}
            </button>
          )}
        </div>
      </header>

      <main>
        <div className="workspace-intro">
          <div>
            <p className="kicker">Claimline / Claims desk</p>
            <h1>The public claims ledger</h1>
            <p>Read the policies. Review the evidence. Follow every decision.</p>
          </div>
          <span className={`access-label ${wallet.address ? 'connected' : ''}`}>
            <Wallet size={14} />
            {wallet.address ? 'Wallet connected' : 'Browsing without a wallet'}
          </span>
        </div>
        {!wallet.address && (
          <div className="browse-banner">
            <div>
              <strong>You’re free to explore.</strong>
              <span>
                Connect your wallet to create a policy, file a claim, or request a decision.
              </span>
            </div>
            <button className="btn ghost small" onClick={() => setConnectionIntent('browse')}>
              <Wallet size={14} />
              Connect wallet
            </button>
          </div>
        )}

        <section className="stats" aria-label="Contract totals" aria-busy={loading}>
          <Stat
            label="Policies on chain"
            value={state ? String(policies.length) : '···'}
            note="Terms recorded on chain"
          />
          <Stat
            label="Claims filed"
            value={state ? String(claims.length) : '···'}
            note="Evidence submitted for review"
          />
          <Stat
            label="Awaiting review"
            value={state ? String(openCount) : '···'}
            note="Open claims and evidence requests"
          />
          <Stat
            label="Settled from pools"
            value={state ? `${formatGen(paid)} GEN` : '···'}
            note="Accounted for on Studionet"
          />
        </section>

        <section className="board" id="workspace" aria-labelledby="workspace-title" tabIndex={-1}>
          <div className="board-head">
            <div>
              <h2 id="workspace-title">{tab === 'policies' ? 'Policy register' : 'Claims ledger'}</h2>
              <p>Explore policies, follow claims, and see how each decision was reached.</p>
            </div>
            <div className="board-actions">
              <button
                className="btn ghost small"
                disabled={loading || Boolean(busy)}
                onClick={() => void load()}
              >
                <RefreshCw size={14} className={loading ? 'spin' : undefined} />
                {loading ? 'Refreshing' : 'Refresh'}
              </button>
              <button
                className="btn primary small"
                onClick={() => (tab === 'policies' ? openPolicy() : openClaim())}
              >
                <Plus size={14} />
                {tab === 'policies' ? 'Write a policy' : 'File a claim'}
              </button>
            </div>
          </div>
          {wallet.isWrongChain && (
            <div className="notice warn" role="status">
              <AlertCircle size={17} />
              <span>
                Your wallet is on another network. Your next transaction will ask you to switch to
                Studionet.
              </span>
            </div>
          )}
          <div className="workspace-bar">
            <div className="workspace-tabs" role="tablist" aria-label="Policy and claim views">
              {(['policies', 'claims'] as const).map((item) => (
                <button
                  key={item}
                  id={`tab-${item}`}
                  role="tab"
                  aria-selected={tab === item}
                  aria-controls="workspace-panel"
                  tabIndex={tab === item ? 0 : -1}
                  className={tab === item ? 'is-active' : ''}
                  onClick={() => switchTab(item)}
                  onKeyDown={(event) => {
                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                      event.preventDefault();
                      const next =
                        event.key === 'Home'
                          ? 'policies'
                          : event.key === 'End'
                            ? 'claims'
                            : tab === 'claims'
                              ? 'policies'
                              : 'claims';
                      switchTab(next);
                      document.getElementById(`tab-${next}`)?.focus();
                    }
                  }}
                >
                  {item === 'policies' ? <ShieldCheck size={15} /> : <FileText size={15} />}
                  {item === 'policies' ? 'Policies' : 'Claims'}
                  <span>
                    {state ? (item === 'policies' ? policies.length : claims.length) : '···'}
                  </span>
                </button>
              ))}
            </div>
            <label className="search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tab === 'policies' ? 'Search policies…' : 'Search claims…'}
                aria-label={tab === 'policies' ? 'Search policies' : 'Search claims'}
              />
              {query && (
                <button className="icon-btn" aria-label="Clear search" onClick={() => setQuery('')}>
                  <X size={14} />
                </button>
              )}
            </label>
          </div>
          <div className="toolbar">
            {tab === 'claims' ? (
              <div className="filters" aria-label="Filter claims by status">
                {FILTERS.map((item) => (
                  <button
                    key={item.key}
                    className={`chip ${filter === item.key ? 'is-on' : ''}`}
                    aria-pressed={filter === item.key}
                    onClick={() => setFilter(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="toolbar-note">
                All policies <span>· Public ledger</span>
              </span>
            )}
            <span className="result-count" role="status">
              {state
                ? `${tab === 'policies' ? filteredPolicies.length : filteredClaims.length} shown`
                : loading
                  ? 'Connecting to Studionet'
                  : 'Data unavailable'}
            </span>
          </div>
          {error && state && (
            <div className="notice warn" role="alert">
              <AlertCircle size={17} />
              <span>Couldn’t refresh. Showing the last loaded records.</span>
              <button className="text-button" onClick={() => void load()} disabled={loading}>
                Try again
              </button>
            </div>
          )}
          <div
            id="workspace-panel"
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
            aria-busy={loading}
          >
            {!state && loading ? (
              <div className="loading-state" role="status">
                <Loader2 size={20} className="spin" />
                <strong>Reading the public ledger</strong>
                <p>Fetching policies and claims from Studionet.</p>
                <div className="skeleton-grid" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            ) : !state && error ? (
              <div className="empty connection-error" role="alert">
                <span className="empty-icon">
                  <AlertCircle size={24} />
                </span>
                <h3>The ledger couldn’t be reached</h3>
                <p>We couldn’t load policies and claims from Studionet. Try connecting again.</p>
                <button className="btn primary" onClick={() => void load()}>
                  <RefreshCw size={15} />
                  Try again
                </button>
                <details>
                  <summary>Connection details</summary>
                  <p>{error}</p>
                </details>
              </div>
            ) : tab === 'policies' ? (
              filteredPolicies.length ? (
                <div className="policy-grid">
                  {filteredPolicies.map((policy) => (
                    <PolicyCard
                      key={policy.id}
                      policy={policy}
                      onOpen={() => setSelectedPolicyId(policy.id)}
                    />
                  ))}
                </div>
              ) : (
                <Empty
                  search={policies.length > 0}
                  title={policies.length ? 'No matching policies' : 'The first policy starts here'}
                  body={
                    policies.length
                      ? 'Try another coverage name, policy ID, or wallet address.'
                      : 'Record the coverage, conditions, and funding that every future claim will be reviewed against.'
                  }
                  action={
                    <button
                      className="btn ghost"
                      onClick={() => (policies.length ? setQuery('') : openPolicy())}
                    >
                      {policies.length ? 'Clear search' : 'Write a policy'}
                    </button>
                  }
                />
              )
            ) : filteredClaims.length ? (
              <ClaimLedger
                claims={filteredClaims}
                onOpen={(claim) => setSelectedClaimId(claim.id)}
              />
            ) : (
              <Empty
                search={claims.length > 0}
                title={claims.length ? 'No matching claims' : 'No claims filed yet'}
                body={
                  claims.length
                    ? 'Try another search or choose a different status.'
                    : 'When a policyholder submits evidence, their claim and its review will appear here.'
                }
                action={
                  <button
                    className="btn ghost"
                    onClick={() => {
                      if (claims.length) {
                        setQuery('');
                        setFilter('ALL');
                      } else openClaim();
                    }}
                  >
                    {claims.length ? 'Clear filters' : 'File a claim'}
                  </button>
                }
              />
            )}
          </div>
          <p className="ledger-caption">
            <ShieldCheck size={13} />
            Read directly from the GenLayer contract
            {updatedAt && (
              <span>
                Updated {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </section>
      </main>

      <Footer />
      {busy && (
        <div className="busy-bar" role="status">
          <Loader2 className="spin" size={16} />
          {busy} · waiting for confirmation
        </div>
      )}
      {toast && (
        <div className={`toast ${toast.kind}`} role={toast.kind === 'err' ? 'alert' : 'status'}>
          {toast.kind === 'ok' ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
          <span>{toast.text}</span>
          <button
            className="icon-btn"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {selectedPolicy && (
        <PolicyDrawer
          policy={selectedPolicy}
          onClose={() => setSelectedPolicyId(null)}
          onFileClaim={() => {
            openClaim(selectedPolicy.id);
            setSelectedPolicyId(null);
          }}
        />
      )}
      {selectedClaim && (
        <ClaimDrawer
          key={selectedClaim.id}
          claim={selectedClaim}
          insurer={selectedClaimPolicy?.insurer}
          canAdjudicate={canAdjudicate(selectedClaim)}
          wallet={wallet.address}
          busy={busy}
          feedback={toast}
          onConnect={() => setConnectionIntent('browse')}
          onClose={() => setSelectedClaimId(null)}
          onAdjudicate={() => void act('Decision', () => adjudicate(selectedClaim.id))}
          onSettle={() => void act('Settlement', () => settle(selectedClaim.id))}
          onReplace={(uri, digest) =>
            void act('Evidence revision', () => replaceEvidence(selectedClaim.id, uri, digest))
          }
        />
      )}
      {modal === 'policy' && (
        <NewPolicyModal
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            void load();
            setToast({ kind: 'ok', text: 'Policy recorded on chain.' });
          }}
        />
      )}
      {modal === 'claim' && (
        <FileClaimModal
          policies={policies}
          initialPolicyId={filingPolicyId}
          wallet={wallet.address}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            switchTab('claims');
            void load();
            setToast({ kind: 'ok', text: 'Claim submitted on chain.' });
          }}
        />
      )}
      {connectionIntent && (
        <ConnectWalletModal
          onClose={() => setConnectionIntent(null)}
          onConnected={() => {
            const intent = connectionIntent;
            setConnectionIntent(null);
            if (intent === 'claim' || intent === 'policy') setModal(intent);
          }}
        />
      )}
    </div>
  );
}
