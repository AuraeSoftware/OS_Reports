/**
 * Detects fillable fields in an uploaded .docx template and fills them back in.
 * Two placeholder styles are supported, mixed freely:
 *   1. Tag style   -> {{ Policy Number }}   (rendered via docxtemplater)
 *   2. Label style -> "Policy Number:" followed by blank space / underscores,
 *                    or an empty table cell next to a label cell
 *                    (handled via direct XML manipulation, since docxtemplater
 *                     has no concept of "find the blank next to this label")
 */
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const TAG_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;
const LABEL_RE = /^([A-Za-z][A-Za-z0-9 /&\-.()]{1,60}?)\s*:\s*(_{2,}|\s*)$/;

function slugify(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function extractText(xmlFragment) {
  const runRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let text = "";
  let m;
  while ((m = runRe.exec(xmlFragment)) !== null) text += m[1];
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function forEachBlock(xml, tagName, cb) {
  const re = new RegExp(`<w:${tagName}(?:\\s[^>]*)?>[\\s\\S]*?<\\/w:${tagName}>`, "g");
  let m;
  while ((m = re.exec(xml)) !== null) {
    cb(m[0], m.index, m.index + m[0].length);
  }
}

/** Returns [{key,label,style}] detected in the template. */
function detectFields(buffer) {
  const zip = new PizZip(buffer);
  const xml = zip.file("word/document.xml").asText();
  const fields = [];
  const seen = new Set();

  function add(label, style) {
    label = label.trim();
    const key = slugify(label);
    if (key && !seen.has(key)) {
      seen.add(key);
      fields.push({ key, label, style });
    }
  }

  // tag-style, anywhere in the body
  let m;
  const tagRe = new RegExp(TAG_RE.source, "g");
  while ((m = tagRe.exec(xml)) !== null) add(m[1], "tag");

  // label-style paragraphs (top-level and inside table cells alike -
  // scanning all <w:p> blocks covers both since cells contain paragraphs)
  forEachBlock(xml, "p", (pXml) => {
    const text = extractText(pXml).trim();
    if (!text || text.includes("{{")) return;
    const labelMatch = text.match(LABEL_RE);
    if (labelMatch) add(labelMatch[1], "label");
  });

  // label-style in tables: "Label:" cell followed by an empty cell
  forEachBlock(xml, "tbl", (tblXml) => {
    forEachBlock(tblXml, "tr", (trXml) => {
      const cells = [];
      forEachBlock(trXml, "tc", (tcXml) => cells.push(extractText(tcXml).trim()));
      for (let i = 0; i < cells.length - 1; i++) {
        if (cells[i].endsWith(":") && !cells[i + 1] && cells[i].length > 1) {
          add(cells[i].slice(0, -1).trim(), "label");
        }
      }
    });
  });

  return fields;
}

/** Replaces the first <w:t> in a paragraph/cell fragment with newText, clears the rest. */
function setFirstRunText(xmlFragment, newText) {
  const escaped = String(newText)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const runRe = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/;
  const match = xmlFragment.match(runRe);
  if (!match) return xmlFragment; // no run to write into - leave untouched
  let out = xmlFragment.replace(runRe, `<w:t$1>${escaped}</w:t>`);
  // blank out any further runs in this fragment so old text doesn't linger
  let firstDone = false;
  out = out.replace(/<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g, (whole, attrs, inner) => {
    if (!firstDone) {
      firstDone = true;
      return whole;
    }
    return `<w:t${attrs || ""}></w:t>`;
  });
  return out;
}

/** Second pass: fills label-style placeholders directly in the XML (post docxtemplater render). */
function fillLabelStyle(xml, data) {
  // paragraphs: "Label:" -> "Label: value"
  const pMatches = [];
  forEachBlock(xml, "p", (pXml, start, end) => {
    const text = extractText(pXml).trim();
    if (!text || text.includes("{{")) return;
    const labelMatch = text.match(LABEL_RE);
    if (!labelMatch) return;
    const label = labelMatch[1].trim();
    const key = slugify(label);
    const entry = data[key];
    if (entry && entry.value !== null && entry.value !== "") {
      const filled = setFirstRunText(pXml, `${label}: ${entry.value}`);
      pMatches.push([start, end, filled]);
    }
  });
  for (let i = pMatches.length - 1; i >= 0; i--) {
    const [start, end, filled] = pMatches[i];
    xml = xml.slice(0, start) + filled + xml.slice(end);
  }

  // tables: "Label:" cell + empty next cell -> fill the empty cell
  const tblReplacements = [];
  forEachBlock(xml, "tbl", (tblXml, tblStart) => {
    forEachBlock(tblXml, "tr", (trXml, trStartRel) => {
      const cellSpans = [];
      forEachBlock(trXml, "tc", (tcXml, tcStartRel, tcEndRel) => {
        cellSpans.push({ xml: tcXml, start: tcStartRel, end: tcEndRel, text: extractText(tcXml).trim() });
      });
      for (let i = 0; i < cellSpans.length - 1; i++) {
        const label = cellSpans[i].text;
        if (!label.endsWith(":") || label.length <= 1 || cellSpans[i + 1].text) continue;
        const key = slugify(label.slice(0, -1));
        const entry = data[key];
        if (!entry || entry.value === null || entry.value === "") continue;
        const filledCell = setFirstRunText(cellSpans[i + 1].xml, String(entry.value));
        const absoluteStart = tblStart + trStartRel + cellSpans[i + 1].start;
        const absoluteEnd = tblStart + trStartRel + cellSpans[i + 1].end;
        tblReplacements.push([absoluteStart, absoluteEnd, filledCell]);
      }
    });
  });
  for (let i = tblReplacements.length - 1; i >= 0; i--) {
    const [start, end, filled] = tblReplacements[i];
    xml = xml.slice(0, start) + filled + xml.slice(end);
  }

  return xml;
}

/**
 * data is { field_key: { value, source } } (the report's mergedData shape).
 * Returns a Buffer of the filled .docx.
 */
function fillTemplate(templateBuffer, data) {
  const zip = new PizZip(templateBuffer);

  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
    parser: (tag) => ({
      get: () => {
        const entry = data[slugify(tag)];
        return entry && entry.value !== null && entry.value !== undefined ? entry.value : "";
      },
    }),
  });
  doc.render();
  const afterTags = doc.getZip();

  // second pass for label-style fields, operating on the rendered XML
  const renderedXml = afterTags.file("word/document.xml").asText();
  const finalXml = fillLabelStyle(renderedXml, data);
  afterTags.file("word/document.xml", finalXml);

  return afterTags.generate({ type: "nodebuffer" });
}

module.exports = { detectFields, fillTemplate, slugify };
