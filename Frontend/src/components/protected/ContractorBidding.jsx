import React, { useEffect, useState } from "react";
import { apiConnector } from "../../services/Connector";
import { bidEndpoints } from "../../services/Apis";
import reactlogo from "../../assets/react.svg";
import { Button } from "../ui/button";
import { toast } from "react-hot-toast";


const ContractorBidding = () => {
  const [potholes, setPotholes] = useState([]);
  const [activePothole, setActivePothole] = useState(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidDescription, setBidDescription] = useState("");
  const [currentUser, setCurrentUser] = useState(null);


  const fetchPotholes = async () => {
    try {
      const response = await apiConnector("get", "/api/potholes/all");
      console.log("Potholes data:", response.data);
      setPotholes(response.data);
    } catch (error) {
      console.error("Failed to fetch potholes:", error);
    }
  };
  const hasUserBid = (pothole) => {
    return pothole.bids?.some(bid => bid.contractor_id === currentUser?.id);
  };
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('account'));
    setCurrentUser(userData);
  }, []);
  useEffect(() => {
    fetchPotholes();
  }, []);

  const handleBidSubmit = async () => {
    try {
      const contractorData = JSON.parse(localStorage.getItem('account'));

      if (!contractorData?.id) {
        toast.error("Please login as a contractor first");
        return;
      }
      if (parseFloat(bidAmount) <= 0) {
        toast.error("Bid amount must be greater than 0");
        return;
      }
      // Check if there's a current bid and compare amounts
      if (activePothole.current_bid && parseFloat(bidAmount) >= activePothole.current_bid.amount) {
        toast.error(`Your bid (₹${bidAmount}) must be lower than current bid (₹${activePothole.current_bid.amount})`);
        return;
      }

      const bidData = {
        pothole_id: activePothole.id,
        contractor_id: contractorData.id,
        amount: parseFloat(bidAmount),
        description: bidDescription,
        status: "pending"
      };

      const response = await apiConnector(
        "post",
        bidEndpoints.SUBMIT_BID,
        bidData
      );

      toast.success("Bid placed successfully!");
      setBidAmount("");
      setBidDescription("");
      setActivePothole(null);
      fetchPotholes();
    } catch (error) {
      console.error("Failed to submit bid:", error);
      toast.error("Failed to place bid. Please try again.");
    }
  };
  return (
    <>
      <div className="bg-white overflow-y-auto flex justify-center h-full">
        <div className="h-full m-2  w-[80vw]">
          {potholes.map((pothole) => (
            <div
              key={pothole.id}
              className="flex bg-white rounded-2xl shadow-md hover:shadow-xl transition p-4 mb-6 border border-gray-200"
            >
              {/* Left Side: Image */}
              <div className="w-1/4 flex items-center justify-center">
                <img
                  src={reactlogo}
                  alt="pothole"
                  className="max-h-[120px] object-contain"
                />
              </div>

              {/* Right Side: Info */}
              <div className="flex flex-col justify-between w-3/4 px-4">
                {/* Description */}
                <div className="mb-3">
                  <p className="text-gray-700 text-sm">
                    <span className="font-semibold">Description:</span>{" "}
                    {pothole.description}
                  </p>
                </div>

                {/* Location & Severity */}
                <div className="flex justify-between items-center flex-wrap gap-4 mb-3">
                  <span className="text-sm text-gray-600">
                    <span className="font-semibold">Latitude:</span> {pothole.latitude}
                  </span>
                  <span className="text-sm text-gray-600">
                    <span className="font-semibold">Longitude:</span> {pothole.longitude}
                  </span>
                  <span
                    className={`px-3 py-1 text-xs font-bold rounded-full 
            ${pothole.severity === "High"
                        ? "bg-red-100 text-red-700"
                        : pothole.severity === "Medium"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                      }`}
                  >
                    {pothole.severity}
                  </span>
                </div>

                {/* Bidding Info */}
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Latest bid:</span>{" "}
                    {pothole.current_bid ? `₹${pothole.current_bid.amount}` : "No bids yet"}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Latest bidder:</span>{" "}
                    {pothole.current_bid?.users?.name || "None"}
                  </p>
                  <Button
                    className={`px-4 py-2 rounded-lg shadow-md ${hasUserBid(pothole)
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    onClick={() => setActivePothole(pothole)}
                    disabled={hasUserBid(pothole)}
                    title={hasUserBid(pothole) ? "You have already placed a bid" : "Place a bid"}
                  >
                    {hasUserBid(pothole) ? "Bid Placed" : "Bid"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Updated Modal */}
      {activePothole && (
        <div className="fixed inset-0 bg-black/75 flex justify-center items-center z-50"
          onClick={() => setActivePothole(null)}>
          <div className="bg-white rounded-lg shadow-lg p-6 w-[30vw]"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Place Your Bid</h2>
            <p className="mb-2">
              <b>Pothole:</b> {activePothole.description}
            </p>
            <input
              type="number"
              placeholder="Enter bid amount"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              className="border p-2 w-full rounded mb-4"
            />
            <textarea
              placeholder="Enter bid description"
              value={bidDescription}
              onChange={(e) => setBidDescription(e.target.value)}
              className="border p-2 w-full rounded mb-4"
              rows="3"
            />
            <div className="flex justify-end space-x-2">
              <Button
                className="bg-gray-400 hover:bg-gray-600 text-white px-4 py-2 rounded"
                onClick={() => {
                  setBidAmount("");
                  setBidDescription("");
                  setActivePothole(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded"
                onClick={handleBidSubmit}
                disabled={!bidAmount || !bidDescription}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ContractorBidding;
