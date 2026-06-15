param namePrefix string
param location string
param tags object

@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param skuName string = 'Standard'

param capacity int = 1
param eventHubName string = 'trackmind-events'
param messageRetentionInDays int = 7
param partitionCount int = 4
param telemetryHubName string = 'trackmind-telemetry-20hz'
param telemetryMessageRetentionInDays int = 1
param telemetryPartitionCount int = 8
param telemetryConsumerGroupName string = 'race-day-projections'
param telemetryTargetHz int = 20
param telemetryLatencyTargetMs int = 100
param logAnalyticsWorkspaceId string

resource namespace 'Microsoft.EventHub/namespaces@2024-01-01' = {
  name: '${namePrefix}-evh-${uniqueString(resourceGroup().id)}'
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuName
    capacity: capacity
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    minimumTlsVersion: '1.2'
    disableLocalAuth: false
  }
}

resource hub 'Microsoft.EventHub/namespaces/eventhubs@2024-01-01' = {
  parent: namespace
  name: eventHubName
  properties: {
    messageRetentionInDays: messageRetentionInDays
    partitionCount: partitionCount
    status: 'Active'
  }
}

resource telemetryHub 'Microsoft.EventHub/namespaces/eventhubs@2024-01-01' = {
  parent: namespace
  name: telemetryHubName
  properties: {
    messageRetentionInDays: telemetryMessageRetentionInDays
    partitionCount: telemetryPartitionCount
    status: 'Active'
    userMetadata: 'TrackMind telemetry stream target: ${telemetryTargetHz}Hz, p95 latency target <${telemetryLatencyTargetMs}ms. Approval-gated consumers only for state mutation.'
  }
}

resource telemetryConsumerGroup 'Microsoft.EventHub/namespaces/eventhubs/consumergroups@2024-01-01' = {
  parent: telemetryHub
  name: telemetryConsumerGroupName
  properties: {
    userMetadata: 'Race-day CQRS projection consumers for horse location, sensor readings, and security occupancy.'
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${namePrefix}-evh-diagnostics'
  scope: namespace
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

output eventHubNamespaceName string = namespace.name
output eventHubNamespaceHostName string = '${namespace.name}.servicebus.windows.net'
output eventHubName string = hub.name
output telemetryHubName string = telemetryHub.name
output telemetryConsumerGroupName string = telemetryConsumerGroup.name
output telemetryTargetHz int = telemetryTargetHz
output telemetryLatencyTargetMs int = telemetryLatencyTargetMs
output diagnosticSettingName string = diagnostics.name
