require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cors = require("cors");
const { connectDB } = require("./src/config/db");

const authRoutes = require("./src/routes/auth");
const templateRoutes = require("./src/routes/templates");
const reportRoutes = require("./src/routes/reports");
const adminRoutes = require("./src/routes/admin");

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/osreports";
const FRONTEND_URL = process.env.FRONTEND_URL;
const IS_PROD = process.env.NODE_ENV === "production";

async function main() {
  await connectDB();

  const app = express();
  app.set("trust proxy", 1); // needed behind Render's proxy for secure cookies

  app.use(
    cors({
      origin: FRONTEND_URL || true,
      credentials: true,
    })
  );
  app.use(express.json());

  app.use(
    session({
      name: "osr_sid",
      secret: process.env.SESSION_SECRET || "change-this-in-render-env-vars",
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: MONGODB_URI, collectionName: "sessions" }),
      cookie: {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: IS_PROD ? "none" : "lax", // cross-site cookie needed since frontend/backend are separate domains
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    })
  );

  app.use("/api/auth", authRoutes);
  app.use("/api/templates", templateRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/admin", adminRoutes);

  app.get("/api/health", (req, res) => res.json({ status: "ok", service: "os-reports-backend" }));

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ detail: "Something went wrong on our end" });
  });

  app.listen(PORT, () => console.log(`OS Reports backend listening on :${PORT}`));
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
