param namePrefix string
param location string
param tags object
param environmentName string
param subnetResourceId string
param logAnalyticsCustomerId string

@secure()
param logAnalyticsSharedKey string

param appInsightsConnectionString string
param apiImage string
param agentImage string
param apiMinReplicas int
param apiMaxReplicas int
param agentMinReplicas int
param agentMaxReplicas int
param postgresHost string
param postgresDatabaseName string
param redisHostName string
param eventHubNamespaceHostName string
param eventHubName string
param telemetryEventHubName string
param telemetryTargetHz int = 20
param telemetryLatencyTargetMs int = 100

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-apps-mi'
  location: location
  tags: tags
}

resource environment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${namePrefix}-cae'
  location: location
  tags: tags
  properties: {
    vnetConfiguration: {
      infrastructureSubnetId: subnetResourceId
      internal: false
    }
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsCustomerId
        sharedKey: logAnalyticsSharedKey
      }
    }
  }
}

var commonEnvironmentVariables = [
  {
    name: 'TRACKMIND_ENVIRONMENT'
    value: environmentName
  }
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: appInsightsConnectionString
  }
  {
    name: 'POSTGRES_HOST'
    value: postgresHost
  }
  {
    name: 'POSTGRES_DATABASE'
    value: postgresDatabaseName
  }
  {
    name: 'REDIS_HOST'
    value: redisHostName
  }
  {
    name: 'EVENTHUB_NAMESPACE'
    value: eventHubNamespaceHostName
  }
  {
    name: 'EVENTHUB_NAME'
    value: eventHubName
  }
  {
    name: 'EVENTHUB_TELEMETRY_NAME'
    value: telemetryEventHubName
  }
  {
    name: 'TRACKMIND_TELEMETRY_TARGET_HZ'
    value: string(telemetryTargetHz)
  }
  {
    name: 'TRACKMIND_TELEMETRY_LATENCY_TARGET_MS'
    value: string(telemetryLatencyTargetMs)
  }
]

resource apiApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${namePrefix}-api'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned, UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 4000
        transport: 'http'
        allowInsecure: false
      }
    }
    template: {
      containers: [
        {
          name: 'trackmind-api'
          image: apiImage
          env: commonEnvironmentVariables
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: apiMinReplicas
        maxReplicas: apiMaxReplicas
      }
    }
  }
}

resource agentApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${namePrefix}-agents'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned, UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
    }
    template: {
      containers: [
        {
          name: 'trackmind-agents'
          image: agentImage
          env: concat(commonEnvironmentVariables, [
            {
              name: 'TRACKMIND_AGENT_MODE'
              value: 'worker'
            }
          ])
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: agentMinReplicas
        maxReplicas: agentMaxReplicas
      }
    }
  }
}

output managedEnvironmentName string = environment.name
output apiContainerAppName string = apiApp.name
output agentContainerAppName string = agentApp.name
output workloadIdentityPrincipalId string = identity.properties.principalId
