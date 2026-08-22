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

  it("recognizes inverted chest pain phrasing", () => {
    const result = ruleBasedParser.parse("peeing a lot more, feeling pain in my chest");
    expect(result.matched.map(({ symptom }) => symptom)).toEqual(["polyuria", "chest_pain"]);
  });

  it("recognizes other inverted chest pain variants", () => {
    expect(ruleBasedParser.parse("pain in the chest").matched.map(({ symptom }) => symptom)).toEqual([
      "chest_pain",
    ]);
    expect(
      ruleBasedParser.parse("I'm hurting in my chest").matched.map(({ symptom }) => symptom)
    ).toEqual(["chest_pain"]);
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

  describe("inverted phrasing generalisation", () => {
    it("maps '<sensation> in (my|the) <part>' to the canonical term", () => {
      expect(
        ruleBasedParser.parse("pain in my chest").matched.map(({ symptom }) => symptom)
      ).toEqual(["chest_pain"]);
      expect(
        ruleBasedParser.parse("pain in my stomach").matched.map(({ symptom }) => symptom)
      ).toEqual(["stomach_pain"]);
      expect(
        ruleBasedParser.parse("pain in my belly").matched.map(({ symptom }) => symptom)
      ).toEqual(["belly_pain"]);
      expect(
        ruleBasedParser.parse("ache in the back").matched.map(({ symptom }) => symptom)
      ).toEqual(["back_pain"]);
      expect(
        ruleBasedParser.parse("pain in my neck").matched.map(({ symptom }) => symptom)
      ).toEqual(["neck_pain"]);
      expect(
        ruleBasedParser.parse("pain in my joints").matched.map(({ symptom }) => symptom)
      ).toEqual(["joint_pain"]);
      expect(
        ruleBasedParser.parse("pain in my knee").matched.map(({ symptom }) => symptom)
      ).toEqual(["knee_pain"]);
      expect(
        ruleBasedParser.parse("pain in my hip").matched.map(({ symptom }) => symptom)
      ).toEqual(["hip_joint_pain"]);
      expect(
        ruleBasedParser.parse("pain in my muscles").matched.map(({ symptom }) => symptom)
      ).toEqual(["muscle_pain"]);
      expect(
        ruleBasedParser.parse("pain behind my eyes").matched.map(({ symptom }) => symptom)
      ).toEqual(["pain_behind_the_eyes"]);
      expect(
        ruleBasedParser.parse("pain in my head").matched.map(({ symptom }) => symptom)
      ).toEqual(["headache"]);
    });

    it("maps '(my|the) <part> (hurts|aches|...)' to the canonical term", () => {
      expect(
        ruleBasedParser.parse("my chest hurts").matched.map(({ symptom }) => symptom)
      ).toEqual(["chest_pain"]);
      expect(
        ruleBasedParser.parse("my stomach hurts").matched.map(({ symptom }) => symptom)
      ).toEqual(["stomach_pain"]);
      expect(
        ruleBasedParser.parse("my back hurts").matched.map(({ symptom }) => symptom)
      ).toEqual(["back_pain"]);
      expect(
        ruleBasedParser.parse("muscles ache").matched.map(({ symptom }) => symptom)
      ).toEqual(["muscle_pain"]);
      expect(
        ruleBasedParser.parse("stomach is aching").matched.map(({ symptom }) => symptom)
      ).toEqual(["stomach_pain"]);
      expect(
        ruleBasedParser.parse("my head hurts").matched.map(({ symptom }) => symptom)
      ).toEqual(["headache"]);
    });

    it("does not invent a term for a body part outside the frozen vocabulary", () => {
      const result = ruleBasedParser.parse("pain in my elbow");
      expect(result.matched).toEqual([]);
      expect(result.ambiguous).toEqual([]);
      expect(result.unmatched).toEqual(["pain in my elbow"]);
    });

    it("routes a genuinely ambiguous rewrite through the ambiguous channel", () => {
      const stomachOrAbdominal = ruleBasedParser.parse("pain in my abdomen");
      expect(stomachOrAbdominal.matched).toEqual([]);
      expect(stomachOrAbdominal.ambiguous).toEqual([
        { matchedText: "abdomen", candidates: ["stomach_pain", "abdominal_pain"] },
      ]);

      const stomachOrBelly = ruleBasedParser.parse("pain in my tummy");
      expect(stomachOrBelly.matched).toEqual([]);
      expect(stomachOrBelly.ambiguous).toEqual([
        { matchedText: "tummy", candidates: ["stomach_pain", "belly_pain"] },
      ]);
    });

    it("still matches the existing forward synonym phrases", () => {
      expect(
        ruleBasedParser.parse("chest pain").matched.map(({ symptom }) => symptom)
      ).toEqual(["chest_pain"]);
      expect(
        ruleBasedParser.parse("chest tightness").matched.map(({ symptom }) => symptom)
      ).toEqual(["chest_pain"]);
    });
  });

  describe("filler-word tolerance", () => {
    it("strips common lead-in fillers before matching", () => {
      expect(
        ruleBasedParser
          .parse("I've got some really bad chest pain")
          .matched.map(({ symptom }) => symptom)
      ).toEqual(["chest_pain"]);
      expect(
        ruleBasedParser
          .parse("I am experiencing lots of fatigue")
          .matched.map(({ symptom }) => symptom)
      ).toEqual(["fatigue"]);
    });

    it("still negates when fillers precede the symptom", () => {
      const notChestPain = ruleBasedParser.parse("not feeling any chest pain");
      expect(notChestPain.matched).toEqual([]);
      expect(notChestPain.negated.map(({ symptom }) => symptom)).toEqual(["chest_pain"]);

      const deniesStomachPain = ruleBasedParser.parse("denies having stomach pain");
      expect(deniesStomachPain.matched).toEqual([]);
      expect(deniesStomachPain.negated.map(({ symptom }) => symptom)).toEqual(["stomach_pain"]);
    });
  });

  describe("verification scenarios", () => {
    it("recognizes polyuria and chest pain together", () => {
      const result = ruleBasedParser.parse(
        "peeing a lot more, feeling pain in my chest"
      );
      expect(result.matched.map(({ symptom }) => symptom)).toEqual([
        "polyuria",
        "chest_pain",
      ]);
      expect(result.unmatched).toEqual([]);
    });

    it("recognizes back pain and fatigue together", () => {
      const result = ruleBasedParser.parse("my back hurts and I'm feeling really tired");
      const matched = result.matched.map(({ symptom }) => symptom);
      expect(matched).toContain("back_pain");
      expect(matched).toContain("fatigue");
    });
  });
});
