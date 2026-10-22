import { useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Search } from 'lucide-react';
import { GENLAYER, contractLink } from '@/config/genlayer';
import { Brand } from './Brand';
import { Footer } from './Footer';

const CONTENTS = [
  ['overview', 'Overview'],
  ['getting-started', 'Getting started'],
  ['wallet', 'Wallet & network'],
  ['roles', 'Roles & permissions'],
  ['policies', 'Creating a policy'],
  ['evidence', 'Preparing evidence'],
  ['filing', 'Filing a claim'],
  ['decisions', 'Understanding decisions'],
  ['appeals', 'Revisions & appeals'],
  ['settlement', 'Payouts & settlement'],
  ['contract', 'Contract reference'],
  ['troubleshooting', 'Troubleshooting'],
];

export function Documentation({ onEnter, onHome }: { onEnter: () => void; onHome: () => void }) {
  const [query, setQuery] = useState('');
  const enter = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onEnter();
  };
  return (
    <div className="shell docs-shell">
      <a className="skip-link" href="#docs-content">
        Skip to documentation
      </a>
      <header className="site-header">
        <Brand onHome={onHome} />
        <nav className="site-nav" aria-label="Main navigation">
          <a className="nav-link" href="/">
            Overview
          </a>
          <a className="nav-link is-active" href="/docs" aria-current="page">
            Documentation
          </a>
          <a className="nav-link" href={contractLink()} target="_blank" rel="noreferrer">
            Contract <ArrowUpRight size={13} />
          </a>
        </nav>
        <div className="header-actions">
          <a className="btn primary" href="/app" onClick={enter}>
            Open claims desk <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      <div className="docs-layout">
        <aside className="docs-sidebar">
          <span className="docs-nav-title">
            <BookOpen size={16} />
            Documentation
          </span>
          <label className="search">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a topic…"
              aria-label="Find a documentation topic"
            />
          </label>
          <nav aria-label="Documentation contents">
            {CONTENTS.filter(([, label]) => label.toLowerCase().includes(query.toLowerCase())).map(
              ([id, label]) => (
                <a key={id} href={`#${id}`}>
                  {label}
                </a>
              ),
            )}
          </nav>
          {CONTENTS.every(([, label]) => !label.toLowerCase().includes(query.toLowerCase())) && (
            <p className="docs-no-results">No topic found. Try “evidence” or “wallet”.</p>
          )}
          <a className="docs-back" href="/app" onClick={enter}>
            Open the claims desk <ArrowRight size={13} />
          </a>
        </aside>
        <main id="docs-content" className="docs-article">
          <header className="docs-intro">
            <p className="eyebrow">The Claimline guide</p>
            <h1>Your guide to Claimline.</h1>
            <p>
              Everything you need to explore the ledger, create a policy, and understand how a claim
              becomes a decision.
            </p>
            <div className="docs-note">
              Current deployment: GenLayer Studionet. All amounts are test GEN. Settlement sends
              native GEN to the recorded claimant wallet when the transaction finalizes.
            </div>
          </header>

          <section id="overview">
            <h2>Overview</h2>
            <p>
              Claimline is a claims adjudication application for micro-insurance. An insurer
              publishes the terms of a policy before a claim exists. The policyholder submits a
              document as evidence. An independent GenLayer validator committee then reviews that
              evidence against the recorded policy.
            </p>
            <p>
              The result is a public record: the outcome, the committee’s reasoning, a finding for
              every policy condition, and the amount that the policy’s payout rules produce. The
              browser reads and writes the contract directly. There is no separate application
              database holding a different version of your claim.
            </p>
            <p>
              The landing page lives at <code>/</code>. The working ledger lives at{' '}
              <code>/app</code>. Anyone can browse policies and claims without connecting a wallet.
            </p>
          </section>

          <section id="getting-started">
            <h2>Getting started</h2>
            <ol>
              <li>
                <strong>Explore first.</strong> Choose <em>Open claims desk</em> on
                the landing page. You can search policies, switch to the claims tab, filter
                outcomes, and open the details of any record.
              </li>
              <li>
                <strong>Connect when you want to act.</strong> Choose <em>Connect wallet</em>. A
                write action also opens a connection prompt if you are browsing as a guest.
                Cancelling it returns you to browsing.
              </li>
              <li>
                <strong>Choose your role.</strong> Use an insurer wallet to write a policy for
                another address, or the recorded holder wallet to file a claim on an existing
                policy.
              </li>
              <li>
                <strong>Confirm and wait.</strong> Approve the requested transaction in your wallet.
                The app waits for a finalized successful receipt before showing success. Committee reviews can
                take one to two minutes or longer.
              </li>
            </ol>
            <p>
              Connecting from the landing page takes you into the claims desk. Disconnecting inside
              the claims desk leaves you there with read access.
            </p>
          </section>

          <section id="wallet">
            <h2>Wallet &amp; network</h2>
            <p>
              Use an injected EIP-1193 browser wallet such as MetaMask. Claimline requests an
              account through the wallet extension; it does not ask you to enter a private key or
              recovery phrase.
            </p>
            <div className="docs-table-wrap">
              <table>
                <tbody>
                  <tr>
                    <th scope="row">Network</th>
                    <td>GenLayer Studionet</td>
                  </tr>
                  <tr>
                    <th scope="row">Chain ID</th>
                    <td>{GENLAYER.chainId}</td>
                  </tr>
                  <tr>
                    <th scope="row">Currency</th>
                    <td>Test GEN</td>
                  </tr>
                  <tr>
                    <th scope="row">RPC</th>
                    <td>
                      <code>{GENLAYER.rpcUrl}</code>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Explorer</th>
                    <td>
                      <a href={GENLAYER.explorerUrl} target="_blank" rel="noreferrer">
                        GenLayer Studio Explorer <ArrowUpRight size={12} />
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              If your wallet is on another network, the app shows a notice. Your next write requests
              a switch to Studionet; if the network is missing, it requests that your wallet add it.
              Review those details before approving.
            </p>
            <p>
              A connected address is not permission to change every record. The contract checks the
              role of the signing address for every write.
            </p>
          </section>

          <section id="roles">
            <h2>Roles &amp; permissions</h2>
            <div className="docs-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Who can do it</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Read policies, claims, and decisions</td>
                    <td>Anyone, including visitors without a wallet</td>
                  </tr>
                  <tr>
                    <td>Create a policy</td>
                    <td>A connected insurer, naming a different holder</td>
                  </tr>
                  <tr>
                    <td>File a claim</td>
                    <td>The holder recorded on an active policy</td>
                  </tr>
                  <tr>
                    <td>Request adjudication</td>
                    <td>The claim’s holder or the policy’s insurer</td>
                  </tr>
                  <tr>
                    <td>Replace evidence or appeal</td>
                    <td>The claim’s holder, within revision and appeal limits</td>
                  </tr>
                  <tr>
                    <td>Settle an approved claim</td>
                    <td>The policy’s insurer</td>
                  </tr>
                  <tr>
                    <td>Add funds to a policy pool</td>
                    <td>Anyone, through the contract’s funding method</td>
                  </tr>
                  <tr>
                    <td>Close a policy</td>
                    <td>The insurer, through the contract’s close method</td>
                  </tr>
                  <tr><td>Recover unused GEN</td><td>The insurer, after closure, while preserving every claim and appeal reserve</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              Pool funding after creation and policy closure are available in the contract
              interface; dedicated controls for those actions are not included in this version of
              the claims desk.
            </p>
          </section>

          <section id="policies">
            <h2>Creating a policy</h2>
            <p>
              Connect the insurer wallet and select <em>Write a policy</em>. The signing wallet
              becomes the insurer. The holder must be a valid, nonzero address different from the
              insurer.
            </p>
            <dl className="docs-definitions">
              <div>
                <dt>Coverage</dt>
                <dd>A short name, up to 80 characters, such as “Travel disruption”.</dd>
              </div>
              <div>
                <dt>Policy wording</dt>
                <dd>The full terms the committee should apply, between 1 and 4,000 characters.</dd>
              </div>
              <div>
                <dt>Conditions</dt>
                <dd>
                  One to eight explicit conditions, each at most 240 characters. The committee must
                  report a finding for each one.
                </dd>
              </div>
              <div>
                <dt>Coverage limit</dt>
                <dd>A positive amount in GEN. It caps the base used to calculate a payout.</dd>
              </div>
              <div>
                <dt>Deductible</dt>
                <dd>
                  A nonnegative amount smaller than the coverage limit, deducted after the payout
                  band is applied.
                </dd>
              </div>
              <div>
                <dt>Covered period</dt>
                <dd>
                  A start and end date, with the end later than the start. Incident dates must fall
                  within this period.
                </dd>
              </div>
              <div>
                <dt>Initial pool</dt>
                <dd>The test GEN sent with policy creation becomes the policy’s available pool.</dd>
              </div>
            </dl>
            <p>
              Write specific conditions that can be checked against a document. For example: “The
              booking confirmation names the policyholder” is easier to evaluate than “The claim is
              reasonable”. Review the wording carefully before signing; this contract does not
              provide an edit method for policy terms.
            </p>
          </section>

          <section id="evidence">
            <h2>Preparing evidence</h2>
            <p>
              The committee fetches the original file from the URL you record. The file must be
              publicly reachable over HTTPS, return HTTP 200, and contain at least one byte. The
              maximum file size is 65,536 bytes (64 KiB), and the URL must be no longer than 500
              characters.
            </p>
            <p>
              <strong>Use a UTF-8 text evidence pack.</strong> The current contract decodes the
              downloaded bytes as text and supplies at most the first 20,000 characters to the
              committee. It does not extract text from a PDF, scan, or photograph. Put the relevant
              facts and supporting records into a concise text file.
            </p>
            <ol>
              <li>
                Prepare the evidence file and host it at a stable public HTTPS URL that serves the
                file itself, not a login screen or preview page.
              </li>
              <li>
                In the claim form, choose <em>Hash a file to fill the digest</em> and select that
                exact file. Hashing happens in your browser. Selecting a file does not upload or
                host it.
              </li>
              <li>
                Enter the public URL. Check that the downloaded file is byte-for-byte identical to
                the file you hashed.
              </li>
              <li>
                Keep the hosted file unchanged while the revision is under review. Even a newline
                change alters its fingerprint.
              </li>
            </ol>
            <p>
              The digest has the form <code>sha256:</code> followed by 64 hexadecimal characters. A
              digest mismatch stops the review rather than judging a different document.
            </p>
            <div className="docs-note">
              Evidence URLs and claim records are public. Use test or appropriately redacted
              information. Do not publish identity documents, financial account details, or other
              private personal information in a public evidence file.
            </div>
          </section>

          <section id="filing">
            <h2>Filing a claim</h2>
            <ol>
              <li>
                Open an active policy and review its wording, dates, limit, deductible, and holder
                address.
              </li>
              <li>
                Select <em>File a claim</em>. When opened from a policy, the form keeps that policy
                selected. Connect the recorded holder’s wallet if prompted.
              </li>
              <li>
                Enter the incident date, a positive claimed amount in GEN, the document URL, and the
                digest of the exact evidence file.
              </li>
              <li>
                Submit and approve the wallet request. After confirmation, the new claim appears
                with a <strong>Filed</strong> status.
              </li>
              <li>
                Open that claim and select <em>Ask the committee</em>. Filing and adjudication are
                separate transactions.
              </li>
            </ol>
            <p>
              The contract rejects claims from another address, incidents outside the covered
              period, and claims on closed policies. The current deployment allows at most 20 claims
              per policy.
            </p>
          </section>

          <section id="decisions">
            <h2>Understanding decisions</h2>
            <p>
              The committee verifies the file, reads it against the policy, and records a bounded
              outcome. The claim drawer shows the written reasoning, condition findings,
              inconsistencies, confidence band, evidence revision, and calculated payout.
            </p>
            <div className="docs-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Meaning</th>
                    <th>Next step</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Filed</td>
                    <td>Evidence is recorded and ready for review.</td>
                    <td>Holder or insurer requests adjudication.</td>
                  </tr>
                  <tr>
                    <td>Approved</td>
                    <td>A 100% payout band was returned.</td>
                    <td>The insurer may settle if the pool covers a positive payout.</td>
                  </tr>
                  <tr>
                    <td>Partially approved</td>
                    <td>A 25%, 50%, or 75% payout band was returned.</td>
                    <td>Read the findings and calculated payout.</td>
                  </tr>
                  <tr>
                    <td>More evidence needed</td>
                    <td>No payout; the document did not support a final approval.</td>
                    <td>The holder can supply a new revision within the limit.</td>
                  </tr>
                  <tr>
                    <td>Declined</td>
                    <td>A zero payout band was returned.</td>
                    <td>The holder may appeal once with new evidence.</td>
                  </tr>
                  <tr>
                    <td>Settled</td>
                    <td>The approved GEN was sent from the policy pool to the claimant wallet.</td>
                    <td>The claim is final.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Confidence is reported as HIGH, MEDIUM, or LOW. It describes the committee’s decision;
              it does not change the payout formula. A verdict is current only when its evaluated
              revision matches the claim’s current evidence revision.
            </p>
          </section>

          <section id="appeals">
            <h2>Revisions &amp; appeals</h2>
            <p>
              A claim can have at most three evidence revisions, including its original filing. The
              holder can replace evidence while the claim is eligible; an approved, partially
              approved, or settled claim cannot be reopened by replacing its document.
            </p>
            <p>
              A replacement records a new URL and digest, increments the evidence revision, resets
              the claim to Filed, and clears the payable amount until another review. The old
              findings remain visible with a stale-verdict notice. Request adjudication again to
              review the new revision.
            </p>
            <p>
              A declined claim has one appeal. Submitting replacement evidence after a decline
              consumes it. Recommitting the same URL and digest is refused, and a judged revision
              cannot simply be rerun. Review the committee’s reasons and supply evidence that
              addresses the missing or contradictory facts.
            </p>
          </section>

          <section id="settlement">
            <h2>Payouts &amp; settlement</h2>
            <p>
              The model chooses a supported payout band. The contract performs the money calculation
              using the policy’s terms:
            </p>
            <pre>
              <code>
                base = min(amount claimed, coverage limit){'\n'}gross = floor(base × payout band /
                100){'\n'}payout = max(0, gross − deductible)
              </code>
            </pre>
            <p>
              For example, a 250 GEN claim under a 1,000 GEN limit, with a 75% band and a 50 GEN
              deductible, produces <strong>137.50 GEN</strong>. A 100% band means the full eligible
              base before the deductible, not necessarily the entire amount requested.
            </p>
            <p>
              Only the insurer can settle. The decision must be approved or partially approved,
              current for the latest evidence, and produce a positive payout. The pool must contain
              enough GEN. Settlement decreases the available pool, increases the policy’s settled
              total, and marks the claim Settled.
            </p>
            <div className="docs-note">
              Settlement emits a native GEN transfer to the recorded claimant on finalization.
              The insurer may close a policy after its covered period and seven-day reporting
              window end, then recover surplus GEN using withdraw_unused. Unresolved claims
              and available appeals keep their maximum possible payout reserved.
            </div>
          </section>

          <section id="contract">
            <h2>Contract reference</h2>
            <p>
              Contract address:{' '}
              <a className="docs-address" href={contractLink()} target="_blank" rel="noreferrer">
                {GENLAYER.contract} <ArrowUpRight size={12} />
              </a>
            </p>
            <p>
              The frontend uses <code>genlayer-js</code> 1.x. Amounts in the contract are integer
              wei; 1 GEN is 10¹⁸ wei. The form accepts GEN and converts it before a write. Dates are
              stored as Unix timestamps.
            </p>
            <div className="docs-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <code>create_policy</code>
                    </td>
                    <td>
                      Record holder, terms, conditions, limit, deductible, and period. Attached GEN
                      funds the pool.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <code>fund_policy</code>
                    </td>
                    <td>Add attached GEN to a policy pool.</td>
                  </tr>
                  <tr>
                    <td>
                      <code>file_claim</code>
                    </td>
                    <td>
                      Record the policy, incident date, claimed amount, evidence URL, and digest.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <code>adjudicate</code>
                    </td>
                    <td>Verify and review the current evidence revision.</td>
                  </tr>
                  <tr>
                    <td>
                      <code>replace_evidence</code>
                    </td>
                    <td>Commit the next evidence revision.</td>
                  </tr>
                  <tr>
                    <td>
                      <code>settle</code>
                    </td>
                    <td>Transfer the approved native GEN to the recorded claimant on finalization.</td>
                  </tr>
                  <tr>
                    <td>
                      <code>close_policy</code>
                    </td>
                    <td>Close after the covered period and seven-day reporting window.</td>
                  </tr>
                  <tr><td><code>withdraw_unused</code></td><td>Transfer closed-policy surplus to the insurer while preserving claim and appeal reserves.</td></tr>
                  <tr>
                    <td>
                      <code>get_state</code>
                    </td>
                    <td>Read all policies, claims, counts, and the policy version.</td>
                  </tr>
                  <tr>
                    <td>
                      <code>get_policy</code> / <code>get_claim</code>
                    </td>
                    <td>Read one record by ID.</td>
                  </tr>
                  <tr>
                    <td>
                      <code>get_policies</code> / <code>get_claims</code>
                    </td>
                    <td>Read all records of a type.</td>
                  </tr>
                  <tr>
                    <td>
                      <code>get_claims_for_policy</code> / <code>get_claims_by</code>
                    </td>
                    <td>Read claims associated with a policy or holder.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              The current contract caps storage at 100 policies and 500 claims. These are deployment
              limits, not guarantees of available capacity.
            </p>
            <h3>Running the frontend locally</h3>
            <pre>
              <code>
                npm --prefix frontend install{'\n'}npm run dev{'\n'}
                {'\n'}# Production build{'\n'}npm run build
              </code>
            </pre>
            <p>
              The Vite app serves the landing page at <code>/</code>, the claims desk at{' '}
              <code>/app</code>, and this guide at <code>/docs</code>. Hosts must send those routes
              to <code>index.html</code>; the repository’s Vercel configuration already includes
              that rewrite.
            </p>
          </section>

          <section id="troubleshooting">
            <h2>Troubleshooting</h2>
            <dl className="docs-definitions">
              <div>
                <dt>The ledger could not be reached</dt>
                <dd>
                  Check your connection and select Try again. Reads time out after 20 seconds. If a
                  refresh fails after records have loaded, the app keeps them visible and labels
                  them as the last loaded records.
                </dd>
              </div>
              <div>
                <dt>No browser wallet found</dt>
                <dd>
                  Install and unlock a compatible browser extension, then retry. You can keep
                  browsing without it.
                </dd>
              </div>
              <div>
                <dt>The wallet is connected, but an action is disabled</dt>
                <dd>
                  Compare the account with the recorded holder or insurer. Also check the claim
                  status and revision limits. Connecting does not override contract permissions.
                </dd>
              </div>
              <div>
                <dt>The insurer cannot be the holder</dt>
                <dd>
                  Create the policy from one address and name a different holder. Use the holder’s
                  wallet later when filing the claim.
                </dd>
              </div>
              <div>
                <dt>Document digest mismatch</dt>
                <dd>
                  Download the hosted file and hash those exact bytes again. Check for preview
                  pages, changed line endings, or edits after filing. Submit a new revision if
                  eligible.
                </dd>
              </div>
              <div>
                <dt>The pool does not cover the payout</dt>
                <dd>
                  The insurer cannot settle until the pool covers the calculated amount. Funds can
                  be added through the contract’s funding method.
                </dd>
              </div>
              <div>
                <dt>A transaction appears to be taking a long time</dt>
                <dd>
                  Committee rounds take time. Inspect the transaction in the explorer and refresh
                  the latest state before sending the same action again. Closing the page does not
                  cancel a transaction already submitted to the network.
                </dd>
              </div>
            </dl>
            <a className="btn primary" href="/app" onClick={enter}>
              Open claims desk <ArrowRight size={15} />
            </a>
          </section>
        </main>
      </div>
      <Footer />
    </div>
  );
}
