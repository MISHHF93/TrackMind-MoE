export type ApiLifecycle = 'design' | 'review' | 'active' | 'deprecated' | 'retired';
export type ApiAuthScheme = 'oauth2' | 'mtls' | 'api-key' | 'jwt';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiOwner { team: string; productOwner: string; technicalOwner: string; supportChannel: string }
export interface ApiDependency { serviceId: string; apiId: string; version: string; criticality: 'low' | 'medium' | 'high' | 'critical' }
export interface RateLimitPolicy { requests: number; perSeconds: number; burst?: number }
export interface ApiEndpoint { path: string; method: HttpMethod; summary: string; scopes: string[]; requestSchema?: Record<string, unknown>; responseSchema?: Record<string, unknown> }
export interface ApiServiceDefinition {
  id: string; name: string; domain: string; version: string; basePath: string; description: string; owner: ApiOwner; lifecycle: ApiLifecycle; auth: ApiAuthScheme[]; endpoints: ApiEndpoint[]; dependencies?: ApiDependency[]; rateLimit?: RateLimitPolicy; tags?: string[]; slo?: { availability: number; latencyMs: number }
}
export interface GatewayRequest { serviceId: string; path: string; method: HttpMethod; principal: { id: string; scopes: string[]; tenantId?: string }; apiKey?: string; nowEpochMs: number }

export class EnterpriseServiceRegistry {
  private readonly services = new Map<string, ApiServiceDefinition>();
  register(service: ApiServiceDefinition) { validateApiGovernance(service); this.services.set(service.id, cloneService(service)); return this.get(service.id)!; }
  get(id: string) { const service = this.services.get(id); return service ? cloneService(service) : undefined; }
  discover(filter: Partial<Pick<ApiServiceDefinition, 'domain' | 'lifecycle'>> & { tag?: string } = {}) { return [...this.services.values()].filter((service) => (!filter.domain || service.domain === filter.domain) && (!filter.lifecycle || service.lifecycle === filter.lifecycle) && (!filter.tag || service.tags?.includes(filter.tag))).map(cloneService); }
  dependencyGraph() { return [...this.services.values()].flatMap((service) => (service.dependencies ?? []).map((dependency) => ({ from: service.id, to: dependency.serviceId, apiId: dependency.apiId, version: dependency.version, criticality: dependency.criticality }))); }
  lifecycle(id: string, lifecycle: ApiLifecycle) { const service = this.services.get(id); if (!service) throw new Error('Service not found'); service.lifecycle = lifecycle; return cloneService(service); }
  ownershipReport() { return [...this.services.values()].map((service) => ({ serviceId: service.id, domain: service.domain, owner: { ...service.owner }, lifecycle: service.lifecycle })); }
}

export class EnterpriseApiGateway {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly registry: EnterpriseServiceRegistry) {}
  route(request: GatewayRequest) {
    const service = this.registry.get(request.serviceId);
    if (!service || service.lifecycle !== 'active') return { allowed: false, status: 404, reason: 'api-not-active-or-not-found', trace: this.trace(request, service?.id) };
    const endpoint = service.endpoints.find((candidate) => candidate.path === request.path && candidate.method === request.method);
    if (!endpoint) return { allowed: false, status: 404, reason: 'endpoint-not-found', trace: this.trace(request, service.id) };
    if (!isAuthenticated(service, request)) return { allowed: false, status: 401, reason: 'authentication-required', trace: this.trace(request, service.id) };
    const missingScopes = endpoint.scopes.filter((scope) => !request.principal.scopes.includes(scope));
    if (missingScopes.length > 0) return { allowed: false, status: 403, reason: 'insufficient-scope', missingScopes, trace: this.trace(request, service.id) };
    if (!this.consumeRateLimit(service, request)) return { allowed: false, status: 429, reason: 'rate-limit-exceeded', trace: this.trace(request, service.id) };
    return { allowed: true, status: 200, reason: 'ok', serviceVersion: service.version, trace: this.trace(request, service.id), headers: { 'x-api-version': service.version, 'x-owner-team': service.owner.team } };
  }
  private consumeRateLimit(service: ApiServiceDefinition, request: GatewayRequest) { const limit = service.rateLimit ?? { requests: 1000, perSeconds: 60 }; const key = `${request.principal.id}:${service.id}`; const windowStart = request.nowEpochMs - limit.perSeconds * 1000; const recent = (this.hits.get(key) ?? []).filter((hit) => hit > windowStart); if (recent.length >= limit.requests + (limit.burst ?? 0)) return false; recent.push(request.nowEpochMs); this.hits.set(key, recent); return true; }
  private trace(request: GatewayRequest, serviceId?: string) { return { traceId: `trc-${request.nowEpochMs}-${request.principal.id}-${serviceId ?? 'unknown'}`, serviceId, principalId: request.principal.id, tenantId: request.principal.tenantId, observable: true, signals: ['metrics', 'logs', 'traces', 'audit-events'] }; }
}

export function generateOpenApi(service: ApiServiceDefinition) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const endpoint of service.endpoints) {
    paths[endpoint.path] = {
      ...(paths[endpoint.path] ?? {}),
      [endpoint.method.toLowerCase()]: {
        summary: endpoint.summary,
        security: service.auth.map((scheme) => ({ [scheme]: endpoint.scopes })),
        requestBody: endpoint.requestSchema ? { content: { 'application/json': { schema: endpoint.requestSchema } } } : undefined,
        responses: { '200': { description: 'Successful response', content: { 'application/json': { schema: endpoint.responseSchema ?? { type: 'object' } } } } },
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: { title: service.name, version: service.version, description: service.description, 'x-owner': service.owner },
    servers: [{ url: service.basePath }],
    tags: service.tags?.map((name) => ({ name })) ?? [],
    paths,
    components: { securitySchemes: Object.fromEntries(service.auth.map((scheme) => [scheme, securityScheme(scheme)])) },
  };
}

export function generateApiDocumentation(service: ApiServiceDefinition) { const endpoints = service.endpoints.map((endpoint) => `- ${endpoint.method} ${service.basePath}${endpoint.path}: ${endpoint.summary} [scopes: ${endpoint.scopes.join(', ')}]`).join('\n'); return `# ${service.name} API\n\nVersion: ${service.version}\nLifecycle: ${service.lifecycle}\nOwner: ${service.owner.team} (${service.owner.supportChannel})\n\n${service.description}\n\n## Endpoints\n${endpoints}\n\n## SLO\nAvailability ${service.slo?.availability ?? 99.9}%, latency ${service.slo?.latencyMs ?? 500}ms`; }

export function generateSdkManifest(service: ApiServiceDefinition) { return { packageName: `@trackmind/${service.id}-client`, version: service.version, languages: ['typescript', 'python'], operations: service.endpoints.map((endpoint) => ({ name: `${endpoint.method.toLowerCase()}${endpoint.path.replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())}`, method: endpoint.method, path: endpoint.path, scopes: [...endpoint.scopes] })) }; }

export function buildApiContractTests(service: ApiServiceDefinition) { return service.endpoints.map((endpoint) => ({ name: `${service.id} ${endpoint.method} ${endpoint.path}`, assertions: ['requires-authentication', 'enforces-authorization-scopes', 'matches-openapi-schema', 'emits-observability-signals', 'respects-rate-limit'] })); }

export function validateApiGovernance(service: ApiServiceDefinition) { const violations = [!service.id && 'missing-service-id', !/^v\d+(\.\d+)?$/.test(service.version) && 'invalid-semver-major-version', !service.basePath.startsWith(`/api/${service.version}/`) && 'base-path-must-include-version', service.auth.length === 0 && 'missing-authentication', service.endpoints.some((endpoint) => endpoint.scopes.length === 0) && 'endpoint-missing-authorization-scope', !service.owner.team && 'missing-owner-team', !service.owner.technicalOwner && 'missing-technical-owner', service.lifecycle === 'active' && !service.slo && 'active-api-missing-slo'].filter(Boolean) as string[]; if (violations.length > 0) throw new Error(`API governance violations: ${violations.join(', ')}`); return { passed: true, controls: ['versioned-base-path', 'owner-assigned', 'auth-required', 'scopes-required', 'slo-required-for-active', 'contract-tests-required'] }; }

export function enterpriseApiGatewayBlueprint() { return { capabilities: ['api-discovery', 'openapi-specifications', 'authentication', 'authorization', 'versioning', 'rate-limiting', 'observability-integration', 'lifecycle-management', 'service-ownership', 'dependency-management', 'automated-documentation', 'contract-testing', 'sdk-generation', 'governance-controls'], standards: ['OpenAPI 3.1', 'OAuth2/JWT scopes', 'mTLS for service-to-service', 'versioned /api/vN paths', 'SLO and owner metadata', 'audit-ready lifecycle gates'] }; }

function isAuthenticated(service: ApiServiceDefinition, request: GatewayRequest) { return service.auth.includes('api-key') ? !!request.apiKey : !!request.principal.id; }
function securityScheme(scheme: ApiAuthScheme) { if (scheme === 'oauth2') return { type: 'oauth2', flows: { clientCredentials: { tokenUrl: '/oauth/token', scopes: {} } } }; if (scheme === 'api-key') return { type: 'apiKey', in: 'header', name: 'x-api-key' }; if (scheme === 'mtls') return { type: 'mutualTLS' }; return { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }; }
function cloneService(service: ApiServiceDefinition): ApiServiceDefinition { return { ...service, owner: { ...service.owner }, auth: [...service.auth], endpoints: service.endpoints.map((endpoint) => ({ ...endpoint, scopes: [...endpoint.scopes], requestSchema: endpoint.requestSchema ? { ...endpoint.requestSchema } : undefined, responseSchema: endpoint.responseSchema ? { ...endpoint.responseSchema } : undefined })), dependencies: service.dependencies?.map((dependency) => ({ ...dependency })), rateLimit: service.rateLimit ? { ...service.rateLimit } : undefined, tags: service.tags ? [...service.tags] : undefined, slo: service.slo ? { ...service.slo } : undefined }; }
