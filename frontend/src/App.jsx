import React, { useMemo, useRef, useState } from "react";
import PatientForm from "./components/PatientForm/PatientForm";
import DashboardShell from "./components/Dashboard/DashboardShell";
import OnboardingWizard from "./components/Onboarding/OnboardingWizard";
import RoleSelect from "./components/RoleSelect/RoleSelect";
import PersonSwitcher from "./components/PersonSwitcher/PersonSwitcher";
import ClinicianPatientList from "./components/ClinicianPatientList/ClinicianPatientList";
import RoleSwitcher from "./components/RoleSwitcher";
import ConfirmButton from "./components/ConfirmButton/ConfirmButton";
import { CLEAR_DEMO_CONFIRMATION } from "./constants/copy";
import {
  loadProfile,
  clearProfile,
  listProfiles,
  saveProfile,
  setActivePatientId,
  loadLabResults,
} from "./storage/userProfileStore";
import { getRole, setRole, ROLES } from "./storage/roleStore";
import { buildPatientDataFromProfile } from "./storage/buildPatientData";
import { demoPatientHistory, demoPatientIds, demoProfiles } from "./mocks/demoPatientHistory";
import {
  removeAssessment,
  saveAssessment,
  listAssessments,
  latestAssessment,
} from "./storage/assessmentHistory";
import { submitPatientData } from "./api/predictService";
import { computeAllBaselines } from "./utils/baseline";
import { buildRiskTrajectory } from "./utils/trajectory";
import { buildBaselineHistory } from "./vitals/aggregateDailyReadings";
import { listReadings } from "./storage/vitalsReadingStore";
import ThemeToggle from "./components/ThemeToggle";
import VitalsProviderPanel from "./components/VitalsProvider/VitalsProviderPanel";
import VisitHistory from "./components/VisitHistory/VisitHistory";

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
  const [demoVersion, setDemoVersion] = useState(0);
  const [demoLoadError, setDemoLoadError] = useState(null);
  const [demoLoadingPatientId, setDemoLoadingPatientId] = useState(null);
  const [historyRoute, setHistoryRoute] = useState(null);
  const demoRequestId = useRef(0);

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
    const selectedProfile = loadProfile(patientId);
    setProfile(selectedProfile);
    if (selectedProfile?.isDemo) {
      loadDemoDashboard(patientId);
      return;
    }
    setView("form");
  };

  const handleBackToPatientList = () => {
    demoRequestId.current += 1;
    setView("clinician-list");
  };

  const handleViewHistory = (patientId, returnView) => {
    setHistoryRoute({ patientId, returnView });
    setView("history");
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
  const savedProfiles = useMemo(() => listProfiles(), [profile, demoVersion]);
  const clinicianPatients = useMemo(
    () =>
      savedProfiles.map((savedProfile) => ({
        patientId: savedProfile.patientId,
        latestAssessment: latestAssessment(savedProfile.patientId),
        isDemo: savedProfile.isDemo === true,
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
    demoProfiles.forEach((demoProfile) => {
      const existingProfile = loadProfile(demoProfile.patientId);
      const hasRealHistory = listAssessments(demoProfile.patientId).some(
        (assessment) => !assessment.isDemo
      );
      if ((existingProfile && !existingProfile.isDemo) || hasRealHistory) {
        return;
      }
      saveProfile(demoProfile, { setActive: false });
      demoPatientHistory
        .filter((assessment) => assessment.patientId === demoProfile.patientId)
        .forEach(saveAssessment);
    });
    setDemoVersion((version) => version + 1);
  };

  const handleClearDemoHistory = () => {
    demoPatientIds.forEach((patientId) => {
      listAssessments(patientId)
        .filter((assessment) => assessment.isDemo)
        .forEach((assessment) => removeAssessment(assessment.id));
      if (loadProfile(patientId)?.isDemo) {
        clearProfile(patientId);
      }
    });
    setProfile(loadProfile());
    setDemoVersion((version) => version + 1);
  };

  const profileUtilityActions = (
    <>
      <button type="button" className="btn-secondary" onClick={handleRedoOnboarding}>
        Edit profile / redo onboarding
      </button>
      <button type="button" className="btn-secondary" onClick={handleLoadDemoHistory}>
        Load demo patients
      </button>
      <ConfirmButton
        label="Clear demo patients"
        confirmLabel="Yes, clear demo patients"
        message={CLEAR_DEMO_CONFIRMATION}
        onConfirm={handleClearDemoHistory}
      />
    </>
  );

  const loadDemoDashboard = async (patientId) => {
    const requestId = demoRequestId.current + 1;
    demoRequestId.current = requestId;
    setDemoLoadingPatientId(patientId);
    const history = listAssessments(patientId);
    if (!history.length) {
      setDemoLoadError(
        "This demo patient has no visit history. Reload the demo patients and try again."
      );
      setView("demo-loading");
      return;
    }

    setDemoLoadError(null);
    setView("demo-loading");
    try {
      // These records begin without predictions. Compute every point from the
      // live service so the displayed risk trajectory is never fabricated.
      const predictions = await Promise.all(
        history.map((assessment) => submitPatientData(assessment.patientData))
      );
      if (requestId !== demoRequestId.current) {
        return;
      }
      history.forEach((assessment, index) =>
        saveAssessment({ ...assessment, prediction: predictions[index] })
      );

      const fullHistory = listAssessments(patientId);
      const currentAssessment = fullHistory[fullHistory.length - 1];
      const currentPrediction = predictions[predictions.length - 1];
      const baselineHistory = buildBaselineHistory(fullHistory, listReadings(patientId));
      const resultBaselines = computeAllBaselines(baselineHistory, currentAssessment.patientData);
      const resultTrajectory = currentPrediction.top_disease
        ? buildRiskTrajectory(fullHistory, currentPrediction.top_disease)
        : [];

      handlePredictionReceived(
        currentAssessment.patientData,
        currentPrediction,
        resultBaselines,
        baselineHistory[0]?.timestamp,
        resultTrajectory,
        {}
      );
    } catch (error) {
      if (requestId !== demoRequestId.current) {
        return;
      }
      setDemoLoadError(error.message || "The model could not be reached. Please try again.");
    }
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
          onLoadDemoPatients={handleLoadDemoHistory}
          onClearDemoPatients={handleClearDemoHistory}
          onViewHistory={(patientId) => handleViewHistory(patientId, "clinician-list")}
        />
      )}

      {view === "demo-loading" && (
        <section className="demo-model-loading" aria-live="polite">
          <h1>Preparing demo dashboard</h1>
          {demoLoadError ? (
            <>
              <p>{demoLoadError}</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => loadDemoDashboard(demoLoadingPatientId)}
              >
                Retry model prediction
              </button>
            </>
          ) : (
            <p>
              The model is running on this patient&apos;s visit history. This can take up to a
              minute while the demo service wakes up.
            </p>
          )}
          <button type="button" className="btn-secondary" onClick={handleBackToPatientList}>
            Back to patient list
          </button>
        </section>
      )}

      {view === "onboarding" && <OnboardingWizard onComplete={handleOnboardingComplete} />}

      {view === "history" && historyRoute ? (
        <VisitHistory
          key={historyRoute.patientId}
          patientId={historyRoute.patientId}
          visits={listAssessments(historyRoute.patientId)}
          onBack={() => setView(historyRoute.returnView)}
        />
      ) : null}

      {view === "form" && (
        <>
          {role === ROLES.PATIENT && (
            <section className="patient-actions" aria-label="Patient actions">
              <PersonSwitcher
                profiles={savedProfiles}
                activePatientId={profile?.patientId}
                onSwitch={handleSwitchPerson}
                onAddPerson={handleAddPerson}
                addButtonClassName="btn-primary"
              />
              <div className="profile-actions patient-action-utilities">
                {profileUtilityActions}
              </div>
            </section>
          )}
          {role === ROLES.CLINICIAN && (
            // One row, not two: "Back to patient list" and the profile/demo
            // utilities are the same kind of action here, and two stacked
            // `.profile-actions` divs read as an accidental split.
            <div className="profile-actions">
              <button type="button" className="btn-secondary" onClick={handleBackToPatientList}>
                Back to patient list
              </button>
              {profileUtilityActions}
            </div>
          )}
          {profile?.patientId ? (
            // Keyed by patientId for the same reason the form is: device
            // readings are strictly per-person and must never carry over when
            // the active person changes.
            <VitalsProviderPanel
              key={`vitals-${profile.patientId}`}
              patientId={profile.patientId}
            />
          ) : null}
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
            onViewHistory={() => handleViewHistory(patientData?.patientId, "dashboard")}
          />
        </>
      )}
    </div>
  );
}
