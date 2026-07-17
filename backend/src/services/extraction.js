const OpenAI = require("openai");

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured on the server");
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function buildFieldList(fields) {
  return fields.map((f) => `- ${f.key}: ${f.label}`).join("\n");
}

function buildPrompt(fields) {
  return `You are an expert insurance document data-extraction assistant.

Target fields to look for (a single document will usually only contain some of these):
${buildFieldList(fields)}

Instructions:
- Read the attached document carefully. It may be a policy document, claim form, medical bill/invoice, ID card, or other insurance-related paperwork.
- Extract ONLY values that are actually present in this document. Do not guess or hallucinate values.
- Map values to the closest target field even if the document's wording differs (e.g. "Sum Insured" -> sum_insured, "Assured Name" -> policyholder_name).
- Classify the document as one of: policy, medical, id, bill, unknown.
- Return STRICT JSON only, in exactly this shape: {"doc_category": "policy|medical|id|bill|unknown", "fields": {"<field_key>": "<value or null>"}}`;
}

function cleanJson(text) {
  const trimmed = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(trimmed);
}

/**
 * extractFromDocument({ buffer, mimeType, filename }, fields)
 * Returns { doc_category, fields: { key: value|null } }
 */
async function extractFromDocument({ buffer, mimeType, filename }, fields) {
  const client = getClient();
  const base64 = buffer.toString("base64");
  const isPdf = mimeType === "application/pdf";

  const content = [{ type: "input_text", text: buildPrompt(fields) }];
  if (isPdf) {
    content.push({
      type: "input_file",
      filename: filename || "document.pdf",
      file_data: `data:application/pdf;base64,${base64}`,
    });
  } else {
    content.push({
      type: "input_image",
      image_url: `data:${mimeType};base64,${base64}`,
    });
  }

  const response = await client.responses.create({
    model: MODEL,
    input: [{ role: "user", content }],
    temperature: 0.1,
  });

  try {
    return cleanJson(response.output_text);
  } catch (e) {
    return { doc_category: "unknown", fields: {} };
  }
}

/**
 * First non-empty value found for a field wins across documents,
 * with the source filename tracked for the review screen.
 */
function mergeExtractions(perDocumentResults, documentsMeta, fields) {
  const merged = {};
  for (const f of fields) merged[f.key] = { value: null, source: null };

  perDocumentResults.forEach((result, i) => {
    const extractedFields = (result && result.fields) || {};
    for (const [key, value] of Object.entries(extractedFields)) {
      if (!(key in merged)) continue;
      const isEmpty = value === null || value === "" || value === "null";
      if (!isEmpty && (merged[key].value === null || merged[key].value === "")) {
        merged[key] = { value, source: documentsMeta[i].filename };
      }
    }
  });

  return merged;
}

module.exports = { extractFromDocument, mergeExtractions };
