// Canonical, ordered list of symptoms recognized across the app.
//
// IMPORTANT: this array MUST stay in lockstep — same items, same order — with
// `KNOWN_SYMPTOMS` in `backend/utils/normalize.js`. The backend encodes
// symptoms as a positional one-hot array (`symptoms_encoded`) before sending
// it to the ML module, so if the two lists ever drift apart, symptoms will be
// silently misencoded or dropped from the model input. If you add, remove, or
// reorder a symptom here, make the same change in `backend/utils/normalize.js`.
export const CANONICAL_SYMPTOMS = [
  "fatigue",
  "frequent_urination",
  "blurred_vision",
  "chest_pain",
  "shortness_of_breath",
  "headache",
  "dizziness",
  "weight_loss",
  "nausea",
  "swelling",
];

export const SYMPTOM_LABELS = CANONICAL_SYMPTOMS.reduce((labels, symptom) => {
  labels[symptom] = symptom.replace(/_/g, " ");
  return labels;
}, {});

export function isKnownSymptom(symptom) {
  return CANONICAL_SYMPTOMS.includes(symptom);
}
