import express from "express";
import { potholeFixed } from "../controllers/contractorController.js";

const router = express.Router();
// add contrctor routes here
// router.get("/home-contractor", contractorHome);

router.post("/complete-work/:bidId", potholeFixed);

export default router;
