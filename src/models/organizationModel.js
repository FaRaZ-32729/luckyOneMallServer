
const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema({
    name: { type: String, required: true, lowercase: true, trim: true },
}, { timestamps: true });

module.exports = mongoose.model("Organization", organizationSchema);
