export const oceanTheme = {
  // Ocean Professional palette
  colors: {
    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    primarySoft: 'rgba(37, 99, 235, 0.12)',
    secondary: '#F59E0B',
    error: '#EF4444',
    background: '#f9fafb',
    surface: '#ffffff',
    text: '#111827',
    textMuted: 'rgba(17, 24, 39, 0.65)',
    grid: 'rgba(17, 24, 39, 0.08)',
    border: 'rgba(17, 24, 39, 0.10)',
    tooltipBg: '#111827',
    tooltipText: '#ffffff'
  },
  radii: {
    sm: 6,
    md: 10,
    lg: 14
  },
  shadows: {
    soft: '0 1px 2px rgba(0,0,0,0.06), 0 1px 1px rgba(0,0,0,0.04)',
    medium: '0 4px 12px rgba(0,0,0,0.08)'
  },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    fontSize: {
      xs: '11px',
      sm: '12px',
      md: '14px'
    },
    axis: {
      color: 'rgba(17, 24, 39, 0.8)',
      tickColor: 'rgba(17, 24, 39, 0.75)',
      labelColor: 'rgba(17, 24, 39, 0.9)'
    }
  }
};

/**
 * PUBLIC_INTERFACE
 * Returns a gradient definition for primary bars to be used in <defs>.
 */
export function getPrimaryBarGradient(id = 'oceanPrimaryGradient') {
  /** Creates a subtle vertical gradient using the theme primary color. */
  const start = oceanTheme.colors.primary;
  const end = 'rgba(37, 99, 235, 0.75)';
  return { id, start, end };
}

/**
 * PUBLIC_INTERFACE
 * Common recharts style props for axes and grid lines.
 */
export function rechartsCommonAxes() {
  /** Returns standard axis and grid styles consistent with Ocean Professional theme. */
  return {
    axisStyle: {
      stroke: oceanTheme.colors.grid,
      fontSize: oceanTheme.typography.fontSize.sm,
      fontFamily: oceanTheme.typography.fontFamily,
      fill: oceanTheme.typography.axis.tickColor
    },
    gridStyle: {
      stroke: oceanTheme.colors.grid,
      strokeDasharray: '3 3'
    },
    tickStyle: {
      fill: oceanTheme.typography.axis.tickColor
    }
  };
}

/**
 * PUBLIC_INTERFACE
 * Button styles for time range selectors (Daily/Weekly/Monthly/Custom)
 */
export const rangeSelectorClasses = {
  container: 'range-selector',
  chip: 'range-chip',
  chipActive: 'range-chip--active'
};

/**
 * PUBLIC_INTERFACE
 * getChartTheme
 * Compatibility helper used by some existing charts.
 * Returns a flat object with color tokens expected by legacy components.
 */
export function getChartTheme() {
  const t = oceanTheme;
  return {
    primary: t.colors.primary,
    primaryActive: t.colors.primaryHover,
    primaryHover: t.colors.primaryHover,
    axisTick: 'rgba(17, 24, 39, 0.75)',
    grid: t.colors.grid,
    label: 'rgba(17, 24, 39, 0.75)',
    tooltip: {
      bg: t.colors.tooltipBg,
      text: t.colors.tooltipText,
      border: 'rgba(255,255,255,0.08)'
    },
    legend: {
      text: t.colors.text
    }
  };
}
