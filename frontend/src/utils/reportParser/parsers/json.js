import { toObservation } from "../normalizer";

const NAME_KEYS = ["testName", "test_name", "name", "test", "parameter", "analyte"];
const VALUE_KEYS = ["value", "result", "reading"];
const UNIT_KEYS = ["unit", "units"];
const RANGE_KEYS = ["refRange", "ref_range", "referenceRange", "range"];
const DATE_KEYS = ["date", "observedAt", "observed_at", "collectedAt"];

function firstDefined(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }
  return undefined;
}

function entryToObservation(entry, fileName) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const rawName = firstDefined(entry, NAME_KEYS);
  const value = firstDefined(entry, VALUE_KEYS);

  if (rawName === undefined || value === undefined) {
    return null;
  }

  return toObservation({
    rawName,
    value,
    unit: firstDefined(entry, UNIT_KEYS),
    refRange: firstDefined(entry, RANGE_KEYS),
    observedAt: firstDefined(entry, DATE_KEYS),
    fileName,
    parser: "json",
  });
}

export function parseJson(text, { fileName } = {}) {
  if (typeof text !== "string" || !text.trim()) {
    return [];
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }

  if (!data) {
    return [];
  }

  const list = Array.isArray(data)
    ? data
    : Array.isArray(data.results)
      ? data.results
      : Array.isArray(data.tests)
        ? data.tests
        : null;

  if (list) {
    return list.map((entry) => entryToObservation(entry, fileName)).filter(Boolean);
  }

  if (typeof data === "object") {
    // Flat object shape, e.g. { glucose: 145, cholesterol: 220 }.
    return Object.entries(data)
      .filter(([, value]) => typeof value === "number" || typeof value === "string")
      .map(([rawName, value]) => toObservation({ rawName, value, fileName, parser: "json" }));
  }

  return [];
}
