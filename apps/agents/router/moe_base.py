from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Sequence


Vector = Sequence[float]


@dataclass
class MoERouterConfig:
    n_features: int
    expert_ids: list[str]
    top_k: int = 2
    aux_loss_weight: float = 0.01
    learning_rate: float = 0.05
    z_loss_weight: float = 0.0


@dataclass
class LearnedRouteResult:
    assignments: list[list[str]]
    probabilities: list[list[float]]
    loads: dict[str, int]
    auxiliary_loss: float
    router_z_loss: float
    total_loss: float
    confidence: list[float]
    evidence_links: list[str] = field(default_factory=list)


def _softmax(logits: Sequence[float]) -> list[float]:
    if not logits:
        return []
    pivot = max(logits)
    values = [math.exp(value - pivot) for value in logits]
    total = sum(values) or 1.0
    return [value / total for value in values]


def _dot(left: Vector, right: Vector) -> float:
    return sum(float(a) * float(b) for a, b in zip(left, right))


class LearnedMoERouter:
    """Base learned router with top-k dispatch and load-balancing auxiliary loss.

    The auxiliary loss follows the common MoE load-balancing idea used by
    Switch/NVIDIA-style routers: minimize N * sum(load_fraction * prob_fraction)
    so high router probability does not collapse onto only a few experts.
    """

    def __init__(self, config: MoERouterConfig, weights: list[list[float]] | None = None, bias: list[float] | None = None):
        if config.top_k < 1 or config.top_k > len(config.expert_ids):
            raise ValueError("top_k must be between 1 and number of experts")
        self.config = config
        self.weights = weights or self._deterministic_weights(config.n_features, len(config.expert_ids))
        self.bias = bias or [0.0 for _ in config.expert_ids]
        if len(self.weights) != len(config.expert_ids) or any(len(row) != config.n_features for row in self.weights):
            raise ValueError("weights must have shape [n_experts][n_features]")
        if len(self.bias) != len(config.expert_ids):
            raise ValueError("bias must have one value per expert")

    def route(self, features: Sequence[Vector], evidence_links: list[str] | None = None) -> LearnedRouteResult:
        probabilities = [self.predict_proba(vector) for vector in features]
        assignments: list[list[str]] = []
        loads = {expert_id: 0 for expert_id in self.config.expert_ids}
        for probs in probabilities:
            ranked = sorted(range(len(probs)), key=lambda idx: probs[idx], reverse=True)[: self.config.top_k]
            expert_ids = [self.config.expert_ids[idx] for idx in ranked]
            assignments.append(expert_ids)
            for expert_id in expert_ids:
                loads[expert_id] += 1
        aux = self.auxiliary_loss(probabilities, assignments)
        z_loss = self.router_z_loss(features)
        return LearnedRouteResult(
            assignments=assignments,
            probabilities=probabilities,
            loads=loads,
            auxiliary_loss=aux,
            router_z_loss=z_loss,
            total_loss=self.config.aux_loss_weight * aux + self.config.z_loss_weight * z_loss,
            confidence=[max(probs) if probs else 0.0 for probs in probabilities],
            evidence_links=evidence_links or [],
        )

    def predict_proba(self, feature: Vector) -> list[float]:
        if len(feature) != self.config.n_features:
            raise ValueError("feature vector length does not match n_features")
        return _softmax([_dot(row, feature) + self.bias[idx] for idx, row in enumerate(self.weights)])

    def auxiliary_loss(self, probabilities: list[list[float]], assignments: list[list[str]]) -> float:
        if not probabilities:
            return 0.0
        n_experts = len(self.config.expert_ids)
        tokens = len(probabilities)
        load_fraction = []
        probability_fraction = []
        for expert_idx, expert_id in enumerate(self.config.expert_ids):
            dispatched = sum(1 for token_assignment in assignments if expert_id in token_assignment)
            load_fraction.append(dispatched / max(1, tokens * self.config.top_k))
            probability_fraction.append(sum(probs[expert_idx] for probs in probabilities) / tokens)
        return n_experts * sum(load * prob for load, prob in zip(load_fraction, probability_fraction))

    def router_z_loss(self, features: Sequence[Vector]) -> float:
        if not features:
            return 0.0
        total = 0.0
        for feature in features:
            logits = [_dot(row, feature) + self.bias[idx] for idx, row in enumerate(self.weights)]
            log_z = math.log(sum(math.exp(value) for value in logits))
            total += log_z * log_z
        return total / len(features)

    def train_step(self, features: Sequence[Vector], labels: Sequence[str], evidence_links: list[str] | None = None) -> dict[str, float | LearnedRouteResult]:
        if len(features) != len(labels):
            raise ValueError("features and labels must have equal length")
        gradients = [[0.0 for _ in range(self.config.n_features)] for _ in self.config.expert_ids]
        bias_gradients = [0.0 for _ in self.config.expert_ids]
        ce_loss = 0.0
        for feature, label in zip(features, labels):
            if label not in self.config.expert_ids:
                raise ValueError(f"unknown expert label: {label}")
            label_idx = self.config.expert_ids.index(label)
            probs = self.predict_proba(feature)
            ce_loss += -math.log(max(probs[label_idx], 1e-9))
            for expert_idx, prob in enumerate(probs):
                delta = prob - (1.0 if expert_idx == label_idx else 0.0)
                for feature_idx, value in enumerate(feature):
                    gradients[expert_idx][feature_idx] += delta * float(value)
                bias_gradients[expert_idx] += delta
        scale = 1.0 / max(1, len(features))
        for expert_idx in range(len(self.config.expert_ids)):
            for feature_idx in range(self.config.n_features):
                self.weights[expert_idx][feature_idx] -= self.config.learning_rate * gradients[expert_idx][feature_idx] * scale
            self.bias[expert_idx] -= self.config.learning_rate * bias_gradients[expert_idx] * scale
        route_result = self.route(features, evidence_links=evidence_links)
        return {
            "cross_entropy_loss": ce_loss * scale,
            "auxiliary_loss": route_result.auxiliary_loss,
            "total_loss": ce_loss * scale + self.config.aux_loss_weight * route_result.auxiliary_loss,
            "route": route_result,
        }

    @staticmethod
    def _deterministic_weights(n_features: int, n_experts: int) -> list[list[float]]:
        return [[((expert_idx + 1) * (feature_idx + 1)) / (n_features * n_experts * 10) for feature_idx in range(n_features)] for expert_idx in range(n_experts)]
