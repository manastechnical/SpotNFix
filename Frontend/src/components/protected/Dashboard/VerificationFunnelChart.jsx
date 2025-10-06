import React, { useEffect, useRef, useState } from 'react';
import { apiConnector } from '@/services/Connector';
import { funnelEndpoints } from '@/services/Apis';

const colors = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6'];

const StepBar = ({ x, y, width, height, color, label, count }) => (
  <g>
    <rect x={x} y={y} width={width} height={height} rx={6} ry={6} fill={color} />
    <text x={x + width / 2} y={y + height / 2 - 2} textAnchor="middle" fill="#0b1020" fontWeight="600">
      {label}
    </text>
    <text x={x + width / 2} y={y + height / 2 + 14} textAnchor="middle" fill="#0b1020" fontSize="12">
      {count}
    </text>
  </g>
);

const VerificationFunnelChart = () => {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const [width, setWidth] = useState(760);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await apiConnector('GET', funnelEndpoints.VERIFICATION_FUNNEL);
        if (mounted) setSteps(res.data?.steps || []);
      } catch (e) {
        if (mounted) setError('Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

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

  if (loading) return <div className="text-gray-400">Loading chart…</div>;
  if (error) return <div className="text-red-400">{error}</div>;
  if (!steps.length) return <div className="text-gray-400">No data</div>;

  const isNarrow = width < 500;
  const pad = { top: 10, right: 10, bottom: 24, left: 10 };
  const minBarWidth = isNarrow ? 180 : 240;
  const W = Math.max(width, minBarWidth + pad.left + pad.right);
  const H = isNarrow ? 220 : 240;
  const IW = W - pad.left - pad.right;
  const baseHeight = 40;
  const gap = 16;

  const maxCount = Math.max(...steps.map(s => s.count || 0), 1);
  const widthFor = (count) => 120 + (IW - 120) * (count / maxCount);

  let y = pad.top;

  return (
    <div ref={containerRef} className="bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700 overflow-x-auto">
      <h3 className="text-white font-semibold mb-2">Verification Funnel</h3>
      <svg width={W} height={H} style={{ minWidth: '100%' }}>
        {steps.map((s, i) => {
          const width = widthFor(s.count || 0);
          const x = pad.left + (IW - width) / 2;
          const color = colors[i % colors.length];
          const node = (
            <StepBar key={s.key} x={x} y={y} width={width} height={baseHeight} color={color} label={s.label} count={s.count || 0} />
          );
          y += baseHeight + gap;
          return node;
        })}
      </svg>
    </div>
  );
};

export default VerificationFunnelChart;
