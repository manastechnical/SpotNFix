import React, { useRef, useState, useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useDropzone } from 'react-dropzone';
import toast, { Toaster } from 'react-hot-toast';
import axios from 'axios';
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
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [crop, setCrop] = useState();
    const [imgSrc, setImgSrc] = useState('');
    const [address, setAddress] = useState("");
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [nearbyPotholes, setNearbyPotholes] = useState([]);
    const [isChecking, setIsChecking] = useState(false);
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);
    const [detectionResult, setDetectionResult] = useState(null);
    const [hasPothole, setHasPothole] = useState(false);

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
                detectPotholeInImage(acceptedFiles[0]);
            }
        }
    });

    const detectPotholeInImage = async (file) => {
        setIsDetecting(true);
        setDetectionResult(null);
        setHasPothole(false);
        setSeverity(null);
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('http://127.0.0.1:5000/detect', {
                method: 'POST',
                body: formData,
            });
            
            if (!response.ok) {
                throw new Error(`Detection failed: ${response.status}`);
            }
            
            const result = await response.json();
            setDetectionResult(result);
            
            if (result.num_detections > 0) {
                setHasPothole(true);
                // Analyze severity based on detection confidence
                analyzeImageSeverity(result.detections[0].confidence);
                toast.success(`Pothole detected! Found ${result.num_detections} pothole(s)`);
            } else {
                setHasPothole(false);
                toast.error("No pothole detected in the image. Please upload a clear image of a pothole.");
            }
        } catch (error) {
            console.error('ML Detection error:', error);
            setHasPothole(false);
            toast.error("Failed to analyze image. Please try again.");
        } finally {
            setIsDetecting(false);
        }
    };

    const analyzeImageSeverity = async (confidence) => {
        setIsAnalyzing(true);
        setSeverity(null);
        
        // Determine severity based on confidence score
        let severity;
        if (confidence >= 0.8) {
            severity = 'High';
        } else if (confidence >= 0.6) {
            severity = 'Medium';
        } else {
            severity = 'Low';
        }
        
        setSeverity(severity);
        setIsAnalyzing(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
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
            setDetectionResult(null);
            setHasPothole(false);
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
                                        <img src={imgSrc} alt="Pothole Preview" style={{ maxHeight: '200px' }}/>
                                    </ReactCrop>
                                    
                                    {/* Detection Status */}
                                    <div className="mt-4">
                                        {isDetecting && (
                                            <div className="flex items-center justify-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                                                <span className="text-blue-700">Analyzing image for potholes...</span>
                                            </div>
                                        )}
                                        
                                        {!isDetecting && detectionResult && (
                                            <div className={`p-3 rounded-lg border ${
                                                hasPothole 
                                                    ? 'bg-green-50 border-green-200 text-green-700' 
                                                    : 'bg-red-50 border-red-200 text-red-700'
                                            }`}>
                                                <div className="flex items-center">
                                                    {hasPothole ? (
                                                        <>
                                                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                            </svg>
                                                            <span className="font-semibold">
                                                                Pothole Detected! ({detectionResult.num_detections} found)
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1h-1z" clipRule="evenodd" />
                                                            </svg>
                                                            <span className="font-semibold">
                                                                No Pothole Detected
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                
                                                {hasPothole && detectionResult.detections && (
                                                    <div className="mt-2 text-sm">
                                                        <p>Confidence: {(detectionResult.detections[0].confidence * 100).toFixed(1)}%</p>
                                                        <p>Class: {detectionResult.detections[0].class_name}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        
                                        {!isDetecting && !hasPothole && mediaFiles.length > 0 && (
                                            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center">
                                                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v4a1 1 0 001 1h1a1 1 0 001-1V6a1 1 0 00-1-1h-1z" clipRule="evenodd" />
                                                        </svg>
                                                        <span className="font-semibold">Please upload a clear image of a pothole</span>
                                                    </div>
                                                    <button
                                                        onClick={() => detectPotholeInImage(mediaFiles[0])}
                                                        className="ml-2 px-3 py-1 text-xs font-semibold text-yellow-700 bg-yellow-100 rounded-full hover:bg-yellow-200 transition-colors"
                                                    >
                                                        Retry Detection
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {/* Guidance Message */}
                            {mediaFiles.length > 0 && !hasPothole && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="flex items-center text-red-700">
                                        <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1h-1z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm">
                                            <strong>Cannot proceed:</strong> No pothole detected in the uploaded image. Please upload a clear image showing a pothole.
                                        </span>
                                    </div>
                                </div>
                            )}
                            
                            <button
                                onClick={() => setStep(2)}
                                disabled={mediaFiles.length === 0 || !hasPothole}
                                className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg w-full font-semibold hover:bg-blue-700 transition disabled:bg-gray-400"
                            >
                                Next
                            </button>
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
                                {isAnalyzing && <p className="text-sm text-gray-500">Analyzing image...</p>}
                                {severity && (
                                <div className={`text-sm font-bold p-2 rounded-md inline-block ${
                                    severity === 'High' ? 'bg-red-100 text-red-800' :
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
        </div>
    );
};

export default ReportPothole;