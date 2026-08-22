const STORAGE_KEY = "ps196_patient_records";

export function savePatientRecord(patientData, prediction) {
  const records = getAllPatientRecords();
  records.push({
    patientData,
    prediction,
    savedAt: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function getAllPatientRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getLatestPatientRecord() {
  const records = getAllPatientRecords();
  return records.length ? records[records.length - 1] : null;
}

export function clearPatientRecords() {
  localStorage.removeItem(STORAGE_KEY);
}
