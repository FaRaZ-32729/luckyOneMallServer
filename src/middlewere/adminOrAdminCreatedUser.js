const adminOrAdminCreatedUser = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not Authenticated' });
    }

    const isAdmin = req.user.role === "admin";
    const isAdminCreatedUser = req.user.createdBy === "admin";

    if (!isAdmin && !isAdminCreatedUser) {
        return res.status(403).json({ message: "Admin or Admin-Created-User privileges required" });
    }

    next();
};

module.exports = adminOrAdminCreatedUser;
