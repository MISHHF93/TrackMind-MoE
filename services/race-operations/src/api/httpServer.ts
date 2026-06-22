import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { RaceOperationsService } from '../application/raceOperationsService.js';
import { handleRaceOperationsRequest, type HttpMethod } from './routes.js';

export interface RaceOperationsHttpServerOptions {
  service: RaceOperationsService;
  port?: number;
  host?: string;
}

export function createRaceOperationsHttpServer(options: RaceOperationsHttpServerOptions) {
  const { service, port = Number(process.env.PORT ?? 4107), host = process.env.HOST ?? '0.0.0.0' } = options;

  const server = http.createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const startedAt = new Date().toISOString();
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const method = (request.method ?? 'GET').toUpperCase() as HttpMethod;
    const result = handleRaceOperationsRequest(method, url.pathname, service, startedAt);
    if (!result) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not_found', path: url.pathname }));
      return;
    }
    response.writeHead(result.status, result.headers ?? { 'content-type': 'application/json' });
    response.end(JSON.stringify(result.body));
  });

  return {
    server,
    listen: () => new Promise<http.Server>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => resolve(server));
    }),
    address: () => server.address(),
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}
