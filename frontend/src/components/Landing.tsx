import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Check,
  Eye,
  FileCheck2,
  Plus,
  UserRound,
  Building2,
  Scale,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { connect, readError } from '@/lib/genlayer/client';
import { useSession } from '@/lib/session';
import { contractLink } from '@/config/genlayer';
import { Brand } from './Brand';
import { Footer } from './Footer';

const STEPS = [
  [
    'Set the terms',
    'An insurer records the coverage, conditions, limit, and deductible before a claim exists.',
  ],
  [
    'Submit the evidence',
    'The policyholder files the original document, the incident date, and the amount claimed.',
  ],
  [
    'Get an independent review',
    'A GenLayer committee checks the document and reviews each policy condition.',
  ],
  [
    'Read the outcome',
    'The decision, its reasoning, and any settlement are recorded in the public ledger.',
  ],
];
const FAQS = [
  [
    'Do I need a wallet to use Claimline?',
    'You can explore policies, claims, and decisions without a wallet. Connect a compatible browser wallet when you want to create a policy, file a claim, or request a review.',
  ],
  [
    'Who decides a claim?',
    'A GenLayer validator committee reviews the evidence against the policy wording and conditions. The contract records the outcome, the reasons, and the finding for each condition.',
  ],
  [
    'What do I submit as evidence?',
    'A public HTTPS URL serving the original document and its SHA-256 fingerprint. You can calculate the fingerprint by selecting the file in the app. The committee checks that it receives the same document. Never put private personal information in a public evidence file.',
  ],
  [
    'Can I appeal a declined claim?',
    'A policyholder can appeal a declined claim once, with a different document and a new fingerprint. An evidence revision can only be judged once. Approved and settled claims are final.',
  ],
  [
    'Does this use real insurance funds?',
    'Claimline runs on GenLayer Studionet with test GEN. Settlement transfers native GEN to the claimant wallet on finalization. Insurers can recover closed-policy surplus while existing claims and appeals keep their collateral reserved.',
  ],
];

export function Landing({ onEnter }: { onEnter: () => void }) {
  const { wallet } = useSession();
  const [error, setError] = useState<string | null>(null);
  async function connectAndEnter() {
    setError(null);
    try {
      await connect();
      onEnter();
    } catch (cause) {
      setError(readError(cause));
    }
  }
  const enter = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onEnter();
  };
  return (
    <div className="shell landing-shell" id="top">
      <a className="skip-link" href="#introduction">
        Skip to introduction
      </a>
      <header className="site-header">
        <Brand />
        <nav className="site-nav" aria-label="Main navigation">
          <a className="nav-link" href="#coverage">
            Coverage
          </a>
          <a className="nav-link" href="#how-it-works">
            How it works
          </a>
          <a className="nav-link" href="/docs">
            Documentation
          </a>
        </nav>
        <div className="header-actions">
          <span className="net-pill">
            Studionet <span>Testnet</span>
          </span>
          <a className="btn primary" href="/app" onClick={enter}>
            Open claims desk <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      <main id="introduction">
        <section className="hero landing-hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Independent claims adjudication</p>
            <h1 id="hero-title">
              Every claim.
              <br />
              <span>Clearly decided.</span>
            </h1>
            <p className="lede">
              Your policy sets the terms. An independent committee reviews the evidence. Every
              decision comes with a reason.
            </p>
            <div className="hero-actions">
              {wallet.address ? (
                <a className="btn primary" href="/app" onClick={enter}>
                  Open claims desk <ArrowRight size={16} />
                </a>
              ) : (
                <button
                  className="btn primary"
                  onClick={() => void connectAndEnter()}
                  disabled={wallet.isConnecting}
                >
                  <Wallet size={16} />
                  {wallet.isConnecting ? 'Connecting…' : 'Connect wallet'}
                  <ArrowRight size={16} />
                </button>
              )}
              <a className="btn ghost" href="/app" onClick={enter}>
                <Eye size={16} />
                Open claims desk
              </a>
            </div>
            <p className="entry-note">
              Browse freely. Connect your wallet when you’re ready to act.
            </p>
            {error && (
              <div className="notice error landing-error" role="alert">
                <AlertCircle size={16} />
                <span>{error} You can still explore the app without a wallet.</span>
              </div>
            )}
          </div>
          <div className="hero-media">
            <img
              className="hero-life"
              src="/images/everyday.jpg"
              alt="Family and friends together at the seaside"
              width="1200"
              height="800"
              fetchPriority="high"
            />
            <img
              className="hero-travel"
              src="/images/travel.jpg"
              alt="A plane wing above the clouds"
              width="1100"
              height="733"
            />
          </div>
        </section>
        <div className="landing-assurances" aria-label="Claimline principles">
          <span>
            <ShieldCheck size={17} />
            Terms fixed before a claim
          </span>
          <span>
            <FileCheck2 size={17} />
            Original evidence verified
          </span>
          <span>
            <Scale size={17} />
            Decisions recorded publicly
          </span>
        </div>
        <section
          className="coverage-section landing-section"
          id="coverage"
          aria-labelledby="coverage-title"
        >
          <div className="section-heading">
            <h2 id="coverage-title">
              For the plans.
              <br />
              <span>And the unexpected.</span>
            </h2>
            <p>
              Examples of what a policy can cover. Actual coverage is always defined by its
              published terms.
            </p>
          </div>
          <div className="coverage-stories">
            <article>
              <img
                src="/images/travel.jpg"
                alt="Airplane wing in the clouds at sunset"
                width="1100"
                height="733"
                loading="lazy"
              />
              <div className="story-copy">
                <span>Travel disruption</span>
                <h3>When the journey changes.</h3>
                <p>
                  Booking confirmations, supplier notices, and receipts give a committee the
                  evidence to review a disrupted trip.
                </p>
                <a className="text-link" href="/app" onClick={enter}>
                  Explore policies <ArrowUpRight size={15} />
                </a>
              </div>
            </article>
            <article>
              <img
                src="/images/equipment.jpg"
                alt="Camera and lenses laid out on a dark surface"
                width="900"
                height="1125"
                loading="lazy"
              />
              <div className="story-copy">
                <span>Equipment protection</span>
                <h3>For the tools you count on.</h3>
                <p>
                  Proof of ownership, damage reports, and repair invoices can support a claim
                  against an equipment policy.
                </p>
                <a className="text-link" href="/app" onClick={enter}>
                  Explore policies <ArrowUpRight size={15} />
                </a>
              </div>
            </article>
          </div>
        </section>

        <section
          className="process-section landing-section"
          id="how-it-works"
          aria-labelledby="process-title"
        >
          <div className="section-heading">
            <h2 id="process-title">
              From policy to decision.
              <br />
              <span>Clear at every step.</span>
            </h2>
            <p>One shared process, with the terms and evidence available to inspect.</p>
          </div>
          <ol className="process-steps">
            {STEPS.map(([title, description], index) => (
              <li key={title}>
                <span className="process-number">0{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="principle" id="evidence" aria-labelledby="principle-title">
          <img
            className="evidence-photo"
            src="/images/evidence.jpg"
            alt="A person reviewing and signing paperwork at a desk"
            width="1100"
            height="734"
            loading="lazy"
          />
          <div>
            <span className="principle-icon">
              <Scale size={22} strokeWidth={1.5} />
            </span>
            <h2 id="principle-title">
              The evidence stays
              <br />
              at the centre.
            </h2>
            <p>
              GenLayer’s validator committee reads your evidence against the policy. The reasoning
              and every condition finding stay on the public ledger.
            </p>
            <a className="text-link" href={contractLink()} target="_blank" rel="noreferrer">
              Explore the contract <ArrowUpRight size={15} />
            </a>
          </div>
          <ul className="guarantees">
            <li>
              <strong>The original evidence</strong>
              <p>
                The committee fetches the document and verifies it against the fingerprint you
                submitted.
              </p>
            </li>
            <li>
              <strong>A reason for every finding</strong>
              <p>See which conditions passed, which failed, and what the committee found.</p>
            </li>
            <li>
              <strong>A payout set by the policy</strong>
              <p>The contract applies the payout band, coverage limit, and deductible.</p>
            </li>
          </ul>
        </section>
        <section className="roles-section landing-section" aria-labelledby="roles-title">
          <div className="section-heading">
            <h2 id="roles-title">
              A shared record.
              <br />
              <span>A clear role for everyone.</span>
            </h2>
          </div>
          <div className="role-grid">
            <article>
              <UserRound size={26} strokeWidth={1.4} />
              <h3>For policyholders</h3>
              <p>
                Know your coverage before you need it. Submit the original evidence and follow the
                reasoning behind your claim.
              </p>
              <ul>
                <li>
                  <Check size={14} />
                  Read the policy and its conditions
                </li>
                <li>
                  <Check size={14} />
                  File evidence and request a review
                </li>
                <li>
                  <Check size={14} />
                  Appeal once with new evidence
                </li>
              </ul>
            </article>
            <article>
              <Building2 size={26} strokeWidth={1.4} />
              <h3>For insurers</h3>
              <p>
                Set clear terms in advance. Fund a policy pool and work from the same recorded
                evidence and decisions as the holder.
              </p>
              <ul>
                <li>
                  <Check size={14} />
                  Publish coverage and conditions
                </li>
                <li>
                  <Check size={14} />
                  Request independent adjudication
                </li>
                <li>
                  <Check size={14} />
                  Settle approved claims from the pool
                </li>
              </ul>
            </article>
          </div>
        </section>

        <section className="faq-section landing-section" id="questions" aria-labelledby="faq-title">
          <div className="section-heading">
            <h2 id="faq-title">
              A few things
              <br />
              <span>worth knowing.</span>
            </h2>
            <p>Before you make your first move.</p>
          </div>
          <div className="faq-list">
            {FAQS.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <Plus size={18} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="entry-section" aria-labelledby="entry-title">
          <div>
            <h2 id="entry-title">See the terms. Follow the decision.</h2>
            <p>Look through the policies. Follow a claim. Read a decision.</p>
          </div>
          <a className="btn primary" href="/app" onClick={enter}>
            Open claims desk <ArrowRight size={16} />
          </a>
        </section>
      </main>
      <Footer />
    </div>
  );
}
