import express from 'express';
import { getPendingVerifications, updateUserVerification, loginAdmin } from '../controllers/adminController.js';
import { verifyAdmin } from '../middleware/authAdmin.js';

const router = express.Router();


router.post('/login', loginAdmin);
router.get('/pending-verifications', verifyAdmin, getPendingVerifications);
router.post('/update-verification', verifyAdmin, updateUserVerification);

export default router;