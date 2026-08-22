import React from "react";
import SymptomInput from "../SymptomInput/SymptomInput";

export default function SymptomFields({ symptoms, onChange, symptomInputRef }) {
  return (
    <fieldset className="form-section">
      <legend>Symptoms</legend>
      <SymptomInput ref={symptomInputRef} symptoms={symptoms} onChange={onChange} />
    </fieldset>
  );
}
