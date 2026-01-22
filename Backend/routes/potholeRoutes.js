import express from 'express';
import multer from 'multer';
// Import both controller functions
import { checkNearbyPotholes, getAllPotholes, reportPothole,verifyPothole,verifyPotholeWithSeverity,discardPothole, finalizePotholeRepair, rejectPotholeRepair,reportDuplicatePothole,discardReopen,penalizeReopen,reportDuplicatePotholeDiscarded,detectSeverityFromImage, getStatusBySeverity, getReportsVsResolutions, getVerificationFunnel, getDashboardKpis } from '../controllers/potholeController.js'; 
import { verifyImage } from '../middleware/verifyImage.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/nearby', checkNearbyPotholes);

// Route for detecting severity from uploaded image
router.post('/detect-severity', upload.single('image'), detectSeverityFromImage);

// The final, complete reporting route
router.post(
    '/report',
    upload.single('media'), 
    verifyImage, 
    reportPothole // Call the new controller function here
);

router.get('/all', getAllPotholes);
router.get('/dashboard/status-by-severity', getStatusBySeverity);
router.get('/dashboard/reports-vs-resolutions', getReportsVsResolutions);
router.get('/dashboard/verification-funnel', getVerificationFunnel);
router.get('/dashboard/kpis', getDashboardKpis);

router.patch('/verify/:id', verifyPothole);
router.patch('/verify-with-severity/:id', verifyPotholeWithSeverity);
router.patch('/discard/:id', discardPothole);
router.patch('/finalize-repair/:id', finalizePotholeRepair);
router.patch('/reject-repair/:id/:potholeId', rejectPotholeRepair); // New route for rejecting repair

router.post(
    '/:potholeId/re-report/:contractId',
    upload.single('media'), // Multer middleware to process the image
    reportDuplicatePothole
);

router.patch('/reopen/discard/:id', discardReopen);
router.patch('/reopen/penalize/:id', penalizeReopen);
router.post(
    '/:potholeId/re-report-discarded/',
    upload.single('media'), // Multer middleware to process the image
    reportDuplicatePotholeDiscarded
);

export default router;