import React, { useState } from "react";
import PatientForm from "./components/PatientForm/PatientForm";
import DashboardShell from "./components/Dashboard/DashboardShell";
import OnboardingWizard from "./components/Onboarding/OnboardingWizard";
import { hasProfile, loadProfile, clearProfile } from "./storage/userProfileStore";
import { buildPatientDataFromProfile } from "./storage/buildPatientData";
import { demoPatientHistory } from "./mocks/demoPatientHistory";
import { removeAssessment, saveAssessment } from "./storage/assessmentHistory";

export default function App() {
  const [prediction, setPrediction] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [baselines, setBaselines] = useState({});
  const [profile, setProfile] = useState(() => loadProfile());
  const [view, setView] = useState(() => (hasProfile() ? "form" : "onboarding"));

  const handlePredictionReceived = (data, resultPrediction, resultBaselines) => {
    setPatientData(data);
    setPrediction(resultPrediction);
    setBaselines(resultBaselines);
    setView("dashboard");
  };

  const handleOnboardingComplete = (nextProfile) => {
    setProfile(nextProfile);
    setView("form");
  };

  const handleRedoOnboarding = () => {
    clearProfile();
    setProfile(null);
    setView("onboarding");
  };

  const initialFormData = buildPatientDataFromProfile(profile);
  const baselineCurrent = Object.fromEntries(
    Object.entries(baselines).map(([metric, result]) => [metric, result.current])
  );
  const baselineData = {
    recordedAt: "local assessment history",
    risk_scores: baselines,
  };

  const handleLoadDemoHistory = () => {
    demoPatientHistory.forEach(saveAssessment);
  };

  const handleClearDemoHistory = () => {
    demoPatientHistory.forEach((assessment) => removeAssessment(assessment.id));
  };

  return (
    <div className="app-shell">
      {view === "onboarding" && <OnboardingWizard onComplete={handleOnboardingComplete} />}
      {view === "form" && (
        <>
          <div className="profile-actions">
            <button type="button" className="btn-secondary" onClick={handleRedoOnboarding}>
              Edit profile / redo onboarding
            </button>
            <button type="button" className="btn-secondary" onClick={handleLoadDemoHistory}>
              Load demo patient history (P001)
            </button>
            <button type="button" className="btn-secondary" onClick={handleClearDemoHistory}>
              Clear demo patient history
            </button>
          </div>
          <PatientForm
            onPredictionReceived={handlePredictionReceived}
            initialData={initialFormData}
          />
        </>
      )}
      {view === "dashboard" && (
        <DashboardShell
          patientData={patientData}
          prediction={prediction}
          baselineCurrent={baselineCurrent}
          baselineData={baselineData}
          onBackToForm={() => setView("form")}
        />
      )}
    </div>
  );
}
