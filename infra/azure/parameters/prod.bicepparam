using '../main.bicep'

param environmentName = 'prod'
param projectName = 'trackmind'
param location = 'eastus'
param postgresAdministratorPassword = readEnvironmentVariable('TRACKMIND_PG_ADMIN_PASSWORD')
param tags = {
  tenant: 'trackmind'
  track: 'nexus'
  environment: 'prod'
  owner: 'platform'
  dataClassification: 'restricted'
  costCenter: 'tm-prod'
  businessCriticality: 'critical'
}

param approvalPolicy = {
  mode: 'dual-approval'
  deploymentApproval: 'two-human-approvals'
  networkingChangeApproval: 'mandatory-human-approval'
  databaseSchemaChangeApproval: 'mandatory-human-approval'
}

param network = {
  addressPrefix: '10.60.0.0/16'
  containerAppsSubnetPrefix: '10.60.1.0/23'
  postgresSubnetPrefix: '10.60.3.0/24'
}

param postgres = {
  administratorLogin: 'trackmindadmin'
  serverVersion: '16'
  skuName: 'Standard_D4s_v3'
  tier: 'GeneralPurpose'
  storageSizeGB: 512
  backupRetentionDays: 35
  highAvailabilityMode: 'ZoneRedundant'
  databaseName: 'trackmind'
}

param containerApps = {
  apiImage: 'ghcr.io/trackmind/nexus-api:prod'
  agentImage: 'ghcr.io/trackmind/nexus-agents:prod'
  apiMinReplicas: 2
  apiMaxReplicas: 10
  agentMinReplicas: 2
  agentMaxReplicas: 6
}

param eventHubs = {
  skuName: 'Standard'
  capacity: 2
  eventHubName: 'trackmind-events'
  messageRetentionInDays: 7
  partitionCount: 8
  telemetryHubName: 'trackmind-telemetry-20hz'
  telemetryMessageRetentionInDays: 3
  telemetryPartitionCount: 16
  telemetryConsumerGroupName: 'race-day-projections'
  telemetryTargetHz: 20
  telemetryLatencyTargetMs: 100
}

param redis = {
  skuName: 'Standard'
  family: 'C'
  capacity: 2
  publicNetworkAccess: 'Disabled'
}

param monitor = {
  retentionInDays: 180
  actionGroupEmail: 'trackmind-prod-ops@example.com'
}
