import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("uses same-origin requests when VITE_API_BASE_URL is explicitly empty", async () => {
  vi.stubEnv("VITE_API_BASE_URL", "");
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ status: "ok" }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const { apiClient } = await import("../client");
  await apiClient.get("/health");

  expect(fetchMock).toHaveBeenCalledWith("/health", expect.objectContaining({ method: "GET" }));
});
