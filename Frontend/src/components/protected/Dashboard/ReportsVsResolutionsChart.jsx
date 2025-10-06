import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiConnector } from '@/services/Connector';
import { dashboardEndpoints } from '@/services/Apis';

const COLORS = { reported: '#38bdf8', resolved: '#22c55e' };

const ReportsVsResolutionsChart = ({ days = 30 }) => {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const [width, setWidth] = useState(760);

  useEffect(() => {
    let mounted = true;
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
    (async () => {
      setLoading(true);
      try {
        const res = await apiConnector('GET', `${dashboardEndpoints.REPORTS_VS_RESOLUTIONS}?${params.toString()}`);
        if (mounted) setSeries(res.data?.series || []);
      } catch (e) {
        if (mounted) setError('Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [days]);

  // Resize observer for responsiveness
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

  const { maxY } = useMemo(() => {
    const m = Math.max(1, ...series.map(d => Math.max(d.reported || 0, d.resolved || 0)));
    return { maxY: m };
  }, [series]);

  if (loading) return <div className="text-gray-400">Loading chart…</div>;
  if (error) return <div className="text-red-400">{error}</div>;
  if (!series.length) return <div className="text-gray-400">No data</div>;

  const isNarrow = width < 500;
  const minPointWidth = isNarrow ? 22 : 18;
  const pad = { top: 10, right: 10, bottom: 40, left: 40 };
  const desiredInnerWidth = Math.max(200, Math.max(1, series.length - 1) * minPointWidth);
  const W = Math.max(width, pad.left + pad.right + desiredInnerWidth);
  const H = isNarrow ? 240 : 280;
  const IW = W - pad.left - pad.right;
  const IH = H - pad.top - pad.bottom;
  const xStep = IW / Math.max(1, series.length - 1);
  const yScale = (v) => IH - (v / maxY) * IH;

  const pathFrom = (key) => {
    return series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${pad.left + i * xStep} ${pad.top + yScale(d[key] || 0)}`).join(' ');
  };

  const areaFrom = (key) => {
    const line = series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${pad.left + i * xStep} ${pad.top + yScale(d[key] || 0)}`).join(' ');
    const tail = `L ${pad.left + (series.length - 1) * xStep} ${pad.top + IH} L ${pad.left} ${pad.top + IH} Z`;
    return line + ' ' + tail;
  };

  const ticks = 4;
  return (
    <div ref={containerRef} className="bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700 overflow-x-auto">
      <h3 className="text-white font-semibold mb-2">Reports vs. Resolutions (Daily)</h3>
      <svg width={W} height={H} style={{ minWidth: '100%' }}>
        {[...Array(ticks + 1).keys()].map((i) => {
          const t = i / ticks;
          const y = pad.top + IH * t;
          const v = Math.round(maxY * (1 - t));
          return (
            <g key={i}>
              <line x1={pad.left} x2={W - pad.right} y1={y} y2={y} stroke="#374151" strokeDasharray="4 4" />
              <text x={pad.left - 8} y={y} textAnchor="end" alignmentBaseline="middle" fontSize="10" fill="#9CA3AF">{v}</text>
            </g>
          );
        })}

        <path d={areaFrom('reported')} fill="#38bdf833" />
        <path d={areaFrom('resolved')} fill="#22c55e33" />

        <path d={pathFrom('reported')} stroke={COLORS.reported} strokeWidth="2" fill="none" />
        <path d={pathFrom('resolved')} stroke={COLORS.resolved} strokeWidth="2" fill="none" />

        {/* X labels (sparse) */}
        {series.map((d, i) => (
          i % Math.ceil(series.length / 8) === 0 ? (
            <text key={d.date} x={pad.left + i * xStep} y={H - pad.bottom + 18} textAnchor="middle" fontSize="10" fill="#9CA3AF">{d.date.slice(5)}</text>
          ) : null
        ))}
      </svg>
      <div className="flex gap-4 mt-3 text-xs">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: COLORS.reported }}></span><span className="text-gray-300">Reported</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: COLORS.resolved }}></span><span className="text-gray-300">Resolved</span></div>
      </div>
    </div>
  );
};

export default ReportsVsResolutionsChart;


