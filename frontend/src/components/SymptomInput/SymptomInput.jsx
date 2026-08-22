import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { CANONICAL_SYMPTOMS, SYMPTOM_LABELS } from "../../constants/symptomVocabulary";
import { symptomParser } from "../../utils/symptomParser/symptomParser";
import "./symptomInput.css";

const EMPTY_RESULT = { matched: [], negated: [], ambiguous: [], unmatched: [] };
const PARSE_DELAY_MS = 350;

const SymptomInput = forwardRef(function SymptomInput(
  { symptoms = [], onChange, parser = symptomParser },
  ref
) {
  const [description, setDescription] = useState("");
  const [parsed, setParsed] = useState(EMPTY_RESULT);
  const [manualPick, setManualPick] = useState("");
  const descriptionRef = useRef("");
  const symptomsRef = useRef(symptoms);
  const onChangeRef = useRef(onChange);
  const parserRef = useRef(parser);
  const autoSymptomsRef = useRef(new Set());
  const manualSymptomsRef = useRef(new Set(symptoms));
  const removedSymptomsRef = useRef(new Set());
  const timerRef = useRef();

  symptomsRef.current = symptoms;
  onChangeRef.current = onChange;
  parserRef.current = parser;

  const emit = useCallback((nextSymptoms) => {
    if (
      nextSymptoms.length !== symptomsRef.current.length ||
      nextSymptoms.some((symptom, index) => symptom !== symptomsRef.current[index])
    ) {
      symptomsRef.current = nextSymptoms;
      onChangeRef.current(nextSymptoms);
    }
    return nextSymptoms;
  }, []);

  const parseDescription = useCallback(
    (text) => {
      const result = text.trim() ? parserRef.current.parse(text) : EMPTY_RESULT;
      const matchedSymptoms = new Set(result.matched.map((item) => item.symptom));

      for (const symptom of removedSymptomsRef.current) {
        if (!matchedSymptoms.has(symptom)) removedSymptomsRef.current.delete(symptom);
      }

      const retained = symptomsRef.current.filter(
        (symptom) => !autoSymptomsRef.current.has(symptom) || manualSymptomsRef.current.has(symptom)
      );
      const autoSymptoms = new Set(
        [...matchedSymptoms].filter((symptom) => !removedSymptomsRef.current.has(symptom))
      );
      const nextSymptoms = [...new Set([...retained, ...autoSymptoms])];

      autoSymptomsRef.current = autoSymptoms;
      setParsed(result);
      return emit(nextSymptoms);
    },
    [emit]
  );

  useEffect(() => {
    timerRef.current = setTimeout(() => parseDescription(descriptionRef.current), PARSE_DELAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [description, parseDescription]);

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    return parseDescription(descriptionRef.current);
  }, [parseDescription]);

  useImperativeHandle(ref, () => ({ flush }), [flush]);

  const add = (symptom) => {
    if (!symptom) return;
    manualSymptomsRef.current.add(symptom);
    removedSymptomsRef.current.delete(symptom);
    emit(
      symptomsRef.current.includes(symptom)
        ? symptomsRef.current
        : [...symptomsRef.current, symptom]
    );
  };
  const remove = (symptom) => {
    manualSymptomsRef.current.delete(symptom);
    autoSymptomsRef.current.delete(symptom);
    if (parsed.matched.some((item) => item.symptom === symptom)) {
      removedSymptomsRef.current.add(symptom);
    }
    emit(symptomsRef.current.filter((item) => item !== symptom));
  };
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
          onChange={(event) => {
            descriptionRef.current = event.target.value;
            setDescription(event.target.value);
          }}
          onBlur={flush}
        />
      </label>

      {symptoms.length > 0 && (
        <div className="symptom-review-group">
          <strong>Understood as present</strong>
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
});

export default SymptomInput;
