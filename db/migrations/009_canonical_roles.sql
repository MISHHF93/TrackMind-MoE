-- Canonical TrackMind Nexus role normalization (20 personas + ai-safety-agent)
-- Migrates legacy role slugs in trackmind.users.roles[] to canonical values.

CREATE TABLE IF NOT EXISTS trackmind.role_aliases (
  legacy_slug text PRIMARY KEY,
  canonical_slug text NOT NULL,
  migrated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO trackmind.role_aliases (legacy_slug, canonical_slug) VALUES
  ('admin', 'platform-super-admin'),
  ('operations-admin', 'organization-admin'),
  ('racing-secretary', 'horse-operations-coordinator'),
  ('track-superintendent', 'facilities-manager'),
  ('security', 'security-manager'),
  ('finance', 'finance-manager'),
  ('ticketing-manager', 'ticketing-fan-manager'),
  ('welfare-officer', 'equine-welfare-officer'),
  ('facilities-supervisor', 'facilities-manager'),
  ('incident-commander', 'race-day-operations-manager')
ON CONFLICT (legacy_slug) DO NOTHING;

UPDATE trackmind.users u
SET roles = (
  SELECT array_agg(DISTINCT COALESCE(a.canonical_slug, r))
  FROM unnest(u.roles) AS r
  LEFT JOIN trackmind.role_aliases a ON a.legacy_slug = r
)
WHERE u.roles IS NOT NULL;

COMMENT ON TABLE trackmind.role_aliases IS 'Audit lookup for legacy-to-canonical role slug migration.';
