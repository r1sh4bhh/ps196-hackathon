import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The base URL is read once at module load, so each case has to reset the
// module registry and re-import with a different env value.
async function loadClientWith(baseUrl) {
  vi.resetModules();
  vi.stubEnv("VITE_API_BASE_URL", baseUrl);
  return import("../client");
}

describe("apiClient base URL", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok" }),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    delete globalThis.fetch;
  });

  // Regression guard for the `??` in client.js: with `||` an empty string
  // falls through to localhost:4000, which in production means the browser
  // calls the user's own machine and silently gets a mock prediction.
  it("treats an empty VITE_API_BASE_URL as same-origin", async () => {
    const { apiClient } = await loadClientWith("");

    await apiClient.get("/health");

    expect(globalThis.fetch).toHaveBeenCalledWith("/health", expect.anything());
  });

  it("falls back to the local dev server when VITE_API_BASE_URL is unset", async () => {
    const { apiClient } = await loadClientWith(undefined);

    await apiClient.get("/health");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/health",
      expect.anything()
    );
  });

  it("uses an explicit base URL when one is configured", async () => {
    const { apiClient } = await loadClientWith("https://ps196.example.com");

    await apiClient.get("/health");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://ps196.example.com/health",
      expect.anything()
    );
  });
});
