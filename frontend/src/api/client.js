// `??`, not `||`: for the single-container deployment the frontend is built
// with VITE_API_BASE_URL= (empty) so requests go to the same origin. An empty
// string is falsy, so `||` would fall back to localhost:4000 in production --
// the browser would call the user's own machine, the request would fail, and
// predictService.js would silently serve a mock prediction instead. Only an
// unset (undefined) value should fall back to the local dev server.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message = body?.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, body);
  }

  return body;
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export const apiClient = {
  get: (path) => request(path, { method: "GET" }),
  post: (path, data) => request(path, { method: "POST", body: JSON.stringify(data) }),
};
