import unittest
import asyncio

from apps.agents.router.main import ClassifyRequest, classify_request, runtime
from apps.agents.router.phase_router import phase_topk, should_phase_route, uniform_dispatch


class PhaseRouterTests(unittest.TestCase):
    def test_uniform_dispatch_balances_equal_capacity_experts(self):
        result = uniform_dispatch(n_tokens=8192, n_experts=32, k=2)
        self.assertEqual(result["mode"], "uniform_dispatch")
        self.assertEqual(len(result["assignments"]), 8192)
        self.assertEqual(len(result["loads"]), 32)
        self.assertEqual(sum(result["loads"]), 8192 * 2)
        self.assertLessEqual(result["max_load"] - result["min_load"], 0)
        self.assertEqual(result["overflow_tokens"], 0)

    def test_phase_topk_respects_structural_capacity(self):
        scores = []
        for token_idx in range(256):
            row = [0.01] * 8
            row[0] = 1.0
            row[(token_idx % 7) + 1] = 0.8
            scores.append(row)

        result = phase_topk(scores, k=2, base_density=0.3)
        self.assertEqual(result["mode"], "phase_topk")
        self.assertEqual(len(result["assignments"]), 256)
        self.assertEqual(sum(result["loads"]), 256 * 2)
        self.assertTrue(all(load <= result["capacity"] for load in result["loads"]))
        self.assertLess(result["max_load"], 256)

    def test_imbalance_detector_uses_threshold(self):
        self.assertFalse(should_phase_route([3, 4, 5], threshold=2))
        self.assertTrue(should_phase_route([0, 0, 9], threshold=2))

    def test_fastapi_router_uses_phase_fallback_on_imbalance(self):
        original_loads = dict(runtime.expert_loads)
        original_threshold = runtime.config["router"]["phase_router"]["imbalance_threshold"]
        original_cascade_enabled = runtime.config["router"]["cascade_router"]["enabled"]
        try:
            runtime.expert_loads = {expert_id: 0 for expert_id in runtime.config["experts"]}
            runtime.expert_loads["security"] = 10
            runtime.config["router"]["phase_router"]["imbalance_threshold"] = 1
            runtime.config["router"]["cascade_router"]["enabled"] = False
            result = asyncio.run(
                classify_request(
                    ClassifyRequest(
                        request="security restricted zone credential camera incident",
                        approval_token="approved",
                        evidence_links=["camera://clip"],
                        context={"approved_by": "chief-steward", "approval_timestamp": "2026-06-14T00:00:00Z"},
                    )
                )
            )
            self.assertEqual(result.tier, "phase_topk")
            self.assertGreaterEqual(runtime.expert_loads[result.expert], 1)
        finally:
            runtime.expert_loads = original_loads
            runtime.config["router"]["phase_router"]["imbalance_threshold"] = original_threshold
            runtime.config["router"]["cascade_router"]["enabled"] = original_cascade_enabled


if __name__ == "__main__":
    unittest.main()
