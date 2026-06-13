param location string = resourceGroup().location
resource log 'Microsoft.OperationalInsights/workspaces@2023-09-01' = { name: 'trackmind-log' location: location properties: { sku: { name: 'PerGB2018' } retentionInDays: 30 } }
resource appi 'Microsoft.Insights/components@2020-02-02' = { name: 'trackmind-appinsights' location: location kind: 'web' properties: { Application_Type: 'web' WorkspaceResourceId: log.id } }
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = { name: 'trackmind${uniqueString(resourceGroup().id)}' location: location sku: { name: 'Standard_LRS' } kind: 'StorageV2' }
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = { name: 'trackmind-kv-${uniqueString(resourceGroup().id)}' location: location properties: { tenantId: subscription().tenantId sku: { family: 'A' name: 'standard' } accessPolicies: [] enableRbacAuthorization: true } }
resource env 'Microsoft.App/managedEnvironments@2023-05-01' = { name: 'trackmind-env' location: location properties: { appLogsConfiguration: { destination: 'log-analytics' logAnalyticsConfiguration: { customerId: log.properties.customerId sharedKey: log.listKeys().primarySharedKey } } } }
resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = { name: 'trackmind-pg-${uniqueString(resourceGroup().id)}' location: location properties: { administratorLogin: 'trackmindadmin' administratorLoginPassword: 'REPLACE_WITH_KEYVAULT_SECRET' version: '16' storage: { storageSizeGB: 32 } } sku: { name: 'Standard_B1ms' tier: 'Burstable' } }
resource events 'Microsoft.EventHub/namespaces@2024-01-01' = { name: 'trackmind-events-${uniqueString(resourceGroup().id)}' location: location sku: { name: 'Standard' tier: 'Standard' capacity: 1 } }
resource iot 'Microsoft.Devices/IotHubs@2023-06-30' = { name: 'trackmind-iot-${uniqueString(resourceGroup().id)}' location: location sku: { name: 'S1' capacity: 1 } properties: {} }
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = { name: 'trackmind-mi' location: location }
// Placeholders: Azure AI Search, Azure OpenAI / AI Foundry connections, and Container Apps revisions are wired by environment-specific modules.
