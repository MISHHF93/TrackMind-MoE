import type { TrackMapDto } from '../../types.js';

const layerLabels: Record<string, string> = { sector: 'Sectors', gate: 'Starting gates', rail: 'Rail positions', barn: 'Barns', facility: 'Facilities', camera: 'Cameras', emergency: 'Emergency resources', measurement: 'Surface measurements', incident: 'Incidents', maintenance: 'Maintenance', workforce: 'Workforce', twin: 'Digital Twin', simulation: 'Simulation' };

export function TrackMap({ map }: { map: TrackMapDto }) {
  const advanced = map.geospatial;
  return <section aria-label="Track map">
    <h2>Track Map {map.mock && '(mock)'}</h2>
    <p>Race distance: {map.distanceMeters}m · Starting gate: {map.startingGate.sectorId} at {map.startingGate.metersFromStart}m</p>
    {advanced && <div aria-label="Digital Twin geospatial operations">
      <p>Viewport zoom {advanced.viewport.zoom} · overlays {advanced.overlays.filter((overlay)=>overlay.visible).length}/{advanced.overlays.length} visible · playback frames {advanced.playback.length}</p>
      <div aria-label="Map controls"><span>Zoom presets: {advanced.controls.zoom.presets.join(', ')}</span><span> · Filters: {advanced.controls.filters.join(', ')}</span><span> · Modes: {advanced.controls.overlayModes.join(', ')}</span></div>
      <div aria-label="Map overlay legend">{advanced.overlays.map((overlay)=><span key={overlay.id}>{layerLabels[overlay.layer] ?? overlay.name} ({Math.round(overlay.opacity * 100)}%) </span>)}</div>
      <div aria-label="Digital Twin state visualization">{advanced.digitalTwinState.map((twin)=><article key={twin.twinId}><h3>{twin.twinId}</h3><p>{twin.health} · v{twin.version} · {twin.lastUpdatedAt}</p></article>)}</div>
      <div aria-label="Simulation overlays">{advanced.simulationOverlays.map((simulation)=><article key={simulation.id}><h3>{simulation.scenario}</h3><p>Risk {simulation.riskDelta} · approval {simulation.approvalRequired ? 'required' : 'not required'}</p></article>)}</div>
      <div aria-label="Geospatial feature list">{advanced.features.map((feature)=><article key={feature.id}><h3>{feature.label}</h3><p>{layerLabels[feature.layer] ?? feature.layer} · {feature.status} · {feature.source}</p></article>)}</div>
    </div>}
    <div>{map.sectors.map((s)=><article key={s.id}><h3>{s.name}</h3><p>{s.startMeters}-{s.endMeters}m · {s.condition}</p><ul>{map.measurements.filter(m=>m.sectorId===s.id).map(m=><li key={m.sectorId}>Moisture {m.moisture}% · Compaction {m.compaction}</li>)}{map.assets.filter(a=>a.sectorId===s.id).map(a=><li key={a.id}>{a.label} ({a.type}) · {a.status}</li>)}</ul></article>)}</div>
  </section>;
}
