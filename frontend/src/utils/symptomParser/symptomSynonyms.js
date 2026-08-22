export const SYMPTOM_SYNONYMS = Object.freeze([
  { phrases: ["tired", "worn out", "no energy"], candidates: ["fatigue"] },
  {
    phrases: ["peeing a lot", "weeing constantly", "frequent urination"],
    candidates: ["polyuria"],
  },
  {
    phrases: ["blurry vision", "vision goes blurry", "vision goes fuzzy"],
    candidates: ["blurred_and_distorted_vision"],
  },
  {
    phrases: ["short of breath", "winded", "can't catch my breath", "cannot catch my breath"],
    candidates: ["breathlessness"],
  },
  { phrases: ["throwing up"], candidates: ["vomiting"] },
  {
    phrases: [
      "chest tightness",
      "pain in my chest",
      "pain in the chest",
      "hurting in my chest",
      "hurting in the chest",
    ],
    candidates: ["chest_pain"],
  },
  { phrases: ["dizzy", "lightheaded"], candidates: ["dizziness"] },
  { phrases: ["always hungry"], candidates: ["excessive_hunger"] },
  {
    phrases: ["swelling"],
    candidates: ["swelling_of_stomach", "swelling_joints", "swollen_legs", "swollen_extremeties"],
  },
  { phrases: ["fever"], candidates: ["high_fever", "mild_fever"] },
]);
