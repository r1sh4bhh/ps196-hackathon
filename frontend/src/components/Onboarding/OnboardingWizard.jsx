import React, { useEffect, useMemo, useRef, useState } from "react";
import QuestionnaireStep from "./QuestionnaireStep";
import ReportUpload from "./ReportUpload";
import ReviewStep from "./ReviewStep";
import { validateQuestionnaire } from "../../constants/questionnaire";
import { saveDraft, loadDraft, clearDraft, saveProfile } from "../../storage/userProfileStore";
import "./onboarding.css";

const STEPS = ["Welcome", "Questionnaire", "Reports", "Review"];

function generatePatientId() {
  return `P${Date.now().toString(36).toUpperCase()}`;
}

export default function OnboardingWizard({ onComplete }) {
  const [draft] = useState(() => loadDraft());
  const [stepIndex, setStepIndex] = useState(() => draft?.stepIndex || 0);
  const [answers, setAnswers] = useState(() => draft?.answers || {});
  const [manualLabs, setManualLabs] = useState(() => draft?.manualLabs || {});
  const [observations, setObservations] = useState(() => draft?.observations || []);
  const [errors, setErrors] = useState({});
  const symptomInputRef = useRef(null);

  useEffect(() => {
    saveDraft({ stepIndex, answers, manualLabs, observations });
  }, [stepIndex, answers, manualLabs, observations]);

  const currentStep = STEPS[stepIndex];

  const goNext = () => {
    if (currentStep === "Questionnaire") {
      const flushedSymptoms = symptomInputRef.current?.flush();
      const nextAnswers = flushedSymptoms
        ? { ...answers, baseline_symptoms: flushedSymptoms }
        : answers;
      if (flushedSymptoms) setAnswers(nextAnswers);
      const { isValid, errors: validationErrors } = validateQuestionnaire(nextAnswers);
      setErrors(validationErrors);
      if (!isValid) {
        return;
      }
    }
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setStepIndex((index) => Math.max(index - 1, 0));
  };

  const handleFinish = () => {
    const patientId = generatePatientId();
    const profile = {
      patientId,
      questionnaire: answers,
      vitals: {},
      labs: {
        manual: manualLabs,
        fromReports: reportLabsFrom(observations),
      },
    };

    const saved = saveProfile(profile);
    clearDraft();
    onComplete(saved || profile);
  };

  const progress = useMemo(() => STEPS.map((label, index) => ({ label, index })), []);

  return (
    <div className="onboarding">
      <div className="onboarding-progress">
        {progress.map(({ label, index }) => (
          <div
            key={label}
            className={`onboarding-progress-step ${
              index < stepIndex ? "is-complete" : index === stepIndex ? "is-active" : ""
            }`}
          />
        ))}
      </div>
      <p className="onboarding-progress-label">
        Step {stepIndex + 1} of {STEPS.length}: {currentStep}
      </p>

      {currentStep === "Welcome" && (
        <section className="form-section">
          <h1>Welcome to PS196</h1>
          <p>
            Let&apos;s set up your baseline health profile. We&apos;ll ask a few questions and let
            you upload any recent lab reports. Everything is stored locally on this device.
          </p>
        </section>
      )}

      {currentStep === "Questionnaire" && (
        <QuestionnaireStep
          answers={answers}
          errors={errors}
          onChange={setAnswers}
          symptomInputRef={symptomInputRef}
        />
      )}

      {currentStep === "Reports" && (
        <ReportUpload observations={observations} onObservationsChange={setObservations} />
      )}

      {currentStep === "Review" && (
        <ReviewStep
          answers={answers}
          observations={observations}
          manualLabs={manualLabs}
          onManualLabsChange={setManualLabs}
          onObservationsChange={setObservations}
        />
      )}

      <div className="onboarding-actions">
        <button type="button" className="btn-secondary" onClick={goBack} disabled={stepIndex === 0}>
          Back
        </button>
        {currentStep === "Review" ? (
          <button type="button" className="btn-primary" onClick={handleFinish}>
            Finish
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={goNext}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}

function reportLabsFrom(observations) {
  const labs = {};
  for (const observation of observations || []) {
    if (observation.status === "parsed" && observation.key) {
      labs[observation.key] = observation.value;
    }
  }
  return labs;
}
