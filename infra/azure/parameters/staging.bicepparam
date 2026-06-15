using '../main.bicep'

param environmentName = 'staging'
param projectName = 'trackmind'
param location = 'eastus'
param postgresAdministratorPassword = readEnvironmentVariable('TRACKMIND_PG_ADMIN_PASSWORD')
param tags = {
  tenant: 'trackmind'
  track: 'nexus'
  environment: 'staging'
  owner: 'platform'
  dataClassification: 'confidential'
  costCenter: 'tm-staging'
  businessCriticality: 'medium'
}

param approvalPolicy = {
  mode: 'manual'
  deploymentApproval: 'single-human-approval'
  networkingChangeApproval: 'mandatory-human-approval'
  databaseSchemaChangeApproval: 'mandatory-human-approval'
}

param network = {
  addressPrefix: '10.50.0.0/16'
  containerAppsSubnetPrefix: '10.50.1.0/23'
  postgresSubnetPrefix: '10.50.3.0/24'
}

param postgres = {
  administratorLogin: 'trackmindadmin'
  serverVersion: '16'
  skuName: 'Standard_D2s_v3'
  tier: 'GeneralPurpose'
  storageSizeGB: 128
  backupRetentionDays: 14
  highAvailabilityMode: 'Disabled'
  databaseName: 'trackmind'
}

param containerApps = {
  apiImage: 'ghcr.io/trackmind/nexus-api:staging'
  agentImage: 'ghcr.io/trackmind/nexus-agents:staging'
  apiMinReplicas: 1
  apiMaxReplicas: 4
  agentMinReplicas: 1
  agentMaxReplicas: 2
}

param eventHubs = {
  skuName: 'Standard'
  capacity: 1
  eventHubName: 'trackmind-events'
  messageRetentionInDays: 3
  partitionCount: 4
  telemetryHubName: 'trackmind-telemetry-20hz'
  telemetryMessageRetentionInDays: 1
  telemetryPartitionCount: 8
  telemetryConsumerGroupName: 'race-day-projections'
  telemetryTargetHz: 20
  telemetryLatencyTargetMs: 100
}

param redis = {
  skuName: 'Standard'
  family: 'C'
  capacity: 1
  publicNetworkAccess: 'Disabled'
}

param monitor = {
  retentionInDays: 60
  actionGroupEmail: 'trackmind-staging-ops@example.com'
}
