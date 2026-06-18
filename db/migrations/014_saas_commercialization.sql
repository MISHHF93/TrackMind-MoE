-- TrackMind Nexus SaaS commercialization layer
-- Subscription plans reference configuration registry; plan definitions are not stored in DB.

CREATE TABLE IF NOT EXISTS trackmind.subscription_plans (
  plan_id           TEXT PRIMARY KEY,
  tier_id           TEXT NOT NULL,
  name              TEXT NOT NULL,
  billing_interval  TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'annual')),
  config_source     TEXT NOT NULL DEFAULT 'config/saas/plans.json',
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trackmind.subscriptions (
  subscription_id       TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL REFERENCES trackmind.organizations(organization_id),
  tenant_id             TEXT REFERENCES trackmind.tenants(tenant_id),
  plan_id               TEXT NOT NULL REFERENCES trackmind.subscription_plans(plan_id),
  status                TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired')),
  billing_provider_ref  TEXT,
  current_period_start  TIMESTAMPTZ NOT NULL,
  current_period_end    TIMESTAMPTZ NOT NULL,
  trial_ends_at         TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON trackmind.subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON trackmind.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON trackmind.subscriptions(status);

CREATE TABLE IF NOT EXISTS trackmind.usage_metrics (
  usage_id          TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL,
  tenant_id         TEXT NOT NULL,
  racetrack_id      TEXT,
  metric_key        TEXT NOT NULL,
  quantity          NUMERIC NOT NULL DEFAULT 1,
  period_start      TIMESTAMPTZ NOT NULL,
  period_end        TIMESTAMPTZ NOT NULL,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_scope ON trackmind.usage_metrics(organization_id, tenant_id, metric_key, period_start);

CREATE TABLE IF NOT EXISTS trackmind.entitlement_overrides (
  override_id       TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL,
  tenant_id         TEXT,
  feature_key       TEXT NOT NULL,
  enabled           BOOLEAN NOT NULL,
  reason            TEXT,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
