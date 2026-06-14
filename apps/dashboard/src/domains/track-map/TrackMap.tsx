import type { CSSProperties } from 'react';
import type { GeospatialFeatureDto, GeospatialLayerDto, GeospatialMapDto, TrackMapDto } from '../../types.js';

type LayerGroup = { label: string; layers: GeospatialLayerDto[]; empty: string };
export type TrackMapRouteContext = 'track-configuration' | 'digital-twin' | 'starting-gate';

type CoverageItem = {
  label: string;
  ariaLabel: string;
  count: number;
  detail: string;
};

const routeContextCopy: Record<TrackMapRouteContext, { title: string; label: string; description: string }> = {
  'track-configuration': {
    title: 'Track Configuration Map',
    label: 'Track Configuration map route context',
    description: 'Canonical route for race distance, sector, gate, rail, turf, work-order, verification, approval, audit, and Digital Twin sync context.',
  },
  'digital-twin': {
    title: 'Digital Twin Track Map',
    label: 'Digital Twin map route context',
    description: 'Reusable read-only map panel for runtime twins, asset relationships, playback, and simulation overlays without local patch controls.',
  },
  'starting-gate': {
    title: 'Starting Gate Track Map',
    label: 'Starting Gate map route context',
    description: 'Reusable gate-position map panel for current placement, target placement, GPS verification, draft work order, and approval status.',
  },
};
type TokenizedVisualStyle = CSSProperties & Record<`--tm-${string}`, string | number>;

const layerLabels: Record<string, string> = {
  sector: 'Sectors',
  gate: 'Starting gates',
  'starting-gate': 'Starting gates',
  rail: 'Rail positions',
  barn: 'Barns',
  stall: 'Stalls',
  facility: 'Facilities',
  camera: 'Cameras',
  emergency: 'Emergency assets',
  'emergency-resource': 'Emergency assets',
  measurement: 'Surface measurements',
  'surface-measurement': 'Surface measurements',
  'surface-heatmap': 'Surface heatmap cells',
  incident: 'Incidents',
  maintenance: 'Maintenance zones',
  workforce: 'Workforce',
  asset: 'Assets',
  telemetry: 'Telemetry',
  twin: 'Digital Twin',
  'digital-twin': 'Digital Twin',
  simulation: 'Simulation',
};

const mapLayerGroups: LayerGroup[] = [
  { label: 'Track sectors', layers: ['sector'], empty: 'No sector features published.' },
  { label: 'Starting gate and rail positions', layers: ['gate', 'starting-gate', 'rail'], empty: 'No gate or rail positions published.' },
  { label: 'Barn stall and facility markers', layers: ['barn', 'stall', 'facility'], empty: 'No barn, stall, or facility markers published.' },
  { label: 'Camera emergency incident markers', layers: ['camera', 'emergency', 'emergency-resource', 'incident'], empty: 'No camera, emergency, or incident markers published.' },
  { label: 'Maintenance and workforce zones', layers: ['maintenance', 'workforce'], empty: 'No maintenance or workforce zones published.' },
  { label: 'Sensor and surface measurement overlays', layers: ['measurement', 'surface-measurement', 'asset', 'telemetry'], empty: 'No sensor or surface measurement overlays published.' },
  { label: 'Surface heatmap overlays', layers: ['surface-heatmap'], empty: 'No surface heatmap cells published.' },
  { label: 'Digital Twin and simulation overlays', layers: ['twin', 'digital-twin', 'simulation'], empty: 'No Digital Twin or simulation overlays published.' },
];

const markerGlyphs: Record<string, string> = {
  sector: 'S',
  gate: 'G',
  'starting-gate': 'G',
  rail: 'R',
  barn: 'B',
  stall: 'St',
  facility: 'F',
  camera: 'C',
  emergency: 'E',
  'emergency-resource': 'E',
  measurement: 'M',
  'surface-measurement': 'M',
  'surface-heatmap': 'H',
  incident: 'I',
  maintenance: 'W',
  workforce: 'P',
  twin: 'T',
  'digital-twin': 'T',
  simulation: 'Sim',
};

const safeId = (value: string) => value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
const clamp = (value: number) => Math.max(4, Math.min(96, value));
const meterPercent = (meters: number, trackDistanceMeters: number) => clamp((meters / Math.max(1, trackDistanceMeters)) * 100);
const formatValue = (value: unknown) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : JSON.stringify(value);
const labelForLayer = (layer: string) => layerLabels[layer] ?? layer.replace(/-/g, ' ');
const featuresForLayers = (features: GeospatialFeatureDto[], layers: GeospatialLayerDto[]) => features.filter((feature) => layers.includes(feature.layer));
const countForLayers = (features: GeospatialFeatureDto[], layers: GeospatialLayerDto[]) => featuresForLayers(features, layers).length;
const tokenizedVisualStyle = (properties: TokenizedVisualStyle): TokenizedVisualStyle => properties;
const sectorRingStyle = (sectorCount: number) => tokenizedVisualStyle({ '--tm-track-sector-count': Math.max(1, sectorCount) });
const sectorPillStyle = (startMeters: number, endMeters: number) => tokenizedVisualStyle({ '--tm-track-sector-height': `${Math.max(4, endMeters - startMeters) / 20}rem` });
const markerHorizontalStyle = (meters: number, trackDistanceMeters: number) => tokenizedVisualStyle({ '--tm-map-marker-left': `${meterPercent(meters, trackDistanceMeters)}%` });

export type GatePlanOverlay = {
  raceId: string;
  currentSectorId: string;
  currentMetersFromStart: number;
  targetSectorId: string;
  targetMetersFromStart: number;
  deltaMeters: number;
  gpsVerified: boolean;
  approvalRequired: boolean;
  workOrderId: string;
};

function overlayVisible(map: GeospatialMapDto, layer: GeospatialLayerDto) {
  return map.overlays.find((overlay) => overlay.layer === layer)?.visible ?? true;
}

function positionForFeature(feature: GeospatialFeatureDto, map: GeospatialMapDto) {
  const { bounds } = map.viewport;
  const longitudeSpan = bounds.east - bounds.west || 1;
  const latitudeSpan = bounds.north - bounds.south || 1;
  return {
    '--tm-map-marker-left': `${clamp(((feature.coordinates.longitude - bounds.west) / longitudeSpan) * 100)}%`,
    '--tm-map-marker-top': `${clamp(((bounds.north - feature.coordinates.latitude) / latitudeSpan) * 100)}%`,
  };
}

function featureMarkerStyle(feature: GeospatialFeatureDto, map: GeospatialMapDto) {
  return tokenizedVisualStyle({
    ...positionForFeature(feature, map),
    '--tm-map-marker-opacity': map.overlays.find((overlay) => overlay.layer === feature.layer)?.opacity ?? 1,
  });
}

function FeatureDetails({ feature }: { feature: GeospatialFeatureDto }) {
  const properties = Object.entries(feature.properties);
  return <article className="focus-card" tabIndex={0} aria-label={`${feature.label} map feature`} data-layer={feature.layer} data-status={feature.status}>
    <strong>{feature.label}</strong>
    <p>Layer: {labelForLayer(feature.layer)}; status: {feature.status}; source: {feature.source}</p>
    <p>Coordinates: {feature.coordinates.latitude}, {feature.coordinates.longitude}</p>
    {properties.length > 0 && <dl>{properties.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{formatValue(value)}</dd></div>)}</dl>}
  </article>;
}

function coverageItems(map: TrackMapDto, features: GeospatialFeatureDto[], gatePlan?: GatePlanOverlay): CoverageItem[] {
  return [
    { label: 'Track sectors', ariaLabel: 'Track sectors overlay coverage', count: map.sectors.length || countForLayers(features, ['sector']), detail: `${map.sectors.length} configured sector cards with distance ranges and conditions.` },
    { label: 'Starting gate position', ariaLabel: 'Starting gate position overlay coverage', count: countForLayers(features, ['gate', 'starting-gate']) + (gatePlan ? 2 : 1), detail: `Configured gate ${map.startingGate.sectorId} at ${map.startingGate.metersFromStart}m${gatePlan ? `; target ${gatePlan.targetSectorId} at ${gatePlan.targetMetersFromStart}m` : ''}.` },
    { label: 'Rail positions', ariaLabel: 'Rail positions overlay coverage', count: countForLayers(features, ['rail']), detail: map.trackConfiguration?.railPosition ? `${map.trackConfiguration.railPosition.railId} offset ${map.trackConfiguration.railPosition.offsetMeters}m; protected turns ${map.trackConfiguration.railPosition.protectedTurns.join(', ')}.` : 'Rail feed comes from geospatial features when present.' },
    { label: 'Turf configuration', ariaLabel: 'Turf configuration overlay coverage', count: map.trackConfiguration?.turfConfiguration ? 1 : countForLayers(features, ['sector']), detail: map.trackConfiguration?.turfConfiguration ? `Lane ${map.trackConfiguration.turfConfiguration.lane}; going ${map.trackConfiguration.turfConfiguration.going}; irrigation ${map.trackConfiguration.turfConfiguration.irrigationMillimeters}mm; mowing ${map.trackConfiguration.turfConfiguration.mowingHeightMillimeters}mm.` : 'Turf configuration not published in this DTO.' },
    { label: 'Barns', ariaLabel: 'Barn overlay coverage', count: countForLayers(features, ['barn']), detail: 'Barn markers come from asset registry or Digital Twin map features.' },
    { label: 'Stalls', ariaLabel: 'Stall overlay coverage', count: countForLayers(features, ['stall']), detail: 'Stall cards are keyboard-readable and include occupancy properties when available.' },
    { label: 'Facilities', ariaLabel: 'Facility overlay coverage', count: countForLayers(features, ['facility']), detail: 'Facility markers include readiness, inspection, and asset health properties when published.' },
    { label: 'Cameras', ariaLabel: 'Camera overlay coverage', count: countForLayers(features, ['camera']), detail: 'Camera markers are read-only situational awareness overlays.' },
    { label: 'Sensors', ariaLabel: 'Sensor overlay coverage', count: countForLayers(features, ['measurement', 'surface-measurement', 'asset', 'telemetry']) + map.assets.filter((asset) => asset.type === 'sensor').length, detail: 'Sensor cards combine asset markers, surface measurements, and telemetry overlays.' },
    { label: 'Emergency resources', ariaLabel: 'Emergency resources overlay coverage', count: countForLayers(features, ['emergency', 'emergency-resource']), detail: 'Emergency resources are shown for awareness only; dispatch remains outside this map.' },
    { label: 'Incidents', ariaLabel: 'Incident overlay coverage', count: countForLayers(features, ['incident']), detail: 'Incident markers route operators to governed security or emergency workflows.' },
    { label: 'Maintenance zones', ariaLabel: 'Maintenance zones overlay coverage', count: countForLayers(features, ['maintenance', 'workforce']), detail: 'Maintenance and workforce zones display work state without issuing work locally.' },
    { label: 'Surface overlays', ariaLabel: 'Surface overlays coverage', count: countForLayers(features, ['measurement', 'surface-measurement', 'surface-heatmap', 'telemetry']) + map.measurements.length, detail: 'Surface overlays include moisture, compaction, drainage, telemetry, and heatmap cells.' },
  ];
}

export function TrackMap({ map, gatePlan, routeContext = 'track-configuration' }: { map: TrackMapDto; gatePlan?: GatePlanOverlay; routeContext?: TrackMapRouteContext }) {
  const advanced = map.geospatial;
  const visibleFeatures = advanced ? advanced.features.filter((feature) => overlayVisible(advanced, feature.layer)) : [];
  const allFeatures = advanced?.features ?? [];
  const gateFeatures = advanced ? featuresForLayers(advanced.features, ['gate', 'starting-gate']) : [];
  const railFeatures = advanced ? featuresForLayers(advanced.features, ['rail']) : [];
  const context = routeContextCopy[routeContext];
  const coverage = coverageItems(map, allFeatures, gatePlan);
  return <section className="track-map" aria-label="Track map" aria-describedby="track-map-keyboard-help" data-map-implementation="shared-track-map" data-map-source="/api/v1/track-configuration/map" data-route-context={routeContext}>
    <h2>{context.title} {map.mock && '(mock)'}</h2>
    <p aria-label={context.label}>{context.description}</p>
    <p id="track-map-keyboard-help">Keyboard map: use Tab to move through sector cards, overlay summaries, map markers, Digital Twin state, simulations, and geospatial features. Each focused card repeats status in text.</p>
    <p>Race distance: {map.distanceMeters}m · Starting gate: {map.startingGate.sectorId} at {map.startingGate.metersFromStart}m</p>
    <nav className="jump-links" aria-label="Track map keyboard shortcuts">
      {map.trackConfiguration && <a href="#track-configuration-plan">Jump to track configuration plan</a>}
      {gatePlan && <a href="#starting-gate-plan-overlay">Jump to starting gate plan overlay</a>}
      <a href="#track-map-sectors">Jump to sectors</a>
      {advanced && <a href="#track-map-overlays">Jump to overlays</a>}
      <a href="#track-map-coverage">Jump to overlay coverage</a>
      {advanced && <a href="#track-map-canvas">Jump to map layout</a>}
      {advanced && <a href="#track-map-features">Jump to features</a>}
    </nav>
    {gatePlan && <section id="starting-gate-plan-overlay" aria-label="Starting gate move target overlay">
      <h3>Starting gate move target overlay</h3>
      <p>Race {gatePlan.raceId}: current {gatePlan.currentSectorId} {gatePlan.currentMetersFromStart}m, target {gatePlan.targetSectorId} {gatePlan.targetMetersFromStart}m, delta {gatePlan.deltaMeters === 0 ? '0m' : `${gatePlan.deltaMeters > 0 ? '+' : ''}${gatePlan.deltaMeters}m`}.</p>
      <p>Approval required {String(gatePlan.approvalRequired)}; GPS verified {String(gatePlan.gpsVerified)}; work order {gatePlan.workOrderId}. Overlay is read-only and does not mutate gate state.</p>
    </section>}
    {map.trackConfiguration && <section id="track-configuration-plan" aria-label="Track configuration control plan">
      <h3>Track configuration control plan</h3>
      <p>Measured {map.trackConfiguration.raceDistance.measuredMeters}m vs advertised {map.trackConfiguration.raceDistance.advertisedMeters}m; variance {map.trackConfiguration.raceDistance.varianceMeters}m.</p>
      <p>Approvals: {map.trackConfiguration.approvalRequirements.join(', ')}. Live actuator control available: {String(map.trackConfiguration.verificationWorkflow.actuatorControlAvailable)}.</p>
      <p>Digital Twin sync: {map.trackConfiguration.digitalTwinSync.twinId}; {map.trackConfiguration.digitalTwinSync.status}{map.trackConfiguration.digitalTwinSync.version ? `; v${map.trackConfiguration.digitalTwinSync.version}` : ''}</p>
      {map.trackConfiguration.railPosition && <p>Rail {map.trackConfiguration.railPosition.railId}: {map.trackConfiguration.railPosition.offsetMeters}m; turns {map.trackConfiguration.railPosition.protectedTurns.join(', ')}</p>}
      {map.trackConfiguration.turfConfiguration && <p>Turf lane {map.trackConfiguration.turfConfiguration.lane}: {map.trackConfiguration.turfConfiguration.going}; irrigation {map.trackConfiguration.turfConfiguration.irrigationMillimeters}mm; mowing {map.trackConfiguration.turfConfiguration.mowingHeightMillimeters}mm; resting {String(map.trackConfiguration.turfConfiguration.resting)}</p>}
      <div className="card-grid" aria-label="Track configuration work orders">{map.trackConfiguration.workOrders.map((order)=><article className="focus-card" tabIndex={0} key={order.id}><h4>{order.crew}</h4><p>Status: {order.status}; due {order.dueAt}; evidence {order.evidenceRequired.join(', ')}</p></article>)}</div>
      <div aria-label="Track configuration verification workflow"><h4>{map.trackConfiguration.verificationWorkflow.id}</h4><p>{map.trackConfiguration.verificationWorkflow.status}; twin sync {map.trackConfiguration.verificationWorkflow.digitalTwinSync}</p></div>
      <p>Events {map.trackConfiguration.events.join(', ')}; audit {map.trackConfiguration.auditIds.join(', ')}</p>
    </section>}
    <section id="track-map-coverage" aria-label="Track map overlay coverage summary">
      <h3>Overlay Coverage</h3>
      <p>All map layers are sourced from the connected TrackMap DTO and labelled for mock/live boundaries. Missing counts are shown as zero instead of creating a separate disconnected map feed.</p>
      <div className="card-grid" aria-label="Required track map overlay categories">{coverage.map((item) => <article className="focus-card" tabIndex={0} key={item.label} aria-label={item.ariaLabel} data-count={item.count}>
        <h4>{item.label}</h4>
        <p><strong>{item.count}</strong> connected records. {item.detail}</p>
      </article>)}</div>
    </section>
    {advanced && <div className="track-map-advanced" aria-label="Digital Twin geospatial operations">
      <p>Viewport zoom {advanced.viewport.zoom} · overlays {advanced.overlays.filter((overlay)=>overlay.visible).length}/{advanced.overlays.length} visible · playback frames {advanced.playback.length}</p>
      <div className="map-controls" aria-label="Map controls"><span>Zoom presets: {advanced.controls.zoom.presets.join(', ')}</span><span>Filters: {advanced.controls.filters.join(', ')}</span><span>Modes: {advanced.controls.overlayModes.join(', ')}</span></div>
      <dl id="track-map-overlays" className="map-legend" aria-label="Map overlay legend">{advanced.overlays.map((overlay)=><div key={overlay.id} tabIndex={0} className="focus-card" data-status={overlay.visible ? 'visible' : 'hidden'}><dt><label><input type="checkbox" checked={overlay.visible} readOnly aria-label={`${labelForLayer(overlay.layer)} overlay visible`} /> {labelForLayer(overlay.layer)}</label></dt><dd>Status: {overlay.visible ? 'visible' : 'hidden'}; opacity {Math.round(overlay.opacity * 100)}%; layer {overlay.layer}</dd></div>)}</dl>
      <div id="track-map-canvas" aria-label="Interactive track map layout" role="group">
        <div aria-label="Track map semantic canvas" className="track-map-canvas">
          <ol aria-label="Track sector ring" className="track-sector-ring" style={sectorRingStyle(map.sectors.length)}>
            {map.sectors.map((sector) => <li key={sector.id} className="track-sector-pill" data-status={sector.condition} style={sectorPillStyle(sector.startMeters, sector.endMeters)}>
              <strong>{sector.name}</strong>
              <p>{sector.startMeters}-{sector.endMeters}m · {sector.condition}</p>
            </li>)}
          </ol>
          {gatePlan && <div aria-label="Starting gate current and target map markers" role="group">
            <article className="track-map-marker track-map-marker--current" aria-label="Current starting gate map marker" style={markerHorizontalStyle(gatePlan.currentMetersFromStart, map.distanceMeters)}>
              <strong>Current gate</strong>
              <p>{gatePlan.currentSectorId} · {gatePlan.currentMetersFromStart}m · GPS {gatePlan.gpsVerified ? 'verified' : 'pending'}</p>
            </article>
            <article className="track-map-marker track-map-marker--target" aria-label="Target starting gate map marker" style={markerHorizontalStyle(gatePlan.targetMetersFromStart, map.distanceMeters)}>
              <strong>Target gate</strong>
              <p>{gatePlan.targetSectorId} · {gatePlan.targetMetersFromStart}m · approval required</p>
            </article>
          </div>}
          {visibleFeatures.map((feature) => <details key={feature.id} className="track-map-marker track-map-marker--feature" aria-label={`${feature.label} marker details`} style={featureMarkerStyle(feature, advanced)}>
            <summary aria-label={`${feature.label} map marker`}><span aria-hidden="true">{markerGlyphs[feature.layer] ?? '*'}</span> {feature.label}</summary>
            <FeatureDetails feature={feature} />
          </details>)}
        </div>
      </div>
      <section aria-label="Starting gate and rail positions">
        <h3>Starting Gate and Rail</h3>
        <p>Configured gate: {map.startingGate.sectorId} at {map.startingGate.metersFromStart}m. Feature feeds: {gateFeatures.length} gate markers, {railFeatures.length} rail markers.</p>
        {gatePlan && <p>Planned target for {gatePlan.raceId}: {gatePlan.targetSectorId} at {gatePlan.targetMetersFromStart}m; request and work order remain approval-blocked.</p>}
        {[...gateFeatures, ...railFeatures].map((feature) => <FeatureDetails key={feature.id} feature={feature} />)}
      </section>
      <div id="track-map-features" className="card-grid" aria-label="Map feature layer groups">{mapLayerGroups.map((group) => {
        const groupFeatures = featuresForLayers(advanced.features, group.layers);
        return <section key={group.label} aria-label={group.label}>
          <h3>{group.label}</h3>
          {groupFeatures.length === 0 ? <p>{group.empty}</p> : groupFeatures.map((feature) => <FeatureDetails key={feature.id} feature={feature} />)}
        </section>;
      })}</div>
      <div className="card-grid" aria-label="Digital Twin state visualization">{advanced.digitalTwinState.map((twin)=><article className="focus-card" tabIndex={0} key={twin.twinId} aria-label={`${twin.twinId} health ${twin.health}`}><h3>{twin.twinId}</h3><p>Status: {twin.health}; version {twin.version}; last updated {twin.lastUpdatedAt}</p><p>Relations {twin.relationshipCount ?? 0}; dependencies {twin.dependencyCount ?? 0}; history {twin.historyEvents ?? 0}; approval {twin.approvalRequired ? 'required' : 'not required'}</p></article>)}</div>
      <div className="card-grid" aria-label="Simulation overlays">{advanced.simulationOverlays.map((simulation)=><article className="focus-card" tabIndex={0} key={simulation.id} aria-label={`${simulation.scenario} simulation overlay`}><h3>{simulation.scenario}</h3><p>SIMULATION PLACEHOLDER - read-only what-if overlay; risk delta {simulation.riskDelta}; approval {simulation.approvalRequired ? 'required' : 'not required'}</p></article>)}</div>
    </div>}
    <div id="track-map-sectors" className="card-grid" aria-label="Keyboard navigable track sectors">{map.sectors.map((s)=><article id={`sector-${safeId(s.id)}`} className="focus-card" tabIndex={0} key={s.id} aria-label={`${s.name} sector: ${s.condition}`}><h3>{s.name}</h3><p>Status: {s.condition}; range {s.startMeters}-{s.endMeters}m</p><ul>{map.measurements.filter(m=>m.sectorId===s.id).map(m=><li key={m.sectorId}>Measurement: moisture <meter min={0} max={100} value={m.moisture}>{m.moisture}%</meter>; compaction {m.compaction}; measured {m.measuredAt}</li>)}{map.assets.filter(a=>a.sectorId===s.id).map(a=><li key={a.id}>Asset: {a.label}; type {a.type}; status {a.status}</li>)}</ul></article>)}</div>
    <section aria-label="Track map approval gates">
      <h3>Approval-gated map actions</h3>
      <p data-no-live-actuator-controls="true">Map controls are read-only in this workspace. Operational changes create approval requests before any backend execution; no live actuator, gate, rail, surface, emergency dispatch, or Digital Twin patch control is mounted here.</p>
      <button type="button" disabled aria-disabled="true" aria-label="Request starting gate move approval">Request gate move approval</button>
      <button type="button" disabled aria-disabled="true" aria-label="Request rail position change approval">Request rail position approval</button>
      <button type="button" disabled aria-disabled="true" aria-label="Request surface maintenance approval">Request surface maintenance approval</button>
      <button type="button" disabled aria-disabled="true" aria-label="Request emergency asset dispatch approval">Request emergency asset dispatch approval</button>
    </section>
  </section>;
}
