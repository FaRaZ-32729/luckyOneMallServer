const organizationModel = require("../models/organizationModel");
const userModel = require("../models/userModel");
const venueModel = require("../models/venueModal");
const mongoose = require("mongoose");

// create venue
const createVenue = async (req, res) => {
    try {
        const { name, organization } = req.body;

        if (!name || !organization)
            return res.status(400).json({ message: "Venue name and organization are required" });

        const existingVenue = await venueModel.findOne({ name, organization });
        if (existingVenue) {
            return res.status(400).json({
                message: "A venue with this name already exists in this organization",
            });
        }

        const venue = await venueModel.create({ name, organization });
        res.status(201).json({
            message: "Venue created successfully",
            venue,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error creating venue" });
    }
};

// get all venues
const getVenues = async (req, res) => {
    try {
        const venues = await venueModel.find().populate("organization");

        if (!venues) return res.status(404).json({ message: "No Venue Found" });

        return res.json(venues);

    } catch (error) {
        return res.status(500).json({ message: "Error fetching venues" });
    }
};

// get single venue by id
const getSingleVenue = async (req, res) => {
    try {
        const { id } = req.params;

        const venue = await venueModel.findById(id).populate("organization", "name");

        if (!venue) return res.status(404).json({ message: "No Venue Found" });

        return res.status(200).json({ venue });

    } catch (error) {
        console.log("error while fetching the venue", error.message);
        return res.status(500).json({ message: "Failed to fetch venue" });
    }
}

// get venues by organizationId
const getVenuesByOrganization = async (req, res) => {
    try {
        const { organizationId } = req.params;

        if (!organizationId)
            return res.status(400).json({ message: "Organization ID is required" });

        const venues = await venueModel.find({ organization: organizationId });

        if (!venues.length)
            return res.status(404).json({ message: "No venues found for this organization" });

        res.status(200).json({ venues });
    } catch (error) {
        console.error("Error fetching venues by organization:", error.message);
        res.status(500).json({ message: "Error fetching venues" });
    }
};

// get venues by user id
const getUserVenues = async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate userId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "Invalid userId" });
        }

        // Find user
        const user = await userModel.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // If no venues assigned
        if (!user.venues || user.venues.length === 0) {
            return res.status(200).json({
                message: "No venues assigned to this user",
                venues: [],
            });
        }

        // Return user venues (they already contain venueId + venueName)
        res.status(200).json({
            message: "User venues fetched successfully",
            venues: user.venues,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};
// update venue
const updateVenue = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name)
            return res.status(400).json({ message: "Venue name is required" });

        const venue = await venueModel.findById(id);
        if (!venue) return res.status(404).json({ message: "Venue not found" });

        const duplicateVenue = await venueModel.findOne({
            name,
            organization: venue.organization,
            _id: { $ne: id },
        });

        if (duplicateVenue) {
            return res.status(400).json({
                message: "A venue with this name already exists in this organization",
            });
        }

        venue.name = name;
        const updatedVenue = await venue.save();

        res.json({
            message: "Venue updated successfully",
            venue: updatedVenue,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error updating venue" });
    }
};

// for admin only wher admin can update organization beside venue name
const updateVenueAsAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, organizationId } = req.body;

        // Validate name
        if (!name) {
            return res.status(400).json({ message: "Venue name is required" });
        }

        // Validate venue ID
        const venue = await venueModel.findById(id);
        if (!venue) {
            return res.status(404).json({ message: "Venue not found" });
        }


        let newOrganizationId = venue.organization; // default: existing org

        // If admin wants to update organization
        if (organizationId) {
            if (!mongoose.Types.ObjectId.isValid(organizationId)) {
                return res.status(400).json({ message: "Invalid organizationId" });
            }

            const organizationExists = await organizationModel.findById(organizationId);
            if (!organizationExists) {
                return res.status(404).json({ message: "Organization not found" });
            }

            newOrganizationId = organizationId;
        }

        // Check duplicate venue in the (new or same) organization
        const duplicateVenue = await venueModel.findOne({
            name,
            organization: newOrganizationId,
            _id: { $ne: id },
        });

        if (duplicateVenue) {
            return res.status(400).json({
                message: "A venue with this name already exists in this organization",
            });
        }

        // Update fields
        venue.name = name;
        venue.organization = newOrganizationId;

        const updatedVenue = await venue.save();

        return res.json({
            message: "Venue updated successfully",
            venue: updatedVenue,
        });

    } catch (error) {
        console.error("Error updating venue:", error);
        res.status(500).json({ message: "Error updating venue" });
    }
};


// delete venue
const deleteVenue = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await venueModel.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ message: "Venue not found" });

        res.json({ message: "Venue deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting venue" });
    }
};

module.exports = { createVenue, getVenues, updateVenue, deleteVenue, getSingleVenue, getVenuesByOrganization, getUserVenues, updateVenueAsAdmin };
