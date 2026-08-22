// Placeholder parser for PDF (and, by extension, image) reports.
//
// We deliberately do NOT ship an OCR or PDF-text-extraction dependency here —
// the task constraints call for zero new runtime dependencies, and OCR
// requires a real dependency (e.g. pdf.js, tesseract.js) to do anything
// useful. Instead we store the file's metadata/blob and hand back a single
// `pending_manual_entry` observation so the report still shows up in the
// review queue with a clear call to action.
//
// EXTENSION SEAM: a future parser (Python-side OCR service, or an in-browser
// pdf.js/tesseract.js integration) can replace this function's body without
// touching the registry, storage, or UI — it only needs to keep returning an
// array of observation-shaped objects (see `normalizer.js`).
export function parsePdf(file, { fileName } = {}) {
  return [
    {
      key: null,
      rawName: fileName || file?.name || "Uploaded document",
      value: null,
      unit: null,
      refRange: null,
      observedAt: null,
      source: {
        fileName: fileName || file?.name || null,
        parser: "pdf",
        confidence: 0,
      },
      status: "pending_manual_entry",
      note: "OCR not yet available — enter this report's values manually.",
    },
  ];
}
