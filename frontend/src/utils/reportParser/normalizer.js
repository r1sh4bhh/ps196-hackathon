import { LAB_DEFINITIONS, resolveLabKey } from "../../constants/labAliases";
import { convertToCanonical } from "./units";

const CONFIDENCE_THRESHOLD = 0.5;

// Builds a provenance-carrying observation from a raw parsed value. This
// function must never throw — malformed input should degrade to a
// `needs_review` observation instead of crashing the upload flow.
export function toObservation({
  rawName,
  value,
  unit,
  refRange,
  observedAt,
  fileName,
  parser,
} = {}) {
  try {
    const safeRawName = typeof rawName === "string" ? rawName : String(rawName ?? "");
    const key = resolveLabKey(safeRawName);
    let confidence = 1;
    let status = "parsed";

    if (!key) {
      return {
        key: null,
        rawName: safeRawName,
        value: coerceValue(value),
        unit: unit || null,
        refRange: refRange || null,
        observedAt: observedAt || null,
        source: { fileName: fileName || null, parser: parser || null, confidence: 0.2 },
        status: "needs_review",
      };
    }

    const {
      value: convertedValue,
      unit: resolvedUnit,
      converted,
    } = convertToCanonical(key, value, unit);

    if (convertedValue === null) {
      return {
        key,
        rawName: safeRawName,
        value: null,
        unit: unit || null,
        refRange: refRange || null,
        observedAt: observedAt || null,
        source: { fileName: fileName || null, parser: parser || null, confidence: 0.2 },
        status: "needs_review",
      };
    }

    if (!unit) {
      confidence -= 0.3;
    } else if (
      !converted &&
      resolvedUnit &&
      normalizeLoose(unit) !== normalizeLoose(resolvedUnit)
    ) {
      confidence -= 0.3;
    }

    const definition = LAB_DEFINITIONS[key];
    if (definition && (convertedValue < definition.min || convertedValue > definition.max)) {
      confidence = Math.min(confidence, 0.3);
    }

    confidence = Math.max(0, Math.min(1, Math.round(confidence * 100) / 100));

    if (confidence < CONFIDENCE_THRESHOLD) {
      status = "needs_review";
    }

    return {
      key,
      rawName: safeRawName,
      value: convertedValue,
      unit: resolvedUnit || unit || (definition ? definition.unit : null),
      refRange: refRange || null,
      observedAt: observedAt || null,
      source: { fileName: fileName || null, parser: parser || null, confidence },
      status,
    };
  } catch {
    return {
      key: null,
      rawName: typeof rawName === "string" ? rawName : "",
      value: null,
      unit: null,
      refRange: null,
      observedAt: null,
      source: { fileName: fileName || null, parser: parser || null, confidence: 0 },
      status: "needs_review",
    };
  }
}

function coerceValue(value) {
  const numeric = Number(value);
  return Number.isNaN(numeric) || value === null || value === undefined || value === ""
    ? null
    : numeric;
}

function normalizeLoose(unit) {
  return String(unit || "")
    .trim()
    .toLowerCase();
}

// Collapses a list of observations down to the latest accepted value per
// lab key. Only observations with status "parsed" are eligible; everything
// else (needs_review, pending_manual_entry, unresolved keys) is ignored.
export function collapseObservations(observations = []) {
  const latest = {};

  for (const observation of observations || []) {
    if (!observation || observation.status !== "parsed" || !observation.key) {
      continue;
    }

    const existing = latest[observation.key];
    const observedTime = timeOf(observation.observedAt);
    const existingTime = existing ? timeOf(existing.observedAt) : -Infinity;

    if (!existing || observedTime >= existingTime) {
      latest[observation.key] = observation;
    }
  }

  return latest;
}

function timeOf(observedAt) {
  if (!observedAt) {
    return -Infinity;
  }
  const time = new Date(observedAt).getTime();
  return Number.isNaN(time) ? -Infinity : time;
}
