const adminOnly = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not Authenticated' });
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin privileges required' });
    next();
};


module.exports = adminOnly