from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Sequence


try:  # Optional dependency. The local simulation path is used in tests.
    import torch.distributed as dist  # type: ignore
except Exception:  # pragma: no cover - depends on runtime image
    dist = None  # type: ignore


@dataclass
class ExpertParallelConfig:
    expert_ids: list[str]
    world_size: int
    local_rank: int = 0
    backend: str = "nccl"
    enable_distributed: bool = True


@dataclass
class ExpertParallelPlan:
    expert_to_rank: dict[str, int]
    rank_to_experts: dict[int, list[str]]
    world_size: int
    backend: str
    distributed_available: bool


@dataclass
class AllToAllResult:
    send_buckets: dict[int, list[Any]]
    receive_buckets: dict[int, list[Any]]
    local_expert_inputs: dict[str, list[Any]]
    plan: ExpertParallelPlan
    simulated: bool
    communication: str = "all_to_all"
    audit_evidence_links: list[str] = field(default_factory=lambda: ["nvidia-moe://expert-parallel/all-to-all"])


class ExpertParallelDispatcher:
    """Maps experts to GPU ranks and exchanges token batches by all-to-all.

    Production uses `torch.distributed.all_to_all_object` when initialized.
    Local development uses a deterministic simulation with identical bucket
    semantics, which keeps CPU-only CI meaningful.
    """

    def __init__(self, config: ExpertParallelConfig):
        if config.world_size < 1:
            raise ValueError("world_size must be positive")
        self.config = config
        self.plan = self._create_plan(config)

    def dispatch(self, tokens: Sequence[Any], assignments: Sequence[Sequence[str]]) -> AllToAllResult:
        if len(tokens) != len(assignments):
            raise ValueError("tokens and assignments must have equal length")
        send_buckets = {rank: [] for rank in range(self.config.world_size)}
        for token, token_assignments in zip(tokens, assignments):
            for expert_id in token_assignments:
                if expert_id not in self.plan.expert_to_rank:
                    raise ValueError(f"unknown expert assignment: {expert_id}")
                target_rank = self.plan.expert_to_rank[expert_id]
                send_buckets[target_rank].append({"expert_id": expert_id, "token": token})

        receive_buckets, simulated = self._all_to_all(send_buckets)
        local_expert_inputs = {expert_id: [] for expert_id in self.plan.rank_to_experts.get(self.config.local_rank, [])}
        for item in receive_buckets.get(self.config.local_rank, []):
            expert_id = item["expert_id"]
            if expert_id in local_expert_inputs:
                local_expert_inputs[expert_id].append(item["token"])
        return AllToAllResult(send_buckets, receive_buckets, local_expert_inputs, self.plan, simulated=simulated)

    def _all_to_all(self, send_buckets: dict[int, list[Any]]) -> tuple[dict[int, list[Any]], bool]:
        if self._distributed_ready():
            output = [[] for _ in range(self.config.world_size)]
            input_payload = [send_buckets[rank] for rank in range(self.config.world_size)]
            dist.all_to_all_object(output, input_payload)  # type: ignore[union-attr]
            return {rank: output[rank] for rank in range(self.config.world_size)}, False
        return {rank: list(bucket) for rank, bucket in send_buckets.items()}, True

    def _distributed_ready(self) -> bool:
        return bool(
            self.config.enable_distributed
            and dist is not None
            and hasattr(dist, "is_available")
            and hasattr(dist, "is_initialized")
            and dist.is_available()
            and dist.is_initialized()
        )

    @staticmethod
    def _create_plan(config: ExpertParallelConfig) -> ExpertParallelPlan:
        expert_to_rank = {expert_id: idx % config.world_size for idx, expert_id in enumerate(config.expert_ids)}
        rank_to_experts = {rank: [] for rank in range(config.world_size)}
        for expert_id, rank in expert_to_rank.items():
            rank_to_experts[rank].append(expert_id)
        return ExpertParallelPlan(
            expert_to_rank=expert_to_rank,
            rank_to_experts=rank_to_experts,
            world_size=config.world_size,
            backend=config.backend,
            distributed_available=bool(dist is not None),
        )
