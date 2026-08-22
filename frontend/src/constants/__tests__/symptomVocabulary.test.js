import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";
import { CANONICAL_SYMPTOMS, SYMPTOM_LABELS } from "../symptomVocabulary";

describe("symptom vocabulary", () => {
  it("matches MODEL_A_SYMPTOMS exactly and in frozen order", () => {
    const featureSpecPath = path.resolve(process.cwd(), "../ml/feature_spec.py");
    const source = fs.readFileSync(featureSpecPath, "utf8");
    const tuple = source.match(/MODEL_A_SYMPTOMS[^=]*=\s*\(([\s\S]*?)\n\)/);

    expect(tuple, "Could not find MODEL_A_SYMPTOMS in ml/feature_spec.py").not.toBeNull();
    const modelSymptoms = [...tuple[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);

    expect(CANONICAL_SYMPTOMS).toEqual(modelSymptoms);
    expect(CANONICAL_SYMPTOMS).toHaveLength(132);
    expect(SYMPTOM_LABELS.blurred_and_distorted_vision).toBe("Blurred or distorted vision");
    expect(SYMPTOM_LABELS.polyuria).toBe("Passing urine very often");
    expect(SYMPTOM_LABELS.chest_pain).toBe("Chest pain");
    expect(SYMPTOM_LABELS.back_pain).toBe("Back pain");
  });
});
