// The set of vitals providers this build can offer. Only the simulated source
// exists today; no real device integration is implemented, and none is implied.

import { simulatedVitalsProvider } from "./simulatedVitalsProvider";
import { validateProvider } from "./vitalsProvider";

const PROVIDERS = [simulatedVitalsProvider];

export function listProviders() {
  return PROVIDERS.filter((provider) => validateProvider(provider).valid);
}

export function getProvider(providerId) {
  return listProviders().find((provider) => provider.id === providerId) || null;
}
