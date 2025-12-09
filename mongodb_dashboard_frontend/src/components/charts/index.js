import { getChartTheme, withAlpha } from './chartTheme';

// PUBLIC_INTERFACE
export function getPrimaryBarGradient(id = 'primaryGradient') {
  /** Returns an object with id, start, end colors for use in <linearGradient>. */
  const theme = getChartTheme();
  const start = theme.primary; // base accent
  const end = withAlpha(theme.primaryActive || theme.primary, 0.85);
  return { id, start, end };
}

// PUBLIC_INTERFACE
export const oceanTheme = {
  colors: {
    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    primarySoft: 'rgba(37,99,235,0.12)',
    text: '#111827',
    tooltipBg: '#1F2937',
    tooltipText: '#F9FAFB',
  },
  typography: {
    fontSize: { sm: 12, md: 14 },
  },
  shadows: {
    medium: '0 6px 22px rgba(0,0,0,0.18)',
  },
};

// PUBLIC_INTERFACE
export function rechartsCommonAxes() {
  /** Common axis and grid styles shared by Recharts-based charts. */
  const theme = getChartTheme();
  return {
    axisStyle: { stroke: theme.axisTick },
    gridStyle: { stroke: theme.grid, strokeDasharray: '3 3' },
    tickStyle: { fill: theme.label },
  };
}

export { default as MostActiveUsersChart } from './MostActiveUsersChart';
export { default as UsersSummaryBarChart } from './UsersSummaryBarChart';
