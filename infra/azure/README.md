# Azure Infrastructure Baseline

This folder contains Azure-first deployment assets for TrackMind Nexus.

## Baseline modules

- Resource groups, tags, budgets, and policy assignments.
- Hub/spoke networking, private DNS, private endpoints, and managed identities.
- Azure API Management, Container Apps or AKS, Event Hubs, Service Bus, Event Grid, Key Vault, Azure Database for PostgreSQL, Cosmos DB, Azure Digital Twins, Azure Monitor, Application Insights, Log Analytics, and Sentinel.
- Environment overlays under `infra/environments` define dev, test, staging, and production configuration.

## Required tags

`tenant`, `track`, `environment`, `owner`, `dataClassification`, `costCenter`, `businessCriticality`.
