const PROFILE_KEY = "ps196_user_profile";
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

export function saveProfile(profile) {
  const record = {
    ...profile,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(record));
    return record;
  } catch {
    return null;
  }
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) {
      return null;
    }
    return runMigrations(safeParse(raw));
  } catch {
    return null;
  }
}

export function hasProfile() {
  return loadProfile() !== null;
}

export function clearProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    // Ignore storage errors on clear.
  }
}

export function exportProfile() {
  const profile = loadProfile();
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
