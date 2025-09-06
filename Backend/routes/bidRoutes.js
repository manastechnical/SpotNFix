import express from 'express';
import { submitBid } from '../controllers/bidController.js';

const router = express.Router();

router.post('/submit', submitBid);

export default router;