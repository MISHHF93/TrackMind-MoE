export interface WageringPoolSnapshot { raceId: string; timestamp: string; pool: string; amount: number; oddsByRunner: Record<string, number> }
export function detectUnusualWagering(snapshots: WageringPoolSnapshot[]) {
  const reports = [] as Array<{ raceId: string; severity: 'medium' | 'high'; reason: string; evidence: string[] }>;
  for (let i = 1; i < snapshots.length; i += 1) {
    const previous = snapshots[i - 1];
    const current = snapshots[i];
    const jump = current.amount / Math.max(1, previous.amount);
    if (current.raceId === previous.raceId && jump > 3) reports.push({ raceId: current.raceId, severity: jump > 6 ? 'high' : 'medium', reason: 'pool velocity anomaly', evidence: [previous.timestamp, current.timestamp] });
  }
  return reports;
}

export type VisionTask = 'horse-detection' | 'jockey-detection' | 'gate-monitoring' | 'track-occupancy';
export interface VisionFrame { cameraId: string; timestamp: string; detections: Array<{ task: VisionTask; confidence: number; bbox: [number, number, number, number] }> }
export function summarizeVision(frame: VisionFrame) {
  return { cameraId: frame.cameraId, timestamp: frame.timestamp, horseCount: frame.detections.filter((d) => d.task === 'horse-detection' && d.confidence >= 0.7).length, occupied: frame.detections.some((d) => d.task === 'track-occupancy' && d.confidence >= 0.7) };
}

export interface CameraClip { cameraId: string; start: string; end: string; uri: string }
export function buildEvidenceTimeline(clips: CameraClip[]) {
  return [...clips].sort((a, b) => a.start.localeCompare(b.start)).map((clip, index) => ({ sequence: index + 1, ...clip, synchronizedKey: `${clip.start}:${clip.end}` }));
}
