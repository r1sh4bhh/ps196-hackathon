const STORAGE_KEY = "ps196_assessment_history";
const SCHEMA_VERSION = 1;
const MAX_ASSESSMENTS_PER_PATIENT = 100;

const MIGRATIONS = {
  // Add migrations here when SCHEMA_VERSION is bumped.
};

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadRepository() {
  try {
    const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
    if (!parsed) {
      return [];
    }

    const repository = Array.isArray(parsed) ? { schemaVersion: 0, assessments: parsed } : parsed;
    if (!Array.isArray(repository.assessments)) {
      return [];
    }

    let migrated = repository;
    let version = typeof migrated.schemaVersion === "number" ? migrated.schemaVersion : 0;
    while (version < SCHEMA_VERSION && MIGRATIONS[version]) {
      migrated = MIGRATIONS[version](migrated);
      version += 1;
    }

    return migrated.assessments;
  } catch {
    return [];
  }
}

function persist(assessments) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        assessments,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function saveAssessment(record) {
  const assessment = {
    id: record?.id || createId(),
    timestamp: record?.timestamp || new Date().toISOString(),
    patientId: record?.patientId,
    patientData: record?.patientData || null,
    prediction: selectPrediction(record?.prediction),
    baselines: record?.baselines || {},
    isDemo: record?.isDemo === true,
  };
  const assessments = loadRepository().filter((entry) => entry.id !== assessment.id);
  assessments.push(assessment);

  const capped = capAssessments(assessments);
  return persist(capped) ? assessment : null;
}

export function listAssessments(patientId) {
  return loadRepository()
    .filter((assessment) => assessment.patientId === patientId)
    .sort((first, second) => String(first.timestamp).localeCompare(String(second.timestamp)));
}

export function getMetricHistory(patientId, metric) {
  return listAssessments(patientId)
    .map((assessment) => ({
      value: getMetricValue(assessment.patientData, metric),
      timestamp: assessment.timestamp,
    }))
    .filter((entry) => entry.value !== null);
}

export function latestAssessment(patientId) {
  const assessments = listAssessments(patientId);
  return assessments.length ? assessments[assessments.length - 1] : null;
}

export function removeAssessment(id) {
  const assessments = loadRepository();
  const nextAssessments = assessments.filter((assessment) => assessment.id !== id);
  return nextAssessments.length === assessments.length ? false : persist(nextAssessments);
}

export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage access is best-effort.
  }
}

export function exportHistory() {
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, assessments: loadRepository() }, null, 2);
}

export function importHistory(json) {
  const parsed = safeParse(json);
  const assessments = Array.isArray(parsed) ? parsed : parsed?.assessments;
  if (!Array.isArray(assessments)) {
    return false;
  }
  return persist(capAssessments(assessments));
}

function selectPrediction(prediction) {
  return {
    risk_scores: prediction?.risk_scores || {},
    top_disease: prediction?.top_disease || null,
    confidence: prediction?.confidence ?? null,
    evidence: prediction?.evidence || [],
    next_test: prediction?.next_test || prediction?.evidence?.[0]?.next_test || null,
  };
}

function capAssessments(assessments) {
  const byPatient = new Map();
  for (const assessment of assessments) {
    const patientAssessments = byPatient.get(assessment.patientId) || [];
    patientAssessments.push(assessment);
    byPatient.set(assessment.patientId, patientAssessments);
  }

  return [...byPatient.values()].flatMap((patientAssessments) =>
    patientAssessments
      .sort((first, second) => String(first.timestamp).localeCompare(String(second.timestamp)))
      .slice(-MAX_ASSESSMENTS_PER_PATIENT)
  );
}

function getMetricValue(patientData, metric) {
  if (metric === "bmi") {
    const directBmi = toNumber(patientData?.vitals?.bmi);
    if (directBmi !== null) {
      return directBmi;
    }
    const weight = toNumber(patientData?.vitals?.weight_kg);
    const height = toNumber(patientData?.vitals?.height_cm);
    return weight !== null && height !== null && height > 0
      ? weight / Math.pow(height / 100, 2)
      : null;
  }
  const section = ["glucose", "cholesterol", "triglycerides", "hdl"].includes(metric)
    ? "labs"
    : "vitals";
  return toNumber(patientData?.[section]?.[metric]);
}

function toNumber(value) {
  return value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
    ? null
    : Number(value);
}

function createId() {
  return `assessment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
