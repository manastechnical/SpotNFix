import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { selectAccount } from '../../app/DashboardSlice';
import { FaPlus, FaSearch, FaUsers } from 'react-icons/fa';
import { fetchAllCommunities, createNewCommunity } from '../../services/repository/userRepo'; 
import CreateCommunityModal from '../utils/CreateCommunityModal';

const CommunityCard = ({ community }) => (
    <Link to={`/community/${community.id}`} className="block">
        <div className="bg-[#1e1e1e] rounded-lg shadow-md p-6 flex flex-col justify-between h-full transition-all duration-300 hover:transform hover:-translate-y-1 hover:shadow-indigo-500/30">
            <div>
                <h3 className="text-xl font-semibold text-white mb-2 truncate">{community.name}</h3>
                <p className="text-gray-400 mb-4 h-20 overflow-hidden text-ellipsis">{community.description}</p>
            </div>
            <div className="flex items-center text-gray-500 mt-4">
                <FaUsers className="mr-2" />
                <span>{community.community_members[0]?.count || 0} Members</span>
            </div>
        </div>
    </Link>
);

const Communities = () => {
    const [allCommunities, setAllCommunities] = useState([]);
    const [filteredCommunities, setFilteredCommunities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const account = useSelector(selectAccount);

    const getCommunities = async () => {
        setIsLoading(true);
        try {
            const response = await fetchAllCommunities();
            if (response?.data?.data) {
                setAllCommunities(response.data.data);
                setFilteredCommunities(response.data.data);
            }
        } catch (error) {
            toast.error("Could not fetch communities.");
        }
        setIsLoading(false);
    };

    useEffect(() => {
        getCommunities();
    }, []);

    useEffect(() => {
        const results = allCommunities.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
        setFilteredCommunities(results);
    }, [searchTerm, allCommunities]);

    const handleCreateCommunity = async (name, description) => {
        if (!account?.id) {
            return toast.error("Your session might have expired. Please log in again.");
        }
        
        const toastId = toast.loading("Creating community...");
        try {
            const response = await createNewCommunity({ name, description, created_by: account.id });
            if (response?.data?.data) {
                toast.success("Community created successfully!");
                getCommunities(); // Refetch to get the accurate list
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to create community.");
        } finally {
            toast.dismiss(toastId);
        }
    };

    return (
        <div className="p-6 text-white min-h-full">
            <CreateCommunityModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreate={handleCreateCommunity}
            />
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold">Join a Community</h1>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search communities..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="bg-[#2a2a2a] border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors shrink-0"
                    >
                        <FaPlus />
                        <span>Create New</span>
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-10">Loading Communities...</div>
            ) : filteredCommunities.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredCommunities.map((community) => (
                        <CommunityCard key={community.id} community={community} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-[#1e1e1e] rounded-lg">
                    <h2 className="text-2xl font-semibold text-white">No Communities Found</h2>
                    <p className="text-gray-400 mt-2">Try a different search or be the first to create one!</p>
                </div>
            )}
        </div>
    );
};

export default Communities;