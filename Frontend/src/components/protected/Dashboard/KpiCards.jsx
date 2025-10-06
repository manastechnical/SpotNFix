import React, { useEffect, useState } from 'react';
import { apiConnector } from '@/services/Connector';
import { kpiEndpoints } from '@/services/Apis';

const Card = ({ label, value, suffix }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 sm:p-4">
    <div className="text-sm text-gray-400">{label}</div>
    <div className="text-2xl font-bold text-white mt-1">{value}{suffix || ''}</div>
  </div>
);

const KpiCards = () => {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await apiConnector('GET', kpiEndpoints.DASHBOARD_KPIS);
        if (mounted) setKpis(res.data);
      } catch (e) {
        if (mounted) setError('Failed to load KPIs');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="text-gray-400">Loading KPIs…</div>;
  if (error) return <div className="text-red-400">{error}</div>;
  if (!kpis) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      <Card label="Bids submitted" value={kpis.bids_submitted} />
      <Card label="Bids accepted" value={kpis.bids_accepted} />
      <Card label="Acceptance rate" value={kpis.acceptance_rate_pct} suffix="%" />
      <Card label="Avg resolution" value={kpis.average_resolution_days} suffix=" days" />
    </div>
  );
};

export default KpiCards;
