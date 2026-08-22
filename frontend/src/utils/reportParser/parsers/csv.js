import { toObservation } from "../normalizer";

const HEADER_ALIASES = {
  name: ["test", "test name", "name", "parameter", "analyte"],
  value: ["value", "result", "reading"],
  unit: ["unit", "units"],
  refRange: ["reference range", "ref range", "reference", "normal range", "range"],
  date: ["date", "collected", "collected on", "observed at", "observed_at"],
};

function detectDelimiter(headerLine) {
  const tabCount = (headerLine.match(/\t/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  return tabCount > commaCount ? "\t" : ",";
}

// Splits a single delimited line, respecting double-quoted cells that may
// contain the delimiter.
function splitLine(line, delimiter) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function mapHeaderIndex(headers) {
  const map = {};

  headers.forEach((header, index) => {
    const normalized = header.trim().toLowerCase();
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(normalized) && map[field] === undefined) {
        map[field] = index;
      }
    }
  });

  return map;
}

export function parseCsv(text, { fileName } = {}) {
  if (typeof text !== "string" || !text.trim()) {
    return [];
  }

  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter);
  const columns = mapHeaderIndex(headers);

  if (columns.name === undefined || columns.value === undefined) {
    return [];
  }

  const observations = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitLine(lines[i], delimiter);
    const rawName = cells[columns.name];
    const value = cells[columns.value];

    if (!rawName || value === undefined || value === "") {
      continue;
    }

    observations.push(
      toObservation({
        rawName,
        value,
        unit: columns.unit !== undefined ? cells[columns.unit] : undefined,
        refRange: columns.refRange !== undefined ? cells[columns.refRange] : undefined,
        observedAt: columns.date !== undefined ? cells[columns.date] : undefined,
        fileName,
        parser: "csv",
      })
    );
  }

  return observations;
}
