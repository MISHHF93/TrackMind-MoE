param namePrefix string
param location string
param tags object

@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param skuName string = 'Standard'

@allowed([
  'C'
  'P'
])
param family string = 'C'

param capacity int = 1

@allowed([
  'Enabled'
  'Disabled'
])
param publicNetworkAccess string = 'Disabled'

param logAnalyticsWorkspaceId string

resource cache 'Microsoft.Cache/redis@2023-08-01' = {
  name: '${namePrefix}-redis-${uniqueString(resourceGroup().id)}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: skuName
      family: family
      capacity: capacity
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    publicNetworkAccess: publicNetworkAccess
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${namePrefix}-redis-diagnostics'
  scope: cache
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

output redisName string = cache.name
output redisHostName string = cache.properties.hostName
output redisSslPort int = cache.properties.sslPort
output diagnosticSettingName string = diagnostics.name
