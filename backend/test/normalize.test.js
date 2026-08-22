const assert = require("node:assert/strict");
const test = require("node:test");
const vocabulary = require("../../shared/symptomVocabulary.json");
const { normalizePatientData } = require("../utils/normalize");

test("symptoms_encoded follows the shared model vocabulary", () => {
  const normalized = normalizePatientData({
    vitals: {},
    labs: {},
    symptoms: ["fatigue", "polyuria", "blurred_and_distorted_vision"],
  });

  assert.equal(normalized.symptoms_encoded.length, 132);
  assert.equal(normalized.symptoms_encoded[vocabulary.indexOf("fatigue")], 1);
  assert.equal(normalized.symptoms_encoded[vocabulary.indexOf("polyuria")], 1);
  assert.equal(normalized.symptoms_encoded[vocabulary.indexOf("blurred_and_distorted_vision")], 1);
  assert.equal(normalized.symptoms_encoded[vocabulary.indexOf("chest_pain")], 0);
});
