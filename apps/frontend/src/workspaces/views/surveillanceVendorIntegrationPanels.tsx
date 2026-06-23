import type { ReactElement } from 'react';
import type { SurveillanceVendorIntegrationContractDescriptor, SurveillanceVendorIntegrationWorkspaceDto } from '@trackmind/shared';
import { Badge } from '@/design/components/badge';
import { RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { feedData } from '../feedUtils';
import type { WorkspacePanelProps } from './workspacePanelTypes';

function contractKindLabel(kind: string): string {
  return kind.replace(/-/g, ' ');
}

function ContractCatalogTable({ contracts }: { contracts: SurveillanceVendorIntegrationContractDescriptor[] }): ReactElement {
  return (
    <RecordTable
      columns={[
        { key: 'kind', label: 'Contract' },
        { key: 'title', label: 'Title' },
        { key: 'category', label: 'Category' },
        { key: 'protocols', label: 'Protocols' },
        { key: 'readiness', label: 'Readiness' },
      ]}
      rows={contracts.map((contract) => ({
        kind: contractKindLabel(contract.contractKind),
        title: contract.title,
        category: contract.connectorCategory,
        protocols: contract.supportedProtocols.join(', '),
        readiness: contract.integrationReadiness,
      }))}
      emptyLabel="No provider-ready integration contracts returned."
    />
  );
}

export function SurveillanceVendorIntegrationPanel({
  workspace,
}: {
  workspace: SurveillanceVendorIntegrationWorkspaceDto | undefined;
}): ReactElement {
  if (!workspace) {
    return (
      <SectionPanel
        title="CCTV & IoT vendor integration contracts"
        description="Provider-ready adapter contracts for camera streams, NVR/VMS, telemetry, gateways, alerts, retention, and capabilities."
      >
        <p className="text-sm text-[var(--muted-foreground)]">
          Vendor integration catalog unavailable — reload the workspace.
        </p>
      </SectionPanel>
    );
  }

  const configuredCount = workspace.providerConfigs.filter((config) => config.activeIntegrationClaimed).length;

  return (
    <div className="space-y-4" id="surveillance-vendor-integration">
      <SectionPanel
        title="CCTV & IoT vendor integration contracts"
        description={workspace.disclaimer}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge variant="advisory">Provider-ready catalog</Badge>
          <Badge variant={configuredCount > 0 ? 'nominal' : 'secondary'}>
            {configuredCount > 0 ? `${configuredCount} configured provider(s)` : 'No active vendor integrations'}
          </Badge>
        </div>
        <ContractCatalogTable contracts={workspace.contracts} />
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Provider-agnostic contracts only — register a provider configuration to activate an integration slot.
          Hard-coded vendor behavior is not permitted.
        </p>
      </SectionPanel>

      {workspace.providerConfigs.length > 0 ? (
        <SectionPanel title="Configured providers" description="Operator-registered vendor bindings.">
          <RecordTable
            columns={[
              { key: 'name', label: 'Provider' },
              { key: 'contract', label: 'Contract' },
              { key: 'status', label: 'Status' },
              { key: 'active', label: 'Active claim' },
            ]}
            rows={workspace.providerConfigs.map((config) => ({
              name: config.displayName,
              contract: contractKindLabel(config.contractKind),
              status: config.operationalStatus,
              active: config.activeIntegrationClaimed ? 'yes' : 'no',
            }))}
          />
        </SectionPanel>
      ) : null}
    </div>
  );
}

export function SurveillanceVendorIntegrationPanels({ results }: WorkspacePanelProps): ReactElement {
  const workspace = feedData<SurveillanceVendorIntegrationWorkspaceDto>(
    results,
    '/surveillance-iot/integration/contracts/workspace',
  );
  return <SurveillanceVendorIntegrationPanel workspace={workspace} />;
}
