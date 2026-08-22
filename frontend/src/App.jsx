import React, { useState } from "react";
import PatientForm from "./components/PatientForm/PatientForm";
import DashboardShell from "./components/Dashboard/DashboardShell";
import OnboardingWizard from "./components/Onboarding/OnboardingWizard";
import { hasProfile, loadProfile, clearProfile } from "./storage/userProfileStore";
import { buildPatientDataFromProfile } from "./storage/buildPatientData";
import { demoPatientHistory } from "./mocks/demoPatientHistory";
import { removeAssessment, saveAssessment } from "./storage/assessmentHistory";
import ThemeToggle from "./components/ThemeToggle";

export default function App() {
  const [prediction, setPrediction] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [baselines, setBaselines] = useState({});
  const [baselineSince, setBaselineSince] = useState(null);
  const [profile, setProfile] = useState(() => loadProfile());
  const [view, setView] = useState(() => (hasProfile() ? "form" : "onboarding"));

  const handlePredictionReceived = (
    data,
    resultPrediction,
    resultBaselines,
    resultBaselineSince
  ) => {
    setPatientData(data);
    setPrediction(resultPrediction);
    setBaselines(resultBaselines);
    setBaselineSince(resultBaselineSince);
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
  const baselineData = Object.keys(baselines).length
    ? {
        recordedAt: baselineSince ? baselineSince.slice(0, 10) : "first personal assessment",
        risk_scores: baselines,
      }
    : null;

  const handleLoadDemoHistory = () => {
    demoPatientHistory.forEach(saveAssessment);
  };

  const handleClearDemoHistory = () => {
    demoPatientHistory.forEach((assessment) => removeAssessment(assessment.id));
  };

  return (
    <div className="app-shell">
      <div className="app-theme-toggle">
        <ThemeToggle />
      </div>
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
