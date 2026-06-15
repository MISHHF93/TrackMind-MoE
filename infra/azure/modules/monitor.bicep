param namePrefix string
param location string
param tags object
param retentionInDays int = 30
param actionGroupEmail string = ''

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-log'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionInDays
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-appi'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
  }
}

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (!empty(actionGroupEmail)) {
  name: '${namePrefix}-ops-ag'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'tmops'
    enabled: true
    emailReceivers: [
      {
        name: 'trackmind-ops'
        emailAddress: actionGroupEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

output logAnalyticsWorkspaceId string = workspace.id
output logAnalyticsCustomerId string = workspace.properties.customerId
output logAnalyticsSharedKey string = workspace.listKeys().primarySharedKey
output applicationInsightsName string = appInsights.name
output applicationInsightsConnectionString string = appInsights.properties.ConnectionString
output actionGroupId string = empty(actionGroupEmail) ? '' : actionGroup.id
