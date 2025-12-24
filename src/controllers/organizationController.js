const orgModel = require("../models/organizationModel");
const userModel = require("../models/userModel");

// create organization
const createOrganization = async (req, res) => {
    try {
        let { name } = req.body;

        if (!name) {
            return res.status(400).json({ message: "Organization name is required" });
        }

        name = name.trim().toLowerCase();

        const existingOrg = await orgModel.findOne({ name });
        if (existingOrg) {
            return res.status(400).json({ message: "Organization already exists" });
        }

        const org = await orgModel.create({ name });

        res.status(201).json({
            message: "Organization created successfully",
            organization: org,
        });
    } catch (err) {
        console.error("Error creating organization:", err);
        res.status(500).json({
            message: "Internal Server Error while creating organization",
        });
    }
};

// get organizations
const getOrganizations = async (req, res) => {
    try {
        const orgs = await orgModel.find();

        if (!orgs) return res.status(404).json({ message: "No Organizations Found" });

        res.status(200).json(orgs);
    } catch (error) {
        console.log("error to fetch organizations");
        return res.status(500).json({ message: "Server Error" });
    }
};

// get single organization  
const getOrganizationById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: "Organization ID is required" });
        }

        const org = await orgModel.findById(id);

        if (!org) {
            return res.status(404).json({ message: "Organization not found" });
        }

        res.status(200).json({
            message: "Organization fetched successfully",
            organization: org,
        });

    } catch (err) {
        console.error("Error fetching organization by ID:", err);
        res.status(500).json({
            message: "Internal Server Error while fetching organization",
        });
    }
};

// get organization by user id
const getOrganizationByUserId = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        // Check if user exists
        const user = await userModel.findById(userId).populate("organization");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if user has an organization
        if (!user.organization) {
            return res.status(404).json({ message: "This user does not belong to any organization" });
        }

        // Return populated organization
        res.status(200).json({
            message: "Organization fetched successfully",
            organization: user.organization,
        });

    } catch (err) {
        console.error("Error fetching organization by user ID:", err);
        res.status(500).json({
            message: "Internal Server Error while fetching organization by user ID",
        });
    }
};


// update organizations
const updateOrganization = async (req, res) => {
    try {
        const { id } = req.params;
        let { name } = req.body;

        if (!id) {
            return res.status(400).json({ message: "Organization ID is required" });
        }

        if (!name) {
            return res.status(400).json({ message: "Organization name is required" });
        }

        name = name.trim().toLowerCase();

        const existingOrg = await orgModel.findOne({ name });
        if (existingOrg && existingOrg._id.toString() !== id) {
            return res.status(400).json({ message: "Another organization with this name already exists" });
        }

        const org = await orgModel.findByIdAndUpdate(
            id,
            { name },
            { new: true, runValidators: true }
        );

        if (!org) {
            return res.status(404).json({ message: "Organization not found" });
        }

        res.status(200).json({
            message: "Organization updated successfully",
            organization: org,
        });
    } catch (err) {
        console.error("Error updating organization:", err);
        res.status(500).json({
            message: "Internal Server Error while updating organization",
        });
    }
};

// delete organizations by id
const deleteOrganization = async (req, res) => {
    try {
        const { id } = req.params;

        const org = await orgModel.findById(id);
        if (!org) {
            return res.status(404).json({ message: "Organization not found" });
        }

        await orgModel.findByIdAndDelete(id);

        res.status(200).json({
            message: "Organization deleted successfully",
            deletedOrganization: org,
        });

    } catch (err) {
        console.error("Error deleting organization:", err);
        res.status(500).json({
            message: "Internal Server Error while deleting organization",
        });
    }
};



module.exports = { createOrganization, getOrganizations, updateOrganization, deleteOrganization, getOrganizationById, getOrganizationByUserId }