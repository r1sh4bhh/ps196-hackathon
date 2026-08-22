// Display-only number formatting. Nothing here may be fed back into a
// computation: rounding is applied at the point of rendering so the stored
// values (and any logic derived from them) stay at full precision.

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
