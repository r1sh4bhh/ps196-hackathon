import React from "react";
import SymptomInput from "../SymptomInput/SymptomInput";

export default function SymptomFields({ symptoms, onChange }) {
  return (
    <fieldset className="form-section">
      <legend>Symptoms</legend>
      <SymptomInput symptoms={symptoms} onChange={onChange} />
    </fieldset>
  );
}
