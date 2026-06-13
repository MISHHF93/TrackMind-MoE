export interface TrackReading {
  moisture: number;
  cushionDepth: number;
  compaction: number;
  temperature: number;
  rainfall: number;
  wind: number;
  lightningDistance: number;
  gateStatus: 'open' | 'closed' | 'fault';
  lightingStatus: 'ok' | 'degraded' | 'offline';
  cameraHealth: 'ok' | 'degraded' | 'offline';
  sensorId?: string;
  capturedAt?: string;
}

const inRange = (value: number, min: number, max: number) => Number.isFinite(value) && value >= min && value <= max;

export function validateReading(reading: TrackReading): string[] {
  const errors: string[] = [];
  if (!inRange(reading.moisture, 0, 100)) errors.push('moisture must be between 0 and 100 percent');
  if (!inRange(reading.cushionDepth, 0, 12)) errors.push('cushion depth must be between 0 and 12 inches');
  if (!inRange(reading.compaction, 0, 1000)) errors.push('compaction must be between 0 and 1000 psi');
  if (!inRange(reading.temperature, -40, 140)) errors.push('temperature must be plausible Fahrenheit');
  if (!inRange(reading.rainfall, 0, 24)) errors.push('rainfall must be between 0 and 24 inches');
  if (!inRange(reading.wind, 0, 150)) errors.push('wind must be between 0 and 150 mph');
  if (!inRange(reading.lightningDistance, 0, 200)) errors.push('lightning distance must be between 0 and 200 miles');
  return errors;
}

export function detectAnomalies(reading: TrackReading): string[] {
  const anomalies: string[] = [];
  if (reading.lightningDistance < 8) anomalies.push('lightning proximity requires weather review');
  if (reading.cameraHealth === 'offline') anomalies.push('camera offline');
  if (reading.gateStatus === 'fault') anomalies.push('gate fault');
  if (reading.lightingStatus === 'offline') anomalies.push('lighting offline');
  if (reading.moisture > 35 && reading.rainfall > 0.5) anomalies.push('wet track surface trend');
  return anomalies;
}
