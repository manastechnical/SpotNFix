import express from 'express';
import multer from 'multer';
// Import both controller functions
import { checkNearbyPotholes, getAllPotholes, reportPothole,verifyPothole,discardPothole, finalizePotholeRepair, rejectPotholeRepair } from '../controllers/potholeController.js'; 
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

router.patch('/verify/:id', verifyPothole);
router.patch('/discard/:id', discardPothole);
router.patch('/finalize-repair/:id', finalizePotholeRepair);
router.patch('/reject-repair/:id', rejectPotholeRepair); // New route for rejecting repair

export default router;