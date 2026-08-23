// Display-only formatting. Nothing here may be fed back into a computation:
// rounding and re-casing are applied at the point of rendering so the stored
// values (and any logic derived from them) stay at full precision.

// Renders a raw option value ("moderately_active") as a display label
// ("Moderately active"). Sentence case, not Title Case, matching how
// SYMPTOM_LABELS is written. Any option whose label needs an acronym or a
// proper noun must carry an explicit `optionLabels` entry -- callers use that
// verbatim and never pass it through here.
export function formatOptionLabel(option) {
  const text = String(option ?? "")
    .replace(/_/g, " ")
    .trim();

  if (!text) {
    return "";
  }

  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function formatNumber(value, maxDecimals = 1) {
  const numeric = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(numeric)) {
    return null;
  }
  // Number() strips a trailing ".0" so whole numbers stay "135", not "135.0".
  return String(Number(numeric.toFixed(maxDecimals)));
}

export function formatMeasurement(value, unit, maxDecimals = 1) {
  const formatted = formatNumber(value, maxDecimals);
  if (formatted === null) {
    return "—";
  }
  return `${formatted} ${unit || ""}`.trim();
}
