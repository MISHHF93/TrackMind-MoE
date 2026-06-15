# TrackMind Phase Router

This package implements deterministic, capacity-aware MoE phase routing.

The Rust core is exposed to Python with maturin/PyO3. The Python wrapper falls back to an equivalent pure-Python implementation when the native module is not built, so tests and local router startup still work in lightweight environments.

## Defaults

- `n_tokens`: `8192`
- `n_experts`: `32`
- `k`: `2`
- `base_density`: `0.3`

## Modes

- `phase_topk(scores, k=2, base_density=0.3)`: standard top-k with deterministic phase balancing and structural capacity caps.
- `uniform_dispatch(n_tokens=8192, n_experts=32, k=2)`: equal-capacity fast path with exact round-robin phase assignment.

## Build

```bash
python -m pip install maturin
maturin develop --manifest-path apps/agents/router/phase_router/Cargo.toml
```

## Test

```bash
python -m unittest apps.agents.router.phase_router.tests.test_phase_router
```

