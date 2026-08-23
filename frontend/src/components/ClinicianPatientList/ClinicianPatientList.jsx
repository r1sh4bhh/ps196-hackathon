import React from "react";
import "./clinicianPatientList.css";

function formatDate(timestamp) {
  return timestamp ? String(timestamp).slice(0, 10) : "No visits yet";
}

function topRiskLabel(latestAssessment) {
  const prediction = latestAssessment?.prediction;
  if (!prediction?.top_disease) {
    return "No prediction yet";
  }
  const score = prediction.risk_scores?.[prediction.top_disease];
  const percent = Number.isFinite(Number(score)) ? ` (${Math.round(Number(score) * 100)}%)` : "";
  return `${prediction.top_disease.replace(/_/g, " ")}${percent}`;
}

export default function ClinicianPatientList({
  patients,
  onSelectPatient,
  onAddPatient,
  onLoadDemoPatients,
  onClearDemoPatients,
  onViewHistory,
}) {
  return (
    <div className="clinician-patient-list">
      <header className="clinician-patient-list-header">
        <h1>Patients</h1>
        <button type="button" className="btn-primary" onClick={onAddPatient}>
          Add new patient
        </button>
        <button type="button" className="btn-secondary" onClick={onLoadDemoPatients}>
          Load demo patients
        </button>
        <button type="button" className="btn-secondary" onClick={onClearDemoPatients}>
          Clear demo patients
        </button>
      </header>

      {patients.length === 0 ? (
        <p className="clinician-patient-list-empty">
          No patients saved on this device yet. Add one to get started, or load demo patients.
        </p>
      ) : (
        <ul className="clinician-patient-list-items">
          {patients.map(({ patientId, latestAssessment, isDemo }) => (
            <li key={patientId} className="clinician-patient-list-item">
              <div className="clinician-patient-list-summary">
                <button
                  type="button"
                  className="clinician-patient-list-select"
                  onClick={() => onSelectPatient(patientId)}
                >
                  <span className="clinician-patient-list-id">
                    {patientId}
                    {isDemo ? <span className="demo-patient-badge">Demo</span> : null}
                  </span>
                  <span className="clinician-patient-list-meta">
                    Last assessment: {formatDate(latestAssessment?.timestamp)}
                  </span>
                  <span className="clinician-patient-list-meta">
                    Top risk: {topRiskLabel(latestAssessment)}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn-secondary clinician-patient-history"
                  onClick={() => onViewHistory(patientId)}
                >
                  View history
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
