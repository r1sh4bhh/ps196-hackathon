const DAY_MS = 24 * 60 * 60 * 1000;

function ageInDays(measuredAt, currentTime) {
  return Math.max(0, Math.floor((currentTime - measuredAt) / DAY_MS));
}

// Glucose is a point-in-time measurement, so it is useful for about a week.
// Stable lipid panels are conventionally repeated annually, so those results
// remain useful for roughly 12 months.
export const LAB_FRESHNESS_DAYS = Object.freeze({
  glucose: 7,
  cholesterol: 365,
  triglycerides: 365,
  hdl: 365,
});

export function getStoredLabStatus(labKey, record, now = new Date()) {
  const measuredAt = Date.parse(record?.recordedAt);
  const currentTime = new Date(now).getTime();
  const value = Number(record?.value);
  const freshnessDays = LAB_FRESHNESS_DAYS[labKey];

  if (
    !Number.isFinite(value) ||
    !Number.isFinite(measuredAt) ||
    !Number.isFinite(currentTime) ||
    freshnessDays === undefined
  ) {
    return null;
  }

  const ageDays = ageInDays(measuredAt, currentTime);
  return {
    value,
    recordedAt: new Date(measuredAt).toISOString(),
    ageDays,
    isFresh: currentTime - measuredAt <= freshnessDays * DAY_MS,
  };
}

export function formatStoredLabAge(record, now = new Date()) {
  const measuredAt = Date.parse(record?.recordedAt);
  const currentTime = new Date(now).getTime();
  if (!Number.isFinite(measuredAt) || !Number.isFinite(currentTime)) {
    return "";
  }

  const ageDays = ageInDays(measuredAt, currentTime);
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(measuredAt));
  const age = ageDays === 0 ? "today" : `${ageDays} day${ageDays === 1 ? "" : "s"} ago`;
  return `from ${date} (${age})`;
}
