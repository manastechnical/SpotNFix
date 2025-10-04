import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { selectAccount } from '../../app/DashboardSlice';
import { FaArrowLeft, FaUsers, FaCalendarAlt, FaCrown, FaUserShield, FaUser, FaEllipsisV, FaTrash, FaPlus, FaCog, FaSave, FaTimes, FaEdit, FaShieldAlt, FaCalendarPlus, FaMapMarkerAlt, FaClock, FaUserFriends, FaCheckCircle } from 'react-icons/fa';
import {
    fetchCommunityById,
    joinCommunityById,
    leaveCommunityById,
    removeCommunityMember,
    updateCommunityMemberRole,
    updateCommunityDetails,
    deleteCommunityById,
    // --- REAL EVENT FUNCTIONS ---
    fetchCommunityEvents,
    createCommunityEvent,
    updateCommunityEvent,
    deleteCommunityEvent,
    rsvpToEvent
} from '../../services/repository/userRepo';
import Portal from '../utils/Portal';
import ConfirmationModal from '../utils/ConfirmationModal';

const ROLES = {
    admin: { icon: FaCrown, color: 'text-yellow-400', label: 'Admin' },
    'co-admin': { icon: FaUserShield, color: 'text-indigo-400', label: 'Co-Admin' },
    member: { icon: FaUser, color: 'text-gray-400', label: 'Member' },
};

// --- HELPER FUNCTION FOR DATE FORMATTING ---
const formatEventDate = (dateString) => {
    if (!dateString) return 'Date not set';
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    return new Date(dateString).toLocaleDateString('en-US', options);
};


// =================================================================================
// --- EVENT MODAL COMPONENT (FOR CREATING & EDITING EVENTS) ---
// =================================================================================
const EventModal = ({ isOpen, onClose, onSave, event }) => {
    const [eventData, setEventData] = useState({
        title: '',
        description: '',
        location: '',
        start_time: '',
        end_time: '',
    });

    // Get current time in YYYY-MM-DDTHH:MM format for the input min attribute
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const minDateTime = now.toISOString().slice(0, 16);

    useEffect(() => {
        if (event) {
            // Pre-fill form for editing
            setEventData({
                title: event.title,
                description: event.description,
                location: event.location,
                start_time: event.start_time ? new Date(event.start_time).toISOString().slice(0, 16) : '',
                end_time: event.end_time ? new Date(event.end_time).toISOString().slice(0, 16) : '',
            });
        } else {
            // Reset for creating
            setEventData({ title: '', description: '', location: '', start_time: '', end_time: '' });
        }
    }, [event, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEventData(prev => {
            const newData = { ...prev, [name]: value };
            // **VALIDATION**: If start_time changes, clear end_time if it's now invalid
            if (name === 'start_time' && newData.end_time && newData.end_time < value) {
                newData.end_time = '';
            }
            return newData;
        });
    };
    
    const handleSubmit = (e) => {
        e.preventDefault();
        // Final validation check before saving
        if (eventData.end_time && eventData.end_time < eventData.start_time) {
            toast.error("End time cannot be before the start time.");
            return;
        }
        
        const dataToSave = {
            ...eventData,
            start_time: new Date(eventData.start_time).toISOString(),
            end_time: eventData.end_time ? new Date(eventData.end_time).toISOString() : null,
        };
        onSave(dataToSave);
    };

    return (
        <Portal>
            <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
                <div className="bg-[#1e1e1e] rounded-lg shadow-xl w-full max-w-lg animate-fade-in-up">
                    <form onSubmit={handleSubmit} className="p-6">
                        <h2 className="text-2xl text-white font-bold mb-4">{event ? 'Edit Event' : 'Create New Event'}</h2>
                        <div className="space-y-4">
                            <input name="title" value={eventData.title} onChange={handleChange} placeholder="Event Title" className="input-field" required />
                            <textarea name="description" value={eventData.description} onChange={handleChange} placeholder="Description" className="input-field h-24" required />
                            <input name="location" value={eventData.location} onChange={handleChange} placeholder="Location (e.g., 'Central Park' or 'Zoom Link')" className="input-field" required />
                            <div>
                               <label className="block text-sm font-medium text-gray-400 mb-1">Start Time</label>
                               {/* **VALIDATION**: Cannot select a past date/time */}
                               <input name="start_time" value={eventData.start_time} onChange={handleChange} type="datetime-local" className="input-field" required min={minDateTime} />
                            </div>
                             <div>
                               <label className="block text-sm font-medium text-gray-400 mb-1">End Time (Optional)</label>
                               {/* **VALIDATION**: End time must be after start time */}
                               <input name="end_time" value={eventData.end_time} onChange={handleChange} type="datetime-local" className="input-field" min={eventData.start_time || minDateTime} disabled={!eventData.start_time} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button type="button" onClick={onClose} className="button-secondary">Cancel</button>
                            <button type="submit" className="button-primary"><FaSave className="mr-2" />Save</button>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
};


// =================================================================================
// --- EVENT CARD COMPONENT ---
// =================================================================================
const EventCard = ({ event, onRsvp, isAttending, canManage, onEdit, onDelete }) => {
    const startDate = new Date(event.start_time);
    const month = startDate.toLocaleString('default', { month: 'short' }).toUpperCase();
    const day = startDate.getDate();

    return (
        <div className="bg-[#2a2a2a] rounded-lg shadow-lg flex transition-transform hover:scale-105">
            <div className="flex flex-col items-center justify-center bg-indigo-600/80 p-4 rounded-l-lg text-white">
                <span className="text-sm font-semibold">{month}</span>
                <span className="text-2xl font-bold">{day}</span>
            </div>
            <div className="p-4 flex flex-col flex-grow">
                <h3 className="text-lg font-bold text-white">{event.title}</h3>
                <p className="text-gray-400 text-sm flex items-center mt-1"><FaClock className="mr-2" /> {formatEventDate(event.start_time)}</p>
                <p className="text-gray-400 text-sm flex items-center mt-1"><FaMapMarkerAlt className="mr-2" /> {event.location}</p>
                <p className="text-gray-400 text-sm flex items-center mt-1"><FaUserFriends className="mr-2" /> {event.attendees.length} attending</p>
                <div className="mt-4 pt-3 border-t border-gray-700 flex justify-between items-center">
                    <button onClick={() => onRsvp(event.id, !isAttending)} className={isAttending ? 'button-success-sm' : 'button-primary-sm'}>
                        {isAttending ? <><FaCheckCircle className="mr-2" /> Attending</> : 'RSVP'}
                    </button>
                    {canManage && (
                        <div className="flex gap-2">
                            <button onClick={() => onEdit(event)} className="button-icon-sm"><FaEdit /></button>
                            <button onClick={() => onDelete(event.id)} className="button-icon-sm text-red-400 hover:bg-red-500"><FaTrash /></button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// =================================================================================
// --- MAIN COMMUNITY DETAIL COMPONENT ---
// =================================================================================
const CommunityDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [community, setCommunity] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('members');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', description: '' });
    const [modalState, setModalState] = useState({ isOpen: false });
    const account = useSelector(selectAccount);
    
    // --- STATE FOR EVENTS ---
    const [events, setEvents] = useState([]);
    const [isEventsLoading, setIsEventsLoading] = useState(false);
    const [eventModal, setEventModal] = useState({ isOpen: false, event: null });


    // --- DATA FETCHING ---
    const fetchCommunityData = useCallback(async () => {
        try {
            const response = await fetchCommunityById(id);
            if (response?.data?.data) {
                setCommunity(response.data.data);
                if (!isEditing) {
                    setEditData({ name: response.data.data.name, description: response.data.data.description });
                }
            } else {
                toast.error("This community no longer exists.");
                navigate('/communities');
            }
        } catch (error) {
            toast.error("Failed to fetch community details.");
            navigate('/communities');
        }
    }, [id, isEditing, navigate]);

    const fetchEventsData = useCallback(async () => {
        setIsEventsLoading(true);
        try {
            const response = await fetchCommunityEvents(id);
            setEvents(response?.data?.data || []);
        } catch (error) {
            toast.error("Could not load events.");
        } finally {
            setIsEventsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        setIsLoading(true);
        Promise.all([fetchCommunityData(), fetchEventsData()]).finally(() => setIsLoading(false));
    }, [fetchCommunityData, fetchEventsData]);


    // --- BACKGROUND POLLING ---
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !isEditing) {
                fetchCommunityData();
                fetchEventsData();
            }
        };

        const intervalId = setInterval(() => {
            if (document.visibilityState === 'visible' && !isEditing) {
                fetchCommunityData();
                // fetchEventsData();
            }
        }, 5000); // 20 seconds polling

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [id, isEditing, fetchCommunityData, fetchEventsData]);


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
    
    // --- EVENT HANDLERS ---

    const handleSaveEvent = async (eventData) => {
        const toastId = toast.loading(eventModal.event ? "Updating event..." : "Creating event...");
        try {
            if (eventModal.event) {
                await updateCommunityEvent(eventModal.event.id, eventData);
                toast.success("Event updated!");
            } else {
                // **FIX**: Pass the creator's ID in the request body
                await createCommunityEvent(id, { ...eventData, created_by: account.id });
                toast.success("Event created!");
            }
            setEventModal({ isOpen: false, event: null });
            fetchEventsData();
        } catch (error) {
            toast.error("Failed to save event.");
        } finally {
            toast.dismiss(toastId);
        }
    };
    
    const handleDeleteEvent = (eventId) => {
        setModalState({
            isOpen: true,
            title: "Delete Event?",
            message: "Are you sure? This cannot be undone.",
            confirmText: "Delete",
            onConfirm: async () => {
                const toastId = toast.loading("Deleting event...");
                try {
                    await deleteCommunityEvent(eventId);
                    toast.success("Event deleted.");
                    fetchEventsData(); // Refresh
                } catch (error) {
                    toast.error("Failed to delete event.");
                } finally {
                    toast.dismiss(toastId);
                    setModalState({ isOpen: false });
                }
            }
        });
    };
    
     const handleRsvp = async (eventId, isRsvping) => {
        const originalEvents = [...events];
        setEvents(prevEvents => prevEvents.map(event => {
            if (event.id === eventId) {
                const newAttendees = isRsvping 
                ? [...event.attendees, account.id]
                : event.attendees.filter(uid => uid !== account.id);
                return { ...event, attendees: newAttendees };
            }
            return event;
        }));
        
        try {
            console.log(account.id)
            // **FIX**: Pass the user's ID in the request body
            await rsvpToEvent(eventId, { rsvp: isRsvping, userId: account.id });
            toast.success(isRsvping ? "You're going!" : "RSVP canceled.");
        } catch (error) {
            toast.error("RSVP failed. Please try again.");
            setEvents(originalEvents);
        }
    };

    // --- (Rest of the handlers remain the same) ---
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
                    fetchCommunityData();
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
            fetchCommunityData();
        } catch (error) {
            toast.error("Failed to join.");
        } finally {
            toast.dismiss(toastId);
        }
    };

    const handleRemoveMember = async (memberId) => {
        setModalState({
            isOpen: true,
            title: "Remove Member?",
            message: "Are you sure you want to remove this member?",
            confirmText: "Remove",
            onConfirm: async () => {
                await removeCommunityMember(id, memberId);
                fetchCommunityData();
                setModalState({ isOpen: false });
            }
        });
    };

    const handleRoleChange = async (memberId, newRole) => {
        await updateCommunityMemberRole(id, memberId, newRole);
        fetchCommunityData();
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
        fetchCommunityData();
    };


    if (isLoading) return <div className="p-10 text-center text-white">Loading...</div>;
    if (!community) return null;

    return (
        <div className="p-4 sm:p-6 text-white min-h-full">
            <ConfirmationModal {...modalState} onClose={() => setModalState({ isOpen: false })} />
            <EventModal 
                isOpen={eventModal.isOpen} 
                onClose={() => setEventModal({ isOpen: false, event: null })} 
                onSave={handleSaveEvent}
                event={eventModal.event} 
            />

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
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-bold mb-2">{community.name}</h1>
                            <p className="text-gray-400 max-w-3xl">{community.description}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0 mt-4 sm:mt-0">
                           {userRole === 'admin' && <button onClick={() => setIsEditing(true)} className="button-icon"><FaEdit /></button>}
                           {currentUserMembership ? <button onClick={handleLeave} className="button-danger">Leave</button> : <button onClick={handleJoin} className="button-primary">Join</button>}
                        </div>
                    </div>
                )}
            </header>

            <div className="flex border-b border-gray-700 mb-6 overflow-x-auto">
                <button onClick={() => setActiveTab('members')} className={`tab-button ${activeTab === 'members' && 'active'}`}><FaUsers /> <span className='hidden sm:block'>Members</span> ({community.members.length})</button>
                <button onClick={() => setActiveTab('events')} className={`tab-button ${activeTab === 'events' && 'active'}`}><FaCalendarAlt /> <span className='hidden sm:block'>Events</span> ({events.length})</button>
                {userRole === 'admin' && <button onClick={() => setActiveTab('manage')} className={`tab-button ${activeTab === 'manage' && 'active'}`}><FaCog /> <span className='hidden sm:block'>Manage</span></button>}
            </div>

            {activeTab === 'members' && (
                <div className="bg-[#1e1e1e] p-6 rounded-lg animate-fade-in-up">
                    <h2 className="text-2xl font-bold mb-4">Community Members</h2>
                    <ul className="space-y-3">
                        {community.members.map(({ user, role }) => (
                            <li key={user.id} className="flex items-center bg-[#2a2a2a] p-3 rounded-lg">
                                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold mr-4 flex-shrink-0">{user.name.charAt(0).toUpperCase()}</div>
                                <span className="text-white truncate">{user.name}</span>
                                <div className={`flex items-center text-sm ml-auto ${ROLES[role].color} flex-shrink-0`}>
                                    {React.createElement(ROLES[role].icon, { className: "mr-1" })}
                                    <span>{ROLES[role].label}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            
            {activeTab === 'events' && (
                <div className="bg-[#1e1e1e] p-6 rounded-lg animate-fade-in-up">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Upcoming Events</h2>
                        {canManage && (
                           <button onClick={() => setEventModal({ isOpen: true, event: null })} className="button-primary flex items-center">
                               <FaCalendarPlus className="sm:mr-2" /> <span className='hidden sm:block'>Create Event</span>
                           </button>
                        )}
                    </div>
                    {isEventsLoading ? <div className="text-center py-8">Loading events...</div> : (
                        events.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {events.map(event => (
                                    <EventCard 
                                        key={event.id}
                                        event={event}
                                        onRsvp={handleRsvp}
                                        isAttending={event.attendees.includes(account.id)}
                                        canManage={canManage}
                                        onEdit={(eventToEdit) => setEventModal({ isOpen: true, event: eventToEdit })}
                                        onDelete={handleDeleteEvent}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-center py-8">No upcoming events. {canManage ? "Why not create one?" : ""}</p>
                        )
                    )}
                </div>
            )}
            
            {activeTab === 'manage' && userRole === 'admin' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
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

// =================================================================================
// --- MemberActionsDropdown (FINAL, PORTAL-BASED VERSION) ---
// =================================================================================
const MemberActionsDropdown = ({ member, currentUserRole, onRoleChange, onRemove }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);
    const menuRef = useRef(null); // Ref for the menu itself

    // Calculate position when the menu is opened
    const handleToggle = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            // Position the menu above the button, aligning to the right
            setPosition({
                top: rect.top + window.scrollY - 8, // Adjust for better placement
                left: rect.left + window.scrollX - 192 + rect.width, // 192 is w-48
            });
        }
        setIsOpen(!isOpen);
    };

    // Effect to handle clicking outside the menu to close it
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
            {/* The button that triggers the dropdown */}
            <button ref={buttonRef} onClick={handleToggle} className="p-2 rounded-full hover:bg-gray-600 transition-colors">
                <FaEllipsisV />
            </button>

            {/* The dropdown menu, now rendered in a Portal */}
            {isOpen && (
                <Portal>
                    <div
                        ref={menuRef}
                        // Apply position dynamically and add transform to pop it upwards
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

export default CommunityDetail;