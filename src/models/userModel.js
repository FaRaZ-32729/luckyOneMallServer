const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    isActive: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    suspensionReason: { type: String, default: "" },
    otp: { type: String },
    otpExpiry: { type: Date },
    setupToken: { type: String },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
    createdBy: { type: String, required: true },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    venues: [{ venueId: { type: mongoose.Schema.Types.ObjectId, ref: "Venue" }, venueName: { type: String } }],
    timer: { type: String, default: null }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
