const mongoose = require("mongoose");

const fieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    style: { type: String, enum: ["tag", "label"], required: true },
  },
  { _id: false }
);

const templateSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  originalFilename: { type: String, required: true },
  fileId: { type: String, required: true }, // GridFS file id, bucket "templates"
  fields: { type: [fieldSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Template", templateSchema);
