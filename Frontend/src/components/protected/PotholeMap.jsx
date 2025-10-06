import React, { useRef, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import axios from 'axios';
import { FiSearch } from 'react-icons/fi';
import { dashboardMenuState } from '../../app/DashboardSlice';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// Helper to get status info
const getStatusInfo = (pothole) => {
    switch (pothole.status) {
        case 'reopened':
            return { text: 'Reopened', className: 'bg-orange-100 text-orange-700' };
        case 'fixed':
            return { text: 'Repaired', className: 'bg-green-100 text-green-700' };
        case 'discarded':
            return { text: 'Discarded', className: 'bg-red-100 text-red-700' };
        case 'under_review':
            return { text: 'Under Review', className: 'bg-yellow-100 text-yellow-700' };
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

const placeholderImageUrl = "https://via.placeholder.com/400x300.png?text=No+Image+Available";

const PotholeMap = () => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);

    // State
    const [potholes, setPotholes] = useState([]);
    const [filteredPotholes, setFilteredPotholes] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [styleURL, setStyleURL] = useState('mapbox://styles/mapbox/streets-v12');
    const isSidebarOpen = useSelector(dashboardMenuState);
    const [severityFilters, setSeverityFilters] = useState({ High: true, Medium: true, Low: true });
    const [isLoading, setIsLoading] = useState(true);

    // --- NEW STATE for details panel ---
    const [selectedPothole, setSelectedPothole] = useState(null);
    const [potholeAddress, setPotholeAddress] = useState("");
    const [isAddressLoading, setIsAddressLoading] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);


    // Fetch all potholes
    useEffect(() => {
        const fetchPotholes = async () => {
            setIsLoading(true);
            try {
                const response = await axios.get('/api/potholes/all');
                setPotholes(response.data);
            } catch (error) {
                console.error("Failed to fetch potholes:", error);
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchPotholes();
    }, []);

    // Filter potholes when data or filters change
    useEffect(() => {
        const filtered = potholes.filter(pothole => severityFilters[pothole.severity]);
        setFilteredPotholes(filtered);
    }, [potholes, severityFilters]);

    // --- NEW: Fetch address when a pothole is selected ---
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

    // Initialize Map
    useEffect(() => {
        if (mapRef.current) return;
        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: styleURL,
            center: [72.8777, 19.0760],
            zoom: 10
        });
        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.addControl(new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
            showUserHeading: true
        }), 'top-right');
        map.on('load', () => map.resize());
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [styleURL]);

    // Add/Update markers on the map
    useEffect(() => {
        const map = mapRef.current;
        if (!map || isLoading) return;

        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        filteredPotholes.forEach(pothole => {
            let color = '#808080';
            if (pothole.severity === 'High') color = '#EF4444';
            if (pothole.severity === 'Medium') color = '#F59E0B';
            if (pothole.severity === 'Low') color = '#10B981';

            const marker = new mapboxgl.Marker({ color })
                .setLngLat([pothole.longitude, pothole.latitude])
                .addTo(map);
            
            // --- MODIFIED: Click handler now sets state to show the panel ---
            marker.getElement().addEventListener('click', () => {
                setSelectedPothole(pothole);
                map.flyTo({ center: [pothole.longitude, pothole.latitude], zoom: 15 });
            });
            
            markersRef.current.push(marker);
        });
    }, [filteredPotholes, isLoading]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery || !mapRef.current) return;
        try {
            const response = await axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${mapboxgl.accessToken}&limit=1`);
            const [lng, lat] = response.data.features[0].center;
            mapRef.current.flyTo({ center: [lng, lat], zoom: 14 });
        } catch (error) {
            console.error("Failed to geocode search query:", error);
        }
    };

    const handleFilterChange = (e) => {
        const { name, checked } = e.target;
        setSeverityFilters(prevFilters => ({
            ...prevFilters,
            [name]: checked
        }));
    };

    // --- NEW: Image navigation handlers ---
    const handlePrevImage = () => setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : selectedPothole.images.length - 1));
    const handleNextImage = () => setCurrentImageIndex(prev => (prev < selectedPothole.images.length - 1 ? prev + 1 : 0));

    return (
        <div className="relative w-full h-full">
            <div ref={mapContainerRef} className="w-full h-full" />
            
            <div className={`absolute top-4 z-10 transition-all duration-300 ${isSidebarOpen ? 'left-2' : 'left-4'}`}>
                <form onSubmit={handleSearch} className="flex items-center bg-white rounded-lg shadow-md">
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search location..." className="py-2 px-4 rounded-l-lg focus:outline-none w-36 sm:w-64" />
                    <button type="submit" className="p-3 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600"><FiSearch /></button>
                </form>
                <div className="mt-4 bg-white rounded-lg shadow-md p-3 space-y-2">
                    <h4 className="text-sm font-bold text-gray-700">Filter by Severity</h4>
                    <div className="flex items-center"><input type="checkbox" id="high" name="High" checked={severityFilters.High} onChange={handleFilterChange} /><label htmlFor="high" className="ml-2 block text-sm">High</label></div>
                    <div className="flex items-center"><input type="checkbox" id="medium" name="Medium" checked={severityFilters.Medium} onChange={handleFilterChange} /><label htmlFor="medium" className="ml-2 block text-sm">Medium</label></div>
                    <div className="flex items-center"><input type="checkbox" id="low" name="Low" checked={severityFilters.Low} onChange={handleFilterChange} /><label htmlFor="low" className="ml-2 block text-sm">Low</label></div>
                </div>
            </div>

            <div className="absolute top-4 right-12 bg-white p-2 rounded shadow-md z-10">
                <select value={styleURL} onChange={(e) => setStyleURL(e.target.value)} className="p-1 border rounded text-sm focus:outline-none">
                    <option value="mapbox://styles/mapbox/streets-v12">Streets</option>
                    <option value="mapbox://styles/mapbox/satellite-streets-v12">Satellite</option>
                    <option value="mapbox://styles/mapbox/outdoors-v12">Outdoors</option>
                    <option value="mapbox://styles/mapbox/dark-v11">Dark</option>
                    <option value="mapbox://styles/mapbox/light-v11">Light</option>
                </select>
            </div>
            
            {/* --- NEW: Details Panel --- */}
            {selectedPothole && (
                <div className="absolute bottom-5 right-5 z-10 bg-white rounded-lg shadow-2xl p-4 w-full max-w-sm flex flex-col gap-4 animate-fade-in">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold">Pothole Details</h3>
                        <button onClick={() => setSelectedPothole(null)} className="text-gray-500 hover:text-gray-800 text-2xl leading-none" title="Close">&times;</button>
                    </div>

                    <div className="relative w-full h-48 bg-gray-200 rounded-lg">
                        <img src={selectedPothole.images?.[currentImageIndex]?.image_url || placeholderImageUrl} alt="Pothole" className="w-full h-full rounded-lg object-cover" />
                        {selectedPothole.images?.length > 1 && (
                            <>
                                <button onClick={handlePrevImage} className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition">&#10094;</button>
                                <button onClick={handleNextImage} className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition">&#10095;</button>
                                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs rounded-full px-2 py-0.5">{currentImageIndex + 1} / {selectedPothole.images.length}</div>
                            </>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div>
                            <p className="text-xs font-semibold text-gray-500">Description</p>
                            <p className="text-sm text-gray-800">{selectedPothole.description}</p>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                            <div>
                                <p className="text-xs font-semibold text-gray-500">Severity</p>
                                <span className={`px-3 py-1 text-xs font-bold rounded-full ${selectedPothole.severity === "High" ? "bg-red-100 text-red-700" : selectedPothole.severity === "Medium" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>{selectedPothole.severity}</span>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500">Status</p>
                                <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusInfo(selectedPothole).className}`}>{getStatusInfo(selectedPothole).text}</span>
                            </div>
                        </div>
                        
                        {selectedPothole.pothole_type && (
                            <div className="pt-2 border-t">
                                <p className="text-xs font-semibold text-gray-500">Type</p>
                                <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">{selectedPothole.pothole_type}</span>
                            </div>
                        )}
                        
                        <div >
                            {selectedPothole.current_bid?.contracts?.[0]?.actual_end_date && (
                                <div className="pt-2 border-t space-y-2">
                                    <p className="text-xs font-semibold text-gray-500">Repair Date</p>
                                    <p className="text-sm text-gray-800">{new Date(selectedPothole.current_bid.contracts[0].actual_end_date).toLocaleDateString()}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PotholeMap;