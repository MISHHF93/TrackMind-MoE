import { CognitiveLoadManager } from './cognitiveLoad.js';
import { EdgeHotPathSafetyEngine } from './hotPath.js';
import { PostRaceLearningLoopService } from './learningLoop.js';
import type { RaceDebriefInput, SafetyAlert, SafetyTelemetryFrame } from './types.js';
import { SquadWarmPathSafetyAnalyst, type WarmPathContext } from './warmPath.js';

export interface SafetyIntelligenceControllerResponse {
  status: number;
  body: unknown;
}

export class SafetyIntelligenceController {
  private readonly hotPath = new EdgeHotPathSafetyEngine(10);
  private readonly warmPath = new SquadWarmPathSafetyAnalyst(1500);
  private readonly cognitiveLoad = new CognitiveLoadManager(3000, 1);
  private readonly learningLoop = new PostRaceLearningLoopService();
  private readonly alertHistory: SafetyAlert[] = [];

  async handle(method: string, path: string, body?: unknown): Promise<SafetyIntelligenceControllerResponse | undefined> {
    try {
      if (method === 'POST' && path === '/safety-intelligence/hot-path/evaluate') {
        const result = this.hotPath.evaluate(body as SafetyTelemetryFrame);
        this.alertHistory.push(...result.alerts);
        const delivery = this.cognitiveLoad.enqueue(result.alerts);
        return { status: 202, body: { ...result, delivery } };
      }

      if (method === 'POST' && path === '/safety-intelligence/warm-path/analyze') {
        const input = body as WarmPathContext;
        const result = this.warmPath.analyze({ ...input, recentAlerts: input.recentAlerts ?? this.alertHistory.filter((alert) => alert.raceId === input.raceId) });
        if (result.synthesizedAlert) this.alertHistory.push(result.synthesizedAlert);
        const delivery = result.synthesizedAlert ? this.cognitiveLoad.enqueue([result.synthesizedAlert]) : this.cognitiveLoad.enqueue([]);
        return { status: 202, body: { ...result, delivery } };
      }

      if (method === 'POST' && path === '/safety-intelligence/alerts/deliver') {
        const alerts = Array.isArray((body as { alerts?: unknown[] } | undefined)?.alerts) ? (body as { alerts: SafetyAlert[] }).alerts : [];
        this.alertHistory.push(...alerts);
        return { status: 202, body: this.cognitiveLoad.enqueue(alerts) };
      }

      if (method === 'GET' && path === '/safety-intelligence/alerts/queue') {
        return { status: 200, body: { queued: this.cognitiveLoad.snapshot(), history: this.alertHistory } };
      }

      if (method === 'POST' && path === '/safety-intelligence/debrief') {
        return { status: 201, body: this.learningLoop.createDebrief(body as RaceDebriefInput) };
      }
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'safety_intelligence_error', message: error instanceof Error ? error.message : String(error) } } };
    }
    return undefined;
  }
}

export function createSafetyIntelligenceController() {
  return new SafetyIntelligenceController();
}
