const express = require("express");
const { getAllUsers, updateUserStatus, updateUserProfile, deleteUser, getUsersByOrganizationId, addVenueToUser, removeVenueFromUser, getUserStatus, getUsersByCreatorId } = require("../controllers/userController");
const adminOnly = require("../middlewere/adminOnly");
const authenticate = require("../middlewere/authMiddleware");
const adminOrAdminCreatedUser = require("../middlewere/adminOrAdminCreatedUser");

const router = express.Router();

router.post("/:userId/add-venue", authenticate, adminOrAdminCreatedUser, addVenueToUser);
router.put("/update-status/:id", authenticate, adminOrAdminCreatedUser, updateUserStatus);
router.get("/all", authenticate, adminOnly, getAllUsers);
router.get("/status/:userId", getUserStatus);
router.get("/:creatorId", getUsersByCreatorId);
router.get("/:orgId", authenticate, adminOrAdminCreatedUser, getUsersByOrganizationId)
router.put("/update/:id", authenticate, adminOrAdminCreatedUser, updateUserProfile);
router.delete("/delete/:id", authenticate, adminOrAdminCreatedUser, deleteUser);
router.delete("/:userId/delete/:venueId", adminOrAdminCreatedUser, removeVenueFromUser);


module.exports = router;