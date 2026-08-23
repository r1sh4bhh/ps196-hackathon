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

    it("maps '<sensation> in <part>' without a determiner", () => {
      expect(
        ruleBasedParser.parse("pain in chest").matched.map(({ symptom }) => symptom)
      ).toEqual(["chest_pain"]);
      expect(
        ruleBasedParser.parse("pain in stomach").matched.map(({ symptom }) => symptom)
      ).toEqual(["stomach_pain"]);
      expect(
        ruleBasedParser.parse("ache in back").matched.map(({ symptom }) => symptom)
      ).toEqual(["back_pain"]);
      expect(
        ruleBasedParser.parse("discomfort in chest").matched.map(({ symptom }) => symptom)
      ).toEqual(["chest_pain"]);
      expect(
        ruleBasedParser.parse("tightness in chest").matched.map(({ symptom }) => symptom)
      ).toEqual(["chest_pain"]);
    });

    it("maps '<sensation> in <part>' with possessive determiners", () => {
      expect(
        ruleBasedParser.parse("pain in his chest").matched.map(({ symptom }) => symptom)
      ).toEqual(["chest_pain"]);
      expect(
        ruleBasedParser.parse("pain in her stomach").matched.map(({ symptom }) => symptom)
      ).toEqual(["stomach_pain"]);
      expect(
        ruleBasedParser.parse("pain in their back").matched.map(({ symptom }) => symptom)
      ).toEqual(["back_pain"]);
    });

    it("maps 'pain behind eyes' without a determiner", () => {
      expect(
        ruleBasedParser.parse("pain behind eyes").matched.map(({ symptom }) => symptom)
      ).toEqual(["pain_behind_the_eyes"]);
      expect(
        ruleBasedParser.parse("ache behind the eyes").matched.map(({ symptom }) => symptom)
      ).toEqual(["pain_behind_the_eyes"]);
    });

    it("handles the plural form of the sensation word", () => {
      expect(
        ruleBasedParser.parse("chest pains").matched.map(({ symptom }) => symptom)
      ).toEqual(["chest_pain"]);
      expect(
        ruleBasedParser.parse("stomach pains").matched.map(({ symptom }) => symptom)
      ).toEqual(["stomach_pain"]);
    });

    it("still routes 'pain in abdomen' through the ambiguous channel", () => {
      const result = ruleBasedParser.parse("pain in abdomen");
      expect(result.matched).toEqual([]);
      expect(result.ambiguous).toEqual([
        { matchedText: "abdomen", candidates: ["stomach_pain", "abdominal_pain"] },
      ]);
    });

    it("still negates the newly-matching phrasings", () => {
      const noPain = ruleBasedParser.parse("no pain in chest");
      expect(noPain.matched).toEqual([]);
      expect(noPain.negated.map(({ symptom }) => symptom)).toEqual(["chest_pain"]);

      const notHaving = ruleBasedParser.parse("not having pain in chest");
      expect(notHaving.matched).toEqual([]);
      expect(notHaving.negated.map(({ symptom }) => symptom)).toEqual(["chest_pain"]);
    });

    it("does not rewrite 'pain in general' into a symptom", () => {
      const result = ruleBasedParser.parse("pain in general");
      expect(result.matched).toEqual([]);
      expect(result.ambiguous).toEqual([]);
      expect(result.unmatched).toEqual(["pain in general"]);
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

  describe("frequency modifiers and expanded synonyms", () => {
    const matchedSymptoms = (text) =>
      ruleBasedParser.parse(text).matched.map(({ symptom }) => symptom);

    it("treats equivalent frequency modifiers as the same phrasing", () => {
      expect(matchedSymptoms("peeing more often")).toEqual(["polyuria"]);
      expect(matchedSymptoms("peeing constantly")).toEqual(["polyuria"]);
      expect(matchedSymptoms("urinating frequently")).toEqual(["polyuria"]);
      expect(matchedSymptoms("going to the toilet a lot")).toEqual(["polyuria"]);
      expect(matchedSymptoms("passing urine frequently")).toEqual(["polyuria"]);
      expect(matchedSymptoms("need to pee all the time")).toEqual(["polyuria"]);
    });

    it("does not treat a bare base activity as a symptom", () => {
      const peeing = ruleBasedParser.parse("peeing");
      expect(peeing.matched).toEqual([]);
      expect(peeing.negated).toEqual([]);
      expect(peeing.unmatched).toEqual(["peeing"]);

      const urinating = ruleBasedParser.parse("urinating");
      expect(urinating.matched).toEqual([]);
      expect(urinating.unmatched).toEqual(["urinating"]);
    });

    it("recognises nausea phrasings", () => {
      expect(matchedSymptoms("feeling sick")).toEqual(["nausea"]);
      expect(matchedSymptoms("I feel sick")).toEqual(["nausea"]);
      expect(matchedSymptoms("nauseous")).toEqual(["nausea"]);
      expect(matchedSymptoms("queasy")).toEqual(["nausea"]);
      expect(matchedSymptoms("sick to my stomach")).toEqual(["nausea"]);
    });

    it("recognises further fatigue, breathlessness and vision phrasings", () => {
      expect(matchedSymptoms("exhausted")).toEqual(["fatigue"]);
      expect(matchedSymptoms("wiped out")).toEqual(["fatigue"]);
      expect(matchedSymptoms("out of breath")).toEqual(["breathlessness"]);
      expect(matchedSymptoms("struggling to breathe")).toEqual(["breathlessness"]);
      expect(matchedSymptoms("vision is blurry")).toEqual(["blurred_and_distorted_vision"]);
      expect(matchedSymptoms("cannot see clearly")).toEqual(["blurred_and_distorted_vision"]);
    });

    it("folds simple inflections of action words", () => {
      expect(matchedSymptoms("vomited")).toEqual(["vomiting"]);
      expect(matchedSymptoms("vomits")).toEqual(["vomiting"]);
      expect(matchedSymptoms("being sick")).toEqual(["vomiting"]);
    });

    it("still negates the newly-matching phrasings", () => {
      const noPolyuria = ruleBasedParser.parse("not peeing more often");
      expect(noPolyuria.matched).toEqual([]);
      expect(noPolyuria.negated.map(({ symptom }) => symptom)).toEqual(["polyuria"]);

      const noNausea = ruleBasedParser.parse("no nausea");
      expect(noNausea.matched).toEqual([]);
      expect(noNausea.negated.map(({ symptom }) => symptom)).toEqual(["nausea"]);
    });

    it("leaves unsupported thirst language unchanged", () => {
      const result = ruleBasedParser.parse("always thirsty");
      expect(result.matched).toEqual([]);
      expect(result.unmatched).toEqual(["always thirsty"]);
    });

    it("still routes ambiguous entries through the ambiguous channel", () => {
      expect(ruleBasedParser.parse("fever").ambiguous).toEqual([
        { matchedText: "fever", candidates: ["high_fever", "mild_fever"] },
      ]);
      expect(ruleBasedParser.parse("swelling").matched).toEqual([]);
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
