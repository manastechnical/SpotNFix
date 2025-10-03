import React, { useRef, useState, useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useDropzone } from 'react-dropzone';
import toast, { Toaster } from 'react-hot-toast';
import axios from 'axios';
import { mlEndpoints } from '../../services/Apis';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { FiAlertTriangle } from 'react-icons/fi';
import { FaLocationArrow } from "react-icons/fa";
import { useSelector } from 'react-redux';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// Helper function to create a circle polygon (unchanged)
const createGeoJSONCircle = (center, radiusInMeters, points = 64) => {
    const coords = { latitude: center[1], longitude: center[0] };
    const km = radiusInMeters / 1000;
    const ret = [];
    const distanceX = km / (111.320 * Math.cos(coords.latitude * Math.PI / 180));
    const distanceY = km / 110.574;
    let theta, x, y;
    for (let i = 0; i < points; i++) {
        theta = (i / points) * (2 * Math.PI);
        x = distanceX * Math.cos(theta);
        y = distanceY * Math.sin(theta);
        ret.push([coords.longitude + x, coords.latitude + y]);
    }
    ret.push(ret[0]);
    return {
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                geometry: { type: "Polygon", coordinates: [ret] }
            }]
        }
    };
};

const ReportPothole = () => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const debounceTimeout = useRef(null);
    const duplicateMarkersRef = useRef([]);
    const [searchRadius, setSearchRadius] = useState(50);
    const [isRecentering, setIsRecentering] = useState(false);
    const [lng, setLng] = useState(72.8777);
    const [lat, setLat] = useState(19.076);
    const [description, setDescription] = useState("");
    const [mediaFiles, setMediaFiles] = useState([]);
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [severity, setSeverity] = useState(null);
    const [crop, setCrop] = useState();
    const [imgSrc, setImgSrc] = useState('');
    const [mlChecking, setMlChecking] = useState(false);
    const [mlDetected, setMlDetected] = useState(null);
    const [mlDetections, setMlDetections] = useState([]);
    const [address, setAddress] = useState("");
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [nearbyPotholes, setNearbyPotholes] = useState([]);
    const [, setIsChecking] = useState(false);
    const [showDuplicates, setShowDuplicates] = useState(false);
    const hasDuplicatesRef = useRef(false);

    // Get user ID from Redux state
    const { account } = useSelector((state) => state.dashboard);
    const userId = account?.id;

    // --- NEW: Improved handleRecenter function ---
    const handleRecenter = () => {
        setIsRecentering(true);
        const toastId = toast.loading('Getting your location...');

        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser.", { id: toastId });
            setIsRecentering(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => { // Success Callback
                toast.success('Location found!', { id: toastId });
                const userLng = pos.coords.longitude;
                const userLat = pos.coords.latitude;

                setLng(userLng);
                setLat(userLat);

                if (mapRef.current && markerRef.current) {
                    mapRef.current.flyTo({ center: [userLng, userLat], zoom: 16 });
                    markerRef.current.setLngLat([userLng, userLat]);
                }
                setIsRecentering(false);
            },
            (err) => { // Error Callback with specific messages
                let errorMessage = 'Could not get location.';
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        errorMessage = "Location access was denied.";
                        break;
                    case err.POSITION_UNAVAILABLE:
                        errorMessage = "Location information is unavailable.";
                        break;
                    case err.TIMEOUT:
                        errorMessage = "Location request timed out.";
                        break;
                    default:
                        errorMessage = "An unknown error occurred.";
                        break;
                }
                toast.error(errorMessage, { id: toastId });
                console.warn(`GEOLOCATION ERROR(${err.code}): ${err.message}`);
                setIsRecentering(false);
            },
            { // Options for higher accuracy
                enableHighAccuracy: true,
                timeout: 10000, // Increased timeout to 10 seconds
                maximumAge: 0
            }
        );
    };

    const updateLocationDetails = useCallback((currentLat, currentLng) => {
        setIsChecking(true);
        setIsGeocoding(true);
        const duplicateCheckPromise = axios.get(`/api/potholes/nearby?lat=${currentLat}&lng=${currentLng}&radius=${searchRadius}`);
        const geocodePromise = axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${currentLng},${currentLat}.json?access_token=${mapboxgl.accessToken}`);
        Promise.all([duplicateCheckPromise, geocodePromise])
            .then(([duplicateRes, geocodeRes]) => {
                setNearbyPotholes(duplicateRes.data);
                setShowDuplicates(false);
                const features = geocodeRes.data.features;
                if (features.length > 0) setAddress(features[0].place_name);
                else setAddress("No address found at this location.");
            })
            .catch(err => {
                console.error("Failed to fetch location details", err);
                setAddress("Could not fetch address.");
            })
            .finally(() => {
                setIsChecking(false);
                setIsGeocoding(false);
            });
    }, [searchRadius]);

    useEffect(() => {
        if (lat && lng) {
            clearTimeout(debounceTimeout.current);
            debounceTimeout.current = setTimeout(() => {
                updateLocationDetails(lat, lng);
            }, 1000);
        }
    }, [lat, lng, updateLocationDetails]);

    useEffect(() => {
        const mapContainer = mapContainerRef.current;
        if (!mapContainer) return;
        const resizeObserver = new ResizeObserver(() => {
            if (mapContainer.clientWidth > 0 && mapContainer.clientHeight > 0 && !mapRef.current) {
                const map = new mapboxgl.Map({
                    container: mapContainer,
                    style: "mapbox://styles/mapbox/streets-v12",
                    center: [lng, lat],
                    zoom: 12,
                });
                mapRef.current = map;
                markerRef.current = new mapboxgl.Marker({ draggable: true, color: '#d02922' })
                    .setLngLat([lng, lat])
                    .addTo(map);
                markerRef.current.on('dragend', () => {
                    const lngLat = markerRef.current.getLngLat();
                    setLat(lngLat.lat);
                    setLng(lngLat.lng);
                });
                map.on('load', () => {
                    map.addSource('radius-source', createGeoJSONCircle([lng, lat], searchRadius));
                    map.addLayer({
                        id: 'radius-layer',
                        type: 'fill',
                        source: 'radius-source',
                        paint: { 'fill-color': '#3B82F6', 'fill-opacity': 0.2 }
                    });
                });
                resizeObserver.disconnect();
            }
        });
        resizeObserver.observe(mapContainer);
        return () => {
            resizeObserver.disconnect();
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (mapRef.current && mapRef.current.getSource('radius-source')) {
            mapRef.current.getSource('radius-source').setData(createGeoJSONCircle([lng, lat], searchRadius).data);
        }
    }, [lat, lng, searchRadius]);

    useEffect(() => {
        duplicateMarkersRef.current.forEach(marker => marker.remove());
        duplicateMarkersRef.current = [];
        hasDuplicatesRef.current = nearbyPotholes.length > 0;
        console.log('[FE] Nearby potholes:', nearbyPotholes, hasDuplicatesRef.current);
        if (showDuplicates && mapRef.current && nearbyPotholes.length > 0) {
            const newMarkers = nearbyPotholes.map(pothole => {
                const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
                    `<strong>Status:</strong> ${pothole.status}<br/><strong>Description:</strong> ${pothole.description || 'N/A'}`
                );
                return new mapboxgl.Marker({ color: "#3B82F6" })
                    .setLngLat([pothole.longitude, pothole.latitude])
                    .setPopup(popup)
                    .addTo(mapRef.current);
            });
            duplicateMarkersRef.current = newMarkers;
        }
    }, [nearbyPotholes, showDuplicates]);

    const { getRootProps, getInputProps } = useDropzone({
        accept: { 'image/*': ['.jpeg', '.png', '.jpg'] },
        onDrop: acceptedFiles => {
            setMediaFiles(acceptedFiles);
            if (acceptedFiles.length > 0) {
                setCrop(undefined);
                const reader = new FileReader();
                reader.addEventListener('load', () => setImgSrc(reader.result.toString() || ''));
                reader.readAsDataURL(acceptedFiles[0]);
                // Trigger ML detection
                console.log('[FE] Selected file:', acceptedFiles[0]);
                detectWithML(acceptedFiles[0]);
            }
        }
    });

    const detectWithML = async (file) => {
        try {
            setMlChecking(true);
            setMlDetected(null);
            setMlDetections([]);
            const formData = new FormData();
            formData.append('image', file);
            console.log('[FE] Calling ML detect at:', mlEndpoints.DETECT);
            const { data } = await axios.post(mlEndpoints.DETECT, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            console.log('[FE] ML response:', data);
            if (data && data.success) {
                setMlDetected(Boolean(data.detected));
                setMlDetections(data.detections || []);
                if (!data.detected) {
                    toast.error('No potholes detected in the image. Please upload a valid pothole image.');
                }
            } else {
                toast.error('Detection failed. Try another image.');
                setMlDetected(false);
            }
        } catch (e) {
            console.error('[FE] ML detect error', e);
            toast.error('Unable to reach detection service.');
            setMlDetected(false);
        } finally {
            setMlChecking(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!hasDuplicatesRef.current) {                                    //new pothole being reported
            if (mediaFiles.length === 0) {
                toast.error("Please upload an image!");
                return;
            }
            if (!userId) {
                toast.error("You must be logged in to report a pothole!");
                return;
            }
            setIsSubmitting(true);
            setUploadProgress(0);
            const formData = new FormData();
            formData.append("description", description);
            formData.append("lat", lat);
            formData.append("lng", lng);
            formData.append("severity", severity);
            formData.append("user_id", userId);
            formData.append("media", mediaFiles[0]);
            try {
                await axios.post("/api/potholes/report", formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                    onUploadProgress: (progressEvent) => {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setUploadProgress(percentCompleted);
                    },
                });
                toast.success("Pothole reported successfully!");
                setMediaFiles([]);
                setImgSrc('');
                setDescription('');
                setSeverity(null);
                setNearbyPotholes([]);
                setShowDuplicates(false);
                setStep(1);
            } catch (err) {
                console.error(err); // Keep this for debugging

                let errorMessage = "Submission failed. Please try again.";
                // Check if the error response from the server has a specific message
                if (err.response && err.response.data && err.response.data.error) {
                    errorMessage = err.response.data.error;
                }
                toast.error(errorMessage);

            } finally {
                setIsSubmitting(false);
            }
        } else {
            // --- CASE 2: Re-reporting a DUPLICATE pothole ---

            if (nearbyPotholes[0].status === 'fixed') {
                // Logic to re-report a fixed pothole
                if (mediaFiles.length === 0) {
                    toast.error("A new image is required to re-report a fixed pothole.");
                    return;
                }
                // Safely get user_id from localStorage
                console.log('[FE] Stored user ID:', userId);
                if (!userId) {
                    toast.error("Could not find user ID. Please log in again.");
                    return;
                }

                // Safely extract the contract ID
                const contractId = nearbyPotholes[0].bids[0]?.contracts[0]?.id;
                const potholeId = nearbyPotholes[0].id;

                if (!contractId) {
                    toast.error("Could not find a valid contract to penalize for this pothole.");
                    return;
                }

                setIsSubmitting(true);
                setUploadProgress(0);
                const formData = new FormData();
                formData.append("user_id", userId);
                formData.append("media", mediaFiles[0]);
                try {
                    const apiUrl = `/api/potholes/${potholeId}/re-report/${contractId}`;
                    await axios.post(apiUrl, formData, {
                        headers: { "Content-Type": "multipart/form-data" },
                        onUploadProgress: (progressEvent) => {
                            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                            setUploadProgress(percentCompleted);
                        },
                    });
                    toast.success("Pothole re-reported successfully!");
                    // Reset form state
                    setMediaFiles([]);
                    setImgSrc('');
                    setDescription('');
                    setSeverity(null);
                    setNearbyPotholes([]);
                    setShowDuplicates(false);
                    setStep(1);
                } catch (err) {
                    console.error(err);
                    let errorMessage = "Failed to re-report pothole.";
                    if (err.response?.data?.error) {
                        errorMessage = err.response.data.error;
                    }
                    toast.error(errorMessage);
                } finally {
                    setIsSubmitting(false);
                }

            } else if (nearbyPotholes[0].status === 'discarded') {
                // Logic to re-report a discarded pothole
                if (mediaFiles.length === 0) {
                    toast.error("A new image is required to re-report a discarded pothole.");
                    return;
                }

                if (!userId) {
                    toast.error("Could not find user ID. Please log in again.");
                    return;
                }

                const potholeId = nearbyPotholes[0].id;

                setIsSubmitting(true);
                setUploadProgress(0);
                const formData = new FormData();
                formData.append("user_id", userId);
                formData.append("media", mediaFiles[0]);
                try {
                    const apiUrl = `/api/potholes/${potholeId}/re-report-discarded/`;
                    await axios.post(apiUrl, formData, {
                        headers: { "Content-Type": "multipart/form-data" },
                        onUploadProgress: (progressEvent) => {
                            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                            setUploadProgress(percentCompleted);
                        },
                    });
                    toast.success("Discarded pothole re-reported successfully!");

                    // Reset form state
                    setMediaFiles([]);
                    setImgSrc('');
                    setDescription('');
                    setSeverity(null);
                    setNearbyPotholes([]);
                    setShowDuplicates(false);
                    setStep(1);

                } catch (err) {
                    console.error(err);
                    let errorMessage = "Failed to re-report pothole.";
                    if (err.response?.data?.error) {
                        errorMessage = err.response.data.error;
                    }
                    toast.error(errorMessage);
                } finally {
                    setIsSubmitting(false);
                }
            }else if(nearbyPotholes[0].status === 'reopened' || nearbyPotholes[0].status === 'reported' || nearbyPotholes[0].status === 'under_review'){
                toast.error("This pothole is already being addressed. Cannot re-report at this time.");
            }
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            <Toaster position="top-center" />
            <div className="w-full h-1/2 md:h-3/5 relative">
                <div ref={mapContainerRef} className="h-full" />
                <button
                    onClick={handleRecenter}
                    disabled={isRecentering}
                    className="absolute bottom-8 right-4 bg-white p-3 rounded-full shadow-lg hover:bg-gray-100 disabled:opacity-50 transition-opacity"
                    aria-label="Recenter map to your location"
                >
                    <FaLocationArrow className="h-5 w-5 text-blue-600" />
                </button>
            </div>
            <div className="w-full h-1/2 md:h-2/5 p-4 bg-white shadow-lg rounded-t-2xl overflow-y-auto">
                <div className="w-full max-w-xl mx-auto">
                    <div className="mb-4">
                        <label htmlFor="radius-select" className="block text-sm font-medium text-gray-700">Search Radius</label>
                        <select
                            id="radius-select"
                            value={searchRadius}
                            onChange={(e) => setSearchRadius(Number(e.target.value))}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        >
                            <option value={50}>50 meters</option>
                            <option value={100}>100 meters</option>
                            <option value={250}>250 meters</option>
                            <option value={500}>500 meters</option>
                        </select>
                    </div>
                    {nearbyPotholes.length > 0 && (
                        <div className="p-3 mb-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded-md" role="alert">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <FiAlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
                                    <div>
                                        <p className="font-bold text-sm">Potential Duplicate Found</p>
                                        <p className="text-xs">{nearbyPotholes.length} report(s) exist nearby. Please verify before submitting.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowDuplicates(!showDuplicates)}
                                    className="ml-4 px-3 py-1 text-xs font-semibold text-white bg-blue-500 rounded-full hover:bg-blue-600 transition-colors flex-shrink-0"
                                >
                                    {showDuplicates ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>
                    )}
                    {step === 1 && (
                        <div>
                            <h2 className="text-2xl font-bold mb-4">Step 1: Locate & Upload</h2>
                            <div {...getRootProps({ className: 'dropzone' })} className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-500">
                                <input {...getInputProps()} capture="environment" />
                                <p className="font-semibold">Drag & drop an image, or click to select</p>
                                <p className="text-xs text-gray-500 mt-1">Pinpoint the location with the marker on the map.</p>
                            </div>
                            {imgSrc && (
                                <div className="mt-4">
                                    <ReactCrop crop={crop} onChange={c => setCrop(c)}>
                                        <img src={imgSrc} alt="Pothole Preview" style={{ maxHeight: '200px' }} />
                                    </ReactCrop>
                                </div>
                            )}

                            {/* ML gating removed */}

                            <button
                                onClick={() => setStep(2)}
                                disabled={mediaFiles.length === 0 || mlChecking || mlDetected === false}
                                className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg w-full font-semibold hover:bg-blue-700 transition disabled:bg-gray-400"
                            >
                                {mlChecking ? 'Analyzing...' : 'Next'}
                            </button>
                            {mlDetected === false && (
                                <p className="mt-2 text-sm text-red-600">No potholes detected in the image. Please upload a valid pothole image.</p>
                            )}
                            {mlDetected && mlDetections?.length > 0 && (
                                <p className="mt-2 text-sm text-green-700">Potholes detected: {mlDetections.length}</p>
                            )}
                        </div>
                    )}
                    {step === 2 && (
                        <form onSubmit={handleSubmit}>
                            <h2 className="text-2xl font-bold mb-4">Step 2: Add Details & Submit</h2>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700">Detected Address</label>
                                <div className="mt-1 p-2 w-full bg-gray-100 rounded-md text-sm text-gray-800 min-h-[40px]">
                                    {isGeocoding ? 'Fetching address...' : address}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full p-2 border rounded-md mt-1"
                                    rows="2"
                                    placeholder="e.g., Deep pothole on the right lane."
                                    required
                                ></textarea>
                            </div>
                            <div className="mt-4">
                                <label className="block text-sm font-medium">Detected Severity</label>
                                {/* isAnalyzing && <p className="text-sm text-gray-500">Analyzing image...</p> */}
                                {severity && (
                                    <div className={`text-sm font-bold p-2 rounded-md inline-block ${severity === 'High' ? 'bg-red-100 text-red-800' :
                                        severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-green-100 text-green-800'
                                        }`}>
                                        {severity}
                                    </div>
                                )}
                            </div>
                            {isSubmitting && (
                                <div className="mt-4 w-full bg-gray-200 rounded-full">
                                    <div className="bg-blue-600 text-xs font-medium text-blue-100 text-center p-0.5 leading-none rounded-full" style={{ width: `${uploadProgress}%` }}>
                                        {uploadProgress}%
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-between mt-6 space-x-4">
                                <button type="button" onClick={() => setStep(1)} className="bg-gray-300 px-6 py-2 rounded-lg font-semibold w-1/2">Back</button>
                                <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold w-1/2 disabled:bg-gray-400">
                                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div >
    );
};

export default ReportPothole;