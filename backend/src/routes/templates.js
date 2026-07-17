const express = require("express");
const multer = require("multer");
const Template = require("../models/Template");
const { requireAuth } = require("../middleware/auth");
const { uploadBuffer } = require("../services/gridfs");
const { detectFields } = require("../services/templateEngine");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function toTemplateOut(t) {
  return {
    id: t._id.toString(),
    name: t.name,
    original_filename: t.originalFilename,
    fields: t.fields,
    created_at: t.createdAt,
  };
}

router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  const { name } = req.body;
  const file = req.file;
  if (!name) return res.status(400).json({ detail: "Give the template a name" });
  if (!file || !file.originalname.toLowerCase().endsWith(".docx")) {
    return res.status(400).json({ detail: "Template must be a .docx file" });
  }

  let fields;
  try {
    fields = detectFields(file.buffer);
  } catch (e) {
    return res.status(400).json({ detail: `Could not read template: ${e.message}` });
  }
  if (!fields.length) {
    return res.status(400).json({
      detail: "No fillable fields detected. Use {{field_name}} tags or 'Label:' style placeholders.",
    });
  }

  const fileId = await uploadBuffer("templates", file.originalname, file.buffer, {
    ownerId: req.user._id.toString(),
  });

  const template = await Template.create({
    ownerId: req.user._id,
    name,
    originalFilename: file.originalname,
    fileId,
    fields,
  });

  res.json(toTemplateOut(template));
});

router.get("/", requireAuth, async (req, res) => {
  const templates = await Template.find({ ownerId: req.user._id }).sort({ createdAt: -1 });
  res.json(templates.map(toTemplateOut));
});

router.get("/:id", requireAuth, async (req, res) => {
  const template = await Template.findById(req.params.id);
  if (!template) return res.status(404).json({ detail: "Template not found" });
  res.json(toTemplateOut(template));
});

module.exports = router;
