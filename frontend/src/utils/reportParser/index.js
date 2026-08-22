import { parseCsv } from "./parsers/csv";
import { parseJson } from "./parsers/json";
import { parseText } from "./parsers/text";
import { parsePdf } from "./parsers/pdf";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Pluggable parser registry, keyed by lowercased file extension (no dot).
// Each entry is { mode: "text" | "binary", parse(input, context) }.
// - "text" parsers receive the file's text contents as a string.
// - "binary" parsers receive the raw File object.
const registry = new Map();

export function registerParser(ext, definition) {
  if (!ext || !definition || typeof definition.parse !== "function") {
    throw new Error("registerParser requires an extension and a parse function.");
  }

  registry.set(ext.toLowerCase(), definition);
}

export function supportedExtensions() {
  return Array.from(registry.keys());
}

function getExtension(fileName = "") {
  const match = /\.([a-z0-9]+)$/i.exec(fileName);
  return match ? match[1].toLowerCase() : "";
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

// Parses a File/Blob-like object using the registered parser that matches
// its extension. Returns an array of observation-shaped objects (see
// `normalizer.js`). Throws if the file is too large or has no registered
// parser, so callers can surface a clear per-file error status.
export async function parseReportFile(file) {
  if (!file) {
    throw new Error("No file provided.");
  }

  if (typeof file.size === "number" && file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("File exceeds the 10 MB limit.");
  }

  const ext = getExtension(file.name || "");
  const definition = registry.get(ext);

  if (!definition) {
    throw new Error(`Unsupported file type: .${ext || "unknown"}`);
  }

  const fileName = file.name;

  if (definition.mode === "binary") {
    return definition.parse(file, { fileName });
  }

  const text = await readFileAsText(file);
  return definition.parse(text, { fileName });
}

registerParser("csv", { mode: "text", parse: (text, ctx) => parseCsv(text, ctx) });
registerParser("tsv", { mode: "text", parse: (text, ctx) => parseCsv(text, ctx) });
registerParser("json", { mode: "text", parse: (text, ctx) => parseJson(text, ctx) });
registerParser("txt", { mode: "text", parse: (text, ctx) => parseText(text, ctx) });
registerParser("pdf", { mode: "binary", parse: (file, ctx) => parsePdf(file, ctx) });
registerParser("png", { mode: "binary", parse: (file, ctx) => parsePdf(file, ctx) });
registerParser("jpg", { mode: "binary", parse: (file, ctx) => parsePdf(file, ctx) });
registerParser("jpeg", { mode: "binary", parse: (file, ctx) => parsePdf(file, ctx) });
