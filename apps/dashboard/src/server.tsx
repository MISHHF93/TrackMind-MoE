import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CommandCenter, loadCommandCenter } from './App.js';
import { createNexusClient } from './api/client.js';
import { canonicalPathForRoute, isKnownRoutePath, routeAliasForPath } from './shell/navigation.js';
import { DEFAULT_DENSITY_LEVEL, DEFAULT_THEME_MODE, dashboardThemeCss } from './theme/tokens.js';
import { nexusApiBasePath, type Role } from '@trackmind/shared';

const now = () => new Date().toISOString();

function createRequestId() {
  return `tm-dashboard-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function requestIdFromHeader(value: IncomingMessage['headers'][string]) {
  return Array.isArray(value) ? value[0] : value;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function structuredLog(level: 'info' | 'warning' | 'error', event: string, fields: Record<string, unknown>) {
  const entry = JSON.stringify({ level, event, service: 'trackmind-dashboard', timestamp: now(), ...fields });
  if (level === 'error') console.error(entry);
  else console.log(entry);
}

const html = (body: string, mode: string) => `<!doctype html>
<html lang="en" data-theme="${DEFAULT_THEME_MODE}" data-density="${DEFAULT_DENSITY_LEVEL}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="trackmind-route-alias-policy" content="Legacy aliases are quarantined" />
    <!-- Legacy aliases are quarantined -->
    <title>TrackMind Nexus</title>
    <style>
      ${dashboardThemeCss}
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body { margin: 0; font-family: var(--tm-font-family); background: radial-gradient(circle at top left, var(--tm-background-app-aura), transparent 36rem), var(--tm-background-app); color: var(--tm-text-primary); font-size: var(--tm-font-size-md); line-height: var(--tm-line-height); }
      h1, h2, h3 { line-height: var(--tm-line-height-tight); }
      h1 { font-size: var(--tm-font-size-xl); }
      h2 { font-size: var(--tm-font-size-lg); }
      a { color: var(--tm-text-link); text-underline-offset: .18em; }
      a:hover { color: var(--tm-text-link-hover); }
      .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
      .skip-link { position: fixed; top: var(--tm-space-2); left: var(--tm-space-2); z-index: 20; transform: translateY(-160%); padding: var(--tm-density-control-pad-x) .9rem; border-radius: var(--tm-radius-md); background: var(--tm-border-focus); color: var(--tm-text-inverse); font-weight: 700; }
      .skip-link:focus { transform: translateY(0); }
      .render-mode-banner { position: sticky; top: 0; z-index: 30; padding: var(--tm-space-2) var(--tm-layout-gutter); background: linear-gradient(90deg, var(--tm-brand-rendered), var(--tm-brand-secondary)); color: var(--tm-text-on-strong); font-weight: 700; box-shadow: var(--tm-elevation-panel); }
      main.nexus-shell { min-height: calc(100vh - 42px); display: grid; grid-template-columns: minmax(var(--tm-layout-sidebar-min), var(--tm-layout-sidebar-max)) minmax(0, 1fr); align-items: start; gap: var(--tm-layout-gutter); width: min(100%, var(--tm-layout-shell-max)); margin-inline: auto; padding: var(--tm-layout-gutter); }
      main.nexus-shell > :not(.sidebar):not(.nexus-sidebar):not(.skip-link) { grid-column: 2; min-width: 0; }
      .workspace-content { grid-column: 2; min-width: 0; display: grid; gap: var(--tm-layout-section-gap); align-content: start; }
      .sidebar, .nexus-sidebar { grid-column: 1; grid-row: 1; align-self: start; position: sticky; top: calc(42px + var(--tm-space-4)); max-height: calc(100vh - 42px - (var(--tm-space-4) * 2)); overflow: auto; border: var(--tm-border-width) solid var(--tm-border-accent-subtle); border-radius: calc(var(--tm-card-radius) + .25rem); padding: var(--tm-space-3); background: var(--tm-background-shell); box-shadow: var(--tm-elevation-card); }
      .nexus-sidebar > a:first-child { display: inline-flex; align-items: center; gap: var(--tm-space-2); margin-bottom: var(--tm-space-3); color: var(--tm-text-on-strong); font-size: var(--tm-font-size-lg); font-weight: 800; text-decoration: none; }
      .nexus-sidebar > p { margin: 0 0 var(--tm-space-4); padding: var(--tm-space-3); border: var(--tm-border-width) solid var(--tm-border-accent-subtle); border-radius: var(--tm-radius-md); background: var(--tm-background-raised-translucent); }
      .nexus-sidebar nav section { margin: 0 0 var(--tm-space-3); padding: var(--tm-space-3); border: var(--tm-border-width) solid var(--tm-border-strong-muted); border-radius: var(--tm-radius-md); background: var(--tm-background-panel-translucent); }
      .nexus-sidebar nav h2 { margin: 0 0 var(--tm-space-2); font-size: var(--tm-font-size-sm); text-transform: uppercase; letter-spacing: var(--tm-letter-spacing-label); color: var(--tm-text-link-hover); }
      .nexus-card, .kpi-tile, .metric-strip div, .notification-list li, .activity-feed li, .active-participants li, .action-rail article, .data-table-shell, .command-panel, .collaboration-panel, .split-pane, .detail-drawer, .notification-drawer, .mock-data-banner, .state-message, .map-legend > div, .track-map-canvas, .workspace-frame, .workspace-section, .workspace-content > header, .workspace-content > section, .workspace-content > aside { border: var(--tm-border-width) solid var(--tm-card-border); border-radius: var(--tm-card-radius); padding: var(--tm-layout-panel-padding); margin: var(--tm-space-2) 0; background: var(--tm-background-panel-translucent); box-shadow: var(--tm-elevation-panel); }
      section article:not(.nexus-card):not(.kpi-tile) { margin: var(--tm-space-2) 0; padding: var(--tm-space-3); border-left: 3px solid var(--tm-border-strong); border-radius: var(--tm-radius-md); background: var(--tm-background-raised-translucent); }
      .route-content-frame { width: min(100%, var(--tm-layout-page-max)); margin-inline: auto; display: grid; gap: var(--tm-layout-section-gap); background: var(--tm-background-route); border-color: var(--tm-border-accent-strong); }
      .route-content-frame > :first-child { margin-top: var(--tm-space-0); }
      .route-content-frame > :last-child { margin-bottom: var(--tm-space-0); }
      .command-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(var(--tm-layout-grid-min), 1fr)); gap: var(--tm-layout-card-gap); align-items: start; }
      .command-bar h1, .command-bar > p { grid-column: 1 / -1; }
      .command-bar nav[aria-label="Shell command actions"] { display: flex; flex-wrap: wrap; gap: var(--tm-space-2); align-items: center; }
      .page-header, .workspace-layout, .workspace-frame, .workspace-section, .command-panel, .collaboration-panel, .data-table-shell, .detail-drawer, .split-pane, .command-bar--shared { min-width: 0; }
      .page-header__metadata, .page-header__actions { display: flex; flex-wrap: wrap; gap: var(--tm-space-2); align-items: center; }
      .command-bar--shared { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(var(--tm-layout-grid-min), 1fr)); gap: var(--tm-layout-card-gap); align-items: start; }
      .page-header.command-bar { position: relative; overflow: hidden; background: var(--tm-background-page-header); border-color: var(--tm-border-accent-muted); }
      .page-header.command-bar::before { content: ""; position: absolute; inset: 0 auto 0 0; width: .35rem; background: linear-gradient(180deg, var(--tm-brand-primary), var(--tm-brand-secondary), var(--tm-brand-accent)); }
      .command-panel > header { margin: 0 0 var(--tm-space-3); background: var(--tm-card-bg-raised); box-shadow: none; }
      .notification-drawer { padding: var(--tm-density-control-pad-y) var(--tm-density-control-pad-x); margin: 0; align-self: start; }
      .notification-drawer summary { min-height: var(--tm-density-control-height); display: flex; align-items: center; cursor: pointer; font-weight: 700; }
      .notification-drawer .notification-list { margin-top: var(--tm-space-2); grid-template-columns: 1fr; max-height: 18rem; overflow: auto; }
      .split-pane { display: grid; grid-template-columns: minmax(0, 2fr) minmax(var(--tm-layout-grid-min), 1fr); gap: var(--tm-layout-card-gap); align-items: start; }
      .split-pane[data-orientation="vertical"] { grid-template-columns: 1fr; }
      .split-pane[data-reverse="true"] .split-pane__primary { order: 2; }
      .split-pane[data-reverse="true"] .split-pane__secondary { order: 1; }
      kbd { border: 1px solid var(--tm-border-subtle); border-radius: .35rem; padding: .05rem .3rem; background: var(--tm-background-raised); color: var(--tm-text-primary); font-size: .85em; }
      nav a, .approval-shortcut { display: block; margin: var(--tm-space-1) 0; padding: var(--tm-density-control-pad-y) var(--tm-density-control-pad-x); border-radius: var(--tm-radius-md); }
      a[aria-current="page"], a[data-active="true"], [aria-current="page"] { background: var(--tm-background-raised); color: var(--tm-text-on-strong); outline: 1px solid var(--tm-brand-primary); font-weight: 700; }
      nav[aria-label="Mobile navigation"] { display: none; }
      .breadcrumb { display: flex; flex-wrap: wrap; gap: .35rem; padding: 0; margin: 0; list-style: none; }
      .breadcrumb li + li::before { content: "/"; margin-right: .35rem; color: var(--tm-text-muted); }
      .jump-links, .map-controls, .filter-bar > div { display: flex; flex-wrap: wrap; gap: var(--tm-space-2); align-items: center; }
      .jump-links a, .map-controls span, .status-badge, .status-token, .nav-route-badge, .risk-badge, .approval-chip, .assignment-chip, .confidence-badge, .status-indicator { border: var(--tm-border-width) solid var(--tm-card-border); border-radius: var(--tm-radius-pill); background: var(--tm-card-bg-raised); padding: var(--tm-space-1) var(--tm-density-control-pad-x); }
      .workspace-frame { display: grid; gap: var(--tm-layout-section-gap); background: var(--tm-background-workspace-frame); }
      .workspace-frame > .page-header, .workspace-frame > .split-pane, .workspace-frame > .workspace-section, .workspace-frame__contexts { margin-block: 0; }
      .workspace-frame__contexts { display: grid; grid-template-columns: repeat(auto-fit, minmax(var(--tm-layout-grid-min), 1fr)); gap: var(--tm-layout-card-gap); }
      .workspace-section { display: grid; gap: var(--tm-space-2); align-content: start; }
      .workspace-section > h3 { margin-top: 0; }
      .workspace-grid, .card-grid, .action-rail, .metric-strip, .notification-list, .active-participants, .map-legend { display: grid; grid-template-columns: repeat(auto-fit, minmax(var(--tm-layout-grid-min), 1fr)); gap: var(--tm-layout-card-gap); padding: 0; }
      .operations-command-cockpit { display: grid; gap: var(--tm-layout-section-gap); }
      .operations-command-cockpit > .workspace-grid { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); }
      .operations-command-cockpit .nexus-card { min-height: 100%; }
      .eyebrow, small, .status-badge-copy { color: var(--tm-text-muted); text-transform: uppercase; letter-spacing: var(--tm-letter-spacing-label); font-size: var(--tm-font-size-sm); }
      .metric-strip div, .notification-list li, .activity-feed li, .active-participants li, .action-rail article { list-style: none; border: var(--tm-border-width) solid var(--tm-card-border); border-radius: var(--tm-radius-md); padding: var(--tm-density-card-padding); background: var(--tm-card-bg-raised); box-shadow: var(--tm-elevation-panel); }
      .metric-strip dd { margin: 0; display: grid; gap: var(--tm-space-1); }
      .metric-strip strong, .kpi-tile strong { display: block; font-size: clamp(1.35rem, 3vw, 2rem); }
      .status-line { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; }
      .status-token, .nav-route-badge, .risk-badge, .approval-chip, .assignment-chip, .confidence-badge, .status-indicator { display: inline-flex; gap: .35rem; align-items: center; color: var(--tm-text-primary); font-weight: 700; }
      .activity-feed { display: grid; gap: var(--tm-space-2); padding: 0; }
      .collaboration-panel { border-color: var(--tm-brand-secondary); }
      .status-token { min-width: 2.2rem; justify-content: center; }
      .status-badge { display: inline-flex; gap: var(--tm-space-1); align-items: center; margin: var(--tm-space-1) var(--tm-space-1) var(--tm-space-1) 0; font-weight: 700; }
      .mock-data-banner, .state-message[data-state="empty"], .state-message[data-state="error"], .state-message[data-state="mock"] { border-style: dashed; }
      .state-message { background: var(--tm-card-bg-raised); }
      .loading-skeleton { display: grid; gap: var(--tm-space-2); }
      .loading-skeleton span[aria-hidden="true"] { min-height: var(--tm-space-3); border-radius: var(--tm-radius-pill); background: var(--tm-border-subtle); opacity: .65; }
      [data-risk="critical"], [role="alert"], [data-tone="critical"], [data-severity="critical"], [data-status*="blocked"], [data-status*="offline"], [data-status*="failed"], [data-status*="rejected"], [data-status*="expired"], [data-health="failed"], [data-approval="rejected"], [data-approval="expired"] { color: var(--tm-status-critical); border-color: var(--tm-status-border-critical); background-color: var(--tm-background-critical); }
      [data-risk="high"], [data-tone="high"] { color: var(--tm-risk-high); border-color: var(--tm-status-border-warning); background-color: var(--tm-risk-background-high); }
      [data-risk="medium"], [data-tone="medium"], [data-tone="warning"], [data-severity="warning"], [data-status*="pending"], [data-status*="watch"], [data-status*="degraded"], [data-status*="escalated"], [data-health="degraded"], [data-state="empty"], [data-state="mock"], [data-state="degraded"], [data-approval="pending"], [data-approval="escalated"] { color: var(--tm-risk-medium); border-color: var(--tm-status-border-warning); background-color: var(--tm-risk-background-medium); }
      [data-status*="pending"], [data-approval="pending"] { color: var(--tm-approval-pending); background-color: var(--tm-approval-background-pending); }
      [data-risk="low"], [data-tone="low"], [data-tone="ok"], [data-status*="ready"], [data-status*="healthy"], [data-status*="approved"], [data-status*="online"], [data-health="good"], [data-approval="approved"] { color: var(--tm-status-ready); border-color: var(--tm-status-border-ready); background-color: var(--tm-status-background-ready); }
      [data-risk="low"] { color: var(--tm-risk-low); background-color: var(--tm-risk-background-low); }
      [data-risk="medium"] { color: var(--tm-risk-medium); background-color: var(--tm-risk-background-medium); }
      [data-status*="approved"], [data-approval="approved"] { color: var(--tm-approval-approved); background-color: var(--tm-approval-background-approved); }
      [data-status*="rejected"], [data-status*="expired"], [data-approval="rejected"], [data-approval="expired"] { color: var(--tm-approval-rejected); background-color: var(--tm-approval-background-rejected); }
      [data-health="good"] { color: var(--tm-twin-health-good); }
      [data-health="degraded"] { color: var(--tm-twin-health-degraded); }
      [data-health="failed"] { color: var(--tm-twin-health-failed); }
      [data-confidence="low"] { color: var(--tm-ai-confidence-low); border-color: var(--tm-status-border-critical); background-color: var(--tm-status-background-critical); }
      [data-confidence="medium"] { color: var(--tm-ai-confidence-medium); border-color: var(--tm-status-border-warning); background-color: var(--tm-status-background-warning); }
      [data-confidence="high"] { color: var(--tm-ai-confidence-high); border-color: var(--tm-status-border-ready); background-color: var(--tm-status-background-ready); }
      [data-tone="info"], [data-tone="nominal"], [data-tone="advisory"], [data-severity="info"], [data-severity="advisory"], [data-audit="info"], [data-audit="sealed"], [data-status*="visible"] { color: var(--tm-severity-info); border-color: var(--tm-status-border-info); background-color: var(--tm-status-background-info); }
      [data-audit="warning"] { color: var(--tm-audit-warning); border-color: var(--tm-status-border-warning); background-color: var(--tm-status-background-warning); }
      [data-audit="critical"] { color: var(--tm-audit-critical); border-color: var(--tm-status-border-critical); background-color: var(--tm-status-background-critical); }
      [data-audit="sealed"] { color: var(--tm-audit-sealed); }
      table { width: 100%; min-width: var(--tm-layout-table-min); border-collapse: collapse; }
      .data-table-shell { overflow-x: auto; }
      th, td { border-bottom: var(--tm-border-width) solid var(--tm-card-border); padding: var(--tm-space-2); text-align: left; }
      button, select, summary, input:not([type="checkbox"]) { min-height: var(--tm-density-control-height); border-radius: var(--tm-radius-md); border: var(--tm-border-width) solid var(--tm-card-border); padding: var(--tm-density-control-pad-y) var(--tm-density-control-pad-x); background: var(--tm-background-control); color: var(--tm-text-primary); }
      button { cursor: pointer; }
      button:disabled { opacity: .65; cursor: not-allowed; border-style: dashed; }
      label { display: block; margin: var(--tm-space-1) 0; }
      .track-map-canvas { position: relative; min-height: 24rem; border: var(--tm-border-width) solid var(--tm-card-border); border-radius: var(--tm-radius-md); padding: var(--tm-space-4); overflow: hidden; background: var(--tm-map-canvas-bg); box-shadow: var(--tm-elevation-panel); }
      .track-sector-ring { display: grid; grid-template-columns: repeat(var(--tm-track-sector-count), minmax(0, 1fr)); gap: var(--tm-space-2); min-height: 8rem; align-items: end; padding: 0; }
      .track-sector-pill { list-style: none; min-height: var(--tm-track-sector-height); border: var(--tm-border-width) solid var(--tm-card-border); border-radius: var(--tm-radius-pill); padding: var(--tm-space-3); background: var(--tm-card-bg-raised); }
      .track-map-marker { position: absolute; left: var(--tm-map-marker-left); top: var(--tm-map-marker-top); max-width: 16rem; background: var(--tm-card-bg); border: var(--tm-border-width) solid var(--tm-border-strong); border-radius: var(--tm-radius-sm); padding: var(--tm-space-2); opacity: var(--tm-map-marker-opacity); box-shadow: var(--tm-elevation-panel); }
      .track-map-marker--current { bottom: var(--tm-map-marker-offset); }
      .track-map-marker--target { bottom: var(--tm-map-marker-stacked-offset); }
      .track-map-marker summary { cursor: pointer; }
      :focus-visible, .focus-card:focus-visible, [tabindex]:focus-visible { outline: 3px solid var(--tm-border-focus); outline-offset: 3px; box-shadow: var(--tm-elevation-focus); }
      @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }
      @media (prefers-contrast: more) { :root { --tm-card-border: var(--tm-border-strong); } header, section, aside, article, .map-legend > div { border-width: 2px; } }
      @media (max-width: 1100px) { main.nexus-shell { grid-template-columns: var(--tm-layout-sidebar-min) minmax(0, 1fr); } .workspace-grid, .card-grid, .action-rail, .metric-strip, .notification-list, .map-legend, .workspace-frame__contexts { grid-template-columns: repeat(auto-fit, minmax(var(--tm-layout-grid-min-condensed), 1fr)); } }
      @media (max-width: 900px) { main.nexus-shell { grid-template-columns: 1fr; } main.nexus-shell > :not(.skip-link), .workspace-content { grid-column: 1; grid-row: auto; } .sidebar, .nexus-sidebar { display: none; position: static; max-height: none; } nav[aria-label="Mobile navigation"] { display: block; } .command-bar, .command-bar--shared, .split-pane, .workspace-frame__contexts, .operations-command-cockpit > .workspace-grid { grid-template-columns: 1fr; } }
      @media (max-width: 640px) { main.nexus-shell { padding: var(--tm-space-2); gap: var(--tm-space-2); } header, section, aside, article, .map-legend > div { padding: var(--tm-density-control-pad-x); margin: var(--tm-space-1) 0; border-radius: var(--tm-radius-md); } h1 { font-size: 1.7rem; } h2 { font-size: 1.25rem; } .jump-links, .map-controls, .filter-bar > div { display: grid; grid-template-columns: 1fr; } .workspace-grid, .card-grid, .action-rail, .metric-strip, .notification-list, .map-legend, .workspace-frame__contexts { grid-template-columns: 1fr; } .track-map-marker { position: static; max-width: none; margin-block: var(--tm-space-2); } }
    </style>
  </head>
  <body>
    <div role="status" class="render-mode-banner">TrackMind dashboard rendered in ${mode} mode.</div>
    ${body}
  </body>
</html>`;

async function renderDashboard(path = '/operations', requestId = createRequestId()) {
  const roles = ((process.env.TRACKMIND_ROLES ?? 'admin').split(',').map((role) => role.trim()).filter(Boolean) as Role[]) || ['admin'];
  const apiBase = process.env.TRACKMIND_API_BASE_URL ?? `http://127.0.0.1:4000${nexusApiBasePath}`;
  const clientContext = {
    requestId,
    tenantId: process.env.TRACKMIND_TENANT_ID ?? 'trackmind',
    racetrackId: process.env.TRACKMIND_RACETRACK_ID ?? 'main-track',
    authToken: process.env.TRACKMIND_API_AUTH_TOKEN,
  };
  try {
    const data = await loadCommandCenter(createNexusClient(true, apiBase, clientContext));
    return html(renderToStaticMarkup(<CommandCenter data={data} roles={roles} path={path} serviceState="online" />), 'live');
  } catch (error) {
    structuredLog('warning', 'dashboard.render.degraded', { requestId, path, apiBase, message: errorMessage(error) });
    const data = await loadCommandCenter(createNexusClient(false));
    return html(renderToStaticMarkup(<CommandCenter data={data} roles={roles} path={path} serviceState="degraded" />), `mock fallback (live data unavailable; request ${requestId})`);
  }
}

export function createTrackMindDashboardServer() {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const requestId = requestIdFromHeader(req.headers['x-trackmind-request-id']) ?? createRequestId();
    const startedAt = Date.now();
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname === '/health') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'x-trackmind-request-id': requestId });
        res.end(JSON.stringify({ ok: true, service: 'trackmind-dashboard', status: 'healthy', requestId, time: now(), apiBase: process.env.TRACKMIND_API_BASE_URL ?? `http://127.0.0.1:4000${nexusApiBasePath}`, observability: { structuredLogs: true, requestIdHeader: 'x-trackmind-request-id', degradedFallbackMode: 'mock-read-only' } }));
        structuredLog('info', 'dashboard.request.completed', { requestId, path: url.pathname, status: 200, durationMs: Date.now() - startedAt });
        return;
      }
      const alias = routeAliasForPath(url.pathname);
      if (alias?.status === 'redirect') {
        const location = `${canonicalPathForRoute(url.pathname)}${url.search}`;
        res.writeHead(308, { location, 'content-type': 'text/plain; charset=utf-8', 'x-trackmind-request-id': requestId });
        res.end(`TrackMind Nexus route moved to ${location}`);
        structuredLog('info', 'dashboard.request.completed', { requestId, path: url.pathname, status: 308, durationMs: Date.now() - startedAt });
        return;
      }
      const status = isKnownRoutePath(url.pathname) ? 200 : 404;
      res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'x-trackmind-request-id': requestId });
      res.end(await renderDashboard(url.pathname, requestId));
      structuredLog('info', 'dashboard.request.completed', { requestId, path: url.pathname, status, durationMs: Date.now() - startedAt });
    } catch (error) {
      structuredLog('error', 'dashboard.request.failed', { requestId, path: req.url ?? '/', status: 500, durationMs: Date.now() - startedAt, message: errorMessage(error) });
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'x-trackmind-request-id': requestId });
      res.end(JSON.stringify({ ok: false, error: { code: 'dashboard_render_error', message: 'TrackMind dashboard request failed', path: req.url ?? '/', requestId, timestamp: now() } }));
    }
  });
}

export function startTrackMindDashboardServer(port = Number(process.env.PORT ?? 5173), host = process.env.HOST ?? '127.0.0.1') {
  const server = createTrackMindDashboardServer();
  server.listen(port, host, () => console.log(`TrackMind dashboard listening on http://${host}:${port}`));
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) startTrackMindDashboardServer();
