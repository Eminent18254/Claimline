# Claimline Live Audit

**Date:** 20 October 2026  
**Network:** GenLayer Studionet, chain 61999  
**Contract:** `0x8506A82203650A991FCDfDA3d6aee670cA5FdB62`  
**Deploy transaction:** `0xf2d814e27513bdc24973e43adfc962a7b3a1a92e8350880bd9b3ea59047f231d`

## Result

- Contract checks: **38 passed, 0 failed**
- Transactions attempted: **18**
- Frontend build: **passed**
- Browser UI audit: **passed** across landing, app navigation, guest browsing, wallet gates, search, filters, drawers, hashing, submissions, Decision refresh, permissions, dialogs, and 320-1440px layouts.

Explorer links:

- Contract: https://explorer-studio.genlayer.com/address/0x8506A82203650A991FCDfDA3d6aee670cA5FdB62
- Deployment: https://explorer-studio.genlayer.com/tx/0xf2d814e27513bdc24973e43adfc962a7b3a1a92e8350880bd9b3ea59047f231d

## Bug found during the audit

The first deployment rejected every policy deposit with:

`called non-payable method create_policy with non-zero value`

`create_policy` and `fund_policy` were declared as regular writes. Both read `gl.message.value`, so both must be payable. They were changed to `@gl.public.write.payable`, the contract was redeployed, and the same calls then succeeded.

## Transaction proof

| Check | Transaction | Result |
|---|---|---|
| Create policy with 1 GEN pool | `0x2fadd9cc1dbf36b1100aaf002c1fdb02524974fe652cd7a3b39bebae6c1b90c5` | Passed |
| Fund policy with 0.2 GEN | `0xd3fcc68d669775488d055557a19da96eacebb588881121b267e025475bf56d56` | Passed |
| File claim with a wrong digest | `0x8e9c4e09a41b853b8f5176659a38bb943b181b41af281e7e500e1fdb31bb708b` | Passed |
| Insurer tries to file for holder | `0x0213344dd07fc90e6f049c6fc5624e1050014a185dfa829f63dfeae883c7c17a` | Correctly rejected |
| Adjudicate with wrong digest | `0xc83637f52aa8b6effebd0acf2756cb993615912371eb81fd84e8b85ea2765823` | Correctly rejected |
| Replace evidence with matching digest | `0x5490ca4aaff1408d8b8f4b13b62e1eee648ed8fa34a89137096b35be1aff7f34` | Passed |
| Adjudicate water-damage claim | `0x45222f6bb53ece45449599bbc66e54ec7ecb3ed7c3986e902db86f9a988e6bfc` | Approved |
| Rerun the same revision | `0xb445edca78a716dc722151b8216d3aedd7a4a74997c3318f3d3e98585023ac7b` | Correctly rejected |
| Holder tries to settle | `0x446518dd5e3b93841537cdb3c9ae34942e4182c0d5edc62310f1f36dc4ffbdc9` | Correctly rejected |
| Settle approved claim | `0x299abf7d6e1174e2de8450c918816018ad12d2ab4c2b994c1dbd4dca3ee8203a` | Passed |
| Replace evidence after settlement | `0x28fbef85f481ab0ddfae6a0f4f3b79431fcce138913bb1412b3836ecf4aa2047` | Correctly rejected |
| File out-of-scope claim | `0x82f69cdf9414fcdf45caa43e4fec0200a7fbc09df54a1262d671779846221a01` | Passed |
| Adjudicate out-of-scope claim | `0xbbd4581c88c2fb17b3d44863098f50d8ecac3c9e4da9201c5ab1f86621888148` | Declined |
| Appeal with new evidence | `0xa644ffe6d08d69f119aee3f657e97adb7e17f9a3d0be04d6043f44c9be41b139` | Passed |
| Adjudicate appeal revision | `0x335f914c02ab41804802e95c6f9a31ea05588aefc2897df10d71353592598171` | Partially approved |
| Settle appeal claim | `0x91b50f553582b6fc474058327ac6148b92ccf42ba122ea1d8186cfbcd50ffb3d` | Passed |
| Close policy | `0x02eb3fe3dff30cb14b08c7e267c18aa16053fa7390ba4e507de340e46d4c6629` | Passed |
| File claim on closed policy | `0xc45fc437b1449d6d47f84aa604eb9a5c42fa21110542f9712d9045eee00b9630` | Correctly rejected |

## Final state

- All policies are closed.
- All claims are settled.
- Claim `c1`: approved at 100%, paid 0.25 GEN.
- Claim `c2`: wrong digest was refused, evidence replaced, then approved at 100% and paid 0.25 GEN.
- Claim `c3`: out-of-scope evidence declined, one appeal accepted, replacement evidence partially approved at 75% and paid 0.275 GEN.
- Policy `p3`: 1.2 GEN pool, 0.525 GEN paid, 0.675 GEN remaining.

## Checks covered

Policy creation, pool funding, evidence hashing, digest mismatch refusal, evidence replacement, revision tracking, first decision, repeated-decision refusal, settlement, settled-final refusal, decline, appeal, partial approval, policy closing, closed-policy refusal, holder/insurer permissions, and every read method: `get_state`, `get_policy`, `get_policies`, `get_claim`, `get_claims`, `get_claims_for_policy`, `get_claims_by`.