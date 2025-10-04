import express from "express";
import {
  createCommunity,
  getCommunities,
  getCommunityById,
  joinCommunity,
  leaveCommunity,
  createEvent,
  getCommunityEvents,
  removeMember, 
  updateMemberRole,
  updateCommunity, 
  deleteCommunity,
  communityUpdates
} from "../controllers/communityController.js";

const router = express.Router();
router.get("/subscribe/:id", communityUpdates);

router.post("/create", createCommunity);
router.get("/", getCommunities);
router.get("/:id", getCommunityById);
router.post("/:communityId/join", joinCommunity);
router.post("/:communityId/leave", leaveCommunity);
router.post("/:communityId/events/create", createEvent);
router.get("/:communityId/events", getCommunityEvents);
router.delete("/:communityId/members/:memberId", removeMember);
router.put("/:communityId/members/:memberId/role", updateMemberRole);
router.put("/:id", updateCommunity);
router.delete("/:id", deleteCommunity);

export default router;