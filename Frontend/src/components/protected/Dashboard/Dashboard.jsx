import React from 'react';
import StatusBySeverityChart from './StatusBySeverityChart';
import ReportsVsResolutionsChart from './ReportsVsResolutionsChart';
import VerificationFunnelChart from './VerificationFunnelChart';
import KpiCards from './KpiCards';

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-[#0b1020] text-white flex items-start justify-center p-4">
      <div className="w-full max-w-6xl h-full flex flex-col">
        <header className="mb-4">
          <h1 className="text-3xl font-bold text-green-500">
            SpotNFix Dashboard
          </h1>
        </header>
        <div className="grid grid-cols-1 gap-6">
          <KpiCards />
          <StatusBySeverityChart />
          <ReportsVsResolutionsChart days={30} />
          <VerificationFunnelChart />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
