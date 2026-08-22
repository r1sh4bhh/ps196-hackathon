import { ruleBasedParser } from "./ruleBasedParser";

// Parser adapters implement parse(text) and return matched, negated, ambiguous,
// and unmatched arrays. The UI only depends on this contract.
export const symptomParser = ruleBasedParser;
