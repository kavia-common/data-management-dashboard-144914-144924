 /**
  * PUBLIC_INTERFACE
  * shapeSessionsTrendSeries
  * Converts { data: [{date: ISOString, count: number}], meta } into [{label: 'YYYY-MM-DD', value: number}]
  * - Uses local time for display label while keeping UTC integrity from server.
  * - Ensures labels are monotonic ascending.
  * @param {{data?: Array<{date: string, count: number}>, meta?: {interval?: string, start?: string, end?: string}}} payload
  * @param {Object} [opts]
  * @param {boolean} [opts.debug=false]
  * @returns {{ series: Array<{label: string, value: number}>, meta: any }}
  */
 export function shapeSessionsTrendSeries(payload, opts = {}) {
   const debug = !!opts.debug;
   const rows = Array.isArray(payload?.data) ? payload.data : [];
   const series = rows
     .map((row) => {
       const d = new Date(row.date);
       if (Number.isNaN(d.getTime())) return null;
       // Local display label while using the UTC date parts for stability
       const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
       return { label, value: Number(row.count || 0) };
     })
     .filter(Boolean)
     .sort((a, b) => (a.label > b.label ? 1 : a.label < b.label ? -1 : 0));

   if (debug) {
     // eslint-disable-next-line no-console
     console.log('[shapeSessionsTrendSeries] shaped', { series, meta: payload?.meta });
   }

   return { series, meta: payload?.meta || {} };
 }
