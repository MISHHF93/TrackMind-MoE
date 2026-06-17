import type { ReactElement } from 'react';
import { backendSupportLabels, type BackendSupportStatus } from '@/domain/support';
import { Badge } from '@/design/components/badge';

export function SupportStatusBadge({ status }: { status: BackendSupportStatus }): ReactElement {
  const variant = status === 'live-api' ? 'nominal' : status === 'facade-api' ? 'secondary' : 'warning';
  return <Badge variant={variant}>{backendSupportLabels[status]}</Badge>;
}
