import { CANONICAL_SYMPTOMS, SYMPTOM_LABELS } from "../../constants/symptomVocabulary";
import { SYMPTOM_SYNONYMS } from "./symptomSynonyms";

const NEGATION_CUE =
  /\b(?:no|not|never|denies|without|don't have|dont have|haven't had|havent had|free of)\b/g;
const CLAUSE_BOUNDARY = /(?:\bbut\b|\bhowever\b|[,.;])/g;
const FUZZY_THRESHOLD = 0.84;
const UNSUPPORTED_PHRASES = ["always thirsty"];

// Filler lead-ins that shouldn't defeat a lookup, e.g. "feeling", "i've got".
// Longer/more specific phrases are listed before the shorter phrases they contain.
const FILLER_PHRASES = [
  "been having",
  "i've got",
  "suffering from",
  "a bit of",
  "lots of",
  "really bad",
  "i have",
  "i am",
  "i'm",
  "experiencing",
  "getting",
  "having",
  "feeling",
  "some",
];

// Frequency/intensity modifiers that all mean "abnormally often/much". They
// are collapsed to one canonical form so a single base phrase (e.g.
// "peeing a lot") covers the whole family instead of SYMPTOM_SYNONYMS having
// to enumerate every base-phrase/modifier combination.
// Longer phrases are listed before the shorter phrases they contain.
const FREQUENCY_MODIFIER = "a lot";
const FREQUENCY_MODIFIERS = [
  "more than usual",
  "more often",
  "all the time",
  "too much",
  "excessively",
  "constantly",
  "frequently",
  "a lot",
  "often",
  "lots",
];

// Minimal, explicit inflection rewrites for action words that appear in the
// synonym list. Deliberately not a general stemmer: a broad stemmer would
// create false matches against the frozen vocabulary.
const INFLECTION_REWRITES = {
  vomit: "vomiting",
  vomits: "vomiting",
  vomited: "vomiting",
  puke: "puking",
  pukes: "puking",
  puked: "puking",
  urinate: "urinating",
  urinates: "urinating",
  urinated: "urinating",
};

// Sensation words that combine with a body part to describe pain in an
// inverted construction, e.g. "pain in my chest" or "ache in the back".
const SENSATION_WORDS =
  "pain|ache|aching|hurting|discomfort|soreness|tightness|cramping";

// Body-part words mapped to their canonical vocabulary term. A value can be
// an array when the rewrite is genuinely ambiguous between two real terms;
// in that case the caller routes it through the ambiguous channel instead of
// silently choosing one.
const PART_REWRITES = {
  chest: "chest_pain",
  stomach: "stomach_pain",
  belly: "belly_pain",
  back: "back_pain",
  neck: "neck_pain",
  joint: "joint_pain",
  joints: "joint_pain",
  knee: "knee_pain",
  hip: "hip_joint_pain",
  muscle: "muscle_pain",
  muscles: "muscle_pain",
  head: "headache",
  abdomen: ["stomach_pain", "abdominal_pain"],
  tummy: ["stomach_pain", "belly_pain"],
};

const AMBIGUOUS_REWRITE_ENTRIES = Object.entries(PART_REWRITES)
  .filter(([, mapped]) => Array.isArray(mapped))
  .map(([part, candidates]) => ({
    phrases: [`__ambiguous_${part}__`],
    candidates,
    displayText: part,
  }));

const TERM_MAP = [
  ...SYMPTOM_SYNONYMS,
  ...AMBIGUOUS_REWRITE_ENTRIES,
  ...CANONICAL_SYMPTOMS.map((symptom) => ({
    phrases: [symptom.replace(/_/g, " "), SYMPTOM_LABELS[symptom].toLowerCase()],
    candidates: [symptom],
  })),
];

export const ruleBasedParser = Object.freeze({
  parse(text) {
    const source = String(text || "").trim();
    const result = { matched: [], negated: [], ambiguous: [], unmatched: [] };
    if (!source) return result;

    const lower = normalize(source.toLowerCase().replace(/[’]/g, "'"));
    const occurrences = findTerms(lower);
    const coveredClauses = new Set();
    const seen = new Set();

    for (const phrase of UNSUPPORTED_PHRASES) {
      if (lower.includes(phrase)) result.unmatched.push(phrase);
    }

    for (const occurrence of occurrences) {
      const negated = isNegated(lower, occurrence.index);
      coveredClauses.add(clauseIndexAt(lower, occurrence.index));

      if (occurrence.candidates.length > 1 && !negated) {
        const key = `ambiguous:${occurrence.index}:${occurrence.phrase}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.ambiguous.push({
            matchedText: occurrence.matchedText,
            candidates: occurrence.candidates,
          });
        }
        continue;
      }

      for (const symptom of occurrence.candidates) {
        const key = `${negated ? "negated" : "matched"}:${symptom}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const item = {
          symptom,
          displayLabel: SYMPTOM_LABELS[symptom],
          matchedText: occurrence.matchedText,
        };
        if (negated) {
          result.negated.push(item);
        } else {
          result.matched.push({
            ...item,
            confidence: occurrence.method === "synonym" ? 0.95 : occurrence.confidence,
            method: occurrence.method,
          });
        }
      }
    }

    const clauses = splitClauses(lower);
    clauses.forEach((clause, index) => {
      const cleaned = clause.replace(/\s+/g, " ").trim();
      if (!cleaned || coveredClauses.has(index)) return;

      const fuzzy = findFuzzyMatch(cleaned);
      if (fuzzy) {
        const item = {
          symptom: fuzzy.symptom,
          displayLabel: SYMPTOM_LABELS[fuzzy.symptom],
          matchedText: fuzzy.matchedText,
        };
        if (isNegated(cleaned, fuzzy.index)) {
          result.negated.push(item);
        } else {
          result.matched.push({
            ...item,
            confidence: fuzzy.confidence,
            method: "fuzzy",
          });
        }
      } else {
        if (!result.unmatched.includes(cleaned)) result.unmatched.push(cleaned);
      }
    });

    return result;
  },
});

function normalize(text) {
  return rewriteInvertedPhrasing(
    normalizeInflections(
      normalizeFrequencyModifiers(stripFillers(normalizeFeelingSick(singularizeSensationWords(text))))
    )
  );
}

// "feeling sick" means nausea, so it is rewritten before "feeling" is stripped
// as a filler. Bare "sick" is deliberately not a nausea synonym: on its own it
// commonly means vomiting, which is a separate symptom.
function normalizeFeelingSick(text) {
  return text.replace(/\bfeel(?:s|ing)?\s+sick\b/g, "nauseous");
}

// "peeing more often" / "peeing constantly" -> "peeing a lot" so one synonym
// phrase covers every equivalent modifier. The modifier is never dropped:
// a bare base word such as "peeing" must not match a symptom on its own.
function normalizeFrequencyModifiers(text) {
  let result = text;
  for (const modifier of FREQUENCY_MODIFIERS) {
    const expression = new RegExp(`\\b${escapeRegExp(modifier)}\\b`, "g");
    result = result.replace(expression, FREQUENCY_MODIFIER);
  }
  return result.replace(/\s+/g, " ").trim();
}

// "vomited" / "vomits" -> "vomiting", using an explicit word list only.
function normalizeInflections(text) {
  return text.replace(/\b[a-z]+\b/g, (word) => INFLECTION_REWRITES[word] ?? word);
}

// "chest pains" / "stomach pains" -> "chest pain" / "stomach pain" so the
// plural form still hits the same exact-phrase and rewrite-rule lookups as
// the singular form.
function singularizeSensationWords(text) {
  return text.replace(/\b(pain|ache)s\b/g, "$1");
}

function stripFillers(text) {
  let result = text;
  for (const filler of FILLER_PHRASES) {
    const expression = new RegExp(`\\b${escapeRegExp(filler)}\\b`, "g");
    result = result.replace(expression, " ");
  }
  return result.replace(/\s+/g, " ").trim();
}

function rewriteInvertedPhrasing(text) {
  let result = text;

  // "pain behind my eyes" / "ache behind the eyes" / "pain behind eyes" ->
  // pain behind the eyes
  result = result.replace(
    new RegExp(
      `\\b(?:${SENSATION_WORDS})\\s+behind\\s+(?:(?:my|the|his|her|their|a)\\s+)?eyes\\b`,
      "g"
    ),
    (match) => rewrittenPhraseFor("pain_behind_the_eyes") ?? match
  );

  // "<sensation> in (my|the|his|her|their|a) <part>" -> "<part>_pain" (or its
  // mapped term). The determiner is optional so "pain in chest" rewrites
  // just like "pain in my chest".
  result = result.replace(
    new RegExp(
      `\\b(?:${SENSATION_WORDS})\\s+in\\s+(?:(?:my|the|his|her|their|a)\\s+)?([a-z]+)\\b`,
      "g"
    ),
    (match, part) => rewrittenPhraseForPart(part) ?? match
  );

  // "(my|the) <part> (hurts|is hurting|aches|is aching|is sore)" -> canonical term
  result = result.replace(
    /\b(?:(?:my|the)\s+)?([a-z]+)\s+(?:hurts|hurt|is hurting|aches|ache|is aching|is sore)\b/g,
    (match, part) => rewrittenPhraseForPart(part) ?? match
  );

  return result;
}

function rewrittenPhraseForPart(part) {
  const mapped = PART_REWRITES[part];
  if (!mapped) return null;

  if (Array.isArray(mapped)) return `__ambiguous_${part}__`;

  return rewrittenPhraseFor(mapped);
}

function rewrittenPhraseFor(symptom) {
  // Only ever rewrite into a term that actually exists in the frozen
  // vocabulary; never invent a term that isn't recognised.
  if (!CANONICAL_SYMPTOMS.includes(symptom)) return null;
  return symptom.replace(/_/g, " ");
}

function findTerms(text) {
  const found = [];
  const occupied = [];

  const entryPhrasePairs = [];
  for (const entry of TERM_MAP) {
    for (const phrase of entry.phrases) {
      entryPhrasePairs.push({ entry, phrase });
    }
  }
  // Match longer phrases first so a full phrase like "hip joint pain" claims
  // its range before a shorter phrase like "joint pain" can grab a subset of it.
  entryPhrasePairs.sort((a, b) => b.phrase.length - a.phrase.length);

  for (const { entry, phrase } of entryPhrasePairs) {
    const expression = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "g");
    for (const match of text.matchAll(expression)) {
      const start = match.index;
      const end = start + match[0].length;
      if (occupied.some(([from, to]) => start < to && end > from)) continue;
      occupied.push([start, end]);
      found.push({
        candidates: entry.candidates,
        phrase,
        matchedText: entry.displayText ?? match[0],
        index: start,
        method: SYMPTOM_SYNONYMS.includes(entry) ? "synonym" : "exact",
        confidence: 1,
      });
    }
  }

  return found.sort((a, b) => a.index - b.index);
}

function isNegated(text, symptomIndex) {
  const prefix = text.slice(0, symptomIndex);
  let clauseStart = 0;
  for (const boundary of prefix.matchAll(CLAUSE_BOUNDARY)) {
    clauseStart = boundary.index + boundary[0].length;
  }

  const clausePrefix = prefix.slice(clauseStart);
  let lastCue = null;
  for (const cue of clausePrefix.matchAll(NEGATION_CUE)) lastCue = cue;
  if (!lastCue) return false;

  const wordsAfterCue = clausePrefix
    .slice(lastCue.index + lastCue[0].length)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return wordsAfterCue.length <= 6;
}

function splitClauses(text) {
  return text
    .split(/(?:\bbut\b|\bhowever\b|[,.;])/)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function clauseIndexAt(text, position) {
  return text.slice(0, position).split(/(?:\bbut\b|\bhowever\b|[,.;])/).length - 1;
}

function findFuzzyMatch(clause) {
  const wordMatches = [...clause.matchAll(/[a-z]+/g)];
  const words = wordMatches.map((match) => match[0]);
  let best = null;

  for (const symptom of CANONICAL_SYMPTOMS) {
    const target = symptom.replace(/_/g, " ");
    const targetLength = target.split(" ").length;
    for (let size = Math.max(1, targetLength - 1); size <= targetLength + 1; size += 1) {
      for (let index = 0; index <= words.length - size; index += 1) {
        const candidate = words.slice(index, index + size).join(" ");
        if (candidate.length < 5) continue;
        const confidence = similarity(candidate, target);
        if (confidence >= FUZZY_THRESHOLD && (!best || confidence > best.confidence)) {
          const start = wordMatches[index].index;
          const lastWord = wordMatches[index + size - 1];
          const end = lastWord.index + lastWord[0].length;
          best = {
            symptom,
            matchedText: clause.slice(start, end),
            confidence: Number(confidence.toFixed(2)),
            index: start,
          };
        }
      }
    }
  }
  return best;
}

function similarity(left, right) {
  return 1 - levenshtein(left, right) / Math.max(left.length, right.length);
}

function levenshtein(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
      previous = current;
    }
  }
  return row[right.length];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
