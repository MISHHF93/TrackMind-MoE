targetScope = 'resourceGroup'

@allowed([
  'dev'
  'staging'
  'prod'
])
param environmentName string

param projectName string = 'trackmind'
param location string = resourceGroup().location
param tags object = {}

@secure()
param postgresAdministratorPassword string

param network object
param postgres object
param containerApps object
param eventHubs object
param redis object
param monitor object
param approvalPolicy object

var namePrefix = '${projectName}-${environmentName}'
var commonTags = union(tags, {
  application: 'trackmind-nexus'
  environment: environmentName
  managedBy: 'bicep'
  approvalPolicy: approvalPolicy.mode
})

module monitoring 'modules/monitor.bicep' = {
  name: '${namePrefix}-monitor'
  params: {
    namePrefix: namePrefix
    location: location
    tags: commonTags
    retentionInDays: monitor.retentionInDays
    actionGroupEmail: monitor.actionGroupEmail
  }
}

module networking 'modules/networking.bicep' = {
  name: '${namePrefix}-network'
  params: {
    namePrefix: namePrefix
    location: location
    tags: commonTags
    addressPrefix: network.addressPrefix
    containerAppsSubnetPrefix: network.containerAppsSubnetPrefix
    postgresSubnetPrefix: network.postgresSubnetPrefix
  }
}

module eventBus 'modules/event-hubs.bicep' = {
  name: '${namePrefix}-eventhub'
  params: {
    namePrefix: namePrefix
    location: location
    tags: commonTags
    skuName: eventHubs.skuName
    capacity: eventHubs.capacity
    eventHubName: eventHubs.eventHubName
    messageRetentionInDays: eventHubs.messageRetentionInDays
    partitionCount: eventHubs.partitionCount
    telemetryHubName: eventHubs.telemetryHubName
    telemetryMessageRetentionInDays: eventHubs.telemetryMessageRetentionInDays
    telemetryPartitionCount: eventHubs.telemetryPartitionCount
    telemetryConsumerGroupName: eventHubs.telemetryConsumerGroupName
    telemetryTargetHz: eventHubs.telemetryTargetHz
    telemetryLatencyTargetMs: eventHubs.telemetryLatencyTargetMs
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

module cache 'modules/redis.bicep' = {
  name: '${namePrefix}-redis'
  params: {
    namePrefix: namePrefix
    location: location
    tags: commonTags
    skuName: redis.skuName
    family: redis.family
    capacity: redis.capacity
    publicNetworkAccess: redis.publicNetworkAccess
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

module database 'modules/postgresql.bicep' = {
  name: '${namePrefix}-postgres'
  params: {
    namePrefix: namePrefix
    location: location
    tags: commonTags
    administratorLogin: postgres.administratorLogin
    administratorPassword: postgresAdministratorPassword
    serverVersion: postgres.serverVersion
    skuName: postgres.skuName
    tier: postgres.tier
    storageSizeGB: postgres.storageSizeGB
    backupRetentionDays: postgres.backupRetentionDays
    highAvailabilityMode: postgres.highAvailabilityMode
    databaseName: postgres.databaseName
    delegatedSubnetResourceId: networking.outputs.postgresSubnetResourceId
    privateDnsZoneResourceId: networking.outputs.postgresPrivateDnsZoneResourceId
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

module apps 'modules/container-apps.bicep' = {
  name: '${namePrefix}-containerapps'
  params: {
    namePrefix: namePrefix
    location: location
    tags: commonTags
    environmentName: environmentName
    subnetResourceId: networking.outputs.containerAppsSubnetResourceId
    logAnalyticsCustomerId: monitoring.outputs.logAnalyticsCustomerId
    logAnalyticsSharedKey: monitoring.outputs.logAnalyticsSharedKey
    appInsightsConnectionString: monitoring.outputs.applicationInsightsConnectionString
    apiImage: containerApps.apiImage
    agentImage: containerApps.agentImage
    apiMinReplicas: containerApps.apiMinReplicas
    apiMaxReplicas: containerApps.apiMaxReplicas
    agentMinReplicas: containerApps.agentMinReplicas
    agentMaxReplicas: containerApps.agentMaxReplicas
    postgresHost: database.outputs.postgresHost
    postgresDatabaseName: postgres.databaseName
    redisHostName: cache.outputs.redisHostName
    eventHubNamespaceHostName: eventBus.outputs.eventHubNamespaceHostName
    eventHubName: eventHubs.eventHubName
    telemetryEventHubName: eventBus.outputs.telemetryHubName
    telemetryTargetHz: eventBus.outputs.telemetryTargetHz
    telemetryLatencyTargetMs: eventBus.outputs.telemetryLatencyTargetMs
  }
}

output approvalPolicyMode string = approvalPolicy.mode
output apiContainerAppName string = apps.outputs.apiContainerAppName
output agentContainerAppName string = apps.outputs.agentContainerAppName
output postgresServerName string = database.outputs.postgresServerName
output eventHubNamespaceName string = eventBus.outputs.eventHubNamespaceName
output telemetryEventHubName string = eventBus.outputs.telemetryHubName
output telemetryConsumerGroupName string = eventBus.outputs.telemetryConsumerGroupName
output redisName string = cache.outputs.redisName
output applicationInsightsName string = monitoring.outputs.applicationInsightsName
