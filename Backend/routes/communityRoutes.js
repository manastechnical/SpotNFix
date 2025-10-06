import express from "express";
import {
  createCommunity,
  getCommunities,
  getCommunityById,
  joinCommunity,
  leaveCommunity,
  createEvent,
  removeMember, 
  updateMemberRole,
  updateCommunity, 
  deleteCommunity,
  communityUpdates,
  getCommunityEvents,
    createCommunityEvent,
    updateCommunityEvent,
    deleteCommunityEvent,
    rsvpToEvent,
} from "../controllers/communityController.js";

const router = express.Router();
router.get("/subscribe/:id", communityUpdates);

router.post("/create", createCommunity);
router.get("/", getCommunities);
router.get("/:id", getCommunityById);
router.post("/:communityId/join", joinCommunity);
router.post("/:communityId/leave", leaveCommunity);
router.post("/:communityId/events/create", createEvent);
router.delete("/:communityId/members/:memberId", removeMember);
router.put("/:communityId/members/:memberId/role", updateMemberRole);
router.put("/:id", updateCommunity);
router.delete("/:id", deleteCommunity);
router.get("/:communityId/events", getCommunityEvents);
router.post("/:communityId/events", createCommunityEvent);
router.put("/events/:eventId", updateCommunityEvent);
router.delete("/events/:eventId", deleteCommunityEvent);
router.post("/events/:eventId/rsvp", rsvpToEvent);

export default router;