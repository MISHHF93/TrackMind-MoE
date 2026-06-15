BEGIN;

INSERT INTO trackmind.kpi_definitions (
  kpi_id, tenant_id, organization_id, racetrack_id, domain, name, description,
  metric_type, unit, target, calculation_method, refresh_cadence, owner_role,
  visibility, approval_sensitivity, model_readable, version
) VALUES
  ('kpi-race-day-operations','trackmind','org-trackmind-network','main-track','race-day-operations','Race-day readiness score','Seed KPI definition over race-day readiness facade events.','score','score',90,'Readiness score minus warning and approval penalties.','5m','steward','tenant-internal','regulated-advisory-only',true,'1.0.1'),
  ('kpi-equine-welfare','trackmind','org-trackmind-network','main-track','equine-welfare','Equine welfare review coverage','Veterinary-scoped welfare review coverage KPI.','percentage','%',95,'Coverage of welfare observations that have review evidence.','5m','veterinarian','veterinary-restricted','regulated-advisory-only',false,'1.0.2'),
  ('kpi-safety-incidents','trackmind','org-trackmind-network','main-track','safety-incidents','Open safety incident pressure','Incident pressure KPI from security and emergency event references.','score','pressure',25,'Weighted count of open incident signals.','5m','security','tenant-internal','approval-visible',true,'1.0.3'),
  ('kpi-stewarding','trackmind','org-trackmind-network','main-track','stewarding','Steward evidence readiness','Evidence readiness before any human-only steward ruling.','score','score',90,'Evidence item coverage across inquiry source events.','5m','steward','tenant-internal','regulated-advisory-only',true,'1.0.4'),
  ('kpi-compliance','trackmind','org-trackmind-network','main-track','compliance','Compliance control mapping readiness','Readiness KPI for mapped compliance controls; not certification.','score','score',85,'Mapped evidence refs divided by required readiness controls.','1h','compliance-officer','tenant-internal','approval-visible',true,'1.0.5'),
  ('kpi-security','trackmind','org-trackmind-network','main-track','security','Security operations coverage','Coverage KPI for zones, cameras, sensors, and security incidents.','percentage','%',95,'Visible security asset coverage over required operational assets.','5m','security','restricted','approval-visible',true,'1.0.6'),
  ('kpi-facilities','trackmind','org-trackmind-network','main-track','facilities','Facilities readiness metadata','Mock/facade facilities readiness KPI definition.','readiness','score',85,'Facade facilities readiness score; no durable work-order claim.','15m','track-superintendent','tenant-internal','approval-visible',true,'1.0.7'),
  ('kpi-ticketing','trackmind','org-trackmind-network','main-track','ticketing','Ticketing contract readiness','Readiness-only KPI for ticketing contract coverage.','readiness','score',80,'Documented route/type/database support coverage.','1h','ticketing-manager','tenant-internal','none',true,'1.0.8'),
  ('kpi-finance','trackmind','org-trackmind-network','main-track','finance','Finance settlement readiness','Readiness-only KPI for payout approval posture; no ledger claim.','readiness','score',80,'Approval workflow readiness for protected payout actions.','1h','finance','tenant-internal','regulated-advisory-only',true,'1.0.9'),
  ('kpi-fan-experience','trackmind','org-trackmind-network','main-track','fan-experience','Fan experience signal readiness','Readiness-only KPI for future fan experience signals.','readiness','score',80,'Documented readiness evidence coverage only.','1h','ticketing-manager','tenant-internal','none',true,'1.0.10'),
  ('kpi-racing-data-hub','trackmind','org-trackmind-network','main-track','racing-data-hub','Provider adapter readiness','Racing Data Hub provider, quality, lineage, and policy readiness.','score','score',90,'Provider registry plus lineage and data quality facade coverage.','15m','compliance-officer','tenant-internal','approval-visible',true,'1.0.11'),
  ('kpi-multi-track-federation','trackmind','org-trackmind-network',NULL,'multi-track-federation','Federated aggregate safety readiness','Aggregate-only federation KPI with no raw cross-track rows.','score','score',85,'Aggregate metadata readiness over anonymized federation descriptors.','1h','compliance-officer','federation-aggregate','approval-visible',true,'1.0.12'),
  ('kpi-ai-governance','trackmind','org-trackmind-network','main-track','ai-governance','AI recommendation governance completeness','Completeness of AI evidence, approval, audit, and model metadata.','percentage','%',95,'Valid governed AI recommendation envelope coverage.','5m','compliance-officer','tenant-internal','approval-visible',true,'1.0.13'),
  ('kpi-audit-integrity','trackmind','org-trackmind-network','main-track','audit-integrity','Audit hash-chain visibility','Hash-chain and evidence reference visibility KPI.','percentage','%',100,'Audit references with hash/evidence links over visible audit records.','5m','read-only-auditor','tenant-internal','approval-visible',true,'1.0.14'),
  ('kpi-approval-workflows','trackmind','org-trackmind-network','main-track','approval-workflows','Approval workflow traceability','Traceability KPI for approvals, evidence, events, and audit refs.','percentage','%',95,'Approval records with event and audit references.','5m','compliance-officer','tenant-internal','approval-visible',true,'1.0.15'),
  ('kpi-tenant-operations','trackmind','org-trackmind-network','main-track','tenant-operations','Tenant scope readiness','Readiness KPI for tenant/racetrack scoping metadata.','score','score',90,'Scope metadata coverage; not proof of global RLS.','1h','admin','restricted','approval-visible',true,'1.0.16'),
  ('kpi-system-health','trackmind','org-trackmind-network','main-track','system-health','Platform health score','Platform health KPI from backend facade health metadata.','score','score',95,'Service status and latency facade score.','1m','admin','tenant-internal','none',true,'1.0.17'),
  ('kpi-data-quality','trackmind','org-trackmind-network','main-track','data-quality','Data quality readiness','Data quality KPI from data hub and feature placeholder metadata.','score','score',90,'Quality reports and feature record completeness.','15m','compliance-officer','tenant-internal','approval-visible',true,'1.0.18'),
  ('kpi-veterinary-privacy','trackmind','org-trackmind-network','main-track','veterinary-privacy','Veterinary privacy guardrail coverage','Restricted KPI for veterinary privacy scope enforcement.','percentage','%',100,'Privacy filtering evidence coverage for equine endpoints.','15m','veterinarian','veterinary-restricted','regulated-advisory-only',false,'1.0.19'),
  ('kpi-deployment-readiness','trackmind','org-trackmind-network','main-track','deployment-readiness','Deployment readiness evidence score','Readiness KPI from build/test/performance artifact evidence.','score','score',95,'Verification artifact coverage over expected release gates.','1h','admin','tenant-internal','approval-visible',true,'1.0.20')
ON CONFLICT (kpi_id) DO NOTHING;

WITH seeded_kpis(kpi_id) AS (
  VALUES
    ('kpi-race-day-operations'), ('kpi-equine-welfare'), ('kpi-safety-incidents'),
    ('kpi-stewarding'), ('kpi-compliance'), ('kpi-security'), ('kpi-facilities'),
    ('kpi-ticketing'), ('kpi-finance'), ('kpi-fan-experience'), ('kpi-racing-data-hub'),
    ('kpi-multi-track-federation'), ('kpi-ai-governance'), ('kpi-audit-integrity'),
    ('kpi-approval-workflows'), ('kpi-tenant-operations'), ('kpi-system-health'),
    ('kpi-data-quality'), ('kpi-veterinary-privacy'), ('kpi-deployment-readiness')
),
threshold_seed AS (
  SELECT
    d.*,
    md5('trackmind:kpi-threshold:' || d.kpi_id || ':' || d.tenant_id || ':' || coalesce(d.racetrack_id, '__federation__')) AS h
  FROM trackmind.kpi_definitions d
  JOIN seeded_kpis s USING (kpi_id)
)
INSERT INTO trackmind.kpi_thresholds (
  threshold_id, kpi_id, tenant_id, racetrack_id, warning, critical,
  target_direction, description, effective_from, created_at
)
SELECT
  (substr(h,1,8) || '-' || substr(h,9,4) || '-' || substr(h,13,4) || '-' || substr(h,17,4) || '-' || substr(h,21,12))::uuid,
  kpi_id,
  tenant_id,
  racetrack_id,
  CASE WHEN kpi_id = 'kpi-safety-incidents' THEN target * 1.15 ELSE target * 0.85 END,
  CASE WHEN kpi_id = 'kpi-safety-incidents' THEN target * 1.50 ELSE target * 0.65 END,
  CASE WHEN kpi_id = 'kpi-safety-incidents' THEN 'below' ELSE 'above' END,
  'Seed threshold; changes require audit and approval-sensitivity review.',
  '2026-06-14T00:12:00Z',
  '2026-06-14T00:12:00Z'
FROM threshold_seed
ON CONFLICT (threshold_id) DO NOTHING;

COMMIT;
