import React, { useState } from "react";
import { CANONICAL_SYMPTOMS, SYMPTOM_LABELS } from "../../constants/symptomVocabulary";
import { symptomParser } from "../../utils/symptomParser/symptomParser";
import "./symptomInput.css";

const EMPTY_RESULT = { matched: [], negated: [], ambiguous: [], unmatched: [] };

export default function SymptomInput({ symptoms = [], onChange, parser = symptomParser }) {
  const [description, setDescription] = useState("");
  const [parsed, setParsed] = useState(EMPTY_RESULT);
  const [manualPick, setManualPick] = useState("");

  const add = (symptom) => {
    if (symptom && !symptoms.includes(symptom)) onChange([...symptoms, symptom]);
  };
  const remove = (symptom) => onChange(symptoms.filter((item) => item !== symptom));
  const dismiss = (group, index) => {
    setParsed((previous) => ({
      ...previous,
      [group]: previous[group].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  return (
    <div className="symptom-input">
      <label className="symptom-description">
        <span>Describe your symptoms in your own words</span>
        <textarea
          value={description}
          rows={4}
          placeholder="For example: been really tired, peeing a lot, vision goes blurry"
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="symptom-parse-button"
        disabled={!description.trim()}
        onClick={() => setParsed(parser.parse(description))}
      >
        Review what we understood
      </button>

      {symptoms.length > 0 && (
        <div className="symptom-review-group">
          <strong>Confirmed present</strong>
          <div className="chip-group">
            {symptoms.map((symptom) => (
              <button
                type="button"
                className="chip chip-active"
                key={symptom}
                onClick={() => remove(symptom)}
                aria-label={`Remove ${SYMPTOM_LABELS[symptom]}`}
              >
                {SYMPTOM_LABELS[symptom]} ×
              </button>
            ))}
          </div>
        </div>
      )}

      {parsed.matched.length > 0 && (
        <div className="symptom-review-group">
          <strong>Possible matches — add only if correct</strong>
          <div className="chip-group">
            {parsed.matched.map((item, index) => (
              <span className="symptom-suggestion" key={`${item.symptom}-${index}`}>
                <button type="button" className="chip" onClick={() => add(item.symptom)}>
                  + {item.displayLabel}
                </button>
                <button
                  type="button"
                  className="symptom-dismiss"
                  onClick={() => dismiss("matched", index)}
                  aria-label={`Dismiss ${item.displayLabel}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {parsed.negated.length > 0 && (
        <div className="symptom-review-group symptom-negated">
          <strong>Understood as not present</strong>
          {parsed.negated.map((item) => (
            <div className="symptom-review-row" key={item.symptom}>
              <span>Not present: {item.displayLabel}</span>
              <button type="button" onClick={() => add(item.symptom)}>
                Mark present
              </button>
            </div>
          ))}
        </div>
      )}

      {parsed.ambiguous.map((item, index) => (
        <label className="symptom-review-group" key={`${item.matchedText}-${index}`}>
          <strong>What did “{item.matchedText}” mean?</strong>
          <select
            defaultValue=""
            onChange={(event) => {
              add(event.target.value);
              dismiss("ambiguous", index);
            }}
          >
            <option value="" disabled>
              Choose a symptom
            </option>
            {item.candidates.map((candidate) => (
              <option value={candidate} key={candidate}>
                {SYMPTOM_LABELS[candidate]}
              </option>
            ))}
          </select>
        </label>
      ))}

      {parsed.unmatched.length > 0 && (
        <div className="symptom-review-group symptom-unmatched">
          <strong>We didn’t recognise this</strong>
          <ul>
            {parsed.unmatched.map((fragment, index) => (
              <li key={`${fragment}-${index}`}>{fragment}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="symptom-manual-pick">
        <select value={manualPick} onChange={(event) => setManualPick(event.target.value)}>
          <option value="" disabled>
            Select a symptom…
          </option>
          {CANONICAL_SYMPTOMS.map((symptom) => (
            <option value={symptom} key={symptom}>
              {SYMPTOM_LABELS[symptom]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!manualPick}
          onClick={() => {
            add(manualPick);
            setManualPick("");
          }}
        >
          Add
        </button>
      </div>

      <details className="symptom-checkboxes">
        <summary>Or choose from the full symptom list</summary>
        <div className="chip-group">
          {CANONICAL_SYMPTOMS.map((symptom) => (
            <button
              type="button"
              key={symptom}
              className={`chip ${symptoms.includes(symptom) ? "chip-active" : ""}`}
              onClick={() => (symptoms.includes(symptom) ? remove(symptom) : add(symptom))}
            >
              {SYMPTOM_LABELS[symptom]}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
