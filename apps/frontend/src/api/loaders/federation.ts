import type { FederationWorkspaceDto } from '@trackmind/shared';
import { getJson } from '../client';
import { apiPaths } from '../paths';
import type { ConsolePayload } from '../../design/opsTypes';
import { loadSharedContext } from './commonContext';
import { countBarChart, postureBreakdownDonut } from './charts';
import { compactLifecycleLanes, recordsLifecycleLane } from './lifecycle';
import { countMetric, navAction, requireReady, textMetric } from './util';

export async function loadFederationConsole(): Promise<ConsolePayload> {
  const [federation, shared] = await Promise.all([
    getJson<FederationWorkspaceDto>(apiPaths.federation.workspace),
    loadSharedContext(),
  ]);
  const data = requireReady(federation, 'Federation workspace');
  const posture = data.rawDataExposure.exposed ? 'critical' : 'ready';

  const trackLifecycleLane = recordsLifecycleLane(
    'federation-track-lifecycle',
    'Federation track lifecycle',
    'Member track certification and sharing posture — aggregate-only federation contract.',
    data.tracks.map((track) => ({
      id: track.racetrackId,
      label: track.displayName,
      status: track.certificationStatus,
      summary: `${track.sharingScope} · ${track.dataResidency}`,
      evidence: [track.schemaVersion, track.tenantId],
      actions: [navAction('Compliance review', '/compliance', 'Track certification posture.')],
    })),
  );

  const certificationCounts = data.tracks.reduce<Record<string, number>>((counts, track) => {
    counts[track.certificationStatus] = (counts[track.certificationStatus] ?? 0) + 1;
    return counts;
  }, {});
  const sharingScopeCounts = data.tracks.reduce<Record<string, number>>((counts, track) => {
    counts[track.sharingScope] = (counts[track.sharingScope] ?? 0) + 1;
    return counts;
  }, {});

  const policyLifecycleLane = recordsLifecycleLane(
    'federation-policy-lifecycle',
    'Federation policy lifecycle',
    'Tenant sharing policy and certification readiness from federation workspace.',
    [{
      id: data.dataSharingPolicy.policyId,
      label: data.tenant.displayName,
      status: data.tenant.certificationStatus,
      summary: `${data.dataSharingPolicy.scope} sharing · approval required`,
      evidence: data.tenant.certificationEvidence,
      actions: [navAction('Data governance', '/data-hub', 'Review export controls for federation sharing.')],
    }],
  );

  return {
    routeId: 'federation',
    title: 'Federation Readiness',
    mission: 'Compare aggregate track readiness across the network — raw cross-track export stays prohibited.',
    posture,
    postureLabel: data.rawDataExposure.exposed ? 'Raw exposure flagged' : 'Aggregate-only sharing',
    source: federation.source,
    primaryActions: [
      navAction('Data governance', '/data-hub', 'Provider export controls.', 'primary'),
      navAction('Compliance lane', '/compliance', 'Certification evidence.'),
      navAction('Audit trail', '/audit', 'Sharing policy audit.'),
    ],
    lifecycleLanes: compactLifecycleLanes([trackLifecycleLane, policyLifecycleLane]),
    charts: [
      countBarChart(
        'track-certification-bar',
        'Track certification status',
        'Federation member tracks grouped by certification readiness.',
        Object.entries(certificationCounts).map(([label, value]) => ({
          id: `cert-${label}`,
          label,
          value,
          posture: label === 'blocked' ? 'blocked' : label === 'action-required' ? 'watch' : label === 'ready-for-trackmind-review' ? 'ready' : 'advisory',
        })),
        'tracks',
        navAction('Compliance lane', '/compliance', 'Certification evidence.'),
      ),
      postureBreakdownDonut(
        'federation-policy-donut',
        'Policy posture',
        sharingScopeCounts,
        {
          'tenant-only': 'ready',
          'federation-aggregate': 'advisory',
          'industry-anonymized': 'advisory',
        },
        navAction('Data governance', '/data-hub', 'Review export controls for federation sharing.'),
      ),
    ],
    queues: [
      {
        id: 'track-profiles',
        title: 'Federation profiles',
        items: data.tracks.map((track) => ({
          id: track.racetrackId,
          title: track.displayName,
          summary: `${track.sharingScope} · ${track.certificationStatus}`,
          posture: track.certificationStatus === 'blocked' ? 'blocked' : 'ready',
          evidence: [track.schemaVersion, track.tenantId],
          actions: [navAction('Compliance review', '/compliance', 'Track certification posture.')],
        })),
      },
    ],
    metrics: [
      countMetric('Track profiles', data.tracks.length, 'Federation member tracks', 'ready'),
      textMetric('Raw exposure', data.rawDataExposure.exposed ? 'Detected' : 'None', 'Cross-track raw data boundary', posture),
      countMetric('Benchmarks', data.crossTrackBenchmarking.metrics.length, 'Anonymized benchmarks only', 'ready'),
    ],
    advisories: shared.advisories,
    contextDegraded: shared.contextDegraded,
  };
}
