// Phrases are matched after normalization in ruleBasedParser (fillers stripped,
// frequency/intensity modifiers collapsed to "a lot", simple inflections
// folded), so a phrase here should be written in that normalized form.
export const SYMPTOM_SYNONYMS = Object.freeze([
  {
    phrases: ["tired", "worn out", "no energy", "exhausted", "fatigued", "no stamina", "drained", "wiped out"],
    candidates: ["fatigue"],
  },
  {
    // A frequency modifier is required: everybody urinates, only doing so
    // abnormally often is a symptom.
    phrases: [
      "peeing a lot",
      "pee a lot",
      "weeing a lot",
      "wee a lot",
      "urinating a lot",
      "urination a lot",
      "frequent urination",
      "passing urine a lot",
      "going to the toilet a lot",
    ],
    candidates: ["polyuria"],
  },
  {
    phrases: [
      "blurry vision",
      "vision goes blurry",
      "vision goes fuzzy",
      "vision is blurry",
      "vision is fuzzy",
      "can't see clearly",
      "cannot see clearly",
    ],
    candidates: ["blurred_and_distorted_vision"],
  },
  {
    phrases: [
      "short of breath",
      "winded",
      "can't catch my breath",
      "cannot catch my breath",
      "out of breath",
      "breathless",
      "puffed",
      "struggling to breathe",
    ],
    candidates: ["breathlessness"],
  },
  { phrases: ["throwing up", "being sick", "vomiting", "puking"], candidates: ["vomiting"] },
  {
    phrases: ["nauseous", "nauseated", "queasy", "sick to my stomach", "sick to the stomach", "sick"],
    candidates: ["nausea"],
  },
  {
    phrases: ["chest tightness"],
    candidates: ["chest_pain"],
  },
  {
    phrases: ["head is pounding", "splitting headache", "head hurts"],
    candidates: ["headache"],
  },
  { phrases: ["dizzy", "lightheaded"], candidates: ["dizziness"] },
  { phrases: ["always hungry", "hungry a lot"], candidates: ["excessive_hunger"] },
  {
    phrases: ["swelling"],
    candidates: ["swelling_of_stomach", "swelling_joints", "swollen_legs", "swollen_extremeties"],
  },
  { phrases: ["fever"], candidates: ["high_fever", "mild_fever"] },
]);
