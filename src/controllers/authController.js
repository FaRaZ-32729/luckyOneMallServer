const userModel = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");
const organizationModel = require("../models/organizationModel");
const venueModel = require("../models/venueModal");

// api for registering admin
const registerAdmin = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email, !password) return res.status(400).json({ message: "All Fields Are Required" });

        const passwordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message:
                    "Password must be at least 8 characters long, include uppercase, lowercase, number, and special character.",
            });
        };

        const existingUser = await userModel.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "User Already Exists" });

        const hashedPassword = await bcrypt.hash(password, 10);

        const newAdmin = await userModel.create({
            name,
            email,
            password: hashedPassword,
            role: "admin",
            isActive: true,
            isVerified: true,
            createdBy: "admin",
            organization: null
        });

        return res.status(201).json({ message: "Admin Created Successfully", Admin: newAdmin })
    } catch (error) {
        console.log(error.message, "error occured while creating admin");
    }
}

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const createUser = async (req, res) => {
    try {
        const { name, email, role, organizationId, venues, timer } = req.body;

        if (!name || !email || !role)
            return res.status(400).json({ message: "All fields are required" });

        const creator = req.user; // logged-in user

        // RULE 1: Only admins OR users that are createdBy: "admin" can create users
        if (creator.role === "user" && creator.createdBy === "user") {
            return res.status(403).json({ message: "Access Denied: You cannot create users" });
        }

        let finalOrganizationId;

        // CASE 1: creator already belongs to an org
        if (creator.organization) {
            finalOrganizationId = creator.organization;
        }
        // CASE 2: admin must provide organizationId
        else {
            if (!organizationId) {
                return res.status(400).json({ message: "Organization ID is required" });
            }

            finalOrganizationId = organizationId;
        }

        // Confirm organization exists
        const organization = await organizationModel.findById(finalOrganizationId);
        if (!organization)
            return res.status(404).json({ message: "Organization not found" });

        // Check duplicate email
        const existingEmail = await userModel.findOne({ email });
        if (existingEmail)
            return res.status(400).json({ message: "User with this email already exists" });

        /* ---------------- VENUE VALIDATION (ONLY FOR USER CREATED USERS) ---------------- */
        let assignedVenues = [];

        if (creator.role === "user") {
            if (!venues || venues.length === 0) {
                return res.status(400).json({
                    message: "You must assign at least one venue"
                });
            }

            // Validate venues belong to same organization
            const validVenues = await venueModel.find({
                _id: { $in: venues },
                organization: creator.organization
            });

            if (validVenues.length !== venues.length) {
                return res.status(400).json({
                    message: "One or more venues are invalid or not in your organization"
                });
            }

            // assignedVenues = venues;
            assignedVenues = validVenues.map(v => ({
                venueId: v._id,
                venueName: v.name
            }));
        }

        /* --------------------- TIMER LOGIC  -------------------------- */

        let assignedTimer;

        if (creator.role === "admin") {
            // Admin can assign custom timer
            assignedTimer = timer !== undefined ? timer : null;
        } else {
            // USER → must pass same timer to sub-user
            if (creator.timer === undefined || creator.timer === null) {
                return res.status(400).json({
                    message: "You do not have a timer assigned. Contact admin."
                });
            }

            assignedTimer = creator.timer;
        }


        /* ---------------- SETUP PASSWORD TOKEN ---------------- */
        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1d" });

        /* ---------------- CREATE USER ---------------- */
        const newUser = await userModel.create({
            name,
            email,
            role,
            organization: finalOrganizationId,
            venues: assignedVenues,
            createdBy: creator.role,
            creatorId: creator._id,
            timer: assignedTimer,
            setupToken: token,
            isActive: false,
            isVerified: false,
        });

        /* ---------------- SEND SETUP EMAIL ---------------- */
        // const setupLink = `http://localhost:5173/setup-password/${token}`;
        const setupLink = `https://luckyone-iotfiysolutions.vercel.app/setup-password/${token}`;

        await sendEmail(
            newUser.email,
            "Set up your Odour Management System account",
            `
            <div style="font-family: Arial, sans-serif; color: #333; background: #f5f8fa; padding: 20px; border-radius: 8px;">
                <div style="text-align: center;">
                    <img src="cid:logo.png" alt="IOTFIY Logo" style="width: 120px; margin-bottom: 20px;" />
                </div>
                <h2 style="color: #0055a5;">Welcome to Odour Management System!</h2>
                <p>Hello <b>${newUser.name || newUser.email}</b>,</p>
                <p>Your account has been created. Please click below to set your password:</p>

                <div style="text-align: center; margin: 20px 0;">
                    <a href="${setupLink}"
                       style="background-color: #0055a5; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-size: 16px;">
                       Set Password
                    </a>
                </div>

                <p style="font-size: 14px; color: #555;">
                    This link will expire in 24 hours. If you didn't expect this email, ignore it.
                </p>
                <hr/>
                <p style="font-size: 12px; text-align: center; color: #888;">
                    © ${new Date().getFullYear()} IOTFIY Solutions. All rights reserved.
                </p>
            </div>
            `
        );

        /* ---------------- RESPONSE WITH POPULATION ---------------- */
        const populatedUser = await userModel
            .findById(newUser._id)
            .populate("organization", "name")
            .populate("venues", "name");

        res.status(201).json({
            message: "User created and setup link sent",
            user: populatedUser
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error creating user" });
    }
};


// set password
const setPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password)
            return res.status(400).json({ message: "Password is required" });

        const passwordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message:
                    "Password must be at least 8 characters long, include uppercase, lowercase, number, and special character.",
            });
        };

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findOne({ email: decoded.email, setupToken: token });
        if (!user)
            return res.status(404).json({ message: "Invalid or expired link" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 min validity

        user.password = hashedPassword;
        user.otp = otp;
        user.otpExpiry = otpExpiry;
        await user.save();


        const setupLink = `https://luckyone-iotfiysolutions.vercel.app/verify-otp/${token}`;

        await sendEmail(
            user.email,
            "Verify Your Odour Management System account",
            `
  <div style="font-family: Arial, sans-serif; color: #333; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #e6e6e6; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #e6e6e6;">
          <img src="cid:logo.png" alt="IOTFIY Logo" style="max-width: 150px;" />
      </div>

      <h2 style="color: #263238; margin-top: 30px;">Welcome to Odour Management System!</h2>
      <p style="font-size: 14px; line-height: 1.6;">
          Hi <strong>${user.name || user.email}</strong>,
          <br><br>
          Your password has been successfully set. To complete your account setup, please use the one-time password (OTP) below to verify your email address.
      </p>

      <div style="background-color: #f4faff; border: 1px solid #cde7ff; padding: 15px; margin: 20px 0; text-align: center; font-size: 22px; letter-spacing: 3px; font-weight: bold;">
          ${otp}
      </div>

      <div style="text-align: center; margin: 25px 0;">
            <a href="${setupLink}"
                style="background-color: #0055a5; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-size: 16px;">
                Verify OTP
            </a>
      </div>

      <p style="font-size: 14px; line-height: 1.6;">
          This OTP is valid for the next <strong>10 minutes</strong>. If you didn’t request this, please ignore this email.
      </p>

      <p style="font-size: 14px; line-height: 1.6;">
          Best Regards, <br>
          <strong>LuckyOne Team</strong>
      </p>

      <div style="text-align: center; font-size: 12px; color: #777; margin-top: 30px;">
          © ${new Date().getFullYear()} IOTFIY Solutions, All rights reserved.
          <br>
          This is an automated message, please do not reply.
      </div>
  </div>
  `
        );


        res.json({ message: "Password set successfully, OTP sent to email" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error setting password" });
    }
};

// verify otp
const verifyOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        const { token } = req.params;

        if (!otp || !token)
            return res.status(400).json({ message: "OTP and token are required" });

        // Decode token to get email
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findOne({ email: decoded.email });

        if (!user) return res.status(404).json({ message: "User not found" });

        // Validate OTP
        if (user.otp !== otp)
            return res.status(400).json({ message: "Invalid OTP" });

        if (Date.now() > user.otpExpiry)
            return res.status(400).json({ message: "OTP expired" });

        // Update user status
        user.isVerified = true;
        user.isActive = true;
        user.otp = null;
        user.otpExpiry = null;
        user.setupToken = null;

        await user.save();

        return res.json({
            message: "Account verified successfully. You can now log in.",
        });
    } catch (err) {
        console.error("OTP Verification Error:", err);
        if (err.name === "TokenExpiredError") {
            return res.status(400).json({ message: "Verification link expired" });
        }
        return res.status(500).json({ message: "Error verifying OTP" });
    }
};

// login user
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await userModel.findOne({ email });
        if (!user)
            return res.status(404).json({ message: "User not found" });

        if (!user.isActive)
            return res.status(403).json({
                message: user.suspensionReason || "Account suspended by admin",
            });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
            return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign(
            { _id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "none",
            secure: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        const { password: _, ...userData } = user.toObject();

        res.status(200).json({
            message: "Login successful",
            user: userData,
            token,
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: "Login error" });
    }
};

//forget password
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email)
            return res.status(400).json({ message: "Email is required" });

        const user = await userModel.findOne({ email });
        if (!user)
            return res.status(404).json({ message: "User not found" });

        // Generate reset token (expires in 15 minutes)
        const resetToken = jwt.sign(
            { email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        // Create reset link
        // const resetLink = `http://localhost:5173/reset-password/${resetToken}`;
        const resetLink = `https://luckyone-iotfiysolutions.vercel.app/reset-password/${resetToken}`;

        // Send email
        await sendEmail(
            user.email,
            "Reset Your Odour Management System account Password",
            `
            <div style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                <h2>Password Reset Request</h2>
                <p>Hello <b>${user.name || user.email}</b>,</p>
                <p>We received a request to reset your password. Click the link below to set a new password. 
                This link will expire in <b>15 minutes</b>.</p>

                <div style="margin: 20px 0;">
                    <a href="${resetLink}" 
                       style="background-color: #0055a5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                       Reset Password
                    </a>
                </div>

                <p>If you didn’t request this, please ignore this email.</p>
                <hr/>
                <p style="font-size: 12px; color: #777;">© ${new Date().getFullYear()} IOTFIY Solutions. All rights reserved.</p>
            </div>
            `
        );

        // Optionally store token (to invalidate later if needed)
        user.resetToken = resetToken;
        user.resetTokenExpiry = Date.now() + 15 * 60 * 1000;
        await user.save();

        res.status(200).json({
            message: "Password reset link sent to your email",
        });
    } catch (err) {
        console.error("Forgot Password Error:", err);
        res.status(500).json({ message: "Error sending reset email" });
    }
};

// reset password
const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!token || !password)
            return res.status(400).json({ message: "Token and new password are required" });

        // Validate new password
        const passwordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message:
                    "Password must be at least 8 characters long, include uppercase, lowercase, number, and special character.",
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await userModel.findOne({
            email: decoded.email,
            resetToken: token,
            resetTokenExpiry: { $gt: Date.now() } // ensure token not expired
        });

        if (!user)
            return res.status(400).json({ message: "Invalid or expired reset link" });

        // Hash and update new password
        const hashedPassword = await bcrypt.hash(password, 10);

        user.password = hashedPassword;
        user.resetToken = null;
        user.resetTokenExpiry = null;

        await user.save();

        res.status(200).json({ message: "Password reset successfully" });
    } catch (err) {
        console.error("Reset Password Error:", err);
        if (err.name === "TokenExpiredError")
            return res.status(400).json({ message: "Reset link expired" });

        res.status(500).json({ message: "Error resetting password" });
    }
};

// logout user 
const logoutUser = async (req, res) => {
    try {
        res.clearCookie("token", { httpOnly: true, sameSite: "none", path: "/", secure: true });
        res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        console.error("Error in logout:", error);
        res.status(500).json({ success: false, message: "Logout failed" });
    }
};

// verified user after login
const verifyMe = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            user: req.user,
        });
    } catch (error) {
        console.error("Error While Verifing User", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


module.exports = { createUser, setPassword, verifyOTP, loginUser, registerAdmin, verifyMe, resetPassword, forgotPassword, logoutUser }