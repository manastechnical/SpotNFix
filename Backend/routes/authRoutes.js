import express from "express";
import { login, registerUser, resendOtp, signInWithGoogle, validateOtp } from "../controllers/authController.js";

const router = express.Router();
router.post("/register", registerUser);
router.post("/validate", validateOtp);
router.get("/resend-otp", resendOtp);
router.post("/login", login);
router.post("/sign-in-google", signInWithGoogle);

export default router;
