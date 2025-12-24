// const jwt = require("jsonwebtoken");
// const userModel = require("../models/userModel");

// const authenticate = async (req, res, next) => {
//     try {
//         const { token } = req.cookies;

//         if (!token)
//             return res.status(401).json({ message: "Unauthenticated user" });

//         // Verify token
//         const decoded = jwt.verify(token, process.env.JWT_SECRET);

//         // Find user from token payload
//         const user = await userModel.findById(decoded._id);
//         if (!user)
//             return res.status(404).json({ message: "User not found" });

//         // Attach user to request object
//         req.user = user;

//         next();
//     } catch (error) {
//         console.error("Auth Error:", error);
//         return res.status(401).json({ message: "Invalid or expired token" });
//     }
// };

// module.exports = authenticate;

// authMiddleware.js
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");

const authenticate = async (req, res, next) => {
    try {
        // Debug help (remove in prod)
        // console.log("headers.cookie:", req.headers.cookie);
        // console.log("authorization header:", req.headers.authorization?.slice?.(0, 50));

        // 1) Try cookie first
        let token = req.cookies?.token;

        // 2) Fallback: Authorization header (Bearer token)
        if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return res.status(401).json({ message: "Unauthenticated user" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded._id);
        if (!user) return res.status(404).json({ message: "User not found" });
        console.log(`Authenticated User : ${user.name}`);
        req.user = user;
        next();
    } catch (error) {
        console.error("Auth Error:", error);
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};

module.exports = authenticate;