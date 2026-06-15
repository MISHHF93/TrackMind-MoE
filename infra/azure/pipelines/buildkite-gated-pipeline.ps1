Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$environment = if ($env:TRACKMIND_ENVIRONMENT) { $env:TRACKMIND_ENVIRONMENT.ToLowerInvariant() } else { 'dev' }
if ($environment -notin @('dev', 'staging', 'prod')) {
  throw "TRACKMIND_ENVIRONMENT must be one of dev, staging, prod. Received '$environment'."
}

$parameterFile = "infra/azure/parameters/$environment.bicepparam"
$resourceGroup = if ($env:AZURE_RESOURCE_GROUP) { $env:AZURE_RESOURCE_GROUP } else { "trackmind-$environment-rg" }

function Test-Truthy([string] $Value) {
  return $Value -match '^(1|true|yes|y)$'
}

function Get-ChangedFiles {
  if ($env:BUILDKITE_COMMIT -and $env:BUILDKITE_BRANCH) {
    $base = if ($env:BUILDKITE_PULL_REQUEST_BASE_BRANCH) { "origin/$($env:BUILDKITE_PULL_REQUEST_BASE_BRANCH)" } else { 'HEAD~1' }
    try {
      return @(git diff --name-only "$base...HEAD" 2>$null)
    } catch {
      return @()
    }
  }
  return @()
}

function Get-InfraDiff {
  if ($env:BUILDKITE_COMMIT -and $env:BUILDKITE_BRANCH) {
    $base = if ($env:BUILDKITE_PULL_REQUEST_BASE_BRANCH) { "origin/$($env:BUILDKITE_PULL_REQUEST_BASE_BRANCH)" } else { 'HEAD~1' }
    try {
      return [string](git diff --unified=0 "$base...HEAD" -- infra/azure 2>$null)
    } catch {
      return ''
    }
  }
  return ''
}

$changedFiles = Get-ChangedFiles
$infraDiff = Get-InfraDiff
$declaredNetworkingChanges = Test-Truthy $env:TRACKMIND_NETWORKING_CHANGES
$declaredDatabaseSchemaChanges = Test-Truthy $env:TRACKMIND_DATABASE_SCHEMA_CHANGES

$networkingDetected = ($changedFiles -match 'infra/azure/modules/networking\.bicep').Count -gt 0 -or $infraDiff -match '(addressPrefix|subnet|virtualNetwork|privateDns|publicNetworkAccess|vnetConfiguration|delegatedSubnet)'
$databaseSchemaDetected = ($changedFiles -match '(migrations?/|schema/|\.sql$|prisma|drizzle|typeorm)').Count -gt 0 -or $declaredDatabaseSchemaChanges

$networkingChanges = $declaredNetworkingChanges -or $networkingDetected
$databaseSchemaChanges = $declaredDatabaseSchemaChanges -or $databaseSchemaDetected

$approvalSteps = New-Object System.Collections.Generic.List[string]
$yaml = New-Object System.Text.StringBuilder

function Add-Line([string] $Line = '') {
  [void]$yaml.AppendLine($Line)
}

function Add-ApprovalBlock([string] $Key, [string] $Label, [string] $Prompt, [string] $FieldKey) {
  $approvalSteps.Add($Key)
  Add-Line "  - block: `"$Label`""
  Add-Line "    key: `"$Key`""
  Add-Line "    depends_on: `"what-if`""
  Add-Line "    prompt: `"$Prompt`""
  Add-Line "    fields:"
  Add-Line "      - text: `"Approver name`""
  Add-Line "        key: `"$FieldKey-approver`""
  Add-Line "        required: true"
  Add-Line "      - text: `"Approval rationale`""
  Add-Line "        key: `"$FieldKey-rationale`""
  Add-Line "        required: true"
}

Add-Line 'env:'
Add-Line "  TRACKMIND_ENVIRONMENT: `"$environment`""
Add-Line "  TRACKMIND_BICEP_PARAMETER_FILE: `"$parameterFile`""
Add-Line "  AZURE_RESOURCE_GROUP: `"$resourceGroup`""
Add-Line "  TRACKMIND_NETWORKING_CHANGES: `"$($networkingChanges.ToString().ToLowerInvariant())`""
Add-Line "  TRACKMIND_DATABASE_SCHEMA_CHANGES: `"$($databaseSchemaChanges.ToString().ToLowerInvariant())`""
Add-Line 'steps:'
Add-Line '  - label: ":bicep: Lint Bicep"'
Add-Line '    key: "lint"'
Add-Line '    command: |'
Add-Line '      az bicep version'
Add-Line '      az bicep build --file infra/azure/main.bicep --stdout > /dev/null'
Add-Line '      for module in infra/azure/modules/*.bicep; do az bicep build --file "$$module" --stdout > /dev/null; done'
Add-Line '    agents:'
Add-Line '      queue: "deployments"'
Add-Line ''
Add-Line '  - label: ":package: Build ARM template"'
Add-Line '    key: "build"'
Add-Line '    depends_on: "lint"'
Add-Line '    command: |'
Add-Line '      mkdir -p infra/azure/out'
Add-Line '      az bicep build --file infra/azure/main.bicep --outfile infra/azure/out/main.json'
Add-Line '    artifact_paths:'
Add-Line '      - "infra/azure/out/main.json"'
Add-Line '    agents:'
Add-Line '      queue: "deployments"'
Add-Line ''
Add-Line '  - label: ":mag: Azure What-If"'
Add-Line '    key: "what-if"'
Add-Line '    depends_on: "build"'
Add-Line '    command: |'
Add-Line '      test -n "$$TRACKMIND_PG_ADMIN_PASSWORD"'
Add-Line '      az deployment group what-if \'
Add-Line '        --resource-group "$$AZURE_RESOURCE_GROUP" \'
Add-Line '        --template-file infra/azure/main.bicep \'
Add-Line '        --parameters "$$TRACKMIND_BICEP_PARAMETER_FILE" \'
Add-Line '        --result-format FullResourcePayloads'
Add-Line '    agents:'
Add-Line '      queue: "deployments"'
Add-Line ''
Add-Line '  - wait: ~'
Add-Line ''

if ($networkingChanges) {
  Add-ApprovalBlock 'approve-networking' ':hand: Approve networking changes' 'Mandatory human approval: networking, subnet, DNS, private access, or public network posture changes were detected or declared.' 'networking'
}

if ($databaseSchemaChanges) {
  Add-ApprovalBlock 'approve-database-schema' ':hand: Approve database schema changes' 'Mandatory human approval: database schema or migration changes were detected or declared.' 'database-schema'
}

if ($environment -eq 'staging') {
  Add-ApprovalBlock 'approve-staging' ':hand: Approve staging deployment' 'Staging requires manual approval after Azure What-If review.' 'staging'
}

if ($environment -eq 'prod') {
  Add-ApprovalBlock 'approve-prod-primary' ':lock: Production approval 1 of 2' 'Production deployment requires dual human approval after Azure What-If review. This is approval 1.' 'prod-primary'
  Add-ApprovalBlock 'approve-prod-secondary' ':lock: Production approval 2 of 2' 'Production deployment requires a second human approval. Use a different approver from approval 1.' 'prod-secondary'
}

Add-Line ''
Add-Line '  - label: ":rocket: Deploy Azure infrastructure"'
Add-Line '    key: "deploy"'
if ($approvalSteps.Count -gt 0) {
  Add-Line '    depends_on:'
  foreach ($step in $approvalSteps) {
    Add-Line "      - `"$step`""
  }
} else {
  Add-Line '    depends_on: "what-if"'
}
Add-Line '    command: |'
Add-Line '      az deployment group create \'
Add-Line '        --resource-group "$$AZURE_RESOURCE_GROUP" \'
Add-Line '        --template-file infra/azure/main.bicep \'
Add-Line '        --parameters "$$TRACKMIND_BICEP_PARAMETER_FILE" \'
Add-Line '        --mode Incremental'
Add-Line '    agents:'
Add-Line '      queue: "deployments"'

$yaml.ToString()
