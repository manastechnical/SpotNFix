import express from 'express';
import multer from 'multer';
// Import both controller functions
import { checkNearbyPotholes, getAllPotholes, reportPothole } from '../controllers/potholeController.js'; 
import { verifyImage } from '../middleware/verifyImage.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/nearby', checkNearbyPotholes);

// The final, complete reporting route
router.post(
    '/report',
    upload.single('media'), 
    verifyImage, 
    reportPothole // Call the new controller function here
);

router.get('/all', getAllPotholes);

export default router;