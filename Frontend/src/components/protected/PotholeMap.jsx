import React, { useRef, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import axios from 'axios';
import { FiSearch } from 'react-icons/fi';
import { dashboardMenuState } from '../../app/DashboardSlice';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

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
    const [severityFilters, setSeverityFilters] = useState({
        High: true,
        Medium: true,
        Low: true,
    });
        const [isLoading, setIsLoading] = useState(true); // Add a loading state


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
                setIsLoading(false); // Set loading to false after fetch
            }
        };
        fetchPotholes();
    }, []);

    // Filter potholes when data or filters change
    useEffect(() => {
        const filtered = potholes.filter(pothole => severityFilters[pothole.severity]);
        setFilteredPotholes(filtered);
    }, [potholes, severityFilters]);

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

        map.on('load', () => {
            map.resize();
        });
        
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [styleURL]);

    useEffect(() => {
        const map = mapRef.current;
        // Wait for the map to exist AND for the data to finish loading
        if (!map || isLoading) return;

        const addMarkers = () => {
            markersRef.current.forEach(marker => marker.remove());
            markersRef.current = [];

            filteredPotholes.forEach(pothole => {
            let color = '#808080';
            if (pothole.severity === 'High') color = '#EF4444';
            if (pothole.severity === 'Medium') color = '#F59E0B';
            if (pothole.severity === 'Low') color = '#10B981';

            const imageUrl = pothole.images && pothole.images.length > 0
                ? `<img src="${pothole.images[0].image_url}" alt="pothole" style="width:100%; height:auto; border-radius: 4px; margin-top: 5px;" />`
                : '';

            const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
                <h3>Severity: ${pothole.severity || 'N/A'}</h3>
                <p>Status: ${pothole.status}</p>
                <p>${pothole.description || 'No description.'}</p>
                ${imageUrl}
            `);

            const marker = new mapboxgl.Marker({ color })
                .setLngLat([pothole.longitude, pothole.latitude])
                .setPopup(popup)
                .addTo(map);
            
            markersRef.current.push(marker);
        });
        };

        // Ensure the map style is loaded before adding markers
        if (map.isStyleLoaded()) {
            addMarkers();
        } else {
            // Use 'once' to prevent this from firing multiple times
            map.once('load', addMarkers);
        }
    }, [filteredPotholes, isLoading]); // Dependency on isLoading is key

    // Add/Update markers on the map
    useEffect(() => {
        const map = mapRef.current;
                if (!map || !map.isStyleLoaded() || isLoading) return;

        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        filteredPotholes.forEach(pothole => {
            let color = '#808080';
            if (pothole.severity === 'High') color = '#EF4444';
            if (pothole.severity === 'Medium') color = '#F59E0B';
            if (pothole.severity === 'Low') color = '#10B981';

            const imageUrl = pothole.images && pothole.images.length > 0
                ? `<img src="${pothole.images[0].image_url}" alt="pothole" style="width:100%; height:auto; border-radius: 4px; margin-top: 5px;" />`
                : '';

            const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
                <h3>Severity: ${pothole.severity || 'N/A'}</h3>
                <p>Status: ${pothole.status}</p>
                <p>${pothole.description || 'No description.'}</p>
                ${imageUrl}
            `);

            const marker = new mapboxgl.Marker({ color })
                .setLngLat([pothole.longitude, pothole.latitude])
                .setPopup(popup)
                .addTo(map);
            
            markersRef.current.push(marker);
        });
    }, [filteredPotholes, styleURL, isLoading]);
    
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

    return (
        <div className="relative w-full h-full">
            {/* The map container now fills the entire space and is part of the layout flow */}
            <div ref={mapContainerRef} className="w-full h-full" />
            
            <div className={`absolute top-4 z-10 transition-all duration-300 ${isSidebarOpen ? 'left-2' : 'left-4'}`}>
                {/* Search Bar */}
                <form onSubmit={handleSearch} className="flex items-center bg-white rounded-lg shadow-md">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search location..."
                        className="py-2 px-4 rounded-l-lg focus:outline-none w-36 sm:w-64"
                    />
                    <button type="submit" className="p-3 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600">
                        <FiSearch />
                    </button>
                </form>

                  {/* Severity Filters */}
                <div className="mt-4 bg-white rounded-lg shadow-md p-3 space-y-2">
                    <h4 className="text-sm font-bold text-gray-700">Filter by Severity</h4>
                    <div className="flex items-center">
                        <input type="checkbox" id="high" name="High" checked={severityFilters.High} onChange={handleFilterChange} />
                        <label htmlFor="high" className="ml-2 block text-sm">High</label>
                    </div>
                    <div className="flex items-center">
                        <input type="checkbox" id="medium" name="Medium" checked={severityFilters.Medium} onChange={handleFilterChange} />
                        <label htmlFor="medium" className="ml-2 block text-sm">Medium</label>
                    </div>
                    <div className="flex items-center">
                        <input type="checkbox" id="low" name="Low" checked={severityFilters.Low} onChange={handleFilterChange} />
                        <label htmlFor="low" className="ml-2 block text-sm">Low</label>
                    </div>
                </div>
            </div>

            {/* --- CONTROLS ON THE RIGHT --- */}
            <div className="absolute top-4 right-12 bg-white p-2 rounded shadow-md z-10">
                <select
                    value={styleURL}
                    onChange={(e) => setStyleURL(e.target.value)}
                    className="p-1 border rounded text-sm focus:outline-none"
                >
                    <option value="mapbox://styles/mapbox/streets-v12">Streets</option>
                    <option value="mapbox://styles/mapbox/satellite-streets-v12">Satellite</option>
                    <option value="mapbox://styles/mapbox/outdoors-v12">Outdoors</option>
                    <option value="mapbox://styles/mapbox/dark-v11">Dark</option>
                    <option value="mapbox://styles/mapbox/light-v11">Light</option>
                </select>
            </div>
        </div>
    );
};

export default PotholeMap;