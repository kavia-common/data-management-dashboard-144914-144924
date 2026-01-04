// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

/**
 * Recharts' ResponsiveContainer relies on ResizeObserver which is not present in JSDOM by default.
 * Provide a minimal polyfill so chart-related component tests don't crash.
 */
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== "undefined" && typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = ResizeObserverMock;
}

if (typeof global !== "undefined" && typeof global.ResizeObserver === "undefined") {
  global.ResizeObserver = ResizeObserverMock;
}
