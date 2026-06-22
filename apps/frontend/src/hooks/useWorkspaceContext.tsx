import { createContext, useCallback, useContext, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import type { WorkspaceAction, OpsPosture } from '@/design/components/workspace';

interface WorkspaceContextValue {
  posture: OpsPosture;
  postureLabel: string;
  primaryActions: WorkspaceAction[];
  setWorkspaceState: (state: Partial<Pick<WorkspaceContextValue, 'posture' | 'postureLabel' | 'primaryActions'>>) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const defaultActions: WorkspaceAction[] = [
  { id: 'nav-dashboard', label: 'Command center', detail: 'Open the operations command center.' },
  { id: 'nav-race-day', label: 'Race day', detail: 'Review race office lifecycle and readiness.' },
  { id: 'nav-approvals', label: 'Approvals', detail: 'Review human approval workflow queue.' },
];

export function WorkspaceProvider({ children }: { children: ReactNode }): ReactElement {
  const [state, setState] = useState({
    posture: 'ready' as OpsPosture,
    postureLabel: 'Select an operating console',
    primaryActions: defaultActions,
  });

  const setWorkspaceState = useCallback(
    (partial: Partial<Pick<WorkspaceContextValue, 'posture' | 'postureLabel' | 'primaryActions'>>) => {
      setState((prev) => ({ ...prev, ...partial }));
    },
    [],
  );

  const value = useMemo<WorkspaceContextValue>(() => ({
    ...state,
    setWorkspaceState,
  }), [state, setWorkspaceState]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspaceContext must be used within WorkspaceProvider');
  return ctx;
}

export function setActiveConsole(state: Partial<Pick<WorkspaceContextValue, 'posture' | 'postureLabel' | 'primaryActions'>>): void {
  // no-op placeholder for compatibility; pages call useWorkspaceContext().setWorkspaceState directly
  void state;
}
