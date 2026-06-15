import asyncio
import unittest

from apps.agents.router.cascade_router import CascadeRouterConfig, CascadingMoERouter, ExpertUtilizationMonitor, RMoEGRUConfig, RMoEGRURouter, SinkhornRouter
from apps.agents.router.expert_parallel import ExpertParallelConfig, ExpertParallelDispatcher
from apps.agents.router.main import ClassifyRequest, classify_request, runtime


class CascadingRouterTests(unittest.TestCase):
    def test_primary_learned_router_is_used_when_healthy_and_confident(self):
        router = CascadingMoERouter(
            CascadeRouterConfig(
                n_features=3,
                expert_ids=["stewarding", "veterinary", "security"],
                primary_confidence_threshold=0.3,
            )
        )
        result = router.route([[0.1, 0.2, 0.9]])
        self.assertEqual(result.tier, "learned")
        self.assertEqual(len(result.assignments[0]), 1)
        self.assertFalse(result.utilization.collapsed)

    def test_secondary_rmoe_gru_router_is_used_when_primary_confidence_is_too_low(self):
        router = CascadingMoERouter(
            CascadeRouterConfig(
                n_features=3,
                expert_ids=["stewarding", "veterinary", "security"],
                primary_confidence_threshold=0.99,
                secondary_confidence_threshold=0.2,
            )
        )
        result = router.route([[0.1, 0.1, 0.1], [0.2, 0.1, 0.0]])
        self.assertEqual(result.tier, "rmoe_gru")
        self.assertEqual(len(result.assignments[0]), 1)

    def test_sinkhorn_router_is_used_when_utilization_collapse_is_detected(self):
        monitor = ExpertUtilizationMonitor(["stewarding", "veterinary", "security"], min_observations=4, collapse_fraction=0.75)
        monitor.extend(["security", "security", "security", "security"])
        router = CascadingMoERouter(
            CascadeRouterConfig(n_features=3, expert_ids=["stewarding", "veterinary", "security"]),
            monitor=monitor,
        )
        result = router.route([[0.1, 0.1, 0.9]])
        self.assertEqual(result.tier, "sinkhorn")
        self.assertTrue(result.utilization.collapsed)

    def test_sinkhorn_balances_batch_loads(self):
        router = SinkhornRouter(["a", "b"], top_k=1, iterations=8)
        result = router.route([[1.0, 0.1], [0.9, 0.2], [0.1, 1.0], [0.2, 0.9]])
        self.assertEqual(sum(result.loads.values()), 4)
        self.assertLessEqual(abs(result.loads["a"] - result.loads["b"]), 2)

    def test_rmoe_gru_produces_recurrent_assignment(self):
        router = RMoEGRURouter(RMoEGRUConfig(n_features=2, expert_ids=["a", "b"], hidden_size=4))
        result = router.route([[1.0, 0.0], [0.5, 0.5]])
        self.assertEqual(len(result.assignments), 1)
        self.assertIn(result.assignments[0][0], {"a", "b"})

    def test_fastapi_classification_uses_sinkhorn_when_expert_collapse_detected(self):
        original_loads = dict(runtime.expert_loads)
        original_monitor = runtime.expert_utilization_monitor
        try:
            runtime.expert_loads = {expert_id: 0 for expert_id in runtime.config["experts"]}
            runtime.expert_loads["security"] = 12
            runtime.expert_utilization_monitor = ExpertUtilizationMonitor(list(runtime.config["experts"]), min_observations=4, collapse_fraction=0.65)
            response = asyncio.run(
                classify_request(
                    ClassifyRequest(
                        request="security restricted zone credential camera incident",
                        approval_token="approved",
                        evidence_links=["camera://clip"],
                        context={"approved_by": "chief-steward", "approval_timestamp": "2026-06-14T00:00:00Z"},
                    )
                )
            )
            self.assertEqual(response.router_health["cascade"]["tier"], "sinkhorn")
            self.assertTrue(response.router_health["cascade"]["utilization"]["collapsed"])
        finally:
            runtime.expert_loads = original_loads
            runtime.expert_utilization_monitor = original_monitor

    def test_expert_parallel_dispatch_simulates_all_to_all_without_gpu_runtime(self):
        dispatcher = ExpertParallelDispatcher(
            ExpertParallelConfig(expert_ids=["a", "b", "c", "d"], world_size=2, enable_distributed=False)
        )
        result = dispatcher.dispatch(["token-1", "token-2"], [["a", "c"], ["b"]])
        self.assertTrue(result.simulated)
        self.assertEqual(result.plan.expert_to_rank["a"], 0)
        self.assertEqual(result.plan.expert_to_rank["b"], 1)
        self.assertEqual(result.local_expert_inputs["a"], ["token-1"])
        self.assertEqual(result.local_expert_inputs["c"], ["token-1"])
        self.assertEqual(result.communication, "all_to_all")


if __name__ == "__main__":
    unittest.main()
