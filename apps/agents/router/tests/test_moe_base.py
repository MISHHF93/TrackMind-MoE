import unittest

from apps.agents.router.moe_base import LearnedMoERouter, MoERouterConfig


class LearnedMoERouterTests(unittest.TestCase):
    def test_learned_router_returns_topk_assignments_with_confidence_and_evidence(self):
        router = LearnedMoERouter(
            MoERouterConfig(n_features=3, expert_ids=["stewarding", "veterinary", "security"], top_k=2),
            weights=[[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]],
        )
        result = router.route([[0.9, 0.2, 0.1], [0.1, 0.2, 0.9]], evidence_links=["training://router-fixture"])
        self.assertEqual(result.assignments[0][0], "stewarding")
        self.assertEqual(result.assignments[1][0], "security")
        self.assertEqual(sum(result.loads.values()), 4)
        self.assertGreater(result.confidence[0], 0.4)
        self.assertEqual(result.evidence_links, ["training://router-fixture"])

    def test_auxiliary_loss_penalizes_expert_collapse_more_than_balanced_dispatch(self):
        router = LearnedMoERouter(MoERouterConfig(n_features=2, expert_ids=["a", "b"], top_k=1))
        collapsed = router.auxiliary_loss([[0.9, 0.1], [0.8, 0.2]], [["a"], ["a"]])
        balanced = router.auxiliary_loss([[0.9, 0.1], [0.1, 0.9]], [["a"], ["b"]])
        self.assertGreater(collapsed, balanced)

    def test_train_step_updates_weights_and_returns_total_loss(self):
        router = LearnedMoERouter(MoERouterConfig(n_features=2, expert_ids=["a", "b"], top_k=1, learning_rate=0.2))
        before = router.predict_proba([1.0, 0.0])[0]
        result = router.train_step([[1.0, 0.0], [0.0, 1.0]], ["a", "b"], evidence_links=["labels://router"])
        after = router.predict_proba([1.0, 0.0])[0]
        self.assertGreater(after, before)
        self.assertGreater(result["total_loss"], 0)
        self.assertEqual(result["route"].evidence_links, ["labels://router"])


if __name__ == "__main__":
    unittest.main()
