import { CANONICAL_SYMPTOMS, SYMPTOM_LABELS } from "../../constants/symptomVocabulary";
import { SYMPTOM_SYNONYMS } from "./symptomSynonyms";

const NEGATION_CUE =
  /\b(?:no|not|never|denies|without|don't have|dont have|haven't had|havent had|free of)\b/g;
const CLAUSE_BOUNDARY = /(?:\bbut\b|\bhowever\b|[,.;])/g;
const FUZZY_THRESHOLD = 0.84;
const UNSUPPORTED_PHRASES = ["always thirsty"];

const TERM_MAP = [
  ...SYMPTOM_SYNONYMS,
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

    const lower = source.toLowerCase().replace(/[’]/g, "'");
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

function findTerms(text) {
  const found = [];
  const occupied = [];

  for (const entry of TERM_MAP) {
    for (const phrase of entry.phrases) {
      const expression = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "g");
      for (const match of text.matchAll(expression)) {
        const start = match.index;
        const end = start + match[0].length;
        if (occupied.some(([from, to]) => start < to && end > from)) continue;
        occupied.push([start, end]);
        found.push({
          candidates: entry.candidates,
          phrase,
          matchedText: match[0],
          index: start,
          method: SYMPTOM_SYNONYMS.includes(entry) ? "synonym" : "exact",
          confidence: 1,
        });
      }
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
