import React, { useRef, useState, useEffect } from "react";
import { apiConnector } from "../../services/Connector";
import { potholeEndpoints, bidEndpoints } from "../../services/Apis";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from "../ui/button";
import { toast } from "react-hot-toast";

// Set Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const placeholderImageUrl = "https://via.placeholder.com/400x300.png?text=No+Image+Available";

// --- HELPER: Find the active contract from ALL bids ---
const getActiveContract = (pothole) => {
    if (!pothole || !pothole.bids) return null;
    // Find the bid that has been accepted
    const acceptedBid = pothole.bids.find(bid => bid.status === 'accepted');
    // Return the contract associated with that bid
    return acceptedBid?.contracts?.[0] || null;
};

// Helper function to determine status text and color
const getStatusInfo = (pothole) => {
    switch (pothole.status) {
        case 'reopened':
            return { text: 'Reopened', className: 'bg-orange-100 text-orange-700' };
        case 'fixed':
            return { text: 'Repaired', className: 'bg-green-100 text-green-700' };
        case 'discarded':
            return { text: 'Discarded', className: 'bg-red-100 text-red-700' };
        case 'under_review': {
            const contract = getActiveContract(pothole);
            
            if (contract && contract.status === 'completed') {
                return { text: 'Final Review', className: 'bg-purple-100 text-purple-700' };
            }
            return { text: 'Under Review', className: 'bg-yellow-100 text-yellow-700' };
        }
        case 'assigned':
            return { text: 'Assigned', className: 'bg-yellow-100 text-yellow-700' };
        case 'reported':
            if (pothole.verify) {
                return { text: 'Verified', className: 'bg-blue-100 text-blue-700' };
            }
            return { text: 'Unverified', className: 'bg-gray-200 text-gray-600' };
        default:
            return { text: 'Unknown', className: 'bg-gray-200 text-gray-600' };
    }
};

const legendItems = [
    { text: 'Reopened', color: '#F97316' }, // Orange
    { text: 'Final Review', color: '#A855F7' }, // Purple
    { text: 'Verified', color: '#3B82F6' }, // Blue
    { text: 'Repaired', color: '#10B981' }, // Green
    { text: 'Under Review / Assigned', color: '#F59E0B' }, // Amber
    { text: 'Discarded', color: '#EF4444' }, // Red
    { text: 'Unverified / Unknown', color: '#6B7280' }, // Grey
];


const ApprovePothole = () => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);

    // State management
    const [potholes, setPotholes] = useState([]);
    const [selectedPothole, setSelectedPothole] = useState(null);
    const [potholeAddress, setPotholeAddress] = useState("");
    const [isAddressLoading, setIsAddressLoading] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isLegendVisible, setIsLegendVisible] = useState(false);
    
    // State for Bid Modal
    const [showBidModal, setShowBidModal] = useState(false);

    // Fetch all potholes from the API
    const fetchPotholes = async () => {
        try {
            const response = await apiConnector("get", "/api/potholes/all");
            setPotholes(response.data);
        } catch (error) {
            console.error("Failed to fetch potholes:", error);
            toast.error("Could not load pothole data.");
        }
    };

    // Fetch potholes on component mount
    useEffect(() => {
        fetchPotholes();
    }, []);

    // Effect for fetching address when a pothole is selected
    useEffect(() => {
        setCurrentImageIndex(0);
        setShowBidModal(false); 
        const fetchAddress = async () => {
            if (!selectedPothole) {
                setPotholeAddress("");
                return;
            }
            setIsAddressLoading(true);
            try {
                const { longitude, latitude } = selectedPothole;
                const accessToken = mapboxgl.accessToken;
                const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${accessToken}`);
                const data = await response.json();
                setPotholeAddress(data.features?.[0]?.place_name || "Address not found.");
            } catch (error) {
                console.error("Error fetching address:", error);
                setPotholeAddress("Could not fetch address.");
            } finally {
                setIsAddressLoading(false);
            }
        };
        fetchAddress();
    }, [selectedPothole]);

    // Initialize and manage map instance
    useEffect(() => {
        if (mapRef.current) return;
        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [72.8777, 19.0760], // Default center to Mumbai
            zoom: 10
        });
        
        map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
        map.addControl(new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
            showUserHeading: true
        }), 'bottom-right');

        mapRef.current = map;
        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Add pothole markers to the map
    useEffect(() => {
        if (!mapRef.current || !potholes.length) return;

        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        potholes.forEach(pothole => {
            let color;
            const statusInfo = getStatusInfo(pothole);

            if (statusInfo.text === 'Reopened') color = legendItems.find(i => i.text === 'Reopened').color;
            else if (statusInfo.text === 'Discarded') color = legendItems.find(i => i.text === 'Discarded').color;
            else if (statusInfo.text === 'Under Review' || statusInfo.text === 'Assigned') color = legendItems.find(i => i.text === 'Under Review / Assigned').color;
            else if (statusInfo.text === 'Repaired') color = legendItems.find(i => i.text === 'Repaired').color;
            else if (statusInfo.text === 'Verified') color = legendItems.find(i => i.text === 'Verified').color;
            else if (statusInfo.text === 'Final Review') color = legendItems.find(i => i.text === 'Final Review').color;
            else color = legendItems.find(i => i.text === 'Unverified / Unknown').color;

            const marker = new mapboxgl.Marker({ color })
                .setLngLat([pothole.longitude, pothole.latitude])
                .addTo(mapRef.current);

            marker.getElement().addEventListener('click', () => {
                setSelectedPothole(pothole);
                mapRef.current.flyTo({ center: [pothole.longitude, pothole.latitude], zoom: 15 });
            });

            markersRef.current.push(marker);
        });
    }, [potholes]);

    // Action Handlers
    const handleAcceptPothole = async (potholeId) => {
        setIsUpdating(true);
        const toastId = toast.loading("Verifying and detecting severity...");
        try {
            const response = await apiConnector("patch", `${potholeEndpoints.VERIFY_POTHOLE}/${potholeId}`, {});
            const detectedSeverity = response.data?.detectedSeverity;
            
            if (detectedSeverity) {
                toast.success(`Pothole Verified! Severity: ${detectedSeverity}`, { id: toastId });
            } else {
                toast.success("Pothole Verified!", { id: toastId });
            }
            
            setSelectedPothole(null);
            await fetchPotholes();
        } catch (error) {
            console.error("Failed to verify pothole:", error);
            toast.error("Verification failed.", { id: toastId });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleRejectPothole = async (potholeId) => {
        setIsUpdating(true);
        const toastId = toast.loading("Discarding...");
        try {
            await apiConnector("patch", `${potholeEndpoints.DISCARD_POTHOLE}/${potholeId}`, {});
            toast.success("Pothole Discarded!", { id: toastId });
            setSelectedPothole(null);
            await fetchPotholes();
        } catch (error) {
            console.error("Failed to discard pothole:", error);
            toast.error("Could not discard pothole.", { id: toastId });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleAcceptBid = async (potholeId, bidId) => {
        setIsUpdating(true);
        const toastId = toast.loading("Accepting Bid...");
        try {
            const user = JSON.parse(localStorage.getItem("account"));
            if (!user?.id) throw new Error("User not found. Please log in again.");

            await apiConnector("patch", `${bidEndpoints.ACCEPT_BID}/${potholeId}`, { bidId, approverId: user.id });

            toast.success("Bid accepted successfully!", { id: toastId });
            setShowBidModal(false); 
            setSelectedPothole(null);
            await fetchPotholes();
        } catch (error) {
            console.error("Failed to accept bid:", error);
            const errorMessage = error.response?.data?.error || "Could not accept bid.";
            toast.error(errorMessage, { id: toastId });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleFinalizeRepair = async (potholeId) => {
        setIsUpdating(true);
        const toastId = toast.loading("Finalizing Repair...");
        try {
            await apiConnector("patch", `${potholeEndpoints.FINALIZE_REPAIR}/${potholeId}`, {});
            toast.success("Repair Finalized and Approved!", { id: toastId });
            setSelectedPothole(null);
            await fetchPotholes();
        } catch (error) {
            console.error("Failed to finalize repair:", error);
            toast.error("Approval failed. Please try again.", { id: toastId });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleRejectRepair = async (contractId,potholeId) => {
        setIsUpdating(true);
        const toastId = toast.loading("Rejecting Repair...");
        try {
            await apiConnector("patch", `${potholeEndpoints.REJECT_REPAIR}/${contractId}/${potholeId}`, {});
            toast.success("Repair Rejected. Contractor has been notified.", { id: toastId });
            setSelectedPothole(null);
            await fetchPotholes();
        } catch (error) {
            console.error("Failed to reject repair:", error);
            toast.error("Could not reject repair. Please try again.", { id: toastId });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDiscardReopen = async (potholeId) => {
        setIsUpdating(true);
        const toastId = toast.loading("Discarding Reopen Claim...");
        try {
            await apiConnector("patch", `${potholeEndpoints.DISCARD_REOPEN}/${potholeId}`, {});
            toast.success("Reopen claim discarded and status set to fixed.", { id: toastId });
            setSelectedPothole(null);
            await fetchPotholes();
        } catch (error) {
            console.error("Failed to discard reopen claim:", error);
            toast.error("Could not discard the claim. Please try again.", { id: toastId });
        } finally {
            setIsUpdating(false);
        }
    };

    const handlePenalizeReopen = async (contractId) => {
        setIsUpdating(true);
        const toastId = toast.loading("Penalizing Contract...");
        try {
            await apiConnector("patch", `${potholeEndpoints.PENALIZE_REOPEN}/${contractId}`, {});
            toast.success("Contract has been penalized.", { id: toastId });
            setSelectedPothole(null);
            await fetchPotholes();
        } catch (error) {
            console.error("Failed to penalize contract:", error);
            toast.error("Could not penalize the contract. Please try again.", { id: toastId });
        } finally {
            setIsUpdating(false);
        }
    };

    // Image navigation handlers
    const handlePrevImage = () => setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : selectedPothole.images.length - 1));
    const handleNextImage = () => setCurrentImageIndex(prev => (prev < selectedPothole.images.length - 1 ? prev + 1 : 0));

    // Get the active contract for the selected pothole
    // 1. Get the bid that is specifically "accepted" (NOT just the current/lowest bid)
    const acceptedBid = selectedPothole?.bids?.find(bid => bid.status === 'accepted');
    // 2. Get the contract from that accepted bid
    const activeContract = acceptedBid?.contracts?.[0];

    return (
        <div className="relative w-full h-full">
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Legend */}
            <div className="absolute top-3 right-3 flex flex-col items-end">
                <button
                    onClick={() => setIsLegendVisible(!isLegendVisible)}
                    className="bg-white p-2 rounded-md shadow-lg text-gray-700 hover:bg-gray-100"
                    title="Toggle Legend"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                </button>

                {isLegendVisible && (
                    <div className="bg-white rounded-lg shadow-xl p-3 mt-2 w-56 animate-fade-in">
                        <h4 className="font-bold text-sm mb-2 border-b pb-1">Marker Legend</h4>
                        <ul className="space-y-1">
                            {legendItems.map(item => (
                                <li key={item.text} className="flex items-center">
                                    <span
                                        className="w-4 h-4 rounded-full mr-2"
                                        style={{ backgroundColor: item.color }}
                                    ></span>
                                    <span className="text-xs text-gray-700">{item.text}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {selectedPothole && (
                <div className="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-lg shadow-2xl p-4 flex flex-col gap-3 animate-fade-in md:bottom-5 md:right-5 md:left-auto md:rounded-lg md:w-full md:max-w-sm">
                    {/* Header */}
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold">Pothole Details</h3>
                        <button onClick={() => setSelectedPothole(null)} className="text-gray-500 hover:text-gray-800 text-2xl leading-none" title="Close">&times;</button>
                    </div>

                    {/* Pothole Info */}
                    <div>
                        <p className="text-sm text-gray-700"><span className="font-semibold">Description:</span> {selectedPothole.description}</p>

                        {['under_review', 'assigned', 'reopened'].includes(selectedPothole.status) && (
                            <p className={`mt-2 text-sm font-medium text-gray-800 p-2 rounded-md ${selectedPothole.status === 'reopened' ? 'bg-orange-100' : 'bg-yellow-100'}`}>
                                <span className="font-semibold">Assigned To:</span>{' '}
                                {/* Display name from the accepted bid explicitly */}
                                {acceptedBid?.users?.name || 'Contractor Info Unavailable'}
                            </p>
                        )}

                        <p className="text-xs text-gray-500 mt-2"><span className="font-semibold">Address:</span> {isAddressLoading ? "Fetching address..." : potholeAddress}</p>
                    </div>

                    {/* Image Carousel */}
                    <div className="relative w-full h-48 bg-gray-200 rounded-lg">
                        <img src={
                            selectedPothole.images?.length 
                                ? (selectedPothole.images[currentImageIndex].type === 'fix_proof' && selectedPothole.images[currentImageIndex].completed_img_url
                                    ? selectedPothole.images[currentImageIndex].completed_img_url 
                                    : selectedPothole.images[currentImageIndex].image_url)
                                : placeholderImageUrl
                        } alt="Pothole" className="w-full h-full rounded-lg object-cover" />
                        {selectedPothole.images?.length > 1 && (
                            <>
                                <button onClick={handlePrevImage} className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition" aria-label="Previous image">&#10094;</button>
                                <button onClick={handleNextImage} className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition" aria-label="Next image">&#10095;</button>
                                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs rounded-full px-2 py-0.5">{currentImageIndex + 1} / {selectedPothole.images.length}</div>
                            </>
                        )}
                    </div>

                    {/* Status Tags & Info Button */}
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${selectedPothole.severity === "High" ? "bg-red-100 text-red-700" : selectedPothole.severity === "Medium" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                                        {selectedPothole.severity} Severity
                                    </span>
                                    
                                    {/* Info Button for Bids */}
                                    {selectedPothole.bids && selectedPothole.bids.length > 0 && selectedPothole.status === 'reported' && selectedPothole.verify && (
                                        <button 
                                            onClick={() => setShowBidModal(true)}
                                            className="bg-blue-100 p-1 rounded-full text-blue-600 hover:bg-blue-200 transition-colors"
                                            title="View and select from all bids"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                {selectedPothole.verify && selectedPothole.severity && (
                                    <span className="text-xs text-gray-500 text-center">🤖 AI Detected</span>
                                )}
                            </div>
                            {selectedPothole.pothole_type && (
                                <div className="flex flex-col gap-1">
                                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                                        {selectedPothole.pothole_type}
                                    </span>
                                    {selectedPothole.verify && (
                                        <span className="text-xs text-gray-500 text-center">🤖 AI Detected</span>
                                    )}
                                </div>
                            )}
                        </div>
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusInfo(selectedPothole).className}`}>{getStatusInfo(selectedPothole).text}</span>
                    </div>

                    {/* Conditional Action Buttons */}
                    {selectedPothole.status === 'reported' && !selectedPothole.verify && (
                        <div className="border-t pt-3 flex justify-between space-x-3">
                            <Button className="w-full md:w-auto flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={() => handleRejectPothole(selectedPothole.id)} disabled={isUpdating}>Reject</Button>
                            <Button className="w-full md:w-auto flex-1 bg-green-500 hover:bg-green-600 text-white" onClick={() => handleAcceptPothole(selectedPothole.id)} disabled={isUpdating}>
                                {isUpdating ? "Analyzing..." : "Accept & Analyze"}
                            </Button>
                        </div>
                    )}

                    {/* UPDATED REOPENED SECTION:
                       1. Uses activeContract (from accepted bid) instead of selectedPothole.current_bid (lowest bid)
                       2. Logs the user's email to console for verification.
                    */}
                    {selectedPothole.status === 'reopened' && activeContract?.status !== 'penalized' && (
                        <div className="border-t pt-3 flex justify-between space-x-3">
                            {console.log("Penalizing Contractor:", acceptedBid?.users?.email)}
                            <Button className="w-full md:w-auto flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={() => handleDiscardReopen(selectedPothole.id)} disabled={isUpdating}>Reject</Button>
                            <Button className="w-full md:w-auto flex-1 bg-green-500 hover:bg-green-600 text-white" onClick={() => handlePenalizeReopen(activeContract?.id)} disabled={isUpdating}>Accept</Button>
                        </div>
                    )}

                    {selectedPothole.status === 'reported' && selectedPothole.verify && selectedPothole.current_bid && (
                        <div className="border-t pt-3 flex flex-col gap-2">
                            <div className="text-center text-sm text-gray-600">
                                Lowest Bid: <span className="font-bold">₹{selectedPothole.current_bid.amount}</span> by <span className="font-bold">{selectedPothole.current_bid.users.name}</span>
                            </div>
                            <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white" onClick={() => handleAcceptBid(selectedPothole.id, selectedPothole.current_bid.id)} disabled={isUpdating}>
                                Accept Lowest Bid
                            </Button>
                        </div>
                    )}

                    {/* UPDATED: Final Review Section 
                        Uses activeContract instead of current_bid 
                    */}
                    {getStatusInfo(selectedPothole).text === 'Final Review' && activeContract && (
                        <div className="border-t pt-3 flex justify-between space-x-3">
                            <Button 
                                className="w-full md:w-auto flex-1 bg-red-500 hover:bg-red-600 text-white" 
                                onClick={() => handleRejectRepair(activeContract.id, selectedPothole.id)} 
                                disabled={isUpdating}
                            >
                                Reject Work
                            </Button>
                            <Button 
                                className="w-full md:w-auto flex-1 bg-green-500 hover:bg-green-600 text-white" 
                                onClick={() => handleFinalizeRepair(selectedPothole.id)} 
                                disabled={isUpdating}
                            >
                                Accept & Finalize
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* --- All Bids Modal --- */}
            {showBidModal && selectedPothole && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowBidModal(false)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-4 border-b shrink-0">
                            <h2 className="text-xl font-bold">All Bids</h2>
                            <button onClick={() => setShowBidModal(false)} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                        </div>

                        {/* Modal Body with Vertical Scroll */}
                        <div className="p-4 overflow-y-auto">
                            {selectedPothole.bids && selectedPothole.bids.length > 0 ? (
                                <div className="space-y-4">
                                    {[...selectedPothole.bids]
                                        .sort((a, b) => a.amount - b.amount) 
                                        .map((bid) => (
                                        <div key={bid.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="font-bold text-lg">₹{bid.amount}</p>
                                                    <p className="text-sm font-semibold text-gray-700">{bid.users?.name}</p>
                                                    <p className="text-xs text-gray-500">{bid.users?.email}</p>
                                                </div>
                                                <Button 
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700 text-white"
                                                    onClick={() => handleAcceptBid(selectedPothole.id, bid.id)}
                                                    disabled={isUpdating}
                                                >
                                                    {isUpdating ? '...' : 'Accept'}
                                                </Button>
                                            </div>
                                            
                                            <div className="bg-gray-100 p-2 rounded text-sm text-gray-700 break-words whitespace-pre-wrap">
                                                {bid.description || "No description provided."}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 py-4">No bids available.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApprovePothole;