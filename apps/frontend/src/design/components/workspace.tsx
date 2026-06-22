import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { ApprovalDecisionButtons } from '@/features/approvals/GovernedActionDialog';
import { GovernedActionDialog } from '@/features/approvals/GovernedActionDialog';
import { advisoryProtectedAction, advisoryTarget } from '@/domain/routeActions';
import { useState } from 'react';

export type OpsPosture = 'ready' | 'watch' | 'blocked' | 'critical' | 'advisory';

export type WorkspaceApprovalApi =
  | 'controlled-actions'
  | 'track-configuration/draft-requests'
  | 'starting-gate-operations/race-start-approval'
  | 'composer'
  | 'draft-requests';

export type WorkspaceActionKind =
  | 'escalation-simulate'
  | 'compliance-evidence-packet'
  | 'facilities-incident-report'
  | 'workforce-task-complete'
  | 'digital-twin-sync'
  | 'notification-dispatch'
  | 'notification-acknowledge';

export interface WorkspaceMetric {
  id: string;
  label: string;
  value: string;
  detail?: string;
  posture?: OpsPosture;
}

export interface WorkspaceQueueItem {
  id: string;
  title: string;
  detail?: string;
  posture?: OpsPosture;
  href?: string;
  meta?: string;
  approvalId?: string;
  incidentId?: string;
  itemKind?: 'approval' | 'incident' | 'alert' | 'escalation';
  focusHref?: string;
}

export interface WorkspaceAction {
  id: string;
  label: string;
  detail?: string;
  protectedAction?: string;
  target?: string;
  approvalApi?: WorkspaceApprovalApi;
  requiredRoles?: string[];
  href?: string;
  variant?: 'default' | 'secondary' | 'outline' | 'governance';
  actionKind?: WorkspaceActionKind;
}

export interface WorkspaceAdvisory {
  id: string;
  title: string;
  detail: string;
  confidence?: string;
  domain?: string;
  protectedAction?: string;
  target?: string;
}

export function MetricGrid({ metrics }: { metrics: WorkspaceMetric[] }): ReactElement {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.id}>
          <CardHeader className="pb-1">
            <div className="metric-card-header">
              <CardDescription>{metric.label}</CardDescription>
            </div>
            <CardTitle className="text-2xl">{metric.value}</CardTitle>
          </CardHeader>
          {metric.detail ? (
            <CardContent className="pt-0">
              <p className="text-xs text-[var(--muted-foreground)]">{metric.detail}</p>
              {metric.posture ? (
                <Badge
                  variant={metric.posture === 'critical' ? 'maroon' : metric.posture === 'watch' ? 'warning' : 'nominal'}
                  className="mt-2"
                >
                  {metric.posture}
                </Badge>
              ) : null}
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

function QueueItemActions({ item }: { item: WorkspaceQueueItem }): ReactElement | null {
  if (item.approvalId && item.itemKind === 'approval') {
    const status = String(item.detail ?? '').toLowerCase();
    if (status.includes('pending') || status.includes('review')) {
      return <ApprovalDecisionButtons approvalId={item.approvalId} />;
    }
  }
  if (item.focusHref) {
    return (
      <Button size="sm" variant="outline" asChild>
        <Link to={item.focusHref}>Open</Link>
      </Button>
    );
  }
  return null;
}

export function PriorityQueue({ title, items, emptyLabel = 'No items in queue.' }: { title: string; items: WorkspaceQueueItem[]; emptyLabel?: string }): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{items.length} item{items.length === 1 ? '' : 's'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? <p className="text-sm text-[var(--muted-foreground)]">{emptyLabel}</p> : null}
        {items.map((item) => {
          const actions = <QueueItemActions item={item} />;
          const content = (
            <>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{item.title}</p>
                {item.detail ? <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{item.detail}</p> : null}
                {item.meta ? <p className="text-xs text-[var(--muted-foreground)] mt-1">{item.meta}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {item.posture ? <span className={`posture-badge posture-badge--${item.posture}`}>{item.posture}</span> : null}
                {actions}
              </div>
            </>
          );
          const className = cn(
            'flex items-start justify-between gap-3 rounded-md border border-[var(--border)] p-3',
            item.posture === 'critical' && 'queue-item-critical',
            item.href && 'hover:bg-[var(--surface-chrome-raised)] transition-colors',
          );
          return item.href && !item.approvalId ? (
            <Link key={item.id} to={item.href} className={className}>
              {content}
            </Link>
          ) : (
            <div key={item.id} className={className}>
              {content}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function EvidencePanel({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function AdvisoryCard({ advisories }: { advisories: WorkspaceAdvisory[] }): ReactElement {
  const [dialog, setDialog] = useState<{ open: boolean; advisory?: WorkspaceAdvisory }>({ open: false });

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Advisories</CardTitle>
        <CardDescription>Advisory only — human approval required for protected actions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {advisories.length === 0 ? <p className="text-sm text-[var(--muted-foreground)]">No active advisories.</p> : null}
        {advisories.map((item) => (
          <div key={item.id} className="rounded-md border border-[color-mix(in_srgb,var(--brand-maroon)_15%,var(--border))] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm">{item.title}</p>
              {item.confidence ? <Badge variant="maroon">{item.confidence}</Badge> : null}
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">{item.detail}</p>
            {item.domain ? <p className="text-xs text-[var(--muted-foreground)]">Expert: {item.domain}</p> : null}
            <Button
              size="sm"
              variant="governance"
              onClick={() => setDialog({ open: true, advisory: item })}
            >
              Request approval
            </Button>
          </div>
        ))}
      </CardContent>
      {dialog.advisory ? (
        <GovernedActionDialog
          open={dialog.open}
          onOpenChange={(open) => setDialog({ open, advisory: open ? dialog.advisory : undefined })}
          title={`Approval for ${dialog.advisory.title}`}
          description={dialog.advisory.detail}
          protectedAction={dialog.advisory.protectedAction ?? advisoryProtectedAction(dialog.advisory.domain) ?? 'safety-critical-control'}
          target={dialog.advisory.target ?? advisoryTarget(dialog.advisory.domain)}
          approvalApi="controlled-actions"
        />
      ) : null}
    </Card>
  );
}

export function DataTable({ columns, rows }: { columns: string[]; rows: string[][] }): ReactElement {
  return (
    <div className="overflow-x-auto rounded-md border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead className="bg-[color-mix(in_srgb,var(--brand-navy)_6%,var(--muted))]">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 text-left font-medium text-[var(--text-strong)]">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-[var(--border)] bg-[var(--card)]">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function JsonPanel({ data, title }: { data: unknown; title: string }): ReactElement {
  return (
    <EvidencePanel title={title}>
      <pre className="overflow-x-auto rounded-md bg-[var(--muted)] p-3 text-xs">{JSON.stringify(data, null, 2)}</pre>
    </EvidencePanel>
  );
}
