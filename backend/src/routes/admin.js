const express = require("express");
const User = require("../models/User");
const Report = require("../models/Report");
const { requireAuth, requireRoles } = require("../middleware/auth");

const router = express.Router();
const VALID_ROLES = ["admin", "reviewer", "user"];

router.get("/users", requireAuth, requireRoles("admin"), async (req, res) => {
  const users = await User.find().sort({ createdAt: 1 });
  const counts = await Report.aggregate([{ $group: { _id: "$ownerId", count: { $sum: 1 } } }]);
  const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));

  res.json(
    users.map((u) => ({
      id: u._id.toString(),
      full_name: u.fullName,
      email: u.email,
      role: u.role,
      created_at: u.createdAt,
      report_count: countMap[u._id.toString()] || 0,
    }))
  );
});

router.patch("/users/:id/role", requireAuth, requireRoles("admin"), async (req, res) => {
  const { role } = req.body;
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ detail: `Role must be one of ${VALID_ROLES.join(", ")}` });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ detail: "User not found" });
  if (user._id.equals(req.user._id) && role !== "admin") {
    return res.status(400).json({ detail: "You can't demote your own account" });
  }
  user.role = role;
  await user.save();
  const reportCount = await Report.countDocuments({ ownerId: user._id });
  res.json({
    id: user._id.toString(),
    full_name: user.fullName,
    email: user.email,
    role: user.role,
    created_at: user.createdAt,
    report_count: reportCount,
  });
});

router.get("/stats", requireAuth, requireRoles("admin", "reviewer"), async (req, res) => {
  const [totalUsers, totalReports, pendingReview, completed] = await Promise.all([
    User.countDocuments(),
    Report.countDocuments(),
    Report.countDocuments({ status: "review" }),
    Report.countDocuments({ status: "completed" }),
  ]);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = await Report.countDocuments({ createdAt: { $gte: monthStart } });

  res.json({
    total_users: totalUsers,
    total_reports: totalReports,
    reports_pending_review: pendingReview,
    reports_completed: completed,
    reports_this_month: thisMonth,
  });
});

module.exports = router;
