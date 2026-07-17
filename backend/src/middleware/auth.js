const User = require("../models/User");

async function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ detail: "Please sign in to continue" });
  }
  const user = await User.findById(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ detail: "Session no longer valid" });
  }
  req.user = user;
  next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ detail: "You don't have access to this" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRoles };
