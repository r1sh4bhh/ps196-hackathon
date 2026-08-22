import React, { useState } from "react";
import PatientForm from "./components/PatientForm/PatientForm";
import DashboardShell from "./components/Dashboard/DashboardShell";

export default function App() {
  const [prediction, setPrediction] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [view, setView] = useState("form");

  const handlePredictionReceived = (data, resultPrediction) => {
    setPatientData(data);
    setPrediction(resultPrediction);
    setView("dashboard");
  };

  return (
    <div className="app-shell">
      {view === "form" && (
        <PatientForm onPredictionReceived={handlePredictionReceived} />
      )}
      {view === "dashboard" && (
        <DashboardShell
          patientData={patientData}
          prediction={prediction}
          onBackToForm={() => setView("form")}
        />
      )}
    </div>
  );
}
