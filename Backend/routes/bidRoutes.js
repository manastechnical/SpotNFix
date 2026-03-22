import express from 'express';
import { submitBid,acceptBid,sortBidsWithAI } from '../controllers/bidController.js';

const router = express.Router();

router.post('/submit', submitBid);
router.patch('/accept/:potholeId', acceptBid);
router.post('/sort', sortBidsWithAI); 
export default router;