import React from "react";
import { render, screen } from "@testing-library/react";
import { QuickRangeProvider, useQuickRange } from "../quickRangeContext";

/**
 * PUBLIC_INTERFACE
 * TestOnlyLabelReader
 * Small helper component to read and render the computed label from QuickRangeContext.
 */
function TestOnlyLabelReader() {
  const { label } = useQuickRange();
  return <div data-testid="label">{label}</div>;
}

describe("Users quick range label formatting", () => {
  test("formats UTC day bounds without rolling over to next day in positive timezones", () => {
    // Simulate a positive timezone where local time would normally roll 23:59Z into the next day.
    const originalTZ = process.env.TZ;
    process.env.TZ = "Asia/Kolkata";

    render(
      <QuickRangeProvider defaultQuickValue={0}>
        <TestOnlyLabelReader />
      </QuickRangeProvider>
    );

    // The provider uses "now" so we can't assert a specific date here without faking timers.
    // But we *can* assert that the label's start and end days match when using quick "Today":
    // it should not show "... – tomorrow" due to UTC end-of-day shifting locally.
    const label = screen.getByTestId("label").textContent || "";

    // If it were using local formatting, "Today" could show two different days.
    // With UTC formatting, start and end should be the same day for "Today".
    const parts = label.split("–").map((s) => s.trim());
    expect(parts.length).toBe(2);
    expect(parts[0]).toBe(parts[1]);

    // Restore TZ
    process.env.TZ = originalTZ;
  });
});
