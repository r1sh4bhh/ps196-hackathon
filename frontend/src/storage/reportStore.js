const REPORTS_KEY = "ps196_reports";
const DB_NAME = "ps196";
const DB_VERSION = 1;
const STORE_NAME = "report_blobs";

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readReports() {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    const parsed = raw ? safeParse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeReports(reports) {
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    return true;
  } catch {
    return false;
  }
}

function isIndexedDbAvailable() {
  return typeof indexedDB !== "undefined";
}

function openDb() {
  if (!isIndexedDbAvailable()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function putBlob(id, blob) {
  const db = await openDb();
  if (!db || !blob) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(blob, id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function deleteBlob(id) {
  const db = await openDb();
  if (!db) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

// Persists report metadata + parsed observations to localStorage, and the
// raw file blob to IndexedDB (best-effort). If IndexedDB is unavailable the
// metadata is still saved — only the raw blob is skipped.
export async function saveReport(report, blob) {
  const reports = readReports();
  const record = {
    id: report.id,
    fileName: report.fileName,
    size: report.size ?? null,
    type: report.type ?? null,
    uploadedAt: report.uploadedAt || new Date().toISOString(),
    observations: report.observations || [],
    hasBlob: false,
  };

  if (blob) {
    record.hasBlob = await putBlob(record.id, blob);
  }

  const next = [...reports.filter((existing) => existing.id !== record.id), record];
  writeReports(next);
  return record;
}

export function listReports() {
  return readReports();
}

export async function getBlob(id) {
  const db = await openDb();
  if (!db) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function removeReport(id) {
  const reports = readReports();
  writeReports(reports.filter((report) => report.id !== id));
  await deleteBlob(id);
}

export function clearReports() {
  const reports = readReports();
  writeReports([]);
  reports.forEach((report) => {
    deleteBlob(report.id);
  });
}

export function allObservations() {
  return readReports().flatMap((report) => report.observations || []);
}
