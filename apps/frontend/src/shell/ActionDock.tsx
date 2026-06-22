import type { ReactElement } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { actionDisabledReason, roleCanUseAction } from '@/domain/approvalControls';
import { Button } from '@/design/components/button';
import type { WorkspaceAction } from '@/design/components/workspace';
import { GovernedActionDialog } from '@/features/approvals/GovernedActionDialog';
import { useWorkspaceActionMutation } from '@/hooks/useWorkspaceActionMutation';

export function ActionDock({ actions }: { actions: WorkspaceAction[] }): ReactElement {
  const navigate = useNavigate();
  const { session } = useTenantSession();
  const [dialog, setDialog] = useState<{ open: boolean; action?: WorkspaceAction }>({ open: false });
  const [message, setMessage] = useState<string | null>(null);
  const actionMutation = useWorkspaceActionMutation();

  return (
    <footer className="action-dock px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="action-dock-label text-xs font-semibold uppercase tracking-wide mr-2">Governed actions</p>
        {actions.map((action) => {
          const disabled = Boolean(action.protectedAction && !roleCanUseAction(action, session.role));
          const title = disabled
            ? actionDisabledReason(action, session.role)
            : action.detail;
          return (
            <Button
              key={action.id}
              type="button"
              size="sm"
              disabled={disabled || (action.actionKind ? actionMutation.isPending : false)}
              variant={action.protectedAction || action.actionKind ? 'governance' : action.variant === 'default' ? 'default' : 'outline'}
              title={title}
              onClick={() => {
                if (disabled) return;
                if (action.protectedAction) {
                  setDialog({ open: true, action });
                  return;
                }
                if (action.actionKind) {
                  void actionMutation.mutateAsync(action).then((response) => {
                    const msg = typeof response === 'object' && response && 'message' in response
                      ? String((response as { message?: string }).message)
                      : `${action.label} submitted.`;
                    setMessage(msg);
                  }).catch((error: Error) => setMessage(error.message));
                  return;
                }
                if (action.href) {
                  navigate(action.href);
                  return;
                }
                if (action.id.startsWith('nav-')) {
                  const pathMap: Record<string, string> = {
                    'nav-dashboard': '/dashboard',
                    'nav-race-day': '/race-day',
                    'nav-approvals': '/approvals',
                  };
                  const path = pathMap[action.id];
                  if (path) navigate(path);
                }
              }}
            >
              {action.label}
            </Button>
          );
        })}
      </div>
      {message ? <p className="mt-2 text-xs text-[var(--muted-foreground)]">{message}</p> : null}
      {actionMutation.isError ? <p className="mt-1 text-xs text-[var(--status-critical)]">{(actionMutation.error as Error).message}</p> : null}
      {dialog.action?.protectedAction ? (
        <GovernedActionDialog
          open={dialog.open}
          onOpenChange={(open) => setDialog({ open, action: open ? dialog.action : undefined })}
          title={dialog.action.label}
          description={dialog.action.detail ?? 'Request human approval for this protected action.'}
          protectedAction={dialog.action.protectedAction}
          target={dialog.action.target ?? dialog.action.id}
          approvalApi={dialog.action.approvalApi}
        />
      ) : null}
    </footer>
  );
}
