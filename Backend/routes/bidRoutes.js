import express from 'express';
import { submitBid,acceptBid } from '../controllers/bidController.js';

const router = express.Router();

router.post('/submit', submitBid);
router.patch('/accept/:potholeId', acceptBid);
export default router;