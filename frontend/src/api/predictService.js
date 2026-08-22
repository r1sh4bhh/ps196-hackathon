import { apiClient, ApiError } from "./client";
import { getMockPrediction } from "../mocks/mockPrediction";

// Mock is strictly opt-in. An unset VITE_USE_MOCK_API used to mean "mock",
// which silently showed fabricated risk scores in the dashboard while the
// real ML backend sat idle and unreachable -- indistinguishable from a
// working demo. Defaulting to the real backend makes that failure loud.
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === "true";

// Every mock result is tagged so the UI can render a visible "not a real
// prediction" badge. Never strip `source` on the way to the dashboard.
function taggedMock(patientData, reason) {
  const mock = getMockPrediction(patientData);
  return {
    ...mock,
    source: "mock",
    fallback_reason: reason,
  };
}

export async function submitPatientData(patientData) {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return taggedMock(patientData, "VITE_USE_MOCK_API=true");
  }

  try {
    const response = await apiClient.post("/predict", { patientData });
    if (response.status !== "success") {
      throw new ApiError(response.message || "Prediction failed", 400, response);
    }
    // The backend sets `source` itself ("model", or "mock" if its own Python
    // bridge fell back). Pass it through untouched rather than assuming the
    // numbers came from a model.
    return response.prediction;
  } catch (error) {
    console.warn(
      "[predictService] Backend unavailable, using mock:",
      error.message
    );
    return taggedMock(patientData, error.message);
  }
}

export async function checkBackendHealth() {
  try {
    const response = await apiClient.get("/health");
    return response.status === "ok";
  } catch {
    return false;
  }
}
