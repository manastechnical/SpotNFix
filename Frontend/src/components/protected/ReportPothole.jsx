import React, { useRef, useState, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN; // store token in .env

const ReportPothole = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const [lng, setLng] = useState(72.8777); // Default Mumbai
  const [lat, setLat] = useState(19.076);
  const [zoom, setZoom] = useState(12);
  const [styleURL, setStyleURL] = useState("mapbox://styles/mapbox/streets-v12");

  const [description, setDescription] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]); // multiple photos/videos

  // Load map
  useEffect(() => {
    if (mapRef.current) return; // prevent reinit

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: styleURL,
      center: [lng, lat],
      zoom: zoom,
    });

    // Add navigation controls
    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLng(pos.coords.longitude);
        setLat(pos.coords.latitude);
        mapRef.current.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 15,
        });
      });
    }

    // Update center state
    mapRef.current.on("move", () => {
      setLng(mapRef.current.getCenter().lng.toFixed(4));
      setLat(mapRef.current.getCenter().lat.toFixed(4));
      setZoom(mapRef.current.getZoom().toFixed(2));
    });
  }, []);

  // Change style dynamically
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(styleURL);
  }, [styleURL]);

  const handleMediaUpload = (e) => {
    setMediaFiles(Array.from(e.target.files));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!description.trim()) {
      alert("Please add a description!");
      return;
    }

    if (mediaFiles.length === 0) {
      alert("Please upload at least one photo or video!");
      return;
    }

    // Send to backend
    const formData = new FormData();
    formData.append("description", description);
    formData.append("lat", lat);
    formData.append("lng", lng);
    mediaFiles.forEach((file) => formData.append("media", file));

    fetch("/api/potholes/report", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        alert("Pothole reported successfully!");
        setDescription("");
        setMediaFiles([]);
      })
      .catch((err) => console.error(err));
  };

  return (
    <div className="flex flex-col md:flex-row h-screen">
      {/* Map Section */}
      <div className="w-full md:w-2/3 relative">
        <div ref={mapContainerRef} className="h-[50vh] md:h-full" />

        {/* Style Switcher */}
        <div className="absolute top-4 left-4 bg-white p-2 rounded shadow-md z-10">
          <select
            value={styleURL}
            onChange={(e) => setStyleURL(e.target.value)}
            className="p-1 border rounded text-sm"
          >
            <option value="mapbox://styles/mapbox/streets-v12">Streets</option>
            <option value="mapbox://styles/mapbox/satellite-streets-v12">Satellite</option>
            <option value="mapbox://styles/mapbox/outdoors-v12">Outdoors</option>
            <option value="mapbox://styles/mapbox/dark-v11">Dark</option>
            <option value="mapbox://styles/mapbox/light-v11">Light</option>
          </select>
        </div>
      </div>

      {/* Form Section */}
      <div className="w-full md:w-1/3 p-4 bg-gray-50 overflow-y-auto">
        <h2 className="text-lg font-bold mb-3">Report a Pothole</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 border rounded mt-1"
              rows="3"
              placeholder="Describe the pothole location, size, etc."
              required
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium">Upload Photos/Videos</label>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleMediaUpload}
              className="mt-1"
              required
            />
            {mediaFiles.length > 0 && (
              <p className="text-xs mt-1 text-gray-500">
                {mediaFiles.length} file(s) selected
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">Latitude</label>
            <input
              type="text"
              value={lat}
              readOnly
              className="w-full p-2 border rounded bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Longitude</label>
            <input
              type="text"
              value={lng}
              readOnly
              className="w-full p-2 border rounded bg-gray-100"
            />
          </div>

          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded w-full hover:bg-blue-700 transition"
          >
            Submit Report
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReportPothole;
