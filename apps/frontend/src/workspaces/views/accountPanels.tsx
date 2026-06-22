import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { rolePermissionSummary, type Role } from '@trackmind/shared';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/design/components/tabs';
import { AccountOverviewTab } from './account/AccountOverviewTab';
import { AccountRolesTab } from './account/AccountRolesTab';
import { AccountNotificationsTab } from './account/AccountNotificationsTab';
import { AccountPreferencesTab } from './account/AccountPreferencesTab';
import { AccountSecurityTab } from './account/AccountSecurityTab';

const tabs = ['overview', 'roles', 'notifications', 'preferences', 'security'] as const;
type AccountTab = typeof tabs[number];

function isAccountTab(value: string | null): value is AccountTab {
  return tabs.includes(value as AccountTab);
}

export function AccountPanels({
  results: _results,
}: {
  results: WorkspaceDataResult[];
  role: Role;
  kpiDomains: readonly import('@trackmind/shared').KPIDomain[];
}): ReactElement {
  const { session } = useTenantSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = isAccountTab(tabParam) ? tabParam : 'overview';

  const resonance = useMemo(() => {
    if (session.profile?.resonance) return session.profile.resonance;
    const summary = rolePermissionSummary(session.role);
    return {
      scope: summary.scope,
      category: summary.category,
      viewerRoutes: summary.viewerRoutes,
      kpiDomains: summary.kpiDomains,
      auditRead: summary.auditRead,
      auditExport: summary.auditExport,
      privacyScopes: summary.privacyScopes,
    };
  }, [session.profile?.resonance, session.role]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        if (isAccountTab(value)) setSearchParams(value === 'overview' ? {} : { tab: value });
      }}
    >
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="roles">Roles & access</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="preferences">Preferences</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
      </TabsList>

      <TabsContent value="overview"><AccountOverviewTab session={session} /></TabsContent>
      <TabsContent value="roles">
        <AccountRolesTab
          session={session}
          sessionRole={session.role}
          assignedRoles={session.assignedRoles ?? [session.role]}
          resonance={resonance}
        />
      </TabsContent>
      <TabsContent value="notifications"><AccountNotificationsTab userId={session.userId} /></TabsContent>
      <TabsContent value="preferences"><AccountPreferencesTab /></TabsContent>
      <TabsContent value="security"><AccountSecurityTab /></TabsContent>
    </Tabs>
  );
}
