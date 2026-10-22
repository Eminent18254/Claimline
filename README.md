# Claimline

![GenLayer](https://img.shields.io/badge/GenLayer-Intelligent%20Contract-5B4FE9)
![Studionet](https://img.shields.io/badge/Studionet-chain%2061999-1F8A70)
![React](https://img.shields.io/badge/React-19-087EA4?logo=react)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)

**Claims are paid when the evidence proves them.**

Claimline is claims adjudication for micro-insurance, built on **GenLayer Intelligent Contracts**. An insurer records a policy on chain before any claim exists: coverage, the full wording, the limit, the deductible, the covered period, and an explicit list of conditions. A holder files a claim by committing a document URL and the SHA-256 of the file it serves. A validator committee then fetches that document itself, proves it against the committed digest, and rules against the policy wording - returning a graded payout and a pass or fail for every condition.

The problem is not storing claims. It is deciding them. On a normal platform the party that pays is also the party that judges, in private, with no record and no appeal. Claimline replaces that with a committee that must agree, on chain, about evidence it downloaded and authenticated itself.

Claimline runs on **GenLayer Studionet (chain 61999)** with test funds only.

## Live audit

The current deployment includes native claimant payouts, safe closed-policy recovery, exact agreement on every condition, and finalized frontend writes. **17 live checks and 16 contract tests pass**, with a 0.25 GEN claimant increase and a 0.35 GEN insurer recovery while preserving 0.40 GEN of claim reserves. See [verification/README.md](verification/README.md) for receipts and balance proof. The earlier accounting-only deployment is documented in [AUDIT.md](AUDIT.md).

## Deployed contract

| | |
|---|---|
| **Contract address** | `0xc85B35932Bb3b5bAfc5d3C7770Fc2e4f0Bc71fd3` |
| **Explorer** | https://explorer-studio.genlayer.com/address/0xc85B35932Bb3b5bAfc5d3C7770Fc2e4f0Bc71fd3 |
| **Deploy transaction** | https://explorer-studio.genlayer.com/tx/0x89e6df076c148c02bce7d85fd630215e0a51853d4275504c3ed316a316a091e6 |
| **Source** | `contracts/Claimline.py` |
| **Runtime** | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` |
| **Client SDK** | `genlayer-js` 1.x |
| **RPC** | `https://studio.genlayer.com/api` |

Read the live state yourself:

```bash
genlayer call 0xc85B35932Bb3b5bAfc5d3C7770Fc2e4f0Bc71fd3 get_state
```

## Why this needs GenLayer

Whether a clause covers an incident, and how much of a claim the paperwork supports, is not a formula. It is a reading of language against facts. No deterministic chain can do that, and no single server can be trusted to do it alone.

Claimline puts the judgement inside the contract:

- The committee fetches the claim document itself. There is no free-text claim field to reword.
- The fetched bytes must hash to the digest committed on chain, or the claim is refused instead of judged.
- The committee returns a bounded outcome, a banded payout, and one pass/fail per published condition - and validators must agree on all of it.
- The payout is arithmetic on chain: `min(claimed, limit) x band / 100 - deductible`. The model picks the band; the contract decides the money.

## The claim lifecycle

```
        create_policy (insurer, funds the pool)
                     |
        file_claim (holder commits URL + digest)
                     |
                  FILED
                     |
              adjudicate (committee)
                     |
   APPROVED | PARTIALLY_APPROVED | DECLINED | MORE_EVIDENCE_REQUIRED
                     |
        settle (GEN transfers to claimant on finalization)
                     |
                  SETTLED
```

A declined claim can be appealed **once**, and the appeal must carry a different document with a different digest. Every evidence revision is judged at most once, re-committing the current revision is refused, and an approved or settled claim is final.

## Contract surface

### Writes

| Function | Who | What it does |
|---|---|---|
| `create_policy` | insurer | Records coverage, wording, conditions, limit, deductible and period. GEN sent with the call becomes the claims pool. |
| `fund_policy` | anyone | Adds GEN to the pool. |
| `file_claim` | holder | Commits the incident date, amount claimed, document URL and SHA-256 digest. |
| `adjudicate` | holder or insurer | Fetches and authenticates the document, then runs the committee. |
| `replace_evidence` | holder | Commits a new revision. Used for a fresh review or a single appeal. |
| `settle` | insurer | Pays an approved claim from the pool. |
| `close_policy` | insurer | Closes reporting after the covered period and seven-day reporting window. Existing claims remain adjudicable and payable. |
| `withdraw_unused` | insurer | Transfers closed-policy surplus to the insurer on finalization; unresolved claims and remaining appeals keep reserves. |

### Views

| Function | Returns |
|---|---|
| `get_state` | Every policy and claim, plus the policy version |
| `get_policy` / `get_policies` | One policy, or all policies |
| `get_claim` / `get_claims` | One claim, or all claims |
| `get_claims_for_policy` | Claims attached to a policy |
| `get_claims_by` | Claims filed by a holder |

## What the committee records

Each decision stores:

- `outcome` - the bounded decision
- `payoutBand` - 0, 25, 50, 75 or 100
- `confidenceBand` - HIGH, MEDIUM or LOW
- `reason` - the committee's written reasoning
- `conditions` - one entry per policy condition, with `passed` and a reason
- `inconsistencies` - the specific gaps or contradictions it found
- `contentDigest` - the digest of the bytes it actually judged
- `evaluatedRevision` - the revision that decision belongs to

`decisionIsCurrent` is derived from `evaluatedRevision == evidenceRevision`, so a decision automatically reads as stale when the evidence changes.

## Frontend

The app reads and writes the contract directly from the browser through `genlayer-js`. There is no backend and no database: the chain is the source of truth, and the UI shows every verdict, band and condition finding read from `get_state`.

The white landing page, with green accents and natural-color photography, lives at `/`. Visitors can connect a wallet to enter,
or choose **Open claims desk** to browse `/app` without one. Creating policies, filing claims, and other
write operations require a connected wallet; policyholder and insurer permissions still apply.
The landing page includes coverage examples, the review process, evidence verification, role guides,
and FAQs with locally hosted photography.

The complete user guide is available at `/docs`, linked from every page footer. It covers setup,
permissions, policy fields, text evidence preparation, decisions, appeals, payout arithmetic, the
contract interface, and troubleshooting. A shared Claimline wordmark and validation monogram appear
throughout the app, with SVG, PNG, ICO, and Apple touch icon assets in `frontend/public/`.

- Connect an injected wallet (MetaMask) on Studionet.
- Write a policy as an insurer, or file a claim as the holder.
- Hash a file in the browser to fill the digest field.
- Open any claim to see the committee's per-condition findings, the flagged inconsistencies, and the evidence digest that was judged.

### Run locally

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

### Build

```bash
npm run build
```

### Frontend verification

The claims desk supports policy and claim search, claim status filters, a consistent light appearance,
and keyboard-accessible detail dialogs. Opening a claim from a policy keeps that policy selected.
If Studionet cannot be reached within 20 seconds, the interface offers a retry and retains any
previously loaded records.

With the Vite development server running, run the browser checks in a second terminal:

```bash
cd frontend
npx playwright install chromium
npm run test:ui
```

The checks inject isolated fixtures in the browser; they do not submit live transactions. They cover
landing/app navigation, guest browsing, wallet gates, search, filters, file hashing, policy selection, decision refresh, keyboard focus, responsive
layouts, and connection recovery. Screenshots are written to `frontend/artifacts/ui/` (gitignored).
Set `CLAIMLINE_URL` for another local server URL or `CLAIMLINE_BROWSER` to use an existing Chromium executable.

## Deploy the contract

```bash
npm run deploy:contract
```

This script waits for FINALIZED, fetches the deployed code, verifies a byte-for-byte
source match, and updates `frontend/src/config/deployment.json`, `.env`, and
`.env.example` automatically. Existing local frontend environment files are also
synced. The frontend reads the tracked manifest, so an old contract address in
Vercel environment variables cannot override the verified deployment. Commit and
push the updated manifest with the source; the next Vercel build uses that address
without changing dashboard variables. Local `.env` files are not uploaded to Vercel.

Use `npm run sync:deployment` to repeat synchronization from an already verified
`verification/deployment.json`, without deploying another contract.

Run `npm run test:contract` for the deterministic adverse-case suite. With Vite
running, `npm run verify:studio` submits real StudioNet and browser transactions
using test GEN and writes receipts and recipient balance snapshots to `verification/`.

## Limitations

- **Testnet only.** Amounts are test GEN on Studionet.
- Existing claims with unresolved evidence or an unused appeal keep their maximum payout reserved. Closing a policy cannot cancel those rights; that collateral becomes recoverable only after the liability resolves.
- Committee rounds take one to two minutes because they are real consensus rounds, not mocked calls.

## Repository layout

```
contracts/Claimline.py      the intelligent contract
frontend/                   React + Vite app
frontend/src/App.tsx        shell, board and cards
frontend/src/components/    drawers and write flows
frontend/src/lib/           domain types, formatting, GenLayer client
scripts/                    deploy and demo helpers
```
