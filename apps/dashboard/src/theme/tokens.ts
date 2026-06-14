export type TokenTree = { readonly [key: string]: string | TokenTree };

export const themeModes = [
  {
    id: 'command-center-dark',
    label: 'Command Center Dark',
    colorScheme: 'dark',
    selectors: [':root', '[data-theme="command-center-dark"]'],
    description: 'Default low-glare operations center theme for race-day command surfaces.',
  },
  {
    id: 'light',
    label: 'Light',
    colorScheme: 'light',
    selectors: ['[data-theme="light"]'],
    description: 'Bright operating mode for daylight or printed review workflows.',
  },
  {
    id: 'high-contrast',
    label: 'High Contrast',
    colorScheme: 'dark',
    selectors: ['[data-theme="high-contrast"]'],
    description: 'Maximum contrast mode for accessible command-center review.',
  },
] as const;

export type ThemeModeId = typeof themeModes[number]['id'];

export const DEFAULT_THEME_MODE: ThemeModeId = 'command-center-dark';

export const densityLevels = [
  {
    id: 'compact',
    label: 'Compact',
    description: 'Higher information density for wallboards and expert operators.',
    tokens: {
      controlHeight: '36px',
      controlPadY: '.32rem',
      controlPadX: '.5rem',
      cardPadding: 'var(--tm-space-2)',
      layoutCardGap: 'var(--tm-space-2)',
    },
  },
  {
    id: 'comfortable',
    label: 'Comfortable',
    description: 'Default balanced density for desktop command-center use.',
    tokens: {
      controlHeight: '44px',
      controlPadY: '.45rem',
      controlPadX: '.65rem',
      cardPadding: 'var(--tm-space-3)',
      layoutCardGap: 'var(--tm-space-3)',
    },
  },
  {
    id: 'spacious',
    label: 'Spacious',
    description: 'Larger targets and spacing for touch review and shared displays.',
    tokens: {
      controlHeight: '52px',
      controlPadY: '.6rem',
      controlPadX: '.85rem',
      cardPadding: 'var(--tm-space-4)',
      layoutCardGap: 'var(--tm-space-4)',
    },
  },
] as const;

export type DensityLevelId = typeof densityLevels[number]['id'];

export const DEFAULT_DENSITY_LEVEL: DensityLevelId = 'comfortable';

export const requiredSemanticTokenPaths = [
  'background.app',
  'background.panel',
  'background.critical',
  'border.subtle',
  'text.primary',
  'text.muted',
  'status.ready',
  'status.warning',
  'status.critical',
  'risk.low',
  'risk.medium',
  'risk.high',
  'approval.pending',
  'approval.approved',
  'approval.rejected',
  'ai.confidence.low',
  'ai.confidence.medium',
  'ai.confidence.high',
  'twin.health.good',
  'twin.health.degraded',
  'twin.health.failed',
] as const;

export type RequiredSemanticTokenPath = typeof requiredSemanticTokenPaths[number];

const commandCenterDarkTokens = {
  brand: {
    primary: '#60a5fa',
    secondary: '#14b8a6',
    accent: '#f59e0b',
    rendered: '#0f766e',
    danger: '#f87171',
  },
  background: {
    app: '#08111f',
    'app-aura': 'rgba(30, 58, 95, .45)',
    panel: '#101b2d',
    'panel-translucent': 'rgba(16, 27, 45, .86)',
    raised: '#13233a',
    'raised-translucent': 'rgba(19, 35, 58, .42)',
    control: '#0f172a',
    critical: 'rgba(248, 113, 113, .12)',
    shell: 'linear-gradient(180deg, rgba(16, 27, 45, .98), rgba(8, 17, 31, .96))',
    route: 'linear-gradient(135deg, rgba(30, 58, 95, .78), rgba(16, 27, 45, .92))',
    'page-header': 'linear-gradient(135deg, rgba(19, 35, 58, .96), rgba(8, 17, 31, .96))',
    'workspace-frame': 'linear-gradient(135deg, rgba(15, 23, 42, .94), rgba(16, 27, 45, .9))',
    'map-canvas': 'linear-gradient(135deg, rgba(19, 35, 58, .88), rgba(8, 17, 31, .94))',
  },
  border: {
    subtle: '#2f4564',
    strong: '#475569',
    'strong-muted': 'rgba(71, 85, 105, .7)',
    'accent-subtle': 'rgba(96, 165, 250, .24)',
    'accent-muted': 'rgba(96, 165, 250, .32)',
    'accent-strong': 'rgba(96, 165, 250, .36)',
    focus: '#fde68a',
  },
  text: {
    primary: '#e6edf7',
    muted: '#b8c7dc',
    inverse: '#111827',
    link: '#bfdbfe',
    'link-hover': '#dbeafe',
    'on-strong': '#ffffff',
  },
  status: {
    ready: '#bbf7d0',
    info: '#bfdbfe',
    warning: '#fed7aa',
    critical: '#fecaca',
  },
  'status-background': {
    ready: 'rgba(34, 197, 94, .1)',
    info: 'rgba(96, 165, 250, .1)',
    warning: 'rgba(251, 146, 60, .12)',
    critical: 'rgba(248, 113, 113, .12)',
  },
  'status-border': {
    ready: '#4ade80',
    info: '#60a5fa',
    warning: '#fb923c',
    critical: '#f87171',
  },
  risk: {
    low: '#bbf7d0',
    medium: '#fed7aa',
    high: '#fed7aa',
    critical: '#fecaca',
  },
  'risk-background': {
    low: 'rgba(34, 197, 94, .1)',
    medium: 'rgba(251, 146, 60, .12)',
    high: 'rgba(251, 146, 60, .16)',
    critical: 'rgba(248, 113, 113, .12)',
  },
  severity: {
    info: '#bfdbfe',
    advisory: '#bfdbfe',
    warning: '#fed7aa',
    critical: '#fecaca',
  },
  approval: {
    pending: '#fed7aa',
    approved: '#bbf7d0',
    rejected: '#fecaca',
    expired: '#fecaca',
  },
  'approval-background': {
    pending: 'rgba(251, 146, 60, .12)',
    approved: 'rgba(34, 197, 94, .1)',
    rejected: 'rgba(248, 113, 113, .12)',
    expired: 'rgba(248, 113, 113, .12)',
  },
  ai: {
    confidence: {
      low: '#fecaca',
      medium: '#fed7aa',
      high: '#bbf7d0',
    },
  },
  audit: {
    info: '#bfdbfe',
    warning: '#fed7aa',
    critical: '#fecaca',
    sealed: '#dbeafe',
  },
  twin: {
    health: {
      good: '#bbf7d0',
      degraded: '#fed7aa',
      failed: '#fecaca',
    },
  },
} as const satisfies TokenTree;

const lightTokens = {
  brand: {
    primary: '#2563eb',
    secondary: '#0f766e',
    accent: '#b45309',
    rendered: '#0f766e',
    danger: '#b91c1c',
  },
  background: {
    app: '#f8fafc',
    'app-aura': 'rgba(219, 234, 254, .66)',
    panel: '#ffffff',
    'panel-translucent': 'rgba(255, 255, 255, .92)',
    raised: '#eaf1f8',
    'raised-translucent': 'rgba(226, 232, 240, .64)',
    control: '#f1f5f9',
    critical: '#fee2e2',
    shell: 'linear-gradient(180deg, rgba(255, 255, 255, .98), rgba(241, 245, 249, .96))',
    route: 'linear-gradient(135deg, rgba(219, 234, 254, .72), rgba(255, 255, 255, .94))',
    'page-header': 'linear-gradient(135deg, rgba(255, 255, 255, .98), rgba(226, 232, 240, .92))',
    'workspace-frame': 'linear-gradient(135deg, rgba(255, 255, 255, .96), rgba(241, 245, 249, .92))',
    'map-canvas': 'linear-gradient(135deg, rgba(219, 234, 254, .92), rgba(248, 250, 252, .98))',
  },
  border: {
    subtle: '#cbd5e1',
    strong: '#64748b',
    'strong-muted': 'rgba(100, 116, 139, .72)',
    'accent-subtle': 'rgba(37, 99, 235, .24)',
    'accent-muted': 'rgba(37, 99, 235, .32)',
    'accent-strong': 'rgba(37, 99, 235, .4)',
    focus: '#92400e',
  },
  text: {
    primary: '#0f172a',
    muted: '#475569',
    inverse: '#f8fafc',
    link: '#1d4ed8',
    'link-hover': '#1e40af',
    'on-strong': '#ffffff',
  },
  status: {
    ready: '#166534',
    info: '#1d4ed8',
    warning: '#92400e',
    critical: '#991b1b',
  },
  'status-background': {
    ready: '#dcfce7',
    info: '#dbeafe',
    warning: '#ffedd5',
    critical: '#fee2e2',
  },
  'status-border': {
    ready: '#22c55e',
    info: '#3b82f6',
    warning: '#f97316',
    critical: '#ef4444',
  },
  risk: {
    low: '#166534',
    medium: '#92400e',
    high: '#9a3412',
    critical: '#991b1b',
  },
  'risk-background': {
    low: '#dcfce7',
    medium: '#ffedd5',
    high: '#fed7aa',
    critical: '#fee2e2',
  },
  severity: {
    info: '#1d4ed8',
    advisory: '#1d4ed8',
    warning: '#92400e',
    critical: '#991b1b',
  },
  approval: {
    pending: '#92400e',
    approved: '#166534',
    rejected: '#991b1b',
    expired: '#991b1b',
  },
  'approval-background': {
    pending: '#ffedd5',
    approved: '#dcfce7',
    rejected: '#fee2e2',
    expired: '#fee2e2',
  },
  ai: {
    confidence: {
      low: '#991b1b',
      medium: '#92400e',
      high: '#166534',
    },
  },
  audit: {
    info: '#1d4ed8',
    warning: '#92400e',
    critical: '#991b1b',
    sealed: '#334155',
  },
  twin: {
    health: {
      good: '#166534',
      degraded: '#92400e',
      failed: '#991b1b',
    },
  },
} as const satisfies TokenTree;

const highContrastTokens = {
  brand: {
    primary: '#93c5fd',
    secondary: '#5eead4',
    accent: '#fde047',
    rendered: '#2dd4bf',
    danger: '#fca5a5',
  },
  background: {
    app: '#000000',
    'app-aura': '#111827',
    panel: '#0b0f19',
    'panel-translucent': '#0b0f19',
    raised: '#111827',
    'raised-translucent': '#111827',
    control: '#000000',
    critical: '#450a0a',
    shell: 'linear-gradient(180deg, #000000, #111827)',
    route: 'linear-gradient(135deg, #000000, #111827)',
    'page-header': 'linear-gradient(135deg, #111827, #000000)',
    'workspace-frame': 'linear-gradient(135deg, #000000, #111827)',
    'map-canvas': 'linear-gradient(135deg, #111827, #000000)',
  },
  border: {
    subtle: '#ffffff',
    strong: '#ffffff',
    'strong-muted': '#ffffff',
    'accent-subtle': '#ffffff',
    'accent-muted': '#ffffff',
    'accent-strong': '#ffffff',
    focus: '#ffffff',
  },
  text: {
    primary: '#ffffff',
    muted: '#e5e7eb',
    inverse: '#000000',
    link: '#ffffff',
    'link-hover': '#fef08a',
    'on-strong': '#ffffff',
  },
  status: {
    ready: '#86efac',
    info: '#bfdbfe',
    warning: '#fde047',
    critical: '#fca5a5',
  },
  'status-background': {
    ready: '#052e16',
    info: '#172554',
    warning: '#422006',
    critical: '#450a0a',
  },
  'status-border': {
    ready: '#86efac',
    info: '#bfdbfe',
    warning: '#fde047',
    critical: '#fca5a5',
  },
  risk: {
    low: '#86efac',
    medium: '#fde047',
    high: '#fdba74',
    critical: '#fca5a5',
  },
  'risk-background': {
    low: '#052e16',
    medium: '#422006',
    high: '#431407',
    critical: '#450a0a',
  },
  severity: {
    info: '#bfdbfe',
    advisory: '#bfdbfe',
    warning: '#fde047',
    critical: '#fca5a5',
  },
  approval: {
    pending: '#fde047',
    approved: '#86efac',
    rejected: '#fca5a5',
    expired: '#fca5a5',
  },
  'approval-background': {
    pending: '#422006',
    approved: '#052e16',
    rejected: '#450a0a',
    expired: '#450a0a',
  },
  ai: {
    confidence: {
      low: '#fca5a5',
      medium: '#fde047',
      high: '#86efac',
    },
  },
  audit: {
    info: '#bfdbfe',
    warning: '#fde047',
    critical: '#fca5a5',
    sealed: '#ffffff',
  },
  twin: {
    health: {
      good: '#86efac',
      degraded: '#fde047',
      failed: '#fca5a5',
    },
  },
} as const satisfies TokenTree;

export const semanticTokensByMode: Record<ThemeModeId, TokenTree> = {
  'command-center-dark': commandCenterDarkTokens,
  light: lightTokens,
  'high-contrast': highContrastTokens,
};

export const baseDesignTokens = {
  '--tm-font-family': '"Segoe UI", Arial, sans-serif',
  '--tm-font-size-xs': '.75rem',
  '--tm-font-size-sm': '.875rem',
  '--tm-font-size-md': '1rem',
  '--tm-font-size-lg': '1.25rem',
  '--tm-font-size-xl': 'clamp(1.7rem, 4vw, 2.4rem)',
  '--tm-font-size-2xl': 'clamp(2rem, 5vw, 3rem)',
  '--tm-line-height-tight': '1.2',
  '--tm-line-height': '1.5',
  '--tm-letter-spacing-label': '.04em',
  '--tm-space-0': '0',
  '--tm-space-1': '.25rem',
  '--tm-space-2': '.5rem',
  '--tm-space-3': '.75rem',
  '--tm-space-4': '1rem',
  '--tm-space-5': '1.25rem',
  '--tm-space-6': '1.5rem',
  '--tm-space-7': '2rem',
  '--tm-space-8': '2.5rem',
  '--tm-space-9': '3rem',
  '--tm-space-10': '4rem',
  '--tm-radius-sm': '.5rem',
  '--tm-radius-md': '.625rem',
  '--tm-radius-lg': '.75rem',
  '--tm-radius-pill': '999px',
  '--tm-border-width': '1px',
  '--tm-elevation-panel': '0 8px 24px rgba(2, 6, 23, .18)',
  '--tm-elevation-card': '0 16px 40px rgba(2, 6, 23, .24)',
  '--tm-elevation-raised': '0 22px 60px rgba(2, 6, 23, .3)',
  '--tm-elevation-focus': '0 0 0 6px rgba(253, 230, 138, .16)',
  '--tm-layout-shell-max': '1640px',
  '--tm-layout-page-max': '1360px',
  '--tm-layout-readable-max': '76rem',
  '--tm-layout-gutter': 'clamp(var(--tm-space-3), 2vw, var(--tm-space-6))',
  '--tm-layout-section-gap': 'clamp(var(--tm-space-3), 1.4vw, var(--tm-space-5))',
  '--tm-layout-panel-padding': 'clamp(var(--tm-space-3), 1.5vw, var(--tm-space-5))',
  '--tm-layout-grid-min': '220px',
  '--tm-layout-grid-min-condensed': '190px',
  '--tm-layout-sidebar-min': '220px',
  '--tm-layout-sidebar-max': '280px',
  '--tm-layout-table-min': '42rem',
  '--tm-track-sector-count': '1',
  '--tm-track-sector-height': '8rem',
  '--tm-map-marker-offset': 'var(--tm-space-4)',
  '--tm-map-marker-stacked-offset': '5.5rem',
  '--tm-map-marker-left': 'auto',
  '--tm-map-marker-top': 'auto',
  '--tm-map-marker-opacity': '1',
  '--tm-breakpoint-sm': '640px',
  '--tm-breakpoint-md': '900px',
  '--tm-breakpoint-lg': '1100px',
} as const;

export function cssVariableForTokenPath(path: string) {
  return `--tm-${path.replace(/\./g, '-')}`;
}

export function flattenTokenEntries(tokens: TokenTree, parentPath: string[] = []): Array<{ path: string; variable: string; value: string }> {
  return Object.entries(tokens).flatMap(([key, value]) => {
    const path = [...parentPath, key];
    if (typeof value === 'string') {
      const dottedPath = path.join('.');
      return [{ path: dottedPath, variable: cssVariableForTokenPath(dottedPath), value }];
    }
    return flattenTokenEntries(value, path);
  });
}

export function semanticTokenValue(mode: ThemeModeId, path: string) {
  const segments = path.split('.');
  let cursor: string | TokenTree = semanticTokensByMode[mode];
  for (const segment of segments) {
    if (typeof cursor === 'string' || !(segment in cursor)) return undefined;
    cursor = cursor[segment];
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

function cssRule(selector: string, entries: ReadonlyArray<readonly [string, string]>) {
  const declarations = entries.map(([property, value]) => `        ${property}: ${value};`).join('\n');
  return `      ${selector} {\n${declarations}\n      }`;
}

const legacyTokenAliases = [
  ['--tm-color-bg', 'var(--tm-background-app)'],
  ['--tm-color-surface', 'var(--tm-background-panel)'],
  ['--tm-color-surface-raised', 'var(--tm-background-raised)'],
  ['--tm-color-surface-control', 'var(--tm-background-control)'],
  ['--tm-color-service-rendered', 'var(--tm-brand-rendered)'],
  ['--tm-color-border', 'var(--tm-border-subtle)'],
  ['--tm-color-border-strong', 'var(--tm-border-strong)'],
  ['--tm-color-text', 'var(--tm-text-primary)'],
  ['--tm-color-muted', 'var(--tm-text-muted)'],
  ['--tm-color-link', 'var(--tm-text-link)'],
  ['--tm-color-link-hover', 'var(--tm-text-link-hover)'],
  ['--tm-color-focus', 'var(--tm-border-focus)'],
  ['--tm-color-inverse-text', 'var(--tm-text-inverse)'],
  ['--tm-color-navigation-active-bg', 'var(--tm-background-raised)'],
  ['--tm-color-navigation-active-border', 'var(--tm-brand-primary)'],
  ['--tm-color-status-ok', 'var(--tm-status-ready)'],
  ['--tm-color-status-info', 'var(--tm-status-info)'],
  ['--tm-color-status-warning', 'var(--tm-status-warning)'],
  ['--tm-color-status-critical', 'var(--tm-status-critical)'],
  ['--tm-color-status-ok-bg', 'var(--tm-status-background-ready)'],
  ['--tm-color-status-info-bg', 'var(--tm-status-background-info)'],
  ['--tm-color-status-warning-bg', 'var(--tm-status-background-warning)'],
  ['--tm-color-status-critical-bg', 'var(--tm-status-background-critical)'],
  ['--tm-color-status-ok-border', 'var(--tm-status-border-ready)'],
  ['--tm-color-status-info-border', 'var(--tm-status-border-info)'],
  ['--tm-color-status-warning-border', 'var(--tm-status-border-warning)'],
  ['--tm-color-status-critical-border', 'var(--tm-status-border-critical)'],
  ['--tm-color-risk-low', 'var(--tm-risk-low)'],
  ['--tm-color-risk-medium', 'var(--tm-risk-medium)'],
  ['--tm-color-risk-high', 'var(--tm-risk-high)'],
  ['--tm-color-risk-critical', 'var(--tm-risk-critical)'],
  ['--tm-color-risk-low-bg', 'var(--tm-risk-background-low)'],
  ['--tm-color-risk-medium-bg', 'var(--tm-risk-background-medium)'],
  ['--tm-color-risk-high-bg', 'var(--tm-risk-background-high)'],
  ['--tm-color-risk-critical-bg', 'var(--tm-risk-background-critical)'],
  ['--tm-card-bg', 'var(--tm-background-panel)'],
  ['--tm-card-bg-raised', 'var(--tm-background-raised)'],
  ['--tm-card-border', 'var(--tm-border-subtle)'],
  ['--tm-card-radius', 'var(--tm-radius-lg)'],
  ['--tm-map-canvas-bg', 'var(--tm-background-map-canvas)'],
  ['--bg', 'var(--tm-background-app)'],
  ['--panel', 'var(--tm-background-panel)'],
  ['--panel-strong', 'var(--tm-background-raised)'],
  ['--border', 'var(--tm-border-subtle)'],
  ['--text', 'var(--tm-text-primary)'],
  ['--muted', 'var(--tm-text-muted)'],
  ['--link', 'var(--tm-text-link)'],
  ['--focus', 'var(--tm-border-focus)'],
  ['--ok', 'var(--tm-status-ready)'],
  ['--warn', 'var(--tm-status-warning)'],
  ['--critical', 'var(--tm-status-critical)'],
] as const;

function createBaseCss() {
  return cssRule(':root', Object.entries(baseDesignTokens));
}

function createModeCss() {
  return themeModes.map((mode) => {
    const semanticEntries = flattenTokenEntries(semanticTokensByMode[mode.id]).map(({ variable, value }) => [variable, value] as const);
    return cssRule(mode.selectors.join(', '), [
      ['color-scheme', mode.colorScheme],
      ...semanticEntries,
      ...legacyTokenAliases,
    ]);
  }).join('\n');
}

function createDensityCss() {
  return densityLevels.map((density) => cssRule(`[data-density="${density.id}"]`, [
    ['--tm-density-control-height', density.tokens.controlHeight],
    ['--tm-density-control-pad-y', density.tokens.controlPadY],
    ['--tm-density-control-pad-x', density.tokens.controlPadX],
    ['--tm-density-card-padding', density.tokens.cardPadding],
    ['--tm-layout-card-gap', density.tokens.layoutCardGap],
  ])).join('\n');
}

export function createDashboardThemeCss() {
  return [
    createBaseCss(),
    createModeCss(),
    createDensityCss(),
  ].join('\n');
}

export const dashboardThemeCss = createDashboardThemeCss();
