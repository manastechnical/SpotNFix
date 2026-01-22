import React, { useRef, useState, useEffect, useCallback } from "react";
import { apiConnector } from "../../services/Connector";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from "../ui/button";
import { toast } from "react-hot-toast";
import { contractorEndpoints } from "../../services/Apis";

// Set Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const placeholderImageUrl = "https://via.placeholder.com/400x300.png?text=No+Image+Available";

// Helper component for the close icon
const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

// --- NEW: Legend data array ---
const legendItems = [
    { text: 'Work Completed', color: '#3B82F6' }, // Blue
    { text: 'Bid Accepted (Ongoing)', color: '#F59E0B' }, // Orange
    { text: 'Bid Pending', color: '#6B7280' }, // Grey
];

const BiddingDetails = () => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);

    // --- Main Component State ---
    const [allPotholes, setAllPotholes] = useState([]);
    const [myBiddedPotholes, setMyBiddedPotholes] = useState([]);
    const [selectedPothole, setSelectedPothole] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [potholeAddress, setPotholeAddress] = useState("");
    const [isAddressLoading, setIsAddressLoading] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isLegendVisible, setIsLegendVisible] = useState(false); // --- NEW STATE ---

    // --- Modal State (Integrated) ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [files, setFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);


    // --- Main Component Functions ---
    const fetchPotholes = async () => {
        try {
            const response = await apiConnector("get", "/api/potholes/all");
            setAllPotholes(response.data);
        } catch (error) {
            console.error("Failed to fetch potholes:", error);
            toast.error("Could not load pothole data.");
        }
    };

    useEffect(() => {
        const userData = JSON.parse(localStorage.getItem('account'));
        setCurrentUser(userData);
        fetchPotholes();
    }, []);

    useEffect(() => {
        if (!currentUser?.id || !allPotholes.length) {
            setMyBiddedPotholes([]);
            return;
        }
        const filtered = allPotholes.map(pothole => {
            const myBid = pothole.bids?.find(bid => bid.contractor_id === currentUser.id);
            if (myBid) return { ...pothole, my_bid: myBid };
            return null;
        }).filter(Boolean);
        setMyBiddedPotholes(filtered);
    }, [allPotholes, currentUser]);

    useEffect(() => {
        if (!selectedPothole) {
            setPotholeAddress("");
            return;
        }
        setCurrentImageIndex(0);
        const fetchAddress = async () => {
            setIsAddressLoading(true);
            try {
                const { longitude, latitude } = selectedPothole;
                const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxgl.accessToken}`);
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

    useEffect(() => {
        if (mapRef.current) return;
        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [72.8777, 19.0760],
            zoom: 10
        });
        
        // --- MODIFIED LINES ---
        map.addControl(new mapboxgl.NavigationControl(), 'bottom-left');
        map.addControl(new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
            showUserHeading: true
        }), 'bottom-left');

        mapRef.current = map;
        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!mapRef.current) return;
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];
        myBiddedPotholes.forEach(pothole => {
            let color;
            if (pothole.my_bid?.contracts?.[0]?.status === 'completed') {
                color = legendItems.find(i => i.text === 'Work Completed').color;
            } else if (pothole.my_bid?.status === 'accepted') {
                color = legendItems.find(i => i.text === 'Bid Accepted (Ongoing)').color;
            } else if (pothole.my_bid?.status === 'pending') {
                color = legendItems.find(i => i.text === 'Bid Pending').color;
            } else {
                return; // Don't show marker if status is unknown
            }

            const marker = new mapboxgl.Marker({ color })
                .setLngLat([pothole.longitude, pothole.latitude])
                .addTo(mapRef.current);

            marker.getElement().addEventListener('click', () => setSelectedPothole(pothole));
            markersRef.current.push(marker);
        });
    }, [myBiddedPotholes]);

    const handlePrevImage = () => setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : selectedPothole.images.length - 1));
    const handleNextImage = () => setCurrentImageIndex(prev => (prev < selectedPothole.images.length - 1 ? prev + 1 : 0));

    // --- Modal Functions (Integrated) ---
    const handleFileChange = useCallback((selectedFiles) => {
        if (!selectedFiles || selectedFiles.length === 0) return;
        const currentFileCount = files.length;
        const maxFiles = 4;
        if (currentFileCount >= maxFiles) {
            toast.error(`You can only upload a maximum of ${maxFiles} images.`);
            return;
        }
        const newFiles = Array.from(selectedFiles);
        const filesToUpload = newFiles.slice(0, maxFiles - currentFileCount);
        if (newFiles.length > filesToUpload.length) {
            toast.error(`You can only add ${maxFiles - currentFileCount} more image(s).`);
        }
        setFiles(prev => [...prev, ...filesToUpload]);
    }, [files]);

    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileChange(e.dataTransfer.files);
    };

    const removeFile = (indexToRemove) => {
        setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setFiles([]);
        setIsDragging(false);
    }

    const handleSubmit = async () => {
        if (files.length === 0) {
            toast.error("Please upload at least one image as proof.");
            return;
        }

        const contractId = selectedPothole.my_bid.id;
        if (!contractId) {
            toast.error("Could not find a contract associated with this bid.");
            return;
        }

        setIsSubmitting(true);
        const toastId = toast.loading("Submitting proof...");

        const formData = new FormData();
formData.append('image', files[0]);
        formData.append('potholeId', selectedPothole.id);

        try {
            await apiConnector(
                "post",
                contractorEndpoints.COMPLETE_WORK_API(contractId),
                formData,
                { 'Content-Type': 'multipart/form-data' }
            );
            toast.success("Repair proof submitted successfully!", { id: toastId });
            closeModal();
            setSelectedPothole(null);
            fetchPotholes();
        } catch (error) {
            console.error("Failed to submit repair proof:", error);
            toast.error("Submission failed. Please try again.", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <div className="relative w-full h-full">
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* --- NEW: Legend Elements --- */}
            <div className="absolute top-4 right-4 flex flex-col items-end">
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
                        <h4 className="font-bold text-sm mb-2 border-b pb-1">My Bids Legend</h4>
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

            {/* --- Details Card --- */}
            {selectedPothole && (
                <div className="absolute bottom-5 right-5 z-10 bg-white rounded-lg shadow-2xl p-4 w-full max-w-sm flex flex-col gap-3 animate-fade-in">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold">Pothole Details</h3>
                        <button onClick={() => setSelectedPothole(null)} className="text-gray-500 hover:text-gray-800 text-2xl leading-none" title="Close">&times;</button>
                    </div>
                    <div>
                        <p className="text-sm text-gray-700"><span className="font-semibold">Description:</span> {selectedPothole.description}</p>
                        <p className="text-xs text-gray-500 mt-1"><span className="font-semibold">Address:</span> {isAddressLoading ? "Fetching..." : potholeAddress}</p>
                    </div>
                    <div className="relative w-full h-48 bg-gray-200 rounded-lg">
                        <img src={
        selectedPothole.images?.length 
            ? (selectedPothole.images[currentImageIndex].type === 'fix_proof' && selectedPothole.images[currentImageIndex].completed_img_url
                ? selectedPothole.images[currentImageIndex].completed_img_url 
                : selectedPothole.images[currentImageIndex].image_url)
            : placeholderImageUrl
    } alt="Pothole" className="w-full h-full rounded-lg object-cover" />
                        {selectedPothole.images && selectedPothole.images.length > 1 && (
                            <>
                                <button onClick={handlePrevImage} className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition" aria-label="Previous image">&#10094;</button>
                                <button onClick={handleNextImage} className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition" aria-label="Next image">&#10095;</button>
                                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs rounded-full px-2 py-0.5">{currentImageIndex + 1} / {selectedPothole.images.length}</div>
                            </>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 self-start">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${selectedPothole.severity === "High" ? "bg-red-100 text-red-700" : selectedPothole.severity === "Medium" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>{selectedPothole.severity} Severity</span>
                        {selectedPothole.pothole_type && (
                            <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">{selectedPothole.pothole_type}</span>
                        )}
                    </div>
                    <div className="border-t pt-3 space-y-2">
                        <div>
                            <p className="text-sm text-gray-700"><span className="font-semibold">Current Lowest Bid:</span> {selectedPothole.current_bid ? `₹${selectedPothole.current_bid.amount}` : "No bids yet"}</p>
                            <p className="text-sm text-gray-700"><span className="font-semibold">By:</span> {selectedPothole.current_bid?.users?.name || "N/A"}</p>
                        </div>
                        {selectedPothole.my_bid && (
                            <div className="border-t pt-3">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-gray-700">Your Bid Status:</p>
                                    <span className={`px-3 py-1 text-xs font-bold rounded-full capitalize ${selectedPothole.my_bid.status === 'accepted' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{selectedPothole.my_bid.status}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    {selectedPothole.my_bid?.status === 'accepted' && selectedPothole.my_bid?.contracts?.[0]?.status !== 'completed' && (
                        <Button className="w-full mt-2 bg-green-500 hover:bg-green-600 text-white" onClick={() => setIsModalOpen(true)}>Repair Complete</Button>
                    )}
                </div>
            )}

            {/* --- Modal JSX (Integrated) --- */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg m-4 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Submit Proof of Repair</h2>
                            <button onClick={closeModal} className="text-gray-500 hover:text-gray-800"><CloseIcon /></button>
                        </div>
                        <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                            <input type="file" multiple accept="image/*" className="hidden" id="file-upload" onChange={(e) => handleFileChange(e.target.files)} />
                            <label htmlFor="file-upload" className="cursor-pointer text-gray-600">
                                <p className="font-semibold">Drag & drop pictures here</p>
                                <p className="text-sm text-gray-500">or</p>
                                <p className="text-blue-600 font-bold">Click to browse</p>
                            </label>
                        </div>
                        {files.length > 0 && (
                            <div className="mt-4">
                                <h4 className="font-semibold text-sm mb-2">Selected Images:</h4>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {files.map((file, index) => (
                                        <div key={index} className="relative">
                                            <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-24 object-cover rounded-md" />
                                            <button onClick={() => removeFile(index)} className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold">&times;</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="mt-6 text-right">
                            <Button onClick={handleSubmit} disabled={isSubmitting || files.length === 0} className="w-full sm-w-auto bg-green-600 hover:bg-green-700 text-white">{isSubmitting ? "Submitting..." : "Work Done"}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BiddingDetails;