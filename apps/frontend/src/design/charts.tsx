import type { ReactElement } from 'react';
import type { ConsoleAction, ConsoleChart, ConsoleGraphEdge, ConsoleGraphNode, OpsPosture } from './opsTypes';

function postureClass(posture: OpsPosture): string {
  return `posture-badge posture-badge--${posture}`;
}

function postureColor(posture: OpsPosture = 'advisory'): string {
  const map: Record<OpsPosture, string> = {
    ready: 'var(--posture-ready)',
    watch: 'var(--posture-watch)',
    blocked: 'var(--posture-blocked)',
    critical: 'var(--posture-critical)',
    advisory: 'var(--posture-advisory)',
  };
  return map[posture];
}

export function OpsButton({
  action,
  onNavigate,
}: {
  action: ConsoleAction;
  onNavigate: (path: string) => void;
}): ReactElement {
  const tone = action.tone ?? 'secondary';
  return (
    <button
      type="button"
      className={`ops-button ops-button--${tone}`}
      title={action.detail}
      onClick={() => onNavigate(action.path)}
    >
      {action.label}
    </button>
  );
}

function ChartHeader({ chart, onNavigate }: { chart: ConsoleChart; onNavigate: (path: string) => void }): ReactElement {
  return (
    <header className="chart-panel__header">
      <div>
        <h3>{chart.title}</h3>
        {chart.description ? <p>{chart.description}</p> : null}
      </div>
      {chart.action ? <OpsButton action={chart.action} onNavigate={onNavigate} /> : null}
    </header>
  );
}

export function BarChartPanel({ chart }: { chart: ConsoleChart }): ReactElement {
  const series = chart.series ?? [];
  const max = chart.maxValue ?? Math.max(1, ...series.map((point) => point.value));

  return (
    <div className="chart-panel chart-panel--bar" role="img" aria-label={chart.title}>
      <svg viewBox={`0 0 ${Math.max(series.length * 48, 240)} 140`} className="chart-panel__svg">
        {series.map((point, index) => {
          const height = Math.max(4, (point.value / max) * 90);
          const x = 16 + index * 48;
          const y = 110 - height;
          return (
            <g key={point.id}>
              <rect
                x={x}
                y={y}
                width={32}
                height={height}
                rx={4}
                fill={postureColor(point.posture)}
                opacity={0.9}
              />
              <text x={x + 16} y={125} textAnchor="middle" className="chart-panel__label">
                {point.label.length > 6 ? `${point.label.slice(0, 5)}…` : point.label}
              </text>
              <title>{`${point.label}: ${point.value}${chart.unit ? ` ${chart.unit}` : ''}${point.detail ? ` — ${point.detail}` : ''}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DonutChartPanel({ chart }: { chart: ConsoleChart }): ReactElement {
  const series = chart.series ?? [];
  const total = series.reduce((sum, point) => sum + point.value, 0) || 1;
  let cursor = 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="chart-panel chart-panel--donut" role="img" aria-label={chart.title}>
      <svg viewBox="0 0 160 160" className="chart-panel__svg chart-panel__svg--donut">
        <circle cx={80} cy={80} r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth={14} />
        {series.map((point) => {
          const fraction = point.value / total;
          const dash = fraction * circumference;
          const segment = (
            <circle
              key={point.id}
              cx={80}
              cy={80}
              r={radius}
              fill="none"
              stroke={postureColor(point.posture)}
              strokeWidth={14}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-cursor * circumference + circumference / 4}
              transform="rotate(-90 80 80)"
            >
              <title>{`${point.label}: ${point.value}`}</title>
            </circle>
          );
          cursor += fraction;
          return segment;
        })}
        <text x={80} y={76} textAnchor="middle" className="chart-panel__donut-value">{total}</text>
        <text x={80} y={94} textAnchor="middle" className="chart-panel__donut-unit">{chart.unit ?? 'total'}</text>
      </svg>
      <ul className="chart-panel__legend">
        {series.map((point) => (
          <li key={point.id} className={postureClass(point.posture ?? 'advisory')}>
            <span>{point.label}</span>
            <strong>{point.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GaugeChartPanel({ chart }: { chart: ConsoleChart }): ReactElement {
  const value = chart.series?.[0]?.value ?? 0;
  const max = chart.maxValue ?? 100;
  const ratio = Math.min(1, Math.max(0, value / max));
  const posture = chart.series?.[0]?.posture ?? 'ready';

  return (
    <div className={`chart-panel chart-panel--gauge ${postureClass(posture)}`} role="img" aria-label={chart.title}>
      <svg viewBox="0 0 200 120" className="chart-panel__svg">
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--border-subtle)" strokeWidth={12} strokeLinecap="round" />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={postureColor(posture)}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${ratio * 251} 251`}
        />
        <text x={100} y={88} textAnchor="middle" className="chart-panel__gauge-value">{Math.round(value)}</text>
        <text x={100} y={106} textAnchor="middle" className="chart-panel__gauge-unit">{chart.unit ?? '%'}</text>
      </svg>
      {chart.series?.[0]?.label ? <p className="chart-panel__caption">{chart.series[0].label}</p> : null}
    </div>
  );
}

export function SparklineChartPanel({ chart }: { chart: ConsoleChart }): ReactElement {
  const series = chart.series ?? [];
  if (series.length < 2) {
    return (
      <div className="chart-panel chart-panel--sparkline">
        <p className="chart-panel__caption">{series[0] ? `${series[0].label}: ${series[0].value}` : 'Insufficient series data'}</p>
      </div>
    );
  }

  const max = chart.maxValue ?? Math.max(...series.map((point) => point.value), 1);
  const min = Math.min(...series.map((point) => point.value));
  const width = 240;
  const height = 80;
  const points = series.map((point, index) => {
    const x = (index / (series.length - 1)) * width;
    const y = height - ((point.value - min) / Math.max(max - min, 1)) * (height - 12) - 6;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="chart-panel chart-panel--sparkline" role="img" aria-label={chart.title}>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-panel__svg">
        <polyline points={points} fill="none" stroke="var(--accent-operational)" strokeWidth={2.5} />
        {series.map((point, index) => {
          const x = (index / (series.length - 1)) * width;
          const y = height - ((point.value - min) / Math.max(max - min, 1)) * (height - 12) - 6;
          return <circle key={point.id} cx={x} cy={y} r={3} fill={postureColor(point.posture)}><title>{`${point.label}: ${point.value}`}</title></circle>;
        })}
      </svg>
    </div>
  );
}

export function TimelineChartPanel({ chart }: { chart: ConsoleChart }): ReactElement {
  const series = chart.series ?? [];

  return (
    <div className="chart-panel chart-panel--timeline" role="img" aria-label={chart.title}>
      <ol className="chart-panel__timeline">
        {series.map((point) => (
          <li key={point.id} className={postureClass(point.posture ?? 'advisory')}>
            <span className="chart-panel__timeline-dot" aria-hidden="true" />
            <div>
              <strong>{point.label}</strong>
              <p>{point.detail ?? String(point.value)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function layoutGraph(nodes: ConsoleGraphNode[], edges: ConsoleGraphEdge[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const columns = Math.max(2, Math.ceil(Math.sqrt(nodes.length)));
  nodes.forEach((node, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    positions.set(node.id, { x: 40 + col * 90, y: 30 + row * 70 });
  });
  return positions;
}

export function LineageGraphPanel({ chart }: { chart: ConsoleChart }): ReactElement {
  const nodes = chart.nodes ?? [];
  const edges = chart.edges ?? [];
  const positions = layoutGraph(nodes, edges);
  const width = Math.max(240, ...[...positions.values()].map((point) => point.x)) + 40;
  const height = Math.max(160, ...[...positions.values()].map((point) => point.y)) + 40;

  return (
    <div className="chart-panel chart-panel--graph" role="img" aria-label={chart.title}>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-panel__svg chart-panel__svg--graph">
        {edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          return (
            <g key={edge.id}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="var(--border-subtle)" strokeWidth={1.5} markerEnd="url(#arrow)" />
              {edge.label ? (
                <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 4} textAnchor="middle" className="chart-panel__edge-label">
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="var(--border-subtle)" />
          </marker>
        </defs>
        {nodes.map((node) => {
          const point = positions.get(node.id);
          if (!point) return null;
          return (
            <g key={node.id}>
              <rect
                x={point.x - 36}
                y={point.y - 18}
                width={72}
                height={36}
                rx={8}
                fill="var(--surface-raised)"
                stroke={postureColor(node.posture)}
                strokeWidth={2}
              />
              <text x={point.x} y={point.y + 4} textAnchor="middle" className="chart-panel__node-label">
                {node.label.length > 10 ? `${node.label.slice(0, 9)}…` : node.label}
              </text>
              <title>{node.kind ? `${node.label} (${node.kind})` : node.label}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ChartBody({ chart }: { chart: ConsoleChart }): ReactElement {
  switch (chart.kind) {
    case 'bar': return <BarChartPanel chart={chart} />;
    case 'donut': return <DonutChartPanel chart={chart} />;
    case 'gauge': return <GaugeChartPanel chart={chart} />;
    case 'sparkline': return <SparklineChartPanel chart={chart} />;
    case 'timeline': return <TimelineChartPanel chart={chart} />;
    case 'graph': return <LineageGraphPanel chart={chart} />;
    default: return <BarChartPanel chart={chart} />;
  }
}

export function ChartRail({
  charts,
  onNavigate,
}: {
  charts: ConsoleChart[];
  onNavigate: (path: string) => void;
}): ReactElement {
  if (!charts.length) return <></>;

  return (
    <section className="chart-rail" aria-label="Operating charts">
      {charts.map((chart) => (
        <article className={`chart-rail__card chart-rail__card--${chart.kind}`} key={chart.id}>
          <ChartHeader chart={chart} onNavigate={onNavigate} />
          <ChartBody chart={chart} />
        </article>
      ))}
    </section>
  );
}
