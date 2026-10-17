import { useState } from 'react';
import { AlertCircle, FileText, Loader2, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import {
  formatDate,
  formatGen,
  parseGen,
  sha256Digest,
  shortAddress,
  toUnix,
  type Policy,
} from '@/lib/claimline';
import { createPolicy, fileClaim, readError, stateAddress } from '@/lib/genlayer/client';

function localInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function Modal({ title, subtitle, onClose, children }: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <span className="kicker">Claimline</span>
            <h2>{title}</h2>
            <p className="modal-sub">{subtitle}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function NewPolicyModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const now = new Date();
  const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const [holder, setHolder] = useState('');
  const [coverage, setCoverage] = useState('Travel disruption');
  const [wording, setWording] = useState(
    'This policy covers non-refundable travel costs when a covered event prevents the insured from travelling. Claims must be supported by a booking confirmation and a supplier notice or official record of the event.',
  );
  const [conditions, setConditions] = useState<string[]>([
    'The incident occurred inside the covered period.',
    'A booking confirmation is included and matches the claimant.',
    'An official notice or supplier record confirms the disrupting event.',
    'The claimed amount is supported by a receipt or invoice.',
  ]);
  const [limit, setLimit] = useState('1000');
  const [deductible, setDeductible] = useState('50');
  const [pool, setPool] = useState('2500');
  const [startsAt, setStartsAt] = useState(localInput(now));
  const [endsAt, setEndsAt] = useState(localInput(later));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateCondition(index: number, value: string) {
    setConditions((current) => current.map((item, i) => (i === index ? value : item)));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!holder.trim()) throw new Error('Enter the holder address');
      if (conditions.some((item) => !item.trim())) throw new Error('Every condition needs text');
      await createPolicy({
        holder,
        coverage,
        wording,
        conditions,
        limitWei: parseGen(limit),
        deductibleWei: parseGen(deductible),
        startsAt: toUnix(startsAt),
        endsAt: toUnix(endsAt),
        poolWei: parseGen(pool),
      });
      onDone();
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Write a policy"
      subtitle="The insurer signs this. The wording and conditions are fixed before any claim exists."
      onClose={onClose}
    >
      <div className="drawer-body">
        <div className="form-grid">
          <label className="field span-2">
            <span>Holder address</span>
            <input value={holder} onChange={(event) => setHolder(event.target.value)} placeholder="0x…" />
            {stateAddress() && (
              <button className="inline-link" type="button" onClick={() => setHolder(stateAddress() ?? '')}>
                Use my connected wallet ({shortAddress(stateAddress() ?? '')})
              </button>
            )}
          </label>

          <label className="field">
            <span>Coverage</span>
            <input value={coverage} onChange={(event) => setCoverage(event.target.value)} />
          </label>

          <label className="field">
            <span>Coverage limit (GEN)</span>
            <input value={limit} onChange={(event) => setLimit(event.target.value)} inputMode="decimal" />
          </label>

          <label className="field">
            <span>Deductible (GEN)</span>
            <input value={deductible} onChange={(event) => setDeductible(event.target.value)} inputMode="decimal" />
          </label>

          <label className="field">
            <span>Fund the pool now (GEN)</span>
            <input value={pool} onChange={(event) => setPool(event.target.value)} inputMode="decimal" />
          </label>

          <label className="field">
            <span>Covers from</span>
            <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          </label>

          <label className="field">
            <span>Covers until</span>
            <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
          </label>
        </div>

        <label className="field">
          <span>Policy wording</span>
          <textarea rows={5} value={wording} onChange={(event) => setWording(event.target.value)} />
        </label>

        <section className="form-section">
          <div className="form-section-head">
            <h3>Conditions ({conditions.length}/8)</h3>
            <button
              className="btn ghost small"
              type="button"
              disabled={conditions.length >= 8}
              onClick={() => setConditions((current) => [...current, ''])}
            >
              <Plus size={13} /> Add condition
            </button>
          </div>
          <p className="hint">Each condition is checked individually. The committee must report a pass or fail for every one.</p>
          <ul className="condition-inputs">
            {conditions.map((condition, index) => (
              <li key={index}>
                <span className="condition-index">{String(index + 1).padStart(2, '0')}</span>
                <input
                  value={condition}
                  onChange={(event) => updateCondition(index, event.target.value)}
                  placeholder="What must be true for this claim"
                />
                <button
                  className="icon-btn"
                  type="button"
                  aria-label="Remove condition"
                  disabled={conditions.length === 1}
                  onClick={() => setConditions((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {error && (
          <div className="notice error">
            <AlertCircle size={15} /> {error}
          </div>
        )}
      </div>

      <footer className="drawer-foot">
        <button className="btn primary" disabled={busy} onClick={() => void submit()}>
          {busy ? <Loader2 className="spin" size={15} /> : <ShieldCheck size={15} />}
          {busy ? 'Writing policy…' : 'Write policy on chain'}
        </button>
        <p className="foot-note">The GEN you send with this call becomes the claims pool.</p>
      </footer>
    </Modal>
  );
}

export function FileClaimModal({
  policies,
  onClose,
  onDone,
}: {
  policies: Policy[];
  onClose: () => void;
  onDone: () => void;
}) {
  const wallet = stateAddress();
  const mine = policies.filter((policy) => policy.status === 'ACTIVE');
  const [policyId, setPolicyId] = useState(mine[0]?.id ?? '');
  const [incidentAt, setIncidentAt] = useState(localInput(new Date()));
  const [claimed, setClaimed] = useState('250');
  const [uri, setUri] = useState('');
  const [digest, setDigest] = useState('');
  const [hashing, setHashing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = mine.find((policy) => policy.id === policyId);

  async function pickFile(file: File | null) {
    if (!file) return;
    setHashing(true);
    try {
      setDigest(await sha256Digest(await file.arrayBuffer()));
    } finally {
      setHashing(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!policyId) throw new Error('Choose a policy');
      if (!uri.trim()) throw new Error('Enter the document URL');
      if (!/^sha256:[0-9a-f]{64}$/i.test(digest.trim())) {
        throw new Error('Digest must be sha256: followed by 64 hex characters');
      }
      await fileClaim({
        policyId,
        incidentAt: toUnix(incidentAt),
        claimedWei: parseGen(claimed),
        evidenceUri: uri,
        evidenceDigest: digest,
      });
      onDone();
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="File a claim"
      subtitle="You commit a document and its SHA-256. The committee reads that document itself - there is no summary to reword."
      onClose={onClose}
    >
      <div className="drawer-body">
        {mine.length === 0 ? (
          <div className="notice warn">
            <AlertCircle size={15} /> No active policies are on chain yet. Write one first.
          </div>
        ) : (
          <>
            <label className="field">
              <span>Policy</span>
              <select value={policyId} onChange={(event) => setPolicyId(event.target.value)}>
                {mine.map((policy) => (
                  <option key={policy.id} value={policy.id}>
                    {policy.id} · {policy.coverage} · limit {formatGen(policy.limitWei)} GEN
                  </option>
                ))}
              </select>
            </label>

            {selected && (
              <div className="policy-summary">
                <div><span>Covered</span><strong>{formatDate(selected.startsAt)} — {formatDate(selected.endsAt)}</strong></div>
                <div><span>Deductible</span><strong>{formatGen(selected.deductibleWei)} GEN</strong></div>
                <div><span>Pool</span><strong>{formatGen(selected.poolWei)} GEN</strong></div>
                <div><span>Holder</span><strong>{shortAddress(selected.holder)}</strong></div>
                {wallet && selected.holder.toLowerCase() !== wallet.toLowerCase() && (
                  <p className="field-error">Your wallet is not the holder on this policy. The contract will refuse the filing.</p>
                )}
              </div>
            )}

            <div className="form-grid">
              <label className="field">
                <span>Incident date</span>
                <input type="datetime-local" value={incidentAt} onChange={(event) => setIncidentAt(event.target.value)} />
              </label>
              <label className="field">
                <span>Amount claimed (GEN)</span>
                <input value={claimed} onChange={(event) => setClaimed(event.target.value)} inputMode="decimal" />
              </label>
            </div>

            <label className="field">
              <span>Claim document URL</span>
              <input
                value={uri}
                onChange={(event) => setUri(event.target.value)}
                placeholder="https://example.com/claim-pack.txt"
              />
              <span className="field-hint">Must be public, HTTPS, and serve the file itself (max 64 KiB).</span>
            </label>

            <label className="field">
              <span>SHA-256 digest</span>
              <input value={digest} onChange={(event) => setDigest(event.target.value)} placeholder="sha256:…" />
            </label>

            <label className="file-pick">
              <input type="file" onChange={(event) => void pickFile(event.target.files?.[0] ?? null)} />
              <span>{hashing ? 'Hashing…' : 'Hash a file to fill the digest'}</span>
            </label>

            <p className="hint">
              The digest is the commitment. If the file at that URL ever changes, the committee refuses it
              instead of judging it.
            </p>
          </>
        )}

        {error && (
          <div className="notice error">
            <AlertCircle size={15} /> {error}
          </div>
        )}
      </div>

      <footer className="drawer-foot">
        <button className="btn primary" disabled={busy || mine.length === 0} onClick={() => void submit()}>
          {busy ? <Loader2 className="spin" size={15} /> : <FileText size={15} />}
          {busy ? 'Committing claim…' : 'File claim on chain'}
        </button>
      </footer>
    </Modal>
  );
}