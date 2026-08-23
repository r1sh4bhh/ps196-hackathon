import React from "react";
import ConfirmButton from "../ConfirmButton/ConfirmButton";
import "./clinicianPatientList.css";

const CLEAR_DEMO_CONFIRMATION =
  "Demo patients and their visit history will be removed from this device. Real patient records are not affected.";

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
      </header>

      <div className="clinician-demo-controls">
        <span className="clinician-demo-controls-label">Demo data</span>
        <button type="button" className="btn-ghost" onClick={onLoadDemoPatients}>
          Load demo patients
        </button>
        <ConfirmButton
          className="btn-ghost"
          label="Clear demo patients"
          confirmLabel="Yes, clear demo patients"
          message={CLEAR_DEMO_CONFIRMATION}
          onConfirm={onClearDemoPatients}
        />
      </div>

      {patients.length === 0 ? (
        <div className="clinician-patient-list-empty">
          <p>
            No patients saved on this device yet. Every patient you add is stored on this device
            only, with their visit history.
          </p>
          <button type="button" className="btn-secondary" onClick={onLoadDemoPatients}>
            Load demo patients
          </button>
        </div>
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
