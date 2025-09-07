import React, { useState, useEffect, useMemo } from 'react';
import { apiConnector } from '@/services/Connector';
import { adminEndpoints } from '@/services/Apis';
import { toast } from 'react-hot-toast';
import { setAdminToken } from '@/app/DashboardSlice';
import { FileText, User, Building, Landmark, Mail, Phone, Hash, ShieldCheck, ShieldX, Calendar, Search, LogOut } from 'lucide-react';
import { useDispatch } from 'react-redux';

const AdminNavbar = ({ onLogout }) => (
    <div className="bg-gray-800/50 backdrop-blur-sm p-4 rounded-lg mb-8 flex justify-between items-center border border-gray-700">
        <h1 className="text-xl font-bold text-white">Admin Panel</h1>
        <div className="flex items-center gap-4">
            <span className="text-gray-300 font-semibold">Admin</span>
            <button onClick={onLogout} className="text-gray-400 hover:text-white transition-colors" title="Logout">
                <LogOut size={20} />
            </button>
        </div>
    </div>
);

// Sub-component for individual cards
const VerificationCard = ({ user, onViewDetails }) => {
    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-5 flex flex-col justify-between border border-gray-700 hover:border-blue-500 transition-all duration-300">
            <div>
                <div className="flex justify-between items-start mb-3">
                    <h2 className="text-xl font-bold text-white">{user.name}</h2>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${user.role === 'contractor' ? 'bg-blue-900/50 text-blue-300 border border-blue-700' : 'bg-purple-900/50 text-purple-300 border border-purple-700'}`}>
                        {user.role}
                    </span>
                </div>
                <div className="space-y-2 text-sm text-gray-400">
                    <div className="flex items-center">
                        <Mail size={14} className="mr-2" />
                        <span>{user.email}</span>
                    </div>
                    <div className="flex items-center">
                        <Calendar size={14} className="mr-2" />
                        <span>Submitted: {new Date(user.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
            <button
                onClick={() => onViewDetails(user)}
                className="mt-4 w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
                Review Application
            </button>
        </div>
    );
};

// Sub-component for detail items in the modal
const DetailItem = ({ icon, label, value }) => (
    <div className="flex items-start text-sm text-gray-300 py-2 border-b border-gray-700">
        <div className="flex-shrink-0 w-6 mt-1">{icon}</div>
        <div className="flex-1">
            <span className="font-semibold text-gray-400 block">{label}</span>
            <span className="text-white">{value || 'N/A'}</span>
        </div>
    </div>
);


// Main Dashboard Component
const SuperAdminDashboard = () => {
    const [pendingUsers, setPendingUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const dispatch = useDispatch();

    const fetchPendingUsers = async () => {
        setLoading(true);
        try {
            const response = await apiConnector('GET', adminEndpoints.GET_PENDING_VERIFICATIONS_API);
            setPendingUsers(response.data.data || []);
        } catch (error) {
            console.error("Failed to fetch pending users", error);
            toast.error("Could not fetch verification requests.");
            setPendingUsers([]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchPendingUsers();
    }, []);

    const handleUpdateStatus = async (userId, status) => {
        const toastId = toast.loading("Updating status...");
        try {
            await apiConnector('POST', adminEndpoints.UPDATE_VERIFICATION_API, { userId, status });
            toast.success(`User has been ${status}.`);
            fetchPendingUsers();
            setSelectedUser(null);
        } catch (error) {
            console.error("Failed to update status", error);
            toast.error("Failed to update user status.");
        }
        toast.dismiss(toastId);
    };

    const handleLogout = () => {
        dispatch(setAdminToken(null)); // Clears token from Redux state and localStorage
        toast.success("Logged out successfully.");
        // The RoutesConfig will automatically redirect to the login page
    };

    // Memoized filtering logic for performance
    const filteredUsers = useMemo(() => {
        return pendingUsers
            .filter(user => {
                if (filterRole === 'all') return true;
                return user.role === filterRole;
            })
            .filter(user => 
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [pendingUsers, searchTerm, filterRole]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 text-white min-h-screen bg-[#121212]">
                        <AdminNavbar onLogout={handleLogout} />

            <header className="mb-8">
                <h1 className="text-4xl font-bold">Verification Requests</h1>
                <p className="text-gray-400 mt-1">Review and approve or reject new applications.</p>
            </header>

               {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg p-1">
                    <button onClick={() => setFilterRole('all')} className={`px-4 py-1 rounded-md text-sm font-semibold transition-colors ${filterRole === 'all' ? 'bg-gray-600' : 'hover:bg-gray-700'}`}>All</button>
                    <button onClick={() => setFilterRole('contractor')} className={`px-4 py-1 rounded-md text-sm font-semibold transition-colors ${filterRole === 'contractor' ? 'bg-gray-600' : 'hover:bg-gray-700'}`}>Contractors</button>
                    <button onClick={() => setFilterRole('government')} className={`px-4 py-1 rounded-md text-sm font-semibold transition-colors ${filterRole === 'government' ? 'bg-gray-600' : 'hover:bg-gray-700'}`}>Officials</button>
                </div>
            </div>
            
            {loading ? (
                 <div className="text-center p-10">Loading...</div>
            ) : filteredUsers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredUsers.map(user => (
                        <VerificationCard key={user.id} user={user} onViewDetails={setSelectedUser} />
                    ))}
                </div>
            ) : (
                <div className="text-center p-16 bg-gray-800 rounded-lg">
                    <h3 className="text-xl font-semibold">No Matching Requests</h3>
                    <p className="text-gray-400 mt-2">Try adjusting your search or filter criteria.</p>
                </div>
            )}

           
            {/* Details Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center p-4 z-50">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl border border-gray-700 flex flex-col">
                        <h2 className="text-2xl font-bold mb-4 border-b border-gray-700 pb-3">Application Details</h2>

                        <div className="flex-grow overflow-y-auto pr-2" style={{ maxHeight: '70vh' }}>
                            {/* Role-Specific Details */}
                            <div className="bg-gray-900 p-4 rounded-lg">
                                {selectedUser.role === 'contractor' && selectedUser.contractor_details && (
                                    <div className="space-y-2">
                                        <DetailItem icon={<User size={16} />} label="Full Name" value={selectedUser.name} />
                                        <DetailItem icon={<Mail size={16} />} label="Email" value={selectedUser.email} />
                                        <DetailItem icon={<Phone size={16} />} label="Phone" value={selectedUser.phone} />
                                        <DetailItem icon={<Building size={16} />} label="Business Name" value={selectedUser.contractor_details.business_name} />
                                        <DetailItem icon={<Hash size={16} />} label="PAN" value={selectedUser.contractor_details.pan_number} />
                                        <DetailItem icon={<Hash size={16} />} label="GSTIN" value={selectedUser.contractor_details.gst_number} />
                                    </div>
                                )}
                                {selectedUser.role === 'government' && selectedUser.government_official_details && (
                                    <div className="space-y-2">
                                        <DetailItem icon={<User size={16} />} label="Full Name" value={selectedUser.name} />
                                        <DetailItem icon={<Mail size={16} />} label="Email" value={selectedUser.email} />
                                        <DetailItem icon={<Phone size={16} />} label="Phone" value={selectedUser.phone} />
                                        <DetailItem icon={<Landmark size={16} />} label="Department" value={selectedUser.government_official_details.department} />
                                        <DetailItem icon={<User size={16} />} label="Designation" value={selectedUser.government_official_details.designation} />
                                        <DetailItem icon={<Hash size={16} />} label="Employee ID" value={selectedUser.government_official_details.employee_id} />
                                    </div>
                                )}
                            </div>

                            {/* Documents Section */}
                            <div className="bg-gray-900 p-4 rounded-lg mt-4">
                                <h3 className="font-bold mb-3 text-lg">Submitted Documents</h3>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    {selectedUser.contractor_details?.pan_card_public_url && (
                                        <a href={selectedUser.contractor_details.pan_card_public_url} target="_blank" rel="noopener noreferrer" className="flex-1 text-center bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm flex items-center justify-center">
                                            <FileText size={16} className="mr-2" /> View PAN Card
                                        </a>
                                    )}
                                    {selectedUser.contractor_details?.aadhaar_card_public_url && (
                                        <a href={selectedUser.contractor_details.aadhaar_card_public_url} target="_blank" rel="noopener noreferrer" className="flex-1 text-center bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm flex items-center justify-center">
                                            <FileText size={16} className="mr-2" /> View Aadhaar
                                        </a>
                                    )}
                                    {selectedUser.contractor_details?.gst_certificate_public_url && (
                                        <a href={selectedUser.contractor_details.gst_certificate_public_url} target="_blank" rel="noopener noreferrer" className="flex-1 text-center bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm flex items-center justify-center">
                                            <FileText size={16} className="mr-2" /> View GST Certificate
                                        </a>
                                    )}
                                     {/* Government Official Documents */}
                                    {selectedUser.government_official_details?.government_id_public_url && (
                                        <a href={selectedUser.government_official_details.government_id_public_url} target="_blank" rel="noopener noreferrer" className="flex-1 text-center bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm flex items-center justify-center">
                                            <FileText size={16} className="mr-2"/> View Official ID
                                        </a>
                                    )}
                                    {selectedUser.government_official_details?.proof_of_employment_public_url && (
                                        <a href={selectedUser.government_official_details.proof_of_employment_public_url} target="_blank" rel="noopener noreferrer" className="flex-1 text-center bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm flex items-center justify-center">
                                            <FileText size={16} className="mr-2"/> View Proof of Employment
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row justify-end gap-4 mt-6 pt-4 border-t border-gray-700">
                            <button onClick={() => setSelectedUser(null)} className="bg-gray-600 px-4 py-2 rounded hover:bg-gray-500 transition-colors w-full sm:w-auto order-last sm:order-first">
                                Close
                            </button>
                            <button onClick={() => handleUpdateStatus(selectedUser.id, 'rejected')} className="flex items-center justify-center bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors w-full sm:w-auto">
                                <ShieldX size={16} className="mr-2" /> Reject
                            </button>
                            <button onClick={() => handleUpdateStatus(selectedUser.id, 'approved')} className="flex items-center justify-center bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors w-full sm:w-auto">
                                <ShieldCheck size={16} className="mr-2" /> Approve
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperAdminDashboard;