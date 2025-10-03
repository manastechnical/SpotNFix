import express from "express";
import { potholeFixed } from "../controllers/contractorController.js";
import multer from "multer";

const router = express.Router();
// add contrctor routes here
// router.get("/home-contractor", contractorHome);
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post("/complete-work/:bidId",
    upload.array('images'),
    potholeFixed);

export default router;
