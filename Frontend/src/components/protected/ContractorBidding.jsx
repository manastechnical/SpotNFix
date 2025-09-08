import React, { useRef, useState, useEffect } from "react";
import { apiConnector } from "../../services/Connector";
import { bidEndpoints } from "../../services/Apis";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from "../ui/button";
import { toast } from "react-hot-toast";

// Set Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const placeholderImageUrl = "https://via.placeholder.com/400x300.png?text=No+Image+Available";

const ContractorBidding = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // State management
  const [potholes, setPotholes] = useState([]);
  const [selectedPothole, setSelectedPothole] = useState(null);
  const [activePothole, setActivePothole] = useState(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidDescription, setBidDescription] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [potholeAddress, setPotholeAddress] = useState("");
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

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

  // Get current user from localStorage
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('account'));
    setCurrentUser(userData);
  }, []);

  // Fetch potholes on component mount
  useEffect(() => {
    fetchPotholes();
  }, []);

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

    // First, remove any existing markers from the map
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = []; // Clear the reference array

    // ✅ MODIFIED: Filter for verified potholes before creating markers
    potholes
      .filter(pothole => pothole.verify === true) // This is the crucial check
      .forEach(pothole => {
        // This code now only runs for potholes that passed the filter
        let color = pothole.severity === 'High' ? '#EF4444' : pothole.severity === 'Medium' ? '#F59E0B' : '#10B981';
        const marker = new mapboxgl.Marker({ color }).setLngLat([pothole.longitude, pothole.latitude]).addTo(mapRef.current);
        
        marker.getElement().addEventListener('click', () => {
          setSelectedPothole(pothole);
        });

        // Add the new marker to our reference array for future cleanup
        markersRef.current.push(marker);
      });
  }, [potholes]);


  const hasUserBid = (pothole) => {
    return pothole?.bids?.some(bid => bid.contractor_id === currentUser?.id);
  };

  const handleBidSubmit = async () => {
    try {
      if (!currentUser?.id) {
        toast.error("Please login as a contractor first.");
        return;
      }
      if (!bidAmount || parseFloat(bidAmount) <= 0) {
        toast.error("Bid amount must be a positive number.");
        return;
      }
      if (activePothole.current_bid && parseFloat(bidAmount) >= activePothole.current_bid.amount) {
        toast.error(`Your bid must be lower than the current bid of ₹${activePothole.current_bid.amount}.`);
        return;
      }
      const bidData = { pothole_id: activePothole.id, contractor_id: currentUser.id, amount: parseFloat(bidAmount), description: bidDescription, status: "pending" };
      await apiConnector("post", bidEndpoints.SUBMIT_BID, bidData);
      toast.success("Bid placed successfully!");
      setBidAmount("");
      setBidDescription("");
      setActivePothole(null);
      setSelectedPothole(null);
      fetchPotholes();
    } catch (error) {
      console.error("Failed to submit bid:", error);
      toast.error("Failed to place bid. Please try again.");
    }
  };

  const handlePrevImage = () => {
    setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : selectedPothole.images.length - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => (prev < selectedPothole.images.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />
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
          </div>
          <div className="border-t pt-3">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Current Lowest Bid:</span>{" "}
                {selectedPothole.current_bid ? `₹${selectedPothole.current_bid.amount}` : "No bids yet"}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">By:</span>{" "}
                {selectedPothole.current_bid?.users?.name || "N/A"}
              </p>
          </div>
          <Button
            className={`w-full mt-2 ${hasUserBid(selectedPothole)
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
            onClick={() => setActivePothole(selectedPothole)}
            disabled={hasUserBid(selectedPothole)}
            title={hasUserBid(selectedPothole) ? "You have already placed a bid on this pothole" : "Place a bid"}
          >
            {hasUserBid(selectedPothole) ? "Bid Already Placed" : "Place Your Bid"}
          </Button>
        </div>
      )}
      {activePothole && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50" onClick={() => setActivePothole(null)}>
          <div className="bg-white rounded-lg shadow-lg p-6 w-11/12 max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Place Your Bid</h2>
            <p className="mb-3 text-sm text-gray-600"><b>Pothole:</b> {activePothole.description}</p>
            <input type="number" placeholder="Enter bid amount (₹)" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} className="border p-2 w-full rounded mb-4"/>
            <textarea placeholder="Describe your plan or materials..." value={bidDescription} onChange={(e) => setBidDescription(e.target.value)} className="border p-2 w-full rounded mb-4" rows="3"/>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setActivePothole(null)}>Cancel</Button>
              <Button className="bg-blue-500 hover:bg-blue-700 text-white" onClick={handleBidSubmit} disabled={!bidAmount || !bidDescription}>Submit Bid</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractorBidding;

