// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

/**
 * JSDOM does not provide ResizeObserver, but Recharts' ResponsiveContainer
 * relies on it. Provide a minimal no-op implementation for unit tests.
 */
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof global.ResizeObserver === "undefined") {
  global.ResizeObserver = ResizeObserverMock;
}
