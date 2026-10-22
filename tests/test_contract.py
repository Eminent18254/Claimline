"""Exercise repository contract logic locally; StudioNet supplies real VM proof.

The adapter implements storage/message/transfer interfaces, not adjudication.
No locally mocked decision is presented as validator or live-chain evidence.
"""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest


class UserError(Exception):
    pass


class Address:
    def __init__(self, value):
        if not isinstance(value, str) or len(value) != 42:
            raise ValueError("bad address")
        self.as_hex = value.lower()

    def __eq__(self, other):
        return isinstance(other, Address) and self.as_hex == other.as_hex


def write(fn):
    return fn


write.payable = write
transfers = []


class Account:
    def __init__(self, address):
        self.address = address

    def emit_transfer(self, *, value, on="finalized"):
        transfers.append((self.address.as_hex, value, on))


gl = types.SimpleNamespace(
    Contract=type("Contract", (), {"balance": 10**30}),
    public=types.SimpleNamespace(write=write, view=write),
    vm=types.SimpleNamespace(UserError=UserError),
    message=types.SimpleNamespace(),
    get_contract_at=Account,
    evm=types.SimpleNamespace(contract_interface=lambda declaration: Account),
)
adapter = types.ModuleType("genlayer")
adapter.gl = gl
adapter.Address = Address
adapter.TreeMap = dict
adapter.DynArray = list
adapter.u256 = int
adapter.u32 = int
adapter.allow_storage = write
sys.modules["genlayer"] = adapter
spec = importlib.util.spec_from_file_location("claimline_contract", Path(__file__).parents[1] / "contracts" / "Claimline.py")
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)

INSURER = "0x" + "1" * 40
HOLDER = "0x" + "2" * 40
ATTACKER = "0x" + "3" * 40
DIGEST = "sha256:" + "a" * 64


class ContractTests(unittest.TestCase):
    def setUp(self):
        transfers.clear()
        self.c = module.Claimline()
        self.c.policies, self.c.claims = {}, {}
        self.c.policy_order, self.c.claim_order = [], []
        self.c.policy_counter = self.c.claim_counter = 0
        gl.message.sender_address = Address(INSURER)
        gl.message.value = 1000
        gl.message_raw = {"datetime": "2026-10-01T00:00:00+00:00"}
        self.p = self.c.create_policy(HOLDER, "Equipment", "Covered damage", '["Receipt", "Damage"]', "1000", "100", "1", "1790812800")
        gl.message.value = 0
        gl.message.sender_address = Address(HOLDER)
        self.cid = self.c.file_claim(self.p, "2", "500", "https://example.com/evidence", DIGEST)
        self.claim = self.c.claims[self.cid]
        self.policy = self.c.policies[self.p]
        gl.message.sender_address = Address(INSURER)

    def approve(self, band=100):
        self.claim.status = "APPROVED" if band == 100 else "PARTIALLY_APPROVED"
        self.claim.payout_band = band
        self.claim.evaluated_revision = 1

    def close(self):
        gl.message_raw = {"datetime": "2026-10-10T00:00:00Z"}
        self.c.close_policy(self.p)

    def rejected(self, method, *args):
        before = copy.deepcopy((self.c.policies, self.c.claims, transfers))
        with self.assertRaises(UserError):
            method(*args)
        self.assertEqual(before, (self.c.policies, self.c.claims, transfers))

    def test_native_payout_and_no_double_spend(self):
        self.approve()
        self.c.settle(self.cid)
        self.assertEqual(transfers, [(HOLDER, 400, "finalized")])
        self.assertEqual((self.policy.pool_wei, self.policy.paid_wei, self.claim.status), (600, 400, "SETTLED"))
        self.rejected(self.c.settle, self.cid)

    def test_partial_band_limit_and_deductible(self):
        self.claim.claimed_wei = 2000
        self.approve(75)
        self.c.settle(self.cid)
        self.assertEqual(transfers, [(HOLDER, 650, "finalized")])

    def test_unauthorized_payout(self):
        self.approve()
        for sender in (HOLDER, ATTACKER):
            gl.message.sender_address = Address(sender)
            self.rejected(self.c.settle, self.cid)

    def test_non_payable_statuses(self):
        for status in ("FILED", "DECLINED", "MORE_EVIDENCE_REQUIRED"):
            self.claim.status = status
            self.rejected(self.c.settle, self.cid)

    def test_stale_decision(self):
        self.approve()
        self.claim.evidence_revision = 2
        self.rejected(self.c.settle, self.cid)

    def test_insufficient_policy_pool_and_contract_balance(self):
        self.approve()
        self.policy.pool_wei = 399
        self.rejected(self.c.settle, self.cid)
        self.policy.pool_wei = 1000
        self.c.balance = 399
        self.rejected(self.c.settle, self.cid)

    def test_zero_payout(self):
        self.approve(25)
        self.claim.claimed_wei = 200
        self.rejected(self.c.settle, self.cid)

    def test_early_close_and_active_withdrawal(self):
        self.rejected(self.c.close_policy, self.p)
        self.rejected(self.c.withdraw_unused, self.p, "1")

    def test_closed_pending_reserve_and_surplus_transfer(self):
        self.close()
        self.assertEqual(self.c._reserved_for(self.policy), 400)
        self.rejected(self.c.withdraw_unused, self.p, "601")
        self.c.withdraw_unused(self.p, "600")
        self.assertEqual(transfers, [(INSURER, 600, "finalized")])
        self.assertEqual((self.policy.pool_wei, self.policy.withdrawn_wei), (400, 600))
        self.approve()
        self.c.settle(self.cid)
        self.assertEqual(self.policy.pool_wei, 0)
        self.assertEqual(transfers[-1], (HOLDER, 400, "finalized"))

    def test_declined_appeal_keeps_reserve(self):
        self.close()
        self.claim.status = "DECLINED"
        self.rejected(self.c.withdraw_unused, self.p, "1000")
        self.claim.appeals = 1
        self.assertEqual(self.c._reserved_for(self.policy), 0)
        self.c.withdraw_unused(self.p, "1000")
        self.assertEqual(transfers, [(INSURER, 1000, "finalized")])

    def test_appeal_in_progress_keeps_reserve(self):
        self.close()
        self.claim.appeals = 1
        self.claim.status = "FILED"
        self.rejected(self.c.withdraw_unused, self.p, "1000")
        self.claim.status = "MORE_EVIDENCE_REQUIRED"
        self.rejected(self.c.withdraw_unused, self.p, "1000")

    def test_zero_negative_overdraw_repeat_and_unauthorized_recovery(self):
        self.close()
        for amount in ("0", "-1", "bad", "1001"):
            self.rejected(self.c.withdraw_unused, self.p, amount)
        for sender in (HOLDER, ATTACKER):
            gl.message.sender_address = Address(sender)
            self.rejected(self.c.withdraw_unused, self.p, "1")
        gl.message.sender_address = Address(INSURER)
        self.c.withdraw_unused(self.p, "600")
        self.rejected(self.c.withdraw_unused, self.p, "600")

    def test_multiple_claims_and_policy_isolation(self):
        gl.message.sender_address = Address(HOLDER)
        self.c.file_claim(self.p, "3", "700", "https://example.com/two", DIGEST)
        gl.message.sender_address = Address(INSURER)
        self.close()
        self.assertEqual(self.c._reserved_for(self.policy), 1000)
        self.rejected(self.c.withdraw_unused, self.p, "1")

    def test_same_bytes_at_another_url_cannot_reroll(self):
        gl.message.sender_address = Address(HOLDER)
        self.rejected(self.c.replace_evidence, self.cid, "https://example.com/alias", DIGEST)

    def test_closed_policy_blocks_new_claims_but_can_be_funded(self):
        self.close()
        gl.message.sender_address = Address(HOLDER)
        self.rejected(self.c.file_claim, self.p, "2", "500", "https://example.com/evidence", DIGEST)
        gl.message.value = 1
        self.c.fund_policy(self.p)
        self.assertEqual(self.policy.pool_wei, 1001)

    def test_exact_condition_agreement_and_prose_freedom(self):
        decision = {"outcome": "PARTIALLY_APPROVED", "payoutBand": 75, "confidenceBand": "HIGH", "contentDigest": DIGEST,
                    "conditions": [{"condition": "Receipt", "passed": True}, {"condition": "Damage", "passed": False}]}
        independent = copy.deepcopy(decision)
        independent["reason"] = "Different prose"
        self.assertTrue(module.decisions_agree(decision, independent))
        for index in range(2):
            altered = copy.deepcopy(independent)
            altered["conditions"][index]["passed"] = not altered["conditions"][index]["passed"]
            self.assertFalse(module.decisions_agree(decision, altered), "One disagreement must fail")
        for field, value in (("outcome", "DECLINED"), ("payoutBand", 50), ("confidenceBand", "LOW"), ("contentDigest", "different")):
            altered = dict(independent, **{field: value})
            self.assertFalse(module.decisions_agree(decision, altered))


if __name__ == "__main__":
    unittest.main(verbosity=2)
