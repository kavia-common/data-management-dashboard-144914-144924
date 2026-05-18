import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import PropTypes from "prop-types";

/**
 * PUBLIC_INTERFACE
 * QuickRangeProvider
 * Provides a single source of truth for Users Analytics quick/custom date range selection.
 *
 * The provider exposes:
 * - selection: { mode: 'quick'|'custom', quickValue: number, customStart: string|null, customEnd: string|null }
 * - computed params: { fromParam: string|null, toParam: string|null, label: string }
 * - setters: setQuickRange(number), setCustomRange(startYmd, endYmd), clearCustom()
 *
 * Notes:
 * - quickValue semantics match the existing UsersAnalyticsPanel implementation:
 *   0 = today, -1 = yesterday, >0 = last N days (inclusive)
 * - fromParam/toParam are formatted to match current backend expectations:
 *   - quick => ISO strings with UTC day bounds
 *   - custom => YYYY-MM-DD strings (backend expands to full-day UTC bounds)
 */
const QuickRangeContext = createContext(null);

function fmtYmd(dt) {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function utcStartOfDay(y, m, d) {
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
}

function utcEndOfDay(y, m, d) {
  return new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
}

function computeParams(selection) {
  const { mode, quickValue, customStart, customEnd } = selection;

  // Custom range => send YYYY-MM-DD values (backend expands)
  if (mode === "custom" && customStart && customEnd) {
    return { fromParam: customStart, toParam: customEnd };
  }

  // Quick range => send ISO bounds (UTC)
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();

  if (quickValue === 0) {
    return {
      fromParam: utcStartOfDay(y, m, d).toISOString(),
      toParam: utcEndOfDay(y, m, d).toISOString(),
    };
  }

  if (quickValue === -1) {
    const yd = new Date(Date.UTC(y, m, d - 1));
    return {
      fromParam: utcStartOfDay(yd.getUTCFullYear(), yd.getUTCMonth(), yd.getUTCDate()).toISOString(),
      toParam: utcEndOfDay(yd.getUTCFullYear(), yd.getUTCMonth(), yd.getUTCDate()).toISOString(),
    };
  }

  if (Number.isFinite(Number(quickValue)) && Number(quickValue) > 0) {
    const end = utcEndOfDay(y, m, d);
    const sd = new Date(Date.UTC(y, m, d));
    sd.setUTCDate(sd.getUTCDate() - (Number(quickValue) - 1));
    const start = utcStartOfDay(sd.getUTCFullYear(), sd.getUTCMonth(), sd.getUTCDate());
    return { fromParam: start.toISOString(), toParam: end.toISOString() };
  }

  // Fallback: omit params and let backend default
  return { fromParam: null, toParam: null };
}

function computeLabel(fromParam, toParam) {
  try {
    if (!fromParam && !toParam) return "Today";

    /**
     * IMPORTANT:
     * Quick ranges compute UTC day bounds (00:00:00.000Z .. 23:59:59.999Z).
     * If we format these in the user's local timezone, the UTC end-of-day can roll over
     * to the next local day (e.g., UTC+05:30 shows "tomorrow"), producing labels like:
     *   "16 Feb 2026 – 17 Feb 2026"
     * even though the range is intended to be "today" in UTC.
     *
     * Fix: format the label in UTC to match the actual range semantics we send to the API.
     */
    const fmt = (d) =>
      d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });

    const isYmd = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const start = isYmd(fromParam) ? new Date(`${fromParam}T00:00:00.000Z`) : new Date(fromParam);
    const end = isYmd(toParam) ? new Date(`${toParam}T23:59:59.999Z`) : new Date(toParam);

    return `${fmt(start)} – ${fmt(end)}`;
  } catch {
    return "";
  }
}

// PUBLIC_INTERFACE
export function QuickRangeProvider({ children, defaultQuickValue = 0 }) {
  const [selection, setSelection] = useState({
    mode: "quick",
    quickValue: defaultQuickValue,
    customStart: null,
    customEnd: null,
  });

  const setQuickRange = useCallback((value) => {
    setSelection({ mode: "quick", quickValue: Number(value), customStart: null, customEnd: null });
  }, []);

  const setCustomRange = useCallback((startYmd, endYmd) => {
    setSelection({ mode: "custom", quickValue: defaultQuickValue, customStart: startYmd || null, customEnd: endYmd || null });
  }, [defaultQuickValue]);

  const clearCustom = useCallback(() => {
    setSelection((prev) => ({ ...prev, mode: "quick", customStart: null, customEnd: null }));
  }, []);

  const { fromParam, toParam } = useMemo(() => computeParams(selection), [selection]);
  const label = useMemo(() => computeLabel(fromParam, toParam), [fromParam, toParam]);

  const value = useMemo(
    () => ({
      selection,
      fromParam,
      toParam,
      label,
      setQuickRange,
      setCustomRange,
      clearCustom,
    }),
    [selection, fromParam, toParam, label, setQuickRange, setCustomRange, clearCustom]
  );

  return <QuickRangeContext.Provider value={value}>{children}</QuickRangeContext.Provider>;
}

QuickRangeProvider.propTypes = {
  children: PropTypes.node,
  defaultQuickValue: PropTypes.number,
};

// PUBLIC_INTERFACE
export function useQuickRange() {
  const ctx = useContext(QuickRangeContext);
  if (!ctx) {
    throw new Error("useQuickRange must be used within a QuickRangeProvider");
  }
  return ctx;
}
