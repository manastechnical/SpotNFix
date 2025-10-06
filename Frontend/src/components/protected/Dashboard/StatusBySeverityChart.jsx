import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiConnector } from '@/services/Connector';
import { potholeEndpoints } from '@/services/Apis';

const STATUS_ORDER = ['reported', 'under_review', 'fixed', 'discarded', 'reopened', 'completed', 'ongoing', 'accepted', 'pending', 'unknown'];
const COLORS = {
  reported: '#f59e0b',
  under_review: '#06b6d4',
  fixed: '#22c55e',
  discarded: '#a3a3a3',
  reopened: '#ef4444',
  completed: '#16a34a',
  ongoing: '#3b82f6',
  accepted: '#8b5cf6',
  pending: '#eab308',
  unknown: '#6b7280'
};

function groupBySeverity(series) {
  const map = new Map();
  for (const item of series) {
    const key = item.severity || 'Unknown';
    if (!map.has(key)) map.set(key, {});
    const statusMap = map.get(key);
    statusMap[item.status || 'unknown'] = item.count;
  }
  return map;
}

const Legend = ({ statuses }) => (
  <div className="flex flex-wrap gap-3 mt-4 text-xs">
    {statuses.map((s) => (
      <div key={s} className="flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: COLORS[s] || COLORS.unknown }} />
        <span className="text-gray-300">{s.replace(/_/g, ' ')}</span>
      </div>
    ))}
  </div>
);

const Bar = ({ width, height, color, x, y, title }) => (
  <rect x={x} y={y} width={width} height={height} fill={color}>
    <title>{title}</title>
  </rect>
);

const StatusBySeverityChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const [width, setWidth] = useState(760);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await apiConnector('GET', potholeEndpoints.DASHBOARD_STATUS_BY_SEVERITY);
        if (mounted) setData(res.data?.series || []);
      } catch (e) {
        if (mounted) setError('Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Resize observer for responsive width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setWidth(Math.max(320, Math.min(900, w)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { grouped, severities, statuses, maxTotal } = useMemo(() => {
    const groupedMap = groupBySeverity(data);
    const severitiesLocal = Array.from(groupedMap.keys());
    const statusesLocal = STATUS_ORDER.filter((s) => data.some(d => (d.status || 'unknown') === s));
    const max = Math.max(1, ...severitiesLocal.map((sev) => {
      const m = groupedMap.get(sev);
      return Object.values(m).reduce((a, b) => a + b, 0);
    }));
    return { grouped: groupedMap, severities: severitiesLocal, statuses: statusesLocal, maxTotal: max };
  }, [data]);

  if (loading) return <div className="text-gray-400">Loading chart…</div>;
  if (error) return <div className="text-red-400">{error}</div>;
  if (severities.length === 0) return <div className="text-gray-400">No data</div>;

  const isNarrow = width < 500;
  const baseGroupWidth = isNarrow ? 56 : 72;
  const baseGroupGap = isNarrow ? 16 : 28;
  const padding = { top: 10, right: 10, bottom: 40, left: isNarrow ? 56 : 80 };
  // Calculate a comfortable inner width based on number of groups so bars don't squash
  const desiredInnerWidth = Math.max(200, severities.length * baseGroupWidth + Math.max(0, severities.length - 1) * baseGroupGap);
  const chartWidth = Math.max(width, padding.left + padding.right + desiredInnerWidth);
  const chartHeight = isNarrow ? 240 : 280;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const barGap = 10;
  const groupGap = baseGroupGap;
  const xStep = (innerWidth - (severities.length - 1) * groupGap) / severities.length;

  const yScale = (value) => (value / maxTotal) * innerHeight;

  let xCursor = padding.left;

  return (
    <div ref={containerRef} className="bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700 overflow-x-auto">
      <h3 className="text-white font-semibold mb-2">Pothole status by severity</h3>
      <svg width={chartWidth} height={chartHeight} style={{ minWidth: '100%' }}>
        {/* Y axis grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1={padding.left}
              x2={chartWidth - padding.right}
              y1={chartHeight - padding.bottom - innerHeight * t}
              y2={chartHeight - padding.bottom - innerHeight * t}
              stroke="#374151"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 8}
              y={chartHeight - padding.bottom - innerHeight * t}
              textAnchor="end"
              alignmentBaseline="middle"
              fontSize="10"
              fill="#9CA3AF"
            >
              {Math.round(maxTotal * t)}
            </text>
          </g>
        ))}

        {severities.map((sev, i) => {
          const statusMap = grouped.get(sev) || {};
          const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
          const groupX = padding.left + i * (xStep + groupGap);
          let yCursor = chartHeight - padding.bottom;

          return (
            <g key={sev}>
              {/* Bars stacked */}
              {statuses.map((st) => {
                const value = statusMap[st] || 0;
                const h = yScale(value);
                yCursor -= h;
                return value > 0 ? (
                  <Bar
                    key={`${sev}-${st}`}
                    x={groupX}
                    y={yCursor}
                    width={xStep}
                    height={h}
                    color={COLORS[st] || COLORS.unknown}
                    title={`${sev}: ${st.replace(/_/g, ' ')} = ${value}`}
                  />
                ) : null;
              })}

              {/* X axis label and total */}
              <text
                x={groupX + xStep / 2}
                y={chartHeight - padding.bottom + 14}
                textAnchor="middle"
                fontSize="11"
                fill="#E5E7EB"
              >
                {sev}
              </text>
              <text
                x={groupX + xStep / 2}
                y={chartHeight - padding.bottom + 28}
                textAnchor="middle"
                fontSize="10"
                fill="#9CA3AF"
              >
                {total}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-3">
        <Legend statuses={statuses.slice(0, 8)} />
      </div>
    </div>
  );
};

export default StatusBySeverityChart;


