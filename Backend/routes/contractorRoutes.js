import express from "express";
import { potholeFixed } from "../controllers/contractorController.js";
import multer from "multer";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post("/complete-work/:bidId",
    upload.single('image'), 
    potholeFixed
);

export default router;