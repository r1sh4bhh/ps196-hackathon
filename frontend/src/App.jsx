import React, { useState } from "react";
import PatientForm from "./components/PatientForm/PatientForm";
import DashboardShell from "./components/Dashboard/DashboardShell";
import OnboardingWizard from "./components/Onboarding/OnboardingWizard";
import { hasProfile, loadProfile, clearProfile } from "./storage/userProfileStore";
import { buildPatientDataFromProfile } from "./storage/buildPatientData";

export default function App() {
  const [prediction, setPrediction] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [profile, setProfile] = useState(() => loadProfile());
  const [view, setView] = useState(() => (hasProfile() ? "form" : "onboarding"));

  const handlePredictionReceived = (data, resultPrediction) => {
    setPatientData(data);
    setPrediction(resultPrediction);
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

  return (
    <div className="app-shell">
      {view === "onboarding" && <OnboardingWizard onComplete={handleOnboardingComplete} />}
      {view === "form" && (
        <>
          <div className="profile-actions">
            <button type="button" className="btn-secondary" onClick={handleRedoOnboarding}>
              Edit profile / redo onboarding
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
          onBackToForm={() => setView("form")}
        />
      )}
    </div>
  );
}
