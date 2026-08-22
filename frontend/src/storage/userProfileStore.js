const LEGACY_PROFILE_KEY = "ps196_user_profile";
const PROFILES_KEY = "ps196_user_profiles";
const DRAFT_KEY = "ps196_onboarding_draft";
const SCHEMA_VERSION = 1;

// Add an entry here whenever SCHEMA_VERSION is bumped. Each migration takes
// the previous shape and returns the next one; they are applied in order
// starting from the stored `schemaVersion` up to SCHEMA_VERSION.
const MIGRATIONS = {
  // Example: 1: (profile) => ({ ...profile, newField: null }),
};

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function runMigrations(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  let migrated = record;
  let version = typeof migrated.schemaVersion === "number" ? migrated.schemaVersion : 0;

  while (version < SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) {
      break;
    }
    migrated = migrate(migrated);
    version += 1;
  }

  return { ...migrated, schemaVersion: SCHEMA_VERSION };
}

function emptyStore() {
  return { profiles: {}, activePatientId: null };
}

// Multiple people (e.g. family members) can share one device. Every saved
// profile is keyed by patientId under a single store, with an
// `activePatientId` pointer to whoever was used most recently. Legacy
// installs that only ever had one profile under `ps196_user_profile` are
// migrated into this shape the first time they're read.
function loadStore() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) {
      const parsed = safeParse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        parsed.profiles &&
        typeof parsed.profiles === "object"
      ) {
        return {
          profiles: { ...parsed.profiles },
          activePatientId: parsed.activePatientId ?? null,
        };
      }
      // Malformed store data: degrade to empty rather than throwing or
      // submitting partial data downstream.
      return emptyStore();
    }

    const legacyRaw = localStorage.getItem(LEGACY_PROFILE_KEY);
    if (legacyRaw) {
      const legacyProfile = runMigrations(safeParse(legacyRaw));
      if (legacyProfile && legacyProfile.patientId) {
        const migratedStore = {
          profiles: { [legacyProfile.patientId]: legacyProfile },
          activePatientId: legacyProfile.patientId,
        };
        persistStore(migratedStore);
        try {
          localStorage.removeItem(LEGACY_PROFILE_KEY);
        } catch {
          // Best-effort cleanup only; the new store is already authoritative.
        }
        return migratedStore;
      }
    }

    return emptyStore();
  } catch {
    return emptyStore();
  }
}

function persistStore(store) {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

// Saves (creates or updates) a profile keyed by its patientId and makes it
// the active person unless `setActive: false` is passed explicitly.
export function saveProfile(profile, { setActive = true } = {}) {
  if (!profile || !profile.patientId) {
    return null;
  }

  const store = loadStore();
  const record = {
    ...profile,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };

  store.profiles[record.patientId] = record;
  if (setActive || !store.activePatientId) {
    store.activePatientId = record.patientId;
  }

  return persistStore(store) ? record : null;
}

// Loads a specific person's profile, or the active person's profile when no
// patientId is given.
export function loadProfile(patientId) {
  const store = loadStore();
  const id = patientId ?? store.activePatientId;
  if (!id) {
    return null;
  }
  return runMigrations(store.profiles[id]);
}

export function hasProfile(patientId) {
  return loadProfile(patientId) !== null;
}

// Lists every saved person on this device, most recently updated first.
export function listProfiles() {
  const store = loadStore();
  return Object.values(store.profiles)
    .map((record) => runMigrations(record))
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function getActivePatientId() {
  return loadStore().activePatientId;
}

// Explicitly switches which saved person is "active" (used when a returning
// patient or a clinician picks a different saved person).
export function setActivePatientId(patientId) {
  const store = loadStore();
  if (!store.profiles[patientId]) {
    return false;
  }
  store.activePatientId = patientId;
  return persistStore(store);
}

// With a patientId: removes just that person. Without one: wipes every
// saved profile (used by "redo onboarding").
export function clearProfile(patientId) {
  if (patientId) {
    const store = loadStore();
    delete store.profiles[patientId];
    if (store.activePatientId === patientId) {
      const remaining = Object.keys(store.profiles);
      store.activePatientId = remaining[0] ?? null;
    }
    persistStore(store);
    return;
  }

  try {
    localStorage.removeItem(PROFILES_KEY);
    localStorage.removeItem(LEGACY_PROFILE_KEY);
  } catch {
    // Ignore storage errors on clear.
  }
}

export function exportProfile(patientId) {
  const profile = loadProfile(patientId);
  return profile ? JSON.stringify(profile, null, 2) : null;
}

export function importProfile(json) {
  const parsed = safeParse(json);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  return saveProfile(parsed);
}

export function saveDraft(draft) {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() })
    );
    return true;
  } catch {
    return false;
  }
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? safeParse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore storage errors on clear.
  }
}
