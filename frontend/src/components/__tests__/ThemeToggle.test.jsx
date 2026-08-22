import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ThemeToggle from "../ThemeToggle";

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  window.matchMedia = vi.fn(() => ({ matches: false }));
  document.documentElement.removeAttribute("data-theme");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ThemeToggle", () => {
  it("uses the system preference when no saved theme exists", () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));

    act(() => root.render(<ThemeToggle />));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(container.querySelector("button").textContent).toContain("Light mode");
  });

  it("persists the selected theme", () => {
    act(() => root.render(<ThemeToggle />));

    act(() => container.querySelector("button").click());

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("ps196-theme")).toBe("dark");
  });
});
