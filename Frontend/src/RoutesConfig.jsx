import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { HeroPage, Login, VerifyEmail } from './components';
import { dashboardMenuState } from './app/DashboardSlice';
import { isAdminLoggedIn, isUserLoggedIn } from './app/DashboardSlice';

import NavBar from './components/protected/Dashboard/NavBar';
import Sidebar from './components/utils/Sidebar';
import Dashboard from './components/protected/Dashboard/Dashboard';
import ReportPothole from './components/protected/ReportPothole';
import PotholeMap from './components/protected/PotholeMap';
import ContractorBidding from './components/protected/ContractorBidding';
import ContractorRegister from "./components/common/ContractorRegister";
import GovernmentOfficialRegister from "./components/common/GovernmentOfficialRegister";
import SuperAdminDashboard from './components/protected/Dashboard/SuperAdminDashboard';
import AdminLogin from './components/common/AdminLogin';
import ApprovePothole from './components/protected/ApprovePothole';
import BiddingDetails from './components/protected/BiddingDetails';
import Communities from './components/protected/Communities';
import CommunityDetail from './components/protected/CommunityDetail';
import ForgotPassword from "./components/common/ForgotPassword";
import ResetPassword from "./components/common/ResetPassword";


const RoutesConfig = () => {
    const isLoggedIn = useSelector(isUserLoggedIn);
    const ifDMenuState = useSelector(dashboardMenuState);
    const location = useLocation();
    const isMapView = location.pathname === '/map-view';
    const isAdminAuth = useSelector(isAdminLoggedIn);

    // Admin Route Logic
    if (location.pathname.startsWith('/admin')) {
        return (
            <Routes>
                <Route
                    path="/admin"
                    element={isAdminAuth ? <SuperAdminDashboard /> : <AdminLogin />}
                />
            </Routes>
        );
    }

    if (!isLoggedIn) {
        return (
            <Routes>
                <Route
                    path="/"
                    key={'home'}
                    className="transition-all scrollbar-hide"
                    element={<HeroPage />}
                />
                <Route
                    path="/login"
                    className="transition-all scrollbar-hide"
                    element={<Login />}
                />
                <Route
                    path="/verify-email"
                    className="transition-all scrollbar-hide"
                    element={<VerifyEmail />}
                />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/register-contractor" className="transition-all scrollbar-hide" element={<ContractorRegister />} />
                <Route path="/register-government-official" className="transition-all scrollbar-hide" element={<GovernmentOfficialRegister />} />
            </Routes>
        );
    } else {
        return (
            <div className="w-full h-screen bg-[#121212] flex flex-col">
                <Sidebar isOpen={ifDMenuState} />
                <NavBar />
                <div className={`flex-grow ${isMapView ? 'relative' : 'overflow-y-auto'} ${ifDMenuState ? 'pl-16' : ''}`}>
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/pd" element={<ReportPothole />} />
                        <Route path="/map-view" element={<PotholeMap />} />
                        <Route path="/contractor-bidding" element={<ContractorBidding />} />
                        <Route path="/admin" element={<SuperAdminDashboard />} />
                        <Route path="/approve-pothole" element={<ApprovePothole />} />
                        <Route path="/bidding-details" element={<BiddingDetails />} />
                        <Route path="/communities" element={<Communities />} />
                        <Route path="/community/:id" element={<CommunityDetail />} />
                    </Routes>
                </div>
            </div>
        );
    }
};

export default RoutesConfig;