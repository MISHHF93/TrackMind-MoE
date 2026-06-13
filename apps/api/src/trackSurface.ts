export interface GeoReading { latitude: number; longitude: number; moisture: number; observedAt: string }
export interface SurfacePhysicsInput { moisture: number; compaction: number; depth: number; temperature: number; rainfall: number; maintenanceHoursAgo: number }

export function buildMoistureHeatmap(readings: GeoReading[], precision = 4) {
  const cells = new Map<string, { total: number; count: number; latest: string }>();
  for (const reading of readings) {
    const key = `${reading.latitude.toFixed(precision)},${reading.longitude.toFixed(precision)}`;
    const cell = cells.get(key) ?? { total: 0, count: 0, latest: reading.observedAt };
    cell.total += reading.moisture;
    cell.count += 1;
    if (reading.observedAt > cell.latest) cell.latest = reading.observedAt;
    cells.set(key, cell);
  }
  return [...cells.entries()].map(([cell, value]) => ({ cell, averageMoisture: value.total / value.count, samples: value.count, latestObservedAt: value.latest }));
}

export function moistureTrend(readings: GeoReading[]): 'drying' | 'stable' | 'wetting' {
  const ordered = [...readings].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  if (ordered.length < 2) return 'stable';
  const delta = ordered.at(-1)!.moisture - ordered[0].moisture;
  return delta > 2 ? 'wetting' : delta < -2 ? 'drying' : 'stable';
}

export function scoreTrackSurface(input: SurfacePhysicsInput) {
  const safetyPenalty = Math.abs(input.moisture - 18) * 1.4 + Math.abs(input.compaction - 240) * 0.05 + Math.abs(input.depth - 3.5) * 8 + input.rainfall * 4;
  const consistencyPenalty = Math.abs(input.moisture - 18) + Math.abs(input.compaction - 240) * 0.03 + Math.min(20, input.maintenanceHoursAgo * 0.8);
  return {
    safetyScore: Math.max(0, Math.round(100 - safetyPenalty)),
    consistencyScore: Math.max(0, Math.round(100 - consistencyPenalty)),
    factors: ['moisture', 'compaction', 'depth', 'weather', 'maintenance'],
  };
}
