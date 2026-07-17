const express = require("express");
const { nanoid } = require("nanoid");
const User = require("../models/User");
const MagicLink = require("../models/MagicLink");
const { sendMagicLink } = require("../services/email");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const LINK_TTL_MINUTES = 15;

function toUserOut(user) {
  return { id: user._id.toString(), fullName: user.fullName, email: user.email, role: user.role };
}

// Step 1: person enters name (if new) + email, we email them a one-time link
router.post("/request-link", async (req, res) => {
  const { email, fullName } = req.body;
  if (!email) return res.status(400).json({ detail: "Email is required" });

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (!existing && !fullName) {
    return res.status(400).json({ detail: "First-time sign-in needs your full name" });
  }

  const token = nanoid(32);
  await MagicLink.create({
    email: email.toLowerCase(),
    fullName: fullName || undefined,
    token,
    expiresAt: new Date(Date.now() + LINK_TTL_MINUTES * 60 * 1000),
  });

  const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
  const link = `${backendUrl}/api/auth/verify?token=${token}`;
  await sendMagicLink(email, link);

  res.json({ ok: true, message: "Check your email for a sign-in link" });
});

// Step 2: person clicks the emailed link
router.get("/verify", async (req, res) => {
  const { token } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  const record = token && (await MagicLink.findOne({ token }));
  if (!record || record.used || record.expiresAt < new Date()) {
    return res.redirect(`${frontendUrl}/?error=link_expired`);
  }
  record.used = true;
  await record.save();

  let user = await User.findOne({ email: record.email });
  if (!user) {
    const isFirstUser = (await User.countDocuments()) === 0;
    user = await User.create({
      email: record.email,
      fullName: record.fullName || record.email.split("@")[0],
      role: isFirstUser ? "admin" : "user",
    });
  }

  req.session.userId = user._id.toString();
  res.redirect(`${frontendUrl}/?signed_in=1`);
});

router.get("/me", requireAuth, (req, res) => res.json(toUserOut(req.user)));

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;
