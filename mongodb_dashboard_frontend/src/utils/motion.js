/**
 * PUBLIC_INTERFACE
 * shouldReduceMotion
 * Returns true when the user's OS/browser has reduced-motion enabled.
 */
export const shouldReduceMotion = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * PUBLIC_INTERFACE
 * motionTokens
 * Returns default motion tokens used throughout the app.
 */
export const motionTokens = () => ({
  duration200: '200ms',
  duration250: '250ms',
  duration300: '300ms',
  ease: 'cubic-bezier(0.2, 0, 0, 1)',
});

/**
 * PUBLIC_INTERFACE
 * transitionStyle
 * Convenience helper to build a standard transition style object for inline styles.
 * Example: style={{ ...transitionStyle("opacity, transform") }}
 */
export const transitionStyle = (props = 'all') => {
  const t = motionTokens();
  return shouldReduceMotion()
    ? { transition: 'none' }
    : { transition: `${props} ${t.duration250} ${t.ease}` };
};

// Default export assigned after declarations to satisfy lint rules
const motion = { shouldReduceMotion, motionTokens, transitionStyle };
export default motion;
