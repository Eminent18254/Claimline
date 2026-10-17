# Claimline

![GenLayer](https://img.shields.io/badge/GenLayer-Intelligent%20Contract-5B4FE9)
![Studionet](https://img.shields.io/badge/Studionet-chain%2061999-1F8A70)
![React](https://img.shields.io/badge/React-19-087EA4?logo=react)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)

**Claims are paid when the evidence proves them.**

Claimline is claims adjudication for micro-insurance, built on **GenLayer Intelligent Contracts**. An insurer records a policy on chain before any claim exists: coverage, the full wording, the limit, the deductible, the covered period, and an explicit list of conditions. A holder files a claim by committing a document URL and the SHA-256 of the file it serves. A validator committee then fetches that document itself, proves it against the committed digest, and rules against the policy wording - returning a graded payout and a pass or fail for every condition.

The problem is not storing claims. It is deciding them. On a normal platform the party that pays is also the party that judges, in private, with no record and no appeal. Claimline replaces that with a committee that must agree, on chain, about evidence it downloaded and authenticated itself.

Claimline runs on **GenLayer Studionet (chain 61999)** with test funds only.

## Deployed contract

| | |
|---|---|
| **Contract address** | `0x7eC02176fe18FE2f2E5f5F5b0E731D8471416829` |
| **Explorer** | https://explorer-studio.genlayer.com/address/0x7eC02176fe18FE2f2E5f5F5b0E731D8471416829 |
| **Deploy transaction** | https://explorer-studio.genlayer.com/tx/0x65326c01d2a3904b3fc5fd95aea5d06bc7611d4eed4c07dde9a72dac87f0c22e |
| **Source** | `contracts/Claimline.py` |
| **Runtime** | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` |
| **Client SDK** | `genlayer-js` 1.x |
| **RPC** | `https://studio.genlayer.com/api` |

Read the live state yourself:

```bash
genlayer call 0x7eC02176fe18FE2f2E5f5F5b0E731D8471416829 get_state
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
        settle (insurer draws from the pool)
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
| `close_policy` | insurer | Stops new claims on a policy. |

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

## Deploy the contract

```bash
genlayer network set studionet
npm run deploy:contract
```

## Limitations

- **Testnet only.** Amounts are test GEN on Studionet.
- **Payouts are recorded, not pushed.** The contract holds and accounts for the pool, but this chain does not let a contract push GEN to an end-user EOA. Settlement draws the payout down on chain; a production deployment would add a payout rail.
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