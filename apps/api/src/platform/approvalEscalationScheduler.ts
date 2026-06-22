import type { CentralizedApprovalService } from '../approvals.js';
import { runApprovalEscalationCycle, type ApprovalEscalationCycleResult } from './approvalEscalationWorker.js';
import type { DurableApprovalStore } from './approvalStore.js';

const defaultIntervalMs = 60_000;

export interface ApprovalEscalationSchedulerHandle {
  stop(): void;
  tick(now?: string): ApprovalEscalationCycleResult;
}

export function startApprovalEscalationScheduler(deps: {
  approvalService: CentralizedApprovalService;
  durableStore: DurableApprovalStore;
  intervalMs?: number;
  reminderLeadMinutes?: number;
}): ApprovalEscalationSchedulerHandle {
  const intervalMs = deps.intervalMs ?? defaultIntervalMs;

  const tick = (now?: string) =>
    runApprovalEscalationCycle({
      approvalService: deps.approvalService,
      durableStore: deps.durableStore,
      now,
      reminderLeadMinutes: deps.reminderLeadMinutes,
    });

  const timer = setInterval(() => {
    tick();
  }, intervalMs);
  if (typeof timer === 'object' && 'unref' in timer) timer.unref();

  return {
    stop: () => clearInterval(timer),
    tick,
  };
}
