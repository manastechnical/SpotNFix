import exifParser from 'exif-parser';

// Helper function to calculate the distance between two GPS coordinates in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

export const verifyImage = (req, res, next) => {
    // Check if a file was uploaded
    if (!req.file) {
        return res.status(400).json({ error: "No image file provided." });
    }

    const imageBuffer = req.file.buffer;
    const clientLat = parseFloat(req.body.lat);
    const clientLng = parseFloat(req.body.lng);

    try {
        const parser = exifParser.create(imageBuffer);
        const exifData = parser.parse();

        // --- 1. GPS Location Check ---
        const photoLat = exifData.tags.GPSLatitude;
        const photoLng = exifData.tags.GPSLongitude;

        if (!photoLat || !photoLng) {
            return res.status(400).json({ error: "Image is missing GPS data. Please use a live photo from your camera." });
        }

        const distance = calculateDistance(clientLat, clientLng, photoLat, photoLng);
        // Allow a 100-meter tolerance for GPS inaccuracies
        if (distance > 0.1) { 
            return res.status(400).json({ error: "Image location does not match the reported location." });
        }

        // --- 2. Timestamp Check ---
        // DateTimeOriginal is the time the photo was taken, in seconds since epoch.
        const photoTimestamp = exifData.tags.DateTimeOriginal * 1000; 
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

        if (!photoTimestamp || photoTimestamp < fiveMinutesAgo) {
            return res.status(400).json({ error: "Image is too old. Please submit a photo taken within the last 5 minutes." });
        }
        // Timestamp freshness check removed as requested

        // If all checks pass, move to the next function in the chain
        next();

    } catch (error) {
        console.error("EXIF Parsing Error:", error);
        return res.status(400).json({ error: "Could not verify image. It may not be a genuine camera photo or may lack metadata." });
    }
};