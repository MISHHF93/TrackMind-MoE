-- Nexus Platform Expansion (Prompts 03-20) persistence targets

CREATE TABLE IF NOT EXISTS trackmind.marketplace_enablements (
  organization_id   TEXT NOT NULL,
  tenant_id         TEXT NOT NULL,
  module_key        TEXT NOT NULL,
  enabled           BOOLEAN NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, tenant_id, module_key)
);

CREATE TABLE IF NOT EXISTS trackmind.white_label_branding (
  organization_id   TEXT NOT NULL,
  tenant_id         TEXT NOT NULL DEFAULT '',
  product_name      TEXT NOT NULL,
  primary_color     TEXT NOT NULL,
  accent_color      TEXT NOT NULL,
  logo_url          TEXT,
  favicon_url       TEXT,
  custom_domain     TEXT,
  support_email     TEXT,
  login_banner_text TEXT,
  experience_theme  TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS trackmind.report_jobs (
  job_id            TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL,
  template_id       TEXT NOT NULL,
  status            TEXT NOT NULL,
  format            TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);
