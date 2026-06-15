from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field
from typing import Iterable, Sequence

from .moe_base import LearnedMoERouter, MoERouterConfig, Vector, _dot, _softmax


@dataclass
class UtilizationHealth:
    total_assignments: int
    expert_loads: dict[str, int]
    active_expert_fraction: float
    max_expert_fraction: float
    entropy: float
    normalized_entropy: float
    collapsed: bool
    reason: str


@dataclass
class ExpertUtilizationMonitor:
    expert_ids: list[str]
    collapse_fraction: float = 0.65
    min_active_fraction: float = 0.5
    min_observations: int = 8
    window_size: int = 256
    assignments: deque[str] = field(default_factory=deque)

    def observe(self, expert_id: str) -> None:
        if expert_id not in self.expert_ids:
            return
        self.assignments.append(expert_id)
        while len(self.assignments) > self.window_size:
            self.assignments.popleft()

    def extend(self, expert_ids: Iterable[str]) -> None:
        for expert_id in expert_ids:
            self.observe(expert_id)

    def health(self, extra_loads: dict[str, int] | None = None) -> UtilizationHealth:
        loads = {expert_id: 0 for expert_id in self.expert_ids}
        for expert_id in self.assignments:
            loads[expert_id] = loads.get(expert_id, 0) + 1
        for expert_id, count in (extra_loads or {}).items():
            if expert_id in loads:
                loads[expert_id] += int(count)

        total = sum(loads.values())
        active = sum(1 for value in loads.values() if value > 0)
        fractions = [value / total for value in loads.values()] if total else [0.0 for _ in loads]
        entropy = -sum(value * math.log(value) for value in fractions if value > 0)
        max_entropy = math.log(max(1, len(loads)))
        normalized_entropy = entropy / max_entropy if max_entropy else 1.0
        active_fraction = active / max(1, len(loads))
        max_fraction = max(fractions, default=0.0)

        collapsed = False
        reason = "healthy"
        if total >= self.min_observations and max_fraction >= self.collapse_fraction:
            collapsed = True
            reason = f"single expert load fraction {max_fraction:.3f} >= {self.collapse_fraction:.3f}"
        elif total >= self.min_observations and active_fraction < self.min_active_fraction:
            collapsed = True
            reason = f"active expert fraction {active_fraction:.3f} < {self.min_active_fraction:.3f}"

        return UtilizationHealth(
            total_assignments=total,
            expert_loads=loads,
            active_expert_fraction=active_fraction,
            max_expert_fraction=max_fraction,
            entropy=entropy,
            normalized_entropy=normalized_entropy,
            collapsed=collapsed,
            reason=reason,
        )


@dataclass
class SinkhornResult:
    assignments: list[list[str]]
    probabilities: list[list[float]]
    loads: dict[str, int]
    iterations: int
    confidence: list[float]


@dataclass
class SinkhornRouter:
    expert_ids: list[str]
    top_k: int = 1
    iterations: int = 16
    temperature: float = 0.7

    def route(self, scores: Sequence[Vector]) -> SinkhornResult:
        if not self.expert_ids:
            raise ValueError("expert_ids must not be empty")
        if self.top_k < 1 or self.top_k > len(self.expert_ids):
            raise ValueError("top_k must be between 1 and number of experts")
        if not scores:
            return SinkhornResult([], [], {expert_id: 0 for expert_id in self.expert_ids}, self.iterations, [])
        for row in scores:
            if len(row) != len(self.expert_ids):
                raise ValueError("each score row must have one value per expert")
        matrix = [[math.exp(float(value) / max(self.temperature, 1e-6)) for value in row] for row in scores]
        for _ in range(self.iterations):
            for row in matrix:
                row_sum = sum(row) or 1.0
                for idx, value in enumerate(row):
                    row[idx] = value / row_sum
            for expert_idx in range(len(self.expert_ids)):
                col_sum = sum(row[expert_idx] for row in matrix) or 1.0
                target_col_sum = len(matrix) / max(1, len(self.expert_ids))
                for row in matrix:
                    row[expert_idx] = row[expert_idx] * target_col_sum / col_sum
        probabilities = [_softmax(row) for row in matrix]
        assignments: list[list[str]] = []
        loads = {expert_id: 0 for expert_id in self.expert_ids}
        for probs in probabilities:
            ranked = sorted(range(len(probs)), key=lambda idx: probs[idx], reverse=True)[: self.top_k]
            routed = [self.expert_ids[idx] for idx in ranked]
            assignments.append(routed)
            for expert_id in routed:
                loads[expert_id] += 1
        return SinkhornResult(assignments, probabilities, loads, self.iterations, [max(row) if row else 0.0 for row in probabilities])


@dataclass
class RMoEGRUConfig:
    n_features: int
    expert_ids: list[str]
    hidden_size: int = 8
    top_k: int = 1


class RMoEGRURouter:
    """Small recurrent router for temporal routing context.

    This is intentionally dependency-free. Production deployments can swap the
    deterministic weights for trained GRU parameters without changing callers.
    """

    def __init__(self, config: RMoEGRUConfig):
        if config.hidden_size < 1:
            raise ValueError("hidden_size must be positive")
        self.config = config
        self.output_weights = self._weights(len(config.expert_ids), config.hidden_size, scale=0.07)
        self.output_bias = [0.0 for _ in config.expert_ids]

    def route(self, sequence: Sequence[Vector]) -> SinkhornResult:
        hidden = [0.0 for _ in range(self.config.hidden_size)]
        for vector in sequence:
            hidden = self._gru_cell(vector, hidden)
        logits = [_dot(row, hidden) + self.output_bias[idx] for idx, row in enumerate(self.output_weights)]
        probabilities = [_softmax(logits)]
        ranked = sorted(range(len(logits)), key=lambda idx: probabilities[0][idx], reverse=True)[: self.config.top_k]
        assignments = [[self.config.expert_ids[idx] for idx in ranked]]
        loads = {expert_id: 0 for expert_id in self.config.expert_ids}
        for expert_id in assignments[0]:
            loads[expert_id] += 1
        return SinkhornResult(assignments, probabilities, loads, iterations=1, confidence=[max(probabilities[0]) if probabilities[0] else 0.0])

    def _gru_cell(self, feature: Vector, hidden: list[float]) -> list[float]:
        next_hidden: list[float] = []
        for idx in range(self.config.hidden_size):
            feature_signal = sum(float(value) * ((idx + 1) * (feature_idx + 1) / (self.config.hidden_size * max(1, self.config.n_features))) for feature_idx, value in enumerate(feature))
            recurrent_signal = hidden[idx] * 0.5
            reset = 1.0 / (1.0 + math.exp(-(feature_signal + recurrent_signal)))
            update = 1.0 / (1.0 + math.exp(-(feature_signal - recurrent_signal)))
            candidate = math.tanh(feature_signal + reset * recurrent_signal)
            next_hidden.append((1.0 - update) * hidden[idx] + update * candidate)
        return next_hidden

    @staticmethod
    def _weights(rows: int, cols: int, scale: float) -> list[list[float]]:
        return [[scale * (row_idx + 1) * (col_idx + 1) / max(1, rows * cols) for col_idx in range(cols)] for row_idx in range(rows)]


@dataclass
class CascadeRouterConfig:
    n_features: int
    expert_ids: list[str]
    top_k: int = 1
    primary_confidence_threshold: float = 0.45
    secondary_confidence_threshold: float = 0.34
    primary_aux_loss_threshold: float = 1.25
    sinkhorn_iterations: int = 16


@dataclass
class CascadeRouteResult:
    tier: str
    assignments: list[list[str]]
    probabilities: list[list[float]]
    loads: dict[str, int]
    confidence: list[float]
    reason: str
    utilization: UtilizationHealth | None = None


class CascadingMoERouter:
    def __init__(self, config: CascadeRouterConfig, monitor: ExpertUtilizationMonitor | None = None):
        self.config = config
        self.monitor = monitor or ExpertUtilizationMonitor(config.expert_ids)
        self.learned = LearnedMoERouter(
            MoERouterConfig(n_features=config.n_features, expert_ids=config.expert_ids, top_k=config.top_k)
        )
        self.rmoe = RMoEGRURouter(RMoEGRUConfig(n_features=config.n_features, expert_ids=config.expert_ids, top_k=config.top_k))
        self.sinkhorn = SinkhornRouter(config.expert_ids, top_k=config.top_k, iterations=config.sinkhorn_iterations)

    def route(self, features: Sequence[Vector], sequence: Sequence[Vector] | None = None, extra_loads: dict[str, int] | None = None, record_utilization: bool = True) -> CascadeRouteResult:
        utilization = self.monitor.health(extra_loads)
        learned = self.learned.route(features)
        learned_confidence = max(learned.confidence, default=0.0)
        if (
            not utilization.collapsed
            and learned_confidence >= self.config.primary_confidence_threshold
            and learned.auxiliary_loss <= self.config.primary_aux_loss_threshold
        ):
            if record_utilization:
                self.monitor.extend(expert for assignment in learned.assignments for expert in assignment)
            return CascadeRouteResult("learned", learned.assignments, learned.probabilities, learned.loads, learned.confidence, "primary learned router accepted", utilization)

        recurrent = self.rmoe.route(sequence or features)
        recurrent_confidence = max(recurrent.confidence, default=0.0)
        if not utilization.collapsed and recurrent_confidence >= self.config.secondary_confidence_threshold:
            if record_utilization:
                self.monitor.extend(expert for assignment in recurrent.assignments for expert in assignment)
            return CascadeRouteResult("rmoe_gru", recurrent.assignments, recurrent.probabilities, recurrent.loads, recurrent.confidence, "secondary recurrent MoE router accepted", utilization)

        sinkhorn = self.sinkhorn.route(features)
        if record_utilization:
            self.monitor.extend(expert for assignment in sinkhorn.assignments for expert in assignment)
        reason = "router collapse detected; Sinkhorn balancing applied" if utilization.collapsed else "confidence below learned and recurrent thresholds; Sinkhorn balancing applied"
        return CascadeRouteResult("sinkhorn", sinkhorn.assignments, sinkhorn.probabilities, sinkhorn.loads, sinkhorn.confidence, reason, utilization)
