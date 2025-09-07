import jwt from 'jsonwebtoken';

export const verifyAdmin = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Bearer Token

    if (!token) {
        return res.status(403).json({ success: false, message: 'No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err || decoded.role !== 'superadmin') {
            return res.status(401).json({ success: false, message: 'Failed to authenticate token.' });
        }
        // If everything is good, save to request for use in other routes
        req.user = decoded;
        next();
    });
};