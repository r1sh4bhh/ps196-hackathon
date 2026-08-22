import React, { useMemo, useState } from "react";
import PatientForm from "./components/PatientForm/PatientForm";
import DashboardShell from "./components/Dashboard/DashboardShell";
import OnboardingWizard from "./components/Onboarding/OnboardingWizard";
import RoleSelect from "./components/RoleSelect/RoleSelect";
import PersonSwitcher from "./components/PersonSwitcher/PersonSwitcher";
import ClinicianPatientList from "./components/ClinicianPatientList/ClinicianPatientList";
import RoleSwitcher from "./components/RoleSwitcher";
import {
  loadProfile,
  clearProfile,
  listProfiles,
  setActivePatientId,
  loadLabResults,
} from "./storage/userProfileStore";
import { getRole, setRole, ROLES } from "./storage/roleStore";
import { buildPatientDataFromProfile } from "./storage/buildPatientData";
import { demoPatientHistory } from "./mocks/demoPatientHistory";
import {
  removeAssessment,
  saveAssessment,
  listAssessments,
  latestAssessment,
} from "./storage/assessmentHistory";
import ThemeToggle from "./components/ThemeToggle";

function hasReturnVisitHistory(patientId) {
  return Boolean(patientId) && listAssessments(patientId).length > 0;
}

function computeInitialView(role, profile) {
  if (!role) {
    return "role-select";
  }
  if (role === ROLES.CLINICIAN) {
    return "clinician-list";
  }
  return profile ? "form" : "onboarding";
}

export default function App() {
  const [prediction, setPrediction] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [baselines, setBaselines] = useState({});
  const [baselineSince, setBaselineSince] = useState(null);
  const [trajectory, setTrajectory] = useState([]);
  const [reusedLabs, setReusedLabs] = useState({});
  const [role, setRoleValue] = useState(() => getRole());
  const [profile, setProfile] = useState(() => loadProfile());
  const [view, setView] = useState(() => computeInitialView(getRole(), loadProfile()));

  const handleRoleSelected = (nextRole) => {
    setRole(nextRole);
    setRoleValue(nextRole);
    const currentProfile = loadProfile();
    setProfile(currentProfile);
    setView(computeInitialView(nextRole, currentProfile));
  };

  const handlePredictionReceived = (
    data,
    resultPrediction,
    resultBaselines,
    resultBaselineSince,
    resultTrajectory,
    resultReusedLabs
  ) => {
    setPatientData(data);
    setPrediction(resultPrediction);
    setBaselines(resultBaselines);
    setBaselineSince(resultBaselineSince);
    setTrajectory(resultTrajectory || []);
    setReusedLabs(resultReusedLabs || {});
    setView("dashboard");
  };

  const handleOnboardingComplete = (nextProfile) => {
    setProfile(nextProfile);
    setView("form");
  };

  const handleRedoOnboarding = () => {
    if (profile?.patientId) {
      clearProfile(profile.patientId);
    }
    setProfile(null);
    setView("onboarding");
  };

  const handleAddPerson = () => {
    setView("onboarding");
  };

  const handleSwitchPerson = (patientId) => {
    if (!setActivePatientId(patientId)) {
      return;
    }
    setProfile(loadProfile(patientId));
    setView("form");
  };

  const handleBackToPatientList = () => {
    setView("clinician-list");
  };

  const isReturningVisit = hasReturnVisitHistory(profile?.patientId);
  const profilePatientData = buildPatientDataFromProfile(profile);
  const initialFormData =
    isReturningVisit && profilePatientData
      ? { ...profilePatientData, labs: {} }
      : profilePatientData;
  const storedLabs = isReturningVisit ? loadLabResults(profile?.patientId) : {};
  // Re-read the saved-people list only when the active profile changes (add,
  // switch, onboarding, or redo), rather than on every render. `profile` is
  // used only as a cache-invalidation signal here, not read directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const savedProfiles = useMemo(() => listProfiles(), [profile]);
  const clinicianPatients = useMemo(
    () =>
      savedProfiles.map((savedProfile) => ({
        patientId: savedProfile.patientId,
        latestAssessment: latestAssessment(savedProfile.patientId),
      })),
    [savedProfiles]
  );
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
        <RoleSwitcher role={role} onSwitch={handleRoleSelected} />
        <ThemeToggle />
      </div>

      {view === "role-select" && <RoleSelect onSelect={handleRoleSelected} />}

      {view === "clinician-list" && (
        <ClinicianPatientList
          patients={clinicianPatients}
          onSelectPatient={handleSwitchPerson}
          onAddPatient={handleAddPerson}
        />
      )}

      {view === "onboarding" && <OnboardingWizard onComplete={handleOnboardingComplete} />}

      {view === "form" && (
        <>
          {role === ROLES.PATIENT && (
            <PersonSwitcher
              profiles={savedProfiles}
              activePatientId={profile?.patientId}
              onSwitch={handleSwitchPerson}
              onAddPerson={handleAddPerson}
            />
          )}
          {role === ROLES.CLINICIAN && (
            <div className="profile-actions">
              <button type="button" className="btn-secondary" onClick={handleBackToPatientList}>
                Back to patient list
              </button>
            </div>
          )}
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
            key={profile?.patientId || "no-profile"}
            onPredictionReceived={handlePredictionReceived}
            initialData={initialFormData}
            storedLabs={storedLabs}
            mode={isReturningVisit ? "short" : "full"}
          />
        </>
      )}
      {view === "dashboard" && (
        <>
          {role === ROLES.CLINICIAN && (
            <div className="profile-actions">
              <button type="button" className="btn-secondary" onClick={handleBackToPatientList}>
                Back to patient list
              </button>
            </div>
          )}
          <DashboardShell
            patientData={patientData}
            prediction={prediction}
            baselineCurrent={baselineCurrent}
            baselineData={baselineData}
            trajectory={trajectory}
            reusedLabs={reusedLabs}
            onBackToForm={() => setView("form")}
          />
        </>
      )}
    </div>
  );
}
