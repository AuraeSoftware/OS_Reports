const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/osreports";
  await mongoose.connect(uri);
  console.log("MongoDB connected");
  return mongoose.connection;
}

module.exports = { connectDB };
