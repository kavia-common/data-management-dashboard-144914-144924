 /**
  * PUBLIC_INTERFACE
  * formatDateUTC(date)
  * Formats a Date object to YYYY-MM-DD in UTC.
  */
export function formatDateUTC(date) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
