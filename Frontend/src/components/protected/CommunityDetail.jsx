import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { selectAccount } from '../../app/DashboardSlice';
import { FaArrowLeft, FaUsers, FaCalendarAlt, FaCrown, FaUserShield, FaUser, FaEllipsisV, FaTrash, FaPlus, FaCog, FaSave, FaTimes, FaEdit, FaShieldAlt } from 'react-icons/fa';
// Corrected import path for all necessary functions
import {
    fetchCommunityById,
    joinCommunityById,
    leaveCommunityById,
    removeCommunityMember,
    updateCommunityMemberRole,
    updateCommunityDetails,
    deleteCommunityById
} from '../../services/repository/userRepo';
import Portal from '../utils/Portal';
import ConfirmationModal from '../utils/ConfirmationModal';

const ROLES = {
    admin: { icon: FaCrown, color: 'text-yellow-400', label: 'Admin' },
    'co-admin': { icon: FaUserShield, color: 'text-indigo-400', label: 'Co-Admin' },
    member: { icon: FaUser, color: 'text-gray-400', label: 'Member' },
};

const MemberActionsDropdown = ({ member, currentUserRole, onRoleChange, onRemove }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);
    const menuRef = useRef(null);

    const handleToggle = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPosition({
                top: rect.top + window.scrollY - 8,
                left: rect.left + window.scrollX - 192 + rect.width,
            });
        }
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                isOpen &&
                buttonRef.current && !buttonRef.current.contains(event.target) &&
                menuRef.current && !menuRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    if (currentUserRole !== 'admin') {
        return <span className={`role-badge ${ROLES[member.role].color}`}>{ROLES[member.role].label}</span>;
    }

    return (
        <>
            <button ref={buttonRef} onClick={handleToggle} className="p-2 rounded-full hover:bg-gray-600 transition-colors">
                <FaEllipsisV />
            </button>
            {isOpen && (
                <Portal>
                    <div
                        style={{ top: `${position.top}px`, left: `${position.left}px`, transform: 'translateY(-100%)' }}
                        className="fixed w-48 bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-lg z-50 animate-fade-in-up"
                    >
                        <div className="py-1">
                            {member.role !== 'co-admin' && <button onClick={() => { onRoleChange(member.user.id, 'co-admin'); setIsOpen(false); }} className="menu-item">Promote to Co-Admin</button>}
                            {member.role !== 'member' && <button onClick={() => { onRoleChange(member.user.id, 'member'); setIsOpen(false); }} className="menu-item">Demote to Member</button>}
                            <button onClick={() => { onRemove(member.user.id); setIsOpen(false); }} className="menu-item text-red-400 hover:bg-red-600 hover:text-white"><FaTrash className="inline mr-2" /> Remove</button>
                        </div>
                    </div>
                </Portal>
            )}
        </>
    );
};


const CommunityDetail = () => {
    const { id } = useParams();
    console.log(id);
    const navigate = useNavigate();
    const [community, setCommunity] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('members');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', description: '' });
    const [modalState, setModalState] = useState({ isOpen: false });
    const account = useSelector(selectAccount);

    const fetchDetails = async () => {
        try {
            const response = await fetchCommunityById(id);
            if (response?.data?.data) {
                setCommunity(response.data.data);
                setEditData({ name: response.data.data.name, description: response.data.data.description });
            } else {
                toast.error("This community no longer exists.");
                navigate('/communities');
            }
        } catch (error) {
            if (!community) {
                toast.error("Failed to fetch details.");
                navigate('/communities');
            }
        }
        setIsLoading(false);
    };

    useEffect(() => {
        setIsLoading(true);
        fetchDetails();
    }, [id]);

    // --- SMART BACKGROUND POLLING LOGIC ---
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchDetails();
            }
        };

        const intervalId = setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchDetails();
            }
        }, 15000);

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [id]);


    const { currentUserMembership, userRole, canManage, isOnlyAdmin } = useMemo(() => {
        if (!community || !account) return {};
        const membership = community.members.find(m => m.user.id === account.id);
        const role = membership?.role;
        const adminCount = community.members.filter(m => m.role === 'admin').length;
        return {
            currentUserMembership: membership,
            userRole: role,
            canManage: role === 'admin' || role === 'co-admin',
            isOnlyAdmin: role === 'admin' && adminCount === 1,
        };
    }, [community, account]);

    const handleLeave = () => {
        const commonLeaveLogic = async () => {
            const toastId = toast.loading("Leaving...");
            try {
                const response = await leaveCommunityById(id, account.id);
                if (response?.data?.message.includes("deleted")) {
                    toast.success("Community deleted as you were the last member.");
                    navigate('/communities');
                } else {
                    toast.success("You have left the community.");
                    fetchDetails();
                }
            } catch (error) {
                toast.error("Failed to leave community.");
            } finally {
                toast.dismiss(toastId);
                setModalState({ isOpen: false });
            }
        };

        if (isOnlyAdmin && community.members.length > 1) {
            setModalState({ isOpen: true, title: "Transfer Ownership?", message: "You are the last admin. Ownership will be transferred to the longest-serving member.", confirmText: "Leave and Transfer", onConfirm: commonLeaveLogic });
        } else {
            setModalState({ isOpen: true, title: "Leave Community?", message: "Are you sure you want to leave?", confirmText: "Leave", onConfirm: commonLeaveLogic });
        }
    };

    const handleJoin = async () => {
        const toastId = toast.loading("Joining...");
        try {
            await joinCommunityById(id, account.id);
            toast.success("Welcome!");
            fetchDetails();
        } catch (error) {
            toast.error("Failed to join.");
        } finally {
            toast.dismiss(toastId);
        }
    };

    // --- CORRECTED MANAGEMENT HANDLERS ---
    const handleRemoveMember = async (memberId) => {
        console.log('hi')
        setModalState({
            isOpen: true,
            title: "Remove Member?",
            message: "Are you sure you want to remove this member?",
            confirmText: "Remove",
            onConfirm: async () => {
                await removeCommunityMember(id, memberId);
                fetchDetails(); // INSTANT FEEDBACK RESTORED
                setModalState({ isOpen: false });
            }
        });
    };

    const handleRoleChange = async (memberId, newRole) => {
        await updateCommunityMemberRole(id, memberId, newRole);
        fetchDetails(); // INSTANT FEEDBACK RESTORED
    };
    
    const handleDeleteCommunity = () => {
        setModalState({
            isOpen: true,
            title: "Delete Community?",
            message: `This will permanently delete the '${community.name}' community and all its data. This action cannot be undone.`,
            confirmText: "Yes, Delete It",
            onConfirm: async () => {
                await deleteCommunityById(id);
                navigate('/communities');
                setModalState({ isOpen: false });
            }
        });
    };

    const handleSaveDetails = async () => {
        await updateCommunityDetails(id, editData);
        setIsEditing(false);
        fetchDetails();
    };


    if (isLoading) return <div className="p-10 text-center text-white">Loading...</div>;
    if (!community) return null;

    return (
        // --- (The JSX for the component remains the same) ---
        <div className="p-6 text-white min-h-full">
            <ConfirmationModal {...modalState} onClose={() => setModalState({ isOpen: false })} />
            <Link to="/communities" className="back-link"><FaArrowLeft /> Back to All Communities</Link>

            <header className="bg-[#1e1e1e] p-6 rounded-lg mb-6">
                {isEditing && userRole === 'admin' ? (
                    <div>
                        <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="input-field text-4xl font-bold mb-2 w-full" />
                        <textarea value={editData.description} onChange={e => setEditData({...editData, description: e.target.value})} className="input-field w-full h-24" />
                        <div className="flex gap-2 mt-4">
                            <button onClick={handleSaveDetails} className="button-primary"><FaSave className="mr-2"/>Save</button>
                            <button onClick={() => setIsEditing(false)} className="button-secondary"><FaTimes className="mr-2"/>Cancel</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-between items-start gap-4">
                        <div>
                            <h1 className="text-4xl font-bold mb-2">{community.name}</h1>
                            <p className="text-gray-400 max-w-3xl">{community.description}</p>
                        </div>
                        <div className="flex gap-2">
                           {userRole === 'admin' && <button onClick={() => setIsEditing(true)} className="button-icon"><FaEdit /></button>}
                           {currentUserMembership ? <button onClick={handleLeave} className="button-danger">Leave</button> : <button onClick={handleJoin} className="button-primary">Join</button>}
                        </div>
                    </div>
                )}
            </header>

            <div className="flex border-b border-gray-700 mb-6">
                <button onClick={() => setActiveTab('members')} className={`tab-button ${activeTab === 'members' && 'active'}`}><FaUsers /> Members ({community.members.length})</button>
                <button onClick={() => setActiveTab('events')} className={`tab-button ${activeTab === 'events' && 'active'}`}><FaCalendarAlt /> Events ({community.events.length})</button>
                {userRole === 'admin' && <button onClick={() => setActiveTab('manage')} className={`tab-button ${activeTab === 'manage' && 'active'}`}><FaCog /> Manage & Settings</button>}
            </div>

            {activeTab === 'members' && (
                <div className="bg-[#1e1e1e] p-6 rounded-lg">
                    <h2 className="text-2xl font-bold mb-4">Community Members</h2>
                    <ul className="space-y-3">
                        {community.members.map(({ user, role }) => (
                            <li key={user.id} className="flex items-center bg-[#2a2a2a] p-3 rounded-lg">
                                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold mr-4">{user.name.charAt(0).toUpperCase()}</div>
                                <span className="text-white">{user.name}</span>
                                <div className={`flex items-center text-sm ml-auto ${ROLES[role].color}`}>
                                    {React.createElement(ROLES[role].icon, { className: "mr-1" })}
                                    <span>{ROLES[role].label}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {activeTab === 'events' && (
                <div className="bg-[#1e1e1e] p-6 rounded-lg">
                    <h2 className="text-2xl font-bold mb-4">Upcoming Events</h2>
                    <p className="text-gray-400">Event functionality coming soon!</p>
                </div>
            )}
            {activeTab === 'manage' && userRole === 'admin' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#1e1e1e] p-6 rounded-lg">
                        <h3 className="text-xl font-semibold mb-3">Manage Members</h3>
                        <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
                            {community.members.map((member) => (
                                <li key={member.user.id} className="flex items-center justify-between bg-[#2a2a2a] p-2 rounded-lg">
                                    <span className="text-white">{member.user.name}</span>
                                    {member.user.id !== account.id ? <MemberActionsDropdown member={member} currentUserRole={userRole} onRoleChange={handleRoleChange} onRemove={handleRemoveMember}/> : <span className={`role-badge ${ROLES[member.role].color}`}>{ROLES[member.role].label}</span>}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="bg-[#1e1e1e] p-6 rounded-lg">
                        <h3 className="text-xl font-semibold mb-3 flex items-center"><FaShieldAlt className="mr-2 text-yellow-400"/>Admin Settings</h3>
                        <div className="mt-4 p-4 rounded-lg border-2 border-red-500/30 bg-red-900/20">
                            <h4 className="font-bold text-red-400">Danger Zone</h4>
                            <p className="text-sm text-gray-400 mt-1 mb-3">This action is permanent and cannot be undone.</p>
                            <button onClick={handleDeleteCommunity} className="button-danger w-full">Delete this Community</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommunityDetail;