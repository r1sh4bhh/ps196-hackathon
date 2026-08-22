import { toObservation } from "../normalizer";
import { resolveLabKey } from "../../../constants/labAliases";

// Matches lines like:
//   Glucose: 145 mg/dL (70-110)
//   Total Cholesterol - 220 mg/dL
//   HDL 35
const LINE_PATTERN =
  /^\s*([A-Za-z][A-Za-z0-9\s/-]*?)\s*[:-]?\s*([\d]+(?:\.\d+)?)\s*([a-zA-Zµ%/]+)?\s*(?:\(([^)]*)\))?\s*$/;

const DATE_PATTERN = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/;

function sniffDate(text) {
  const match = text.match(DATE_PATTERN);
  return match ? match[1] : null;
}

export function parseText(text, { fileName } = {}) {
  if (typeof text !== "string" || !text.trim()) {
    return [];
  }

  const documentDate = sniffDate(text);
  const lines = text.split(/\r\n|\r|\n/);
  const observations = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const match = trimmed.match(LINE_PATTERN);
    if (!match) {
      continue;
    }

    const [, rawName, value, unit, refRange] = match;

    if (!resolveLabKey(rawName)) {
      continue;
    }

    observations.push(
      toObservation({
        rawName,
        value,
        unit,
        refRange: refRange || undefined,
        observedAt: documentDate || undefined,
        fileName,
        parser: "text",
      })
    );
  }

  return observations;
}
