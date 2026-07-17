const mongoose = require("mongoose");

const reportDocumentSchema = new mongoose.Schema({
  originalFilename: { type: String, required: true },
  fileId: { type: String, required: true }, // GridFS file id, bucket "documents"
  mimeType: { type: String, required: true },
  docCategory: { type: String, default: "unknown" }, // policy | medical | id | bill | unknown
  extractedData: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ["pending", "processing", "done", "failed"], default: "pending" },
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const mergedFieldSchema = new mongoose.Schema(
  {
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    source: { type: String, default: null },
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: "Template", required: true },
  name: { type: String, required: true },
  status: {
    type: String,
    enum: ["draft", "extracting", "review", "completed", "failed"],
    default: "draft",
  },
  mergedData: { type: Map, of: mergedFieldSchema, default: {} },
  documents: { type: [reportDocumentSchema], default: [] },
  outputFileId: { type: String }, // GridFS file id, bucket "outputs", once generated
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

reportSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Report", reportSchema);
