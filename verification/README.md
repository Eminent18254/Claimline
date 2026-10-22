# Steward remediation verification

Verified 2026-10-22T15:39:37.504Z on StudioNet, chain 61999.

Contract: [0xc85B35932Bb3b5bAfc5d3C7770Fc2e4f0Bc71fd3](https://explorer-studio.genlayer.com/address/0xc85B35932Bb3b5bAfc5d3C7770Fc2e4f0Bc71fd3)

Deployment: [0x89e6df076c148c02bce7d85fd630215e0a51853d4275504c3ed316a316a091e6](https://explorer-studio.genlayer.com/tx/0x89e6df076c148c02bce7d85fd630215e0a51853d4275504c3ed316a316a091e6) — FINALIZED, successful.

Repository and deployed source SHA-256: `222e3d1f30d1a845562c5273172ee9a2524b8d8f514cfa9c99712760e085e5ee`. Source fetched with `gen_getContractCode` matched byte for byte. See [deployed-source.py](deployed-source.py), [deployment.json](deployment.json), and [deployment-receipt.json](deployment-receipt.json).

## Changes

- `settle` emits empty-calldata EthSend native GEN to the immutable claimant address on finalization. StudioNet routes this to an ordinary wallet as a SEND transaction. Settlement guards reject stale, unapproved, zero, insufficient, unauthorized, and repeated payments.
- `withdraw_unused` emits native GEN to the recorded insurer only from closed-policy surplus. Closure waits until coverage and the seven-day reporting window end. Unresolved claims and remaining appeals reserve their maximum possible payouts; approved claims reserve their actual payout. Policy pools cannot fund another policy’s withdrawal.
- Validators must agree exactly on outcome, payout band, confidence band, authenticated digest, and every condition identity and boolean. Only explanatory prose may differ. Local mutation tests reject a single changed condition.
- Browser writes require successful FINALIZED receipts; reads use finalized state. Native transfer balances and emitted child transactions are checked separately. Policy closure and recovery controls are available to the insurer.
- Deployment verifies the source before automatically syncing the tracked frontend manifest and local environment variables. Vercel uses the manifest on its next build, including when old host variables exist. A prebuild check detects source/deployment drift.

## Actual recipient balance proof

| Transaction | Recipient | Before (wei) | After (wei) | Increase (wei) |
|---|---|---:|---:|---:|
| [Native GEN reaches approved claimant wallet](https://explorer-studio.genlayer.com/tx/0xe5cfc4622602890c900c605860515d692e3906c29e79eb2d5a7ac9de1d4a7842) | `0x3654661080bC75Fd1674d5D81728Af424ff41622` | 1000000000000000000 | 1250000000000000000 | 250000000000000000 |
| [Unused native GEN reaches insurer while claim reserve remains](https://explorer-studio.genlayer.com/tx/0xd272c75e1549d4b43c6c2f0f58de612291475207686a51294a9335b98be7860a) | `0xCd7c77bF9748C1468dC8c1453dF9E70088aE2f71` | 9600000000000004999 | 9950000000000004999 | 350000000000000000 |

The signer pays no StudioNet gas in these test receipts; both recipient increases and matching contract decreases were asserted. No off-chain transfer was used to simulate settlement or withdrawal.

## Transactions

| Check | Explorer transaction | Receipt |
|---|---|---|
| Browser creates funded policy and waits for FINALIZED | [0x1b93f9b83598a0acfa1a534a540f7ff3d55634f41f42f201cf08a7752413fdbc](https://explorer-studio.genlayer.com/tx/0x1b93f9b83598a0acfa1a534a540f7ff3d55634f41f42f201cf08a7752413fdbc) | FINALIZED; SUCCESS; actual browser write |
| Holder files authenticated liquid damage | [0x0df7a03e8408d31cc43b29aad510ebc91802c6a4dd41e9fd3db41368e631d1d7](https://explorer-studio.genlayer.com/tx/0x0df7a03e8408d31cc43b29aad510ebc91802c6a4dd41e9fd3db41368e631d1d7) | FINALIZED; SUCCESS |
| Holder files out-of-scope evidence | [0xec0dbcfe0778d2349f61b58c6e70a39219c8f54d758381fd41a210807da8f5d1](https://explorer-studio.genlayer.com/tx/0xec0dbcfe0778d2349f61b58c6e70a39219c8f54d758381fd41a210807da8f5d1) | FINALIZED; SUCCESS |
| Cannot recover an active policy pool | [0x0ad5ca5ef6c3cc3c7d5c1e29711686e1d175126140baa1c32234a5dc8ec728cc](https://explorer-studio.genlayer.com/tx/0x0ad5ca5ef6c3cc3c7d5c1e29711686e1d175126140baa1c32234a5dc8ec728cc) | FINALIZED; ERROR; state and balances unchanged |
| Cannot close before the reporting deadline | [0x169f90c398334cfc0a99bb83e6b8db5847ab7f847d66552d597f1f387ca87e22](https://explorer-studio.genlayer.com/tx/0x169f90c398334cfc0a99bb83e6b8db5847ab7f847d66552d597f1f387ca87e22) | FINALIZED; ERROR; state and balances unchanged |
| Cannot settle an unadjudicated claim | [0x57304ad03de4cd418b7b45b046f4c2ff5bc9c3dc0fee6c15c0aa182007b6fbfb](https://explorer-studio.genlayer.com/tx/0x57304ad03de4cd418b7b45b046f4c2ff5bc9c3dc0fee6c15c0aa182007b6fbfb) | FINALIZED; ERROR; state and balances unchanged |
| Browser requests real committee decision and waits for FINALIZED | [0x387b52bff80e22a250c0832bf48d2c7aa7c196bf3eb85c06bad913ea73bd3be5](https://explorer-studio.genlayer.com/tx/0x387b52bff80e22a250c0832bf48d2c7aa7c196bf3eb85c06bad913ea73bd3be5) | FINALIZED; SUCCESS; actual browser write |
| Unrelated wallet cannot settle approved claim | [0x5a91d0432f9afb47a9cf03f103993d4bfc1527eb99df7ab8c39994e134408631](https://explorer-studio.genlayer.com/tx/0x5a91d0432f9afb47a9cf03f103993d4bfc1527eb99df7ab8c39994e134408631) | FINALIZED; ERROR; state and balances unchanged |
| Holder cannot redirect or authorize settlement | [0xc48fbdfddde403b3c445ecc93daabbcf888b4c87f01749e373b752d2f541896d](https://explorer-studio.genlayer.com/tx/0xc48fbdfddde403b3c445ecc93daabbcf888b4c87f01749e373b752d2f541896d) | FINALIZED; ERROR; state and balances unchanged |
| Native GEN reaches approved claimant wallet | [0xe5cfc4622602890c900c605860515d692e3906c29e79eb2d5a7ac9de1d4a7842](https://explorer-studio.genlayer.com/tx/0xe5cfc4622602890c900c605860515d692e3906c29e79eb2d5a7ac9de1d4a7842) | FINALIZED; SUCCESS |
| Double payout rejects without changing balances | [0xc077c2540ef9c10fab9ee4dad5d6c71fb19a3f2ad167bafc47c2f34c118f3a4c](https://explorer-studio.genlayer.com/tx/0xc077c2540ef9c10fab9ee4dad5d6c71fb19a3f2ad167bafc47c2f34c118f3a4c) | FINALIZED; ERROR; state and balances unchanged |
| Insurer closes reporting-expired policy | [0xcc52823b28f9993ff1b00940e0092482f644c6c07df9475d752f7fc546ee6ea1](https://explorer-studio.genlayer.com/tx/0xcc52823b28f9993ff1b00940e0092482f644c6c07df9475d752f7fc546ee6ea1) | FINALIZED; SUCCESS |
| Unresolved claim collateral cannot be withdrawn | [0x16135a98248bcd5e425ae4fe79ea3757c950f4e30dca194613adb6fe9de0b478](https://explorer-studio.genlayer.com/tx/0x16135a98248bcd5e425ae4fe79ea3757c950f4e30dca194613adb6fe9de0b478) | FINALIZED; ERROR; state and balances unchanged |
| Zero withdrawal rejects | [0x6534ed74f018ccadd066cb3b33e8f3673b1afc6cd325bf751ab047f56b47aa51](https://explorer-studio.genlayer.com/tx/0x6534ed74f018ccadd066cb3b33e8f3673b1afc6cd325bf751ab047f56b47aa51) | FINALIZED; ERROR; state and balances unchanged |
| Negative withdrawal rejects | [0xec916b26c1bb7aa27739dabe291f9e66e0653a2ad37488bdb32a66d0d3bf4f57](https://explorer-studio.genlayer.com/tx/0xec916b26c1bb7aa27739dabe291f9e66e0653a2ad37488bdb32a66d0d3bf4f57) | FINALIZED; ERROR; state and balances unchanged |
| Unused native GEN reaches insurer while claim reserve remains | [0xd272c75e1549d4b43c6c2f0f58de612291475207686a51294a9335b98be7860a](https://explorer-studio.genlayer.com/tx/0xd272c75e1549d4b43c6c2f0f58de612291475207686a51294a9335b98be7860a) | FINALIZED; SUCCESS |
| Repeated withdrawal cannot consume remaining collateral | [0xea7daa24ffd8199d074388d2ac5b417544f7871f89a182cdb1c2f1e40b83224a](https://explorer-studio.genlayer.com/tx/0xea7daa24ffd8199d074388d2ac5b417544f7871f89a182cdb1c2f1e40b83224a) | FINALIZED; ERROR; state and balances unchanged |

## Validation

- 17 successful live checks. Expected contract failures count as passed adverse cases only after their state and balance invariants are verified.
- 16 deterministic contract tests pass, including exact-condition mutation, stale decision, zero payout, policy and contract insufficiency, multiple claim reserves, appeals, and authorization.
- Frontend TypeScript/build and browser UI suite pass.
- Finalized contract balance equals the sum of remaining policy pools.

Full machine-readable proof: [live-review.json](live-review.json). Each transaction has a receipt JSON alongside it; validator private keys returned by StudioNet are redacted. Evidence documents are pinned to an immutable GitHub commit and stored alongside their hashes.

## Remaining constraints

StudioNet uses test GEN. Existing unresolved claims or unused appeals retain collateral until their liabilities resolve. These protections deliberately prevent insurer closure from cancelling claim rights.
