-- Enterprise customer management platform
-- All records are organization-scoped with strict tenant isolation.

CREATE TABLE IF NOT EXISTS trackmind.enterprise_customers (
  customer_id           TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL REFERENCES trackmind.organizations(organization_id),
  tenant_id             TEXT REFERENCES trackmind.tenants(tenant_id),
  legal_name            TEXT NOT NULL,
  display_name          TEXT NOT NULL,
  industry              TEXT NOT NULL,
  region                TEXT NOT NULL,
  lifecycle_status      TEXT NOT NULL CHECK (lifecycle_status IN ('prospect', 'onboarding', 'active', 'at-risk', 'churned', 'suspended')),
  support_tier_id       TEXT NOT NULL,
  subscription_plan_id  TEXT,
  account_owner_id      TEXT,
  success_manager_id    TEXT,
  primary_contact_id    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_customers_org ON trackmind.enterprise_customers(organization_id);

CREATE TABLE IF NOT EXISTS trackmind.customer_contacts (
  contact_id        TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL,
  customer_id       TEXT NOT NULL REFERENCES trackmind.enterprise_customers(customer_id),
  tenant_id         TEXT,
  full_name         TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT,
  role              TEXT NOT NULL,
  is_primary        BOOLEAN NOT NULL DEFAULT FALSE,
  status            TEXT NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_org ON trackmind.customer_contacts(organization_id, customer_id);

CREATE TABLE IF NOT EXISTS trackmind.customer_contracts (
  contract_id         TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL,
  customer_id         TEXT NOT NULL REFERENCES trackmind.enterprise_customers(customer_id),
  tenant_id           TEXT,
  contract_number     TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  status              TEXT NOT NULL,
  plan_id             TEXT,
  support_tier_id     TEXT NOT NULL,
  value_usd           NUMERIC NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'USD',
  effective_date      TIMESTAMPTZ NOT NULL,
  expiration_date     TIMESTAMPTZ NOT NULL,
  auto_renew          BOOLEAN NOT NULL DEFAULT TRUE,
  signed_by_contact_id TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_contracts_org ON trackmind.customer_contracts(organization_id, customer_id);

CREATE TABLE IF NOT EXISTS trackmind.racetrack_portfolios (
  portfolio_id          TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL,
  customer_id           TEXT NOT NULL REFERENCES trackmind.enterprise_customers(customer_id),
  tenant_id             TEXT NOT NULL,
  name                  TEXT NOT NULL,
  jurisdiction          TEXT NOT NULL,
  operational_status    TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trackmind.portfolio_racetracks (
  portfolio_id    TEXT NOT NULL REFERENCES trackmind.racetrack_portfolios(portfolio_id),
  racetrack_id    TEXT NOT NULL,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (portfolio_id, racetrack_id)
);

CREATE TABLE IF NOT EXISTS trackmind.customer_success_plans (
  plan_id               TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL,
  customer_id           TEXT NOT NULL REFERENCES trackmind.enterprise_customers(customer_id),
  tenant_id             TEXT,
  success_manager_id    TEXT NOT NULL,
  success_manager_name  TEXT NOT NULL,
  health_score          INTEGER NOT NULL,
  health_band           TEXT NOT NULL,
  adoption_score        INTEGER NOT NULL,
  next_review_at        TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trackmind.customer_onboarding_workflows (
  workflow_id             TEXT PRIMARY KEY,
  organization_id         TEXT NOT NULL,
  customer_id             TEXT NOT NULL REFERENCES trackmind.enterprise_customers(customer_id),
  tenant_id               TEXT,
  racetrack_id            TEXT,
  workflow_template_id    TEXT NOT NULL,
  status                  TEXT NOT NULL,
  steps                   JSONB NOT NULL,
  started_at              TIMESTAMPTZ NOT NULL,
  completed_at            TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_onboarding_org ON trackmind.customer_onboarding_workflows(organization_id, customer_id);
