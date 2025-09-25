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

// Helper function to determine status text and color
const getStatusInfo = (pothole) => {
    switch (pothole.status) {
        case 'fixed':
            return { text: 'Repaired', className: 'bg-green-100 text-green-700' };
        case 'discarded':
            return { text: 'Discarded', className: 'bg-red-100 text-red-700' };
        case 'under_review': {
            const contract = pothole?.current_bid?.contracts?.[0];
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

    // Fetch all potholes from the API
    const fetchPotholes = async () => {
        try {
            const response = await apiConnector("get", "/api/potholes/all");
            setPotholes(response.data);
            console.log("Fetched potholes:", response.data);
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
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.addControl(new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
            showUserHeading: true
        }), 'top-right');
        mapRef.current = map;
        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Add pothole markers to the map
    useEffect(() => {
        if (!mapRef.current || !potholes.length) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        // Create and add new markers
        potholes.forEach(pothole => {
            let color;
            const statusInfo = getStatusInfo(pothole);

            if (statusInfo.text === 'Discarded') color = '#EF4444'; // Red
            else if (statusInfo.text === 'Under Review' || statusInfo.text === 'Assigned') color = '#F59E0B'; // Amber
            else if (statusInfo.text === 'Repaired') color = '#10B981'; // Green
            else if (statusInfo.text === 'Verified') color = '#3B82F6'; // Blue
            else if (statusInfo.text === 'Final Review') color = '#A855F7'; // Purple
            else color = '#6B7280'; // Grey for Unverified/Unknown

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
        const toastId = toast.loading("Verifying...");
        try {
            await apiConnector("patch", `${potholeEndpoints.VERIFY_POTHOLE}/${potholeId}`, {});
            toast.success("Pothole Verified!", { id: toastId });
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

    const handleRejectRepair = async (contractId) => {
        setIsUpdating(true);
        const toastId = toast.loading("Rejecting Repair...");
        console.log("Rejecting repair for contract ID:", contractId);
        try {
            await apiConnector("patch", `${potholeEndpoints.REJECT_REPAIR}/${contractId}`, {});
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

    // Image navigation handlers
    const handlePrevImage = () => setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : selectedPothole.images.length - 1));
    const handleNextImage = () => setCurrentImageIndex(prev => (prev < selectedPothole.images.length - 1 ? prev + 1 : 0));

    return (
        <div className="relative w-full h-full">
            <div ref={mapContainerRef} className="w-full h-full" />

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

                        {(selectedPothole.status === 'under_review' || selectedPothole.status === 'assigned') && (
                            <p className="mt-2 text-sm font-medium text-gray-800 bg-yellow-100 p-2 rounded-md">
                                <span className="font-semibold">Assigned To:</span>{' '}
                                {selectedPothole.bids?.find(bid => bid.status === 'accepted')?.users?.name || 'Contractor Info Unavailable'}
                            </p>
                        )}

                        <p className="text-xs text-gray-500 mt-2"><span className="font-semibold">Address:</span> {isAddressLoading ? "Fetching address..." : potholeAddress}</p>
                    </div>

                    {/* Image Carousel */}
                    <div className="relative w-full h-48 bg-gray-200 rounded-lg">
                        <img src={selectedPothole.images?.length ? selectedPothole.images[currentImageIndex].image_url : placeholderImageUrl} alt="Pothole" className="w-full h-full rounded-lg object-cover" />
                        {selectedPothole.images?.length > 1 && (
                            <>
                                <button onClick={handlePrevImage} className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition" aria-label="Previous image">&#10094;</button>
                                <button onClick={handleNextImage} className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition" aria-label="Next image">&#10095;</button>
                                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs rounded-full px-2 py-0.5">{currentImageIndex + 1} / {selectedPothole.images.length}</div>
                            </>
                        )}
                    </div>

                    {/* Status Tags */}
                    <div className="flex justify-between items-center">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${selectedPothole.severity === "High" ? "bg-red-100 text-red-700" : selectedPothole.severity === "Medium" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>{selectedPothole.severity} Severity</span>
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusInfo(selectedPothole).className}`}>{getStatusInfo(selectedPothole).text}</span>
                    </div>

                    {/* Conditional Action Buttons */}
                    {selectedPothole.status === 'reported' && !selectedPothole.verify && (
                        <div className="border-t pt-3 flex justify-between space-x-3">
                            <Button className="w-full md:w-auto flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={() => handleRejectPothole(selectedPothole.id)} disabled={isUpdating}>Reject</Button>
                            <Button className="w-full md:w-auto flex-1 bg-green-500 hover:bg-green-600 text-white" onClick={() => handleAcceptPothole(selectedPothole.id)} disabled={isUpdating}>Accept</Button>
                        </div>
                    )}

                    {selectedPothole.status === 'reported' && selectedPothole.verify && selectedPothole.current_bid && (
                        <div className="border-t pt-3 flex flex-col gap-2">
                            <div className="text-center text-sm text-gray-600">Lowest Bid: <span className="font-bold">₹{selectedPothole.current_bid.amount}</span> by <span className="font-bold">{selectedPothole.current_bid.users.name}</span></div>
                            <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white" onClick={() => handleAcceptBid(selectedPothole.id, selectedPothole.current_bid.id)} disabled={isUpdating}>Accept Bid</Button>
                        </div>
                    )}

                    {getStatusInfo(selectedPothole).text === 'Final Review' && (
                        <div className="border-t pt-3 flex justify-between space-x-3">
                            <Button className="w-full md:w-auto flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={() => handleRejectRepair(selectedPothole.current_bid?.contracts?.[0]?.id)} disabled={isUpdating}>Reject Work</Button>
                            <Button className="w-full md:w-auto flex-1 bg-green-500 hover:bg-green-600 text-white" onClick={() => handleFinalizeRepair(selectedPothole.id)} disabled={isUpdating}>Accept & Finalize</Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ApprovePothole;