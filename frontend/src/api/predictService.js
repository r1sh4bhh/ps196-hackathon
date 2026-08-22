import { apiClient, ApiError } from "./client";
import { getMockPrediction } from "../mocks/mockPrediction";

const USE_MOCK =
  import.meta.env.VITE_USE_MOCK_API === "true" || import.meta.env.VITE_USE_MOCK_API === undefined;

export async function submitPatientData(patientData) {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return getMockPrediction(patientData);
  }

  try {
    const response = await apiClient.post("/predict", { patientData });
    if (response.status !== "success") {
      throw new ApiError(response.message || "Prediction failed", 400, response);
    }
    return response.prediction;
  } catch (error) {
    console.warn("[predictService] Backend unavailable, using mock:", error.message);
    return getMockPrediction(patientData);
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
