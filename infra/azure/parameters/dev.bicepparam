using '../main.bicep'

param environmentName = 'dev'
param projectName = 'trackmind'
param location = 'eastus'
param postgresAdministratorPassword = readEnvironmentVariable('TRACKMIND_PG_ADMIN_PASSWORD')
param tags = {
  tenant: 'trackmind'
  track: 'nexus'
  environment: 'dev'
  owner: 'platform'
  dataClassification: 'internal'
  costCenter: 'tm-dev'
  businessCriticality: 'low'
}

param approvalPolicy = {
  mode: 'skip'
  deploymentApproval: 'skip'
  networkingChangeApproval: 'mandatory-human-approval'
  databaseSchemaChangeApproval: 'mandatory-human-approval'
}

param network = {
  addressPrefix: '10.40.0.0/16'
  containerAppsSubnetPrefix: '10.40.1.0/23'
  postgresSubnetPrefix: '10.40.3.0/24'
}

param postgres = {
  administratorLogin: 'trackmindadmin'
  serverVersion: '16'
  skuName: 'Standard_B1ms'
  tier: 'Burstable'
  storageSizeGB: 32
  backupRetentionDays: 7
  highAvailabilityMode: 'Disabled'
  databaseName: 'trackmind'
}

param containerApps = {
  apiImage: 'ghcr.io/trackmind/nexus-api:dev'
  agentImage: 'ghcr.io/trackmind/nexus-agents:dev'
  apiMinReplicas: 0
  apiMaxReplicas: 2
  agentMinReplicas: 0
  agentMaxReplicas: 1
}

param eventHubs = {
  skuName: 'Standard'
  capacity: 1
  eventHubName: 'trackmind-events'
  messageRetentionInDays: 1
  partitionCount: 2
  telemetryHubName: 'trackmind-telemetry-20hz'
  telemetryMessageRetentionInDays: 1
  telemetryPartitionCount: 4
  telemetryConsumerGroupName: 'race-day-projections'
  telemetryTargetHz: 20
  telemetryLatencyTargetMs: 100
}

param redis = {
  skuName: 'Basic'
  family: 'C'
  capacity: 0
  publicNetworkAccess: 'Enabled'
}

param monitor = {
  retentionInDays: 30
  actionGroupEmail: ''
}
