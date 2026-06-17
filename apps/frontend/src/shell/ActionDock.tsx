import type { ReactElement } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { actionDisabledReason, roleCanUseAction } from '@/domain/approvalControls';
import { Button } from '@/design/components/button';
import type { WorkspaceAction } from '@/design/components/workspace';
import { GovernedActionDialog } from '@/features/approvals/GovernedActionDialog';

export function ActionDock({ actions }: { actions: WorkspaceAction[] }): ReactElement {
  const navigate = useNavigate();
  const { session } = useTenantSession();
  const [dialog, setDialog] = useState<{ open: boolean; action?: WorkspaceAction }>({ open: false });

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
              disabled={disabled}
              variant={action.protectedAction ? 'governance' : action.variant === 'default' ? 'default' : 'outline'}
              title={title}
              onClick={() => {
                if (disabled) return;
                if (action.protectedAction) {
                  setDialog({ open: true, action });
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
