import { describe, expect, it } from "vitest";
import { ruleBasedParser } from "../ruleBasedParser";

describe("ruleBasedParser", () => {
  it("maps common lay-language synonyms", () => {
    const result = ruleBasedParser.parse(
      "been really tired, peeing a lot, vision goes blurry, short of breath"
    );

    expect(result.matched.map(({ symptom }) => symptom)).toEqual([
      "fatigue",
      "polyuria",
      "blurred_and_distorted_vision",
      "breathlessness",
    ]);
  });

  it("reports no chest pain as negated", () => {
    const result = ruleBasedParser.parse("no chest pain");
    expect(result.matched).toEqual([]);
    expect(result.negated.map(({ symptom }) => symptom)).toEqual(["chest_pain"]);
  });

  it("stops negation at a clause boundary", () => {
    const result = ruleBasedParser.parse("no fever but really bad fatigue");
    expect(result.negated.map(({ symptom }) => symptom)).toEqual(["high_fever", "mild_fever"]);
    expect(result.matched.map(({ symptom }) => symptom)).toEqual(["fatigue"]);
  });

  it("applies a negation cue to coordinated symptoms", () => {
    const result = ruleBasedParser.parse("denies dizziness or nausea");
    expect(result.matched).toEqual([]);
    expect(result.negated.map(({ symptom }) => symptom)).toEqual(["dizziness", "nausea"]);
  });

  it("does not negate an affirmative symptom", () => {
    const result = ruleBasedParser.parse("I have chest pain");
    expect(result.matched.map(({ symptom }) => symptom)).toEqual(["chest_pain"]);
    expect(result.negated).toEqual([]);
  });

  it("uses conservative fuzzy matching for a close typo", () => {
    const result = ruleBasedParser.parse("dizzines");
    expect(result.matched[0]).toMatchObject({ symptom: "dizziness", method: "fuzzy" });
  });

  it("preserves negation offsets when fuzzy matching punctuation", () => {
    const result = ruleBasedParser.parse("no chest-pain");
    expect(result.matched).toEqual([]);
    expect(result.negated.map(({ symptom }) => symptom)).toEqual(["chest_pain"]);
  });

  it("leaves nonsense and unsupported thirst language unmatched", () => {
    expect(ruleBasedParser.parse("flibbertigibbet").unmatched).toEqual(["flibbertigibbet"]);
    expect(ruleBasedParser.parse("always thirsty").unmatched).toEqual(["always thirsty"]);
    expect(ruleBasedParser.parse("tired and always thirsty").unmatched).toEqual(["always thirsty"]);
  });

  it("does not guess which kind of swelling the user means", () => {
    const result = ruleBasedParser.parse("I have swelling");
    expect(result.matched).toEqual([]);
    expect(result.ambiguous).toEqual([
      {
        matchedText: "swelling",
        candidates: [
          "swelling_of_stomach",
          "swelling_joints",
          "swollen_legs",
          "swollen_extremeties",
        ],
      },
    ]);
  });

  it("parses the verification example", () => {
    const result = ruleBasedParser.parse(
      "been really tired, peeing a lot, vision goes blurry, no chest pain"
    );
    expect(result.matched.map(({ symptom }) => symptom)).toEqual([
      "fatigue",
      "polyuria",
      "blurred_and_distorted_vision",
    ]);
    expect(result.negated.map(({ symptom }) => symptom)).toEqual(["chest_pain"]);
  });
});
