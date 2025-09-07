export const validateRegistrationData = (req, res, next) => {
    const { pan_number, gst_number } = req.body;
    
    // Regex for PAN Card Number
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (pan_number && !panRegex.test(pan_number)) {
        return res.status(400).json({ success: false, message: 'Invalid PAN number format.' });
    }

    // Regex for GSTIN Number
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (gst_number && !gstRegex.test(gst_number)) {
        return res.status(400).json({ success: false, message: 'Invalid GST number format.' });
    }
    
    // If all validations pass
    next();
};