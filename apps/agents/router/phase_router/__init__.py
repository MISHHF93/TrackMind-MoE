from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

try:
    from ._phase_router_rs import phase_topk as _rust_phase_topk
    from ._phase_router_rs import uniform_dispatch as _rust_uniform_dispatch

    RUST_AVAILABLE = True
except Exception:  # pragma: no cover - exercised when maturin extension is absent
    _rust_phase_topk = None
    _rust_uniform_dispatch = None
    RUST_AVAILABLE = False


DEFAULT_N_TOKENS = 8192
DEFAULT_N_EXPERTS = 32
DEFAULT_K = 2
DEFAULT_BASE_DENSITY = 0.3


@dataclass(frozen=True)
class PhaseRouterConfig:
    n_tokens: int = DEFAULT_N_TOKENS
    n_experts: int = DEFAULT_N_EXPERTS
    k: int = DEFAULT_K
    base_density: float = DEFAULT_BASE_DENSITY
    imbalance_threshold: int = 2


def _capacity_for(n_tokens: int, n_experts: int, k: int, base_density: float) -> int:
    total_slots = n_tokens * k
    fair_share = (total_slots + n_experts - 1) // n_experts
    return fair_share + int(fair_share * max(base_density, 0.0) + 0.999999)


def _result(mode: str, assignments: list[list[int]], loads: list[int], capacity: int, overflow_tokens: int) -> dict:
    min_load = min(loads) if loads else 0
    max_load = max(loads) if loads else 0
    return {
        "mode": mode,
        "assignments": assignments,
        "loads": loads,
        "capacity": capacity,
        "overflow_tokens": overflow_tokens,
        "min_load": min_load,
        "max_load": max_load,
        "imbalance": max_load - min_load,
        "native": RUST_AVAILABLE,
    }


def _validate(scores: list[list[float]], k: int) -> int:
    if not scores:
        raise ValueError("scores must contain at least one token row")
    n_experts = len(scores[0])
    if n_experts == 0:
        raise ValueError("scores must contain at least one expert column")
    if k <= 0 or k > n_experts:
        raise ValueError("k must be in the range 1..=n_experts")
    for idx, row in enumerate(scores):
        if len(row) != n_experts:
            raise ValueError(f"scores row {idx} has {len(row)} experts, expected {n_experts}")
    return n_experts


def _python_phase_topk(scores: list[list[float]], k: int = DEFAULT_K, base_density: float = DEFAULT_BASE_DENSITY) -> dict:
    n_experts = _validate(scores, k)
    capacity = _capacity_for(len(scores), n_experts, k, base_density)
    loads = [0] * n_experts
    assignments: list[list[int]] = []
    overflow_tokens = 0

    for token_idx, row in enumerate(scores):
        phase = token_idx % n_experts
        ranked = sorted(range(n_experts), key=lambda expert: (-row[expert], (expert - phase) % n_experts, expert))
        token_assignments: list[int] = []
        for expert in ranked:
            if len(token_assignments) == k:
                break
            if loads[expert] < capacity:
                token_assignments.append(expert)
                loads[expert] += 1
        if len(token_assignments) < k:
            overflow_tokens += 1
            for expert in sorted(range(n_experts), key=lambda item: (loads[item], (item - phase) % n_experts, item)):
                if len(token_assignments) == k:
                    break
                if expert not in token_assignments:
                    token_assignments.append(expert)
                    loads[expert] += 1
        assignments.append(token_assignments)

    return _result("phase_topk", assignments, loads, capacity, overflow_tokens)


def _python_uniform_dispatch(n_tokens: int = DEFAULT_N_TOKENS, n_experts: int = DEFAULT_N_EXPERTS, k: int = DEFAULT_K) -> dict:
    if n_tokens <= 0:
        raise ValueError("n_tokens must be greater than zero")
    if n_experts <= 0:
        raise ValueError("n_experts must be greater than zero")
    if k <= 0 or k > n_experts:
        raise ValueError("k must be in the range 1..=n_experts")
    loads = [0] * n_experts
    assignments: list[list[int]] = []
    stride = max(n_experts // k, 1)
    for token_idx in range(n_tokens):
        phase = token_idx % n_experts
        token_assignments = [(phase + rank * stride) % n_experts for rank in range(k)]
        for expert in token_assignments:
            loads[expert] += 1
        assignments.append(token_assignments)
    return _result("uniform_dispatch", assignments, loads, max(loads), 0)


def phase_topk(scores: Iterable[Iterable[float]], k: int = DEFAULT_K, base_density: float = DEFAULT_BASE_DENSITY) -> dict:
    rows = [[float(value) for value in row] for row in scores]
    if RUST_AVAILABLE and _rust_phase_topk is not None:
        result = _rust_phase_topk(rows, k, base_density)
        result["native"] = True
        return result
    return _python_phase_topk(rows, k, base_density)


def uniform_dispatch(n_tokens: int = DEFAULT_N_TOKENS, n_experts: int = DEFAULT_N_EXPERTS, k: int = DEFAULT_K) -> dict:
    if RUST_AVAILABLE and _rust_uniform_dispatch is not None:
        result = _rust_uniform_dispatch(n_tokens, n_experts, k)
        result["native"] = True
        return result
    return _python_uniform_dispatch(n_tokens, n_experts, k)


def load_imbalance(loads: Iterable[int]) -> dict:
    values = [int(value) for value in loads]
    if not values:
        return {"min_load": 0, "max_load": 0, "imbalance": 0, "ratio": 1.0}
    min_load = min(values)
    max_load = max(values)
    ratio = float("inf") if min_load == 0 and max_load > 0 else (max_load / max(min_load, 1))
    return {"min_load": min_load, "max_load": max_load, "imbalance": max_load - min_load, "ratio": ratio}


def should_phase_route(loads: Iterable[int], threshold: int = 2) -> bool:
    return load_imbalance(loads)["imbalance"] > threshold
