const mongoose = require("mongoose");

const magicLinkSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  fullName: { type: String }, // only used on first-time sign-up
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// Mongo TTL index - expired/used tokens clean themselves up automatically
magicLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("MagicLink", magicLinkSchema);
