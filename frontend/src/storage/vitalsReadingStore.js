// Per-patient storage for vitals readings and the provider (if any) currently
// connected for that person.
//
// Readings are keyed by patientId, mirroring the per-patientId profile store
// from PR #19: one person's device readings must never surface for another
// person on the same device. Provenance - source, providerId, and the
// simulated flag - is persisted with every reading, so a synthetic value stays
// marked as synthetic permanently, including after the provider is
// disconnected.

import { normalizeStoredReading } from "../vitals/vitalsProvider";

const STORAGE_KEY = "ps196_vitals_readings";
const SCHEMA_VERSION = 1;
const MAX_READINGS_PER_PATIENT = 5000;

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function emptyStore() {
  return { schemaVersion: SCHEMA_VERSION, readings: {}, connections: {} };
}

function loadStore() {
  try {
    const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || typeof parsed !== "object") {
      return emptyStore();
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      readings: parsed.readings && typeof parsed.readings === "object" ? parsed.readings : {},
      connections:
        parsed.connections && typeof parsed.connections === "object" ? parsed.connections : {},
    };
  } catch {
    return emptyStore();
  }
}

function persist(store) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...store,
        schemaVersion: SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
      })
    );
    return true;
  } catch {
    return false;
  }
}

function readingKey(reading) {
  return `${reading.providerId}|${reading.metric}|${reading.measuredAt}`;
}

// Returns this person's readings, oldest first. Legacy entries with no source
// recorded are normalized to manual, never guessed as device data.
export function listReadings(patientId) {
  if (!patientId) {
    return [];
  }
  const stored = loadStore().readings[patientId];
  return (Array.isArray(stored) ? stored : [])
    .map(normalizeStoredReading)
    .filter(Boolean)
    .sort((first, second) => first.measuredAt.localeCompare(second.measuredAt));
}

// Appends readings for one person, ignoring anything that does not satisfy the
// reading contract and de-duplicating repeated syncs of the same window.
export function saveReadings(patientId, readings) {
  if (!patientId || !Array.isArray(readings)) {
    return [];
  }

  const store = loadStore();
  const existing = listReadings(patientId);
  const seen = new Set(existing.map(readingKey));
  const accepted = [];

  for (const raw of readings) {
    const reading = normalizeStoredReading(raw);
    if (!reading || seen.has(readingKey(reading))) {
      continue;
    }
    seen.add(readingKey(reading));
    accepted.push(reading);
  }

  const merged = [...existing, ...accepted]
    .sort((first, second) => first.measuredAt.localeCompare(second.measuredAt))
    .slice(-MAX_READINGS_PER_PATIENT);

  store.readings[patientId] = merged;
  return persist(store) ? accepted : [];
}

export function getConnectedProviderId(patientId) {
  if (!patientId) {
    return null;
  }
  const connected = loadStore().connections[patientId];
  return typeof connected === "string" && connected !== "" ? connected : null;
}

export function connectProvider(patientId, providerId) {
  if (!patientId || typeof providerId !== "string" || providerId === "") {
    return false;
  }
  const store = loadStore();
  store.connections[patientId] = providerId;
  return persist(store);
}

// Disconnecting stops future syncs. It deliberately does not delete anything
// already recorded: those readings keep their provenance and their simulated
// marking permanently.
export function disconnectProvider(patientId) {
  if (!patientId) {
    return false;
  }
  const store = loadStore();
  delete store.connections[patientId];
  return persist(store);
}

export function clearReadings(patientId) {
  const store = loadStore();
  if (patientId) {
    delete store.readings[patientId];
    persist(store);
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage access is best-effort.
  }
}
