# Architecture

TrackMind-MoE combines a PostgreSQL operational store, race-day event bus, expert-agent stubs, digital twin, IoT ingestion, rulebook RAG interface, React dashboard, and Azure deployment baseline. Critical AI outputs are recommendations until human approval is recorded.

## Build intent

See `docs/TRACKMIND_BUILD_INTENT.md` for the current platform build intent, including the product vision, safety boundaries, human-approval requirements, Digital Twin/event/audit/workflow/rules/AI governance model, and phased roadmap. See `docs/TRACKMIND_IMPLEMENTATION_PLAN.md` for the incremental execution plan that maps the intent into repository workstreams.
