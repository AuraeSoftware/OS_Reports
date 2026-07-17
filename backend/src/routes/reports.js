const express = require("express");
const multer = require("multer");
const Report = require("../models/Report");
const Template = require("../models/Template");
const { requireAuth } = require("../middleware/auth");
const { uploadBuffer, downloadBuffer } = require("../services/gridfs");
const { extractFromDocument, mergeExtractions } = require("../services/extraction");
const { fillTemplate } = require("../services/templateEngine");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

function isStaff(user) {
  return user.role === "admin" || user.role === "reviewer";
}

function mapToObject(map) {
  if (!map) return {};
  if (map instanceof Map) return Object.fromEntries(map);
  return map;
}

async function toReportOut(report, includeOwner = false) {
  const out = {
    id: report._id.toString(),
    name: report.name,
    status: report.status,
    merged_data: mapToObject(report.mergedData),
    output_available: !!report.outputFileId,
    error_message: report.errorMessage || null,
    created_at: report.createdAt,
    documents: report.documents.map((d) => ({
      id: d._id.toString(),
      original_filename: d.originalFilename,
      doc_category: d.docCategory,
      status: d.status,
      extracted_data: d.extractedData,
    })),
  };
  if (includeOwner) {
    const User = require("../models/User");
    const owner = await User.findById(report.ownerId);
    out.owner_name = owner ? owner.fullName : null;
    out.owner_email = owner ? owner.email : null;
  }
  return out;
}

async function getAccessibleReport(id, user) {
  const conditions = { _id: id };
  if (!isStaff(user)) conditions.ownerId = user._id;
  return Report.findOne(conditions);
}

router.post("/", requireAuth, async (req, res) => {
  const { template_id, name } = req.body;
  const template = await Template.findById(template_id);
  if (!template) return res.status(404).json({ detail: "Template not found" });

  const report = await Report.create({ ownerId: req.user._id, templateId: template._id, name });
  res.json(await toReportOut(report));
});

router.get("/", requireAuth, async (req, res) => {
  const conditions = req.query.scope === "all" && isStaff(req.user) ? {} : { ownerId: req.user._id };
  const reports = await Report.find(conditions).sort({ createdAt: -1 });
  res.json(await Promise.all(reports.map((r) => toReportOut(r, isStaff(req.user)))));
});

router.get("/:id", requireAuth, async (req, res) => {
  const report = await getAccessibleReport(req.params.id, req.user);
  if (!report) return res.status(404).json({ detail: "Report not found" });
  res.json(await toReportOut(report, isStaff(req.user)));
});

router.post("/:id/documents", requireAuth, upload.array("files"), async (req, res) => {
  const report = await getAccessibleReport(req.params.id, req.user);
  if (!report) return res.status(404).json({ detail: "Report not found" });

  for (const file of req.files) {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return res.status(400).json({ detail: `Unsupported file type: ${file.originalname}` });
    }
    const fileId = await uploadBuffer("documents", file.originalname, file.buffer, {
      reportId: report._id.toString(),
    });
    report.documents.push({
      originalFilename: file.originalname,
      fileId,
      mimeType: file.mimetype,
      status: "pending",
    });
  }
  await report.save();
  res.json(await toReportOut(report));
});

async function runExtraction(reportId) {
  const report = await Report.findById(reportId);
  if (!report) return;
  const template = await Template.findById(report.templateId);
  const fields = template ? template.fields : [];

  report.status = "extracting";
  await report.save();

  const perDocResults = [];
  const docsMeta = [];

  try {
    for (const doc of report.documents) {
      doc.status = "processing";
      await report.save();
      try {
        const buffer = await downloadBuffer("documents", doc.fileId);
        const result = await extractFromDocument(
          { buffer, mimeType: doc.mimeType, filename: doc.originalFilename },
          fields
        );
        doc.extractedData = result.fields || {};
        doc.docCategory = result.doc_category || "unknown";
        doc.status = "done";
        perDocResults.push(result);
      } catch (err) {
        doc.status = "failed";
        doc.errorMessage = err.message;
        perDocResults.push({ fields: {} });
      }
      docsMeta.push({ filename: doc.originalFilename });
      await report.save();
    }

    const merged = mergeExtractions(perDocResults, docsMeta, fields);
    report.mergedData = merged;
    report.status = "review";
  } catch (err) {
    report.status = "failed";
    report.errorMessage = err.message;
  }
  await report.save();
}

router.post("/:id/extract", requireAuth, async (req, res) => {
  const report = await getAccessibleReport(req.params.id, req.user);
  if (!report) return res.status(404).json({ detail: "Report not found" });
  if (!report.documents.length) {
    return res.status(400).json({ detail: "Upload at least one document before extracting" });
  }

  report.status = "extracting";
  await report.save();
  runExtraction(report._id.toString()).catch((e) => console.error("Extraction failed:", e));

  res.json(await toReportOut(report));
});

router.patch("/:id/fields", requireAuth, async (req, res) => {
  const report = await getAccessibleReport(req.params.id, req.user);
  if (!report) return res.status(404).json({ detail: "Report not found" });

  const current = mapToObject(report.mergedData);
  for (const [key, value] of Object.entries(req.body.fields || {})) {
    const existingSource = current[key] ? current[key].source : null;
    current[key] = { value, source: existingSource };
  }
  report.mergedData = current;
  await report.save();
  res.json(await toReportOut(report));
});

router.post("/:id/generate", requireAuth, async (req, res) => {
  const report = await getAccessibleReport(req.params.id, req.user);
  if (!report) return res.status(404).json({ detail: "Report not found" });

  const template = await Template.findById(report.templateId);
  if (!template) return res.status(404).json({ detail: "Template not found" });

  try {
    const templateBuffer = await downloadBuffer("templates", template.fileId);
    const filled = fillTemplate(templateBuffer, mapToObject(report.mergedData));
    const outputFileId = await uploadBuffer("outputs", `${report.name}.docx`, filled, {
      reportId: report._id.toString(),
    });
    report.outputFileId = outputFileId;
    report.status = "completed";
    await report.save();
    res.json(await toReportOut(report));
  } catch (err) {
    report.status = "failed";
    report.errorMessage = err.message;
    await report.save();
    res.status(500).json({ detail: `Could not generate document: ${err.message}` });
  }
});

router.get("/:id/download", requireAuth, async (req, res) => {
  const report = await getAccessibleReport(req.params.id, req.user);
  if (!report || !report.outputFileId) {
    return res.status(404).json({ detail: "Report has not been generated yet" });
  }
  const buffer = await downloadBuffer("outputs", report.outputFileId);
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="${report.name}.docx"`,
  });
  res.send(buffer);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const report = await getAccessibleReport(req.params.id, req.user);
  if (!report) return res.status(404).json({ detail: "Report not found" });
  await report.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
