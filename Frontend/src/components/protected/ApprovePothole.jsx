import React, { useRef, useState, useEffect } from "react";
import { apiConnector } from "../../services/Connector";
import { potholeEndpoints } from "../../services/Apis"; 
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from "../ui/button";
import { toast } from "react-hot-toast";

// Set Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const placeholderImageUrl = "https://via.placeholder.com/400x300.png?text=No+Image+Available";

const ApprovePothole = () => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);

    // State management (removed bid-related states)
    const [potholes, setPotholes] = useState([]);
    const [selectedPothole, setSelectedPothole] = useState(null);
    const [potholeAddress, setPotholeAddress] = useState("");
    const [isAddressLoading, setIsAddressLoading] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isUpdating, setIsUpdating] = useState(false); // State to disable buttons during API call

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
        setCurrentImageIndex(0); // Reset image index when pothole changes

        const fetchAddress = async () => {
            if (!selectedPothole) {
                setPotholeAddress("");
                return;
            }

            setIsAddressLoading(true);
            try {
                const { longitude, latitude } = selectedPothole;
                const accessToken = mapboxgl.accessToken;
                const response = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${accessToken}`
                );
                const data = await response.json();

                if (data.features && data.features.length > 0) {
                    setPotholeAddress(data.features[0].place_name);
                } else {
                    setPotholeAddress("Address not found.");
                }
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
            center: [72.8777, 19.0760],
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
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];
        potholes.forEach(pothole => {
            let color;
            if (pothole.status === 'discarded') {
                color = '#EF4444'; // Red
            } else if (pothole.status === 'under_review' || pothole.status === 'assigned') {
                color = '#F59E0B'; // Amber/Yellow
            } else if (pothole.status === 'repaired') {
                color = '#10B981'; // Green
            } else if (pothole.status === 'reported' && pothole.verify === true) {
                color = '#3B82F6'; // Blue for verified
            } else {
                color = '#6B7280'; // Grey for reported but unverified
            }

            const marker = new mapboxgl.Marker({ color }).setLngLat([pothole.longitude, pothole.latitude]).addTo(mapRef.current);
            marker.getElement().addEventListener('click', () => {
                setSelectedPothole(pothole);
            });
            markersRef.current.push(marker);
        });
    }, [potholes]);


    // --- NEW: Handlers for Accept and Reject buttons ---
    const handleAcceptPothole = async (potholeId) => {
        setIsUpdating(true);
        const toastId = toast.loading("Verifying...");
        try {
            // ✅ Pass an empty object {} as the request body
            await apiConnector("patch", `${potholeEndpoints.VERIFY_POTHOLE}/${potholeId}`, {});
            
            toast.success("Pothole Verified!", { id: toastId });
            setSelectedPothole(null); // Close the details card
            await fetchPotholes(); // Refresh data to update map markers
        } catch (error) {
            console.error("Failed to verify pothole:", error);
            toast.error("Verification failed. Please try again.", { id: toastId });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleRejectPothole = async (potholeId) => {
        setIsUpdating(true);
        const toastId = toast.loading("Discarding...");
        try {
            // ✅ Pass an empty object {} as the request body
            await apiConnector("patch", `${potholeEndpoints.DISCARD_POTHOLE}/${potholeId}`, {});

            toast.success("Pothole Discarded!", { id: toastId });
            setSelectedPothole(null); // Close the details card
            await fetchPotholes(); // Refresh data to update map markers
        } catch (error) {
            console.error("Failed to discard pothole:", error);
            toast.error("Could not discard pothole. Please try again.", { id: toastId });
        } finally {
            setIsUpdating(false);
        }
    };

    // --- Carousel navigation functions ---
    const handlePrevImage = () => {
        setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : selectedPothole.images.length - 1));
    };

    const handleNextImage = () => {
        setCurrentImageIndex(prev => (prev < selectedPothole.images.length - 1 ? prev + 1 : 0));
    };

    return (
        <div className="relative w-full h-full">
            {/* Map Container */}
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Floating Pothole Details Card */}
            {selectedPothole && (
                <div className="absolute bottom-5 right-5 z-10 bg-white rounded-lg shadow-2xl p-4 w-full max-w-sm flex flex-col gap-3 animate-fade-in">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold">Pothole Details</h3>
                        <button
                            onClick={() => setSelectedPothole(null)}
                            className="text-gray-500 hover:text-gray-800 text-2xl leading-none"
                            title="Close"
                        >
                            &times;
                        </button>
                    </div>

                    <div>
                        <p className="text-sm text-gray-700">
                            <span className="font-semibold">Description:</span>{" "}
                            {selectedPothole.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            <span className="font-semibold">Address:</span>{" "}
                            {isAddressLoading ? "Fetching address..." : potholeAddress}
                        </p>
                    </div>

                    {/* Image Carousel Display */}
                    <div className="relative w-full h-48 bg-gray-200 rounded-lg">
                        <img
                            src={
                                selectedPothole.images && selectedPothole.images.length > 0
                                    ? selectedPothole.images[currentImageIndex].image_url
                                    : placeholderImageUrl
                            }
                            alt="Pothole"
                            className="w-full h-full rounded-lg object-cover"
                        />

                        {selectedPothole.images && selectedPothole.images.length > 1 && (
                            <>
                                <button
                                    onClick={handlePrevImage}
                                    className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition"
                                    aria-label="Previous image"
                                >
                                    &#10094;
                                </button>
                                <button
                                    onClick={handleNextImage}
                                    className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition"
                                    aria-label="Next image"
                                >
                                    &#10095;
                                </button>
                                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs rounded-full px-2 py-0.5">
                                    {currentImageIndex + 1} / {selectedPothole.images.length}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex justify-between items-center">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full 
                            ${selectedPothole.severity === "High" ? "bg-red-100 text-red-700"
                                : selectedPothole.severity === "Medium" ? "bg-yellow-100 text-yellow-700"
                                    : "bg-green-100 text-green-700"}`}>
                            {selectedPothole.severity} Severity
                        </span>
                        <span className={`px-3 py-1 text-xs font-bold rounded-full
                            ${selectedPothole.verify ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                            {selectedPothole.verify ? 'Verified' : 'Unverified'}
                        </span>
                    </div>

                    {/* --- NEW: Accept / Reject Buttons --- */}
                    {/* Only show these buttons for reported potholes that are not yet verified or discarded */}
                    {selectedPothole.status === 'reported' && !selectedPothole.verify && (
                        <div className="border-t pt-3 flex justify-between space-x-3">
                            <Button
                                className="w-[8vw] bg-red-500 hover:bg-red-600 text-white"
                                onClick={() => handleRejectPothole(selectedPothole.id)}
                                disabled={isUpdating}
                            >
                                Reject
                            </Button>
                            <Button
                                className="w-[8vw] bg-green-500 hover:bg-green-600 text-white"
                                onClick={() => handleAcceptPothole(selectedPothole.id)}
                                disabled={isUpdating}
                            >
                                Accept
                            </Button>
                        </div>
                    )}
                </div>
            )}
            
            {/* REMOVED: Bidding Modal is no longer needed */}
        </div>
    );
};

export default ApprovePothole;