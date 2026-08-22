export const llmParser = Object.freeze({
  parse() {
    // A future adapter must run offline and validate structured output against
    // the same parser return contract before exposing it to the UI.
    throw new Error("LLM symptom parsing is not implemented");
  },
});
