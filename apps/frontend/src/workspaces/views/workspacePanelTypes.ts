import type { KPIDomain, Role } from '@trackmind/shared';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';

export type WorkspacePanelProps = {
  results: WorkspaceDataResult[];
  role?: Role;
  kpiDomains?: readonly KPIDomain[];
};
