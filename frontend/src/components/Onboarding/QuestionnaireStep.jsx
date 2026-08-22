import React from "react";
import {
  QUESTIONNAIRE,
  QUESTIONNAIRE_SECTIONS,
  isQuestionVisible,
  computeBmi,
} from "../../constants/questionnaire";
import SymptomInput from "../SymptomInput/SymptomInput";

function QuestionField({ question, value, error, onChange, symptomInputRef }) {
  const handleChange = (nextValue) => onChange(question.id, nextValue);

  if (question.id === "baseline_symptoms") {
    return (
      <fieldset className="field">
        <legend>{question.label}</legend>
        <SymptomInput
          ref={symptomInputRef}
          symptoms={Array.isArray(value) ? value : []}
          onChange={handleChange}
        />
      </fieldset>
    );
  }

  if (question.type === "boolean") {
    return (
      <label className="field">
        <span>{question.label}</span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => handleChange(event.target.checked)}
        />
      </label>
    );
  }

  if (question.type === "single") {
    return (
      <label className="field">
        <span>{question.label}</span>
        <select
          className="form-control"
          value={value ?? ""}
          onChange={(event) => handleChange(event.target.value)}
        >
          <option value="" disabled>
            Select an option
          </option>
          {question.options.map((option) => (
            <option key={option} value={option}>
              {question.optionLabels?.[option] || option.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        {error && <span className="field-error">{error}</span>}
      </label>
    );
  }

  if (question.type === "multi") {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (option) => {
      const next = selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option];
      handleChange(next);
    };

    return (
      <fieldset className="field">
        <legend>{question.label}</legend>
        <div className="chip-group">
          {question.options.map((option) => (
            <button
              type="button"
              key={option}
              className={`chip ${selected.includes(option) ? "chip-active" : ""}`}
              onClick={() => toggle(option)}
            >
              {question.optionLabels?.[option] || option.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  if (question.type === "number") {
    return (
      <label className="field">
        <span>
          {question.label}
          {question.unit ? ` (${question.unit})` : ""}
        </span>
        <input
          type="number"
          value={value ?? ""}
          onChange={(event) => handleChange(event.target.value)}
        />
        {error && <span className="field-error">{error}</span>}
      </label>
    );
  }

  return (
    <label className="field">
      <span>{question.label}</span>
      <input
        type="text"
        value={value ?? ""}
        onChange={(event) => handleChange(event.target.value)}
      />
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export default function QuestionnaireStep({ answers, errors, onChange, symptomInputRef }) {
  const setAnswer = (id, value) => {
    onChange({ ...answers, [id]: value });
  };

  const bmi = computeBmi(answers.height_cm, answers.weight_kg);

  return (
    <div className="questionnaire-step">
      {QUESTIONNAIRE_SECTIONS.map((section) => {
        const questions = QUESTIONNAIRE.filter(
          (question) => question.section === section && isQuestionVisible(question, answers)
        );

        if (questions.length === 0) {
          return null;
        }

        return (
          <fieldset className="form-section" key={section}>
            <legend>{section}</legend>
            {questions.map((question) => (
              <QuestionField
                key={question.id}
                question={question}
                value={answers[question.id]}
                error={errors?.[question.id]}
                onChange={setAnswer}
                symptomInputRef={symptomInputRef}
              />
            ))}
            {section === "Demographics" && bmi !== null && (
              <p className="bmi-hint">Computed BMI: {bmi}</p>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
