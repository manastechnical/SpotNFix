import express from "express";
import { login, registerContractor, registerGovernmentOfficial, registerUser, resendOtp, signInWithGoogle, validateOtp } from "../controllers/authController.js";

const router = express.Router();
router.post("/register", registerUser);
router.post("/validate", validateOtp);
router.get("/resend-otp", resendOtp);
router.post("/login", login);
router.post("/sign-in-google", signInWithGoogle);
router.post("/register-contractor", registerContractor);
router.post("/register-government-official", registerGovernmentOfficial);

export default router;
