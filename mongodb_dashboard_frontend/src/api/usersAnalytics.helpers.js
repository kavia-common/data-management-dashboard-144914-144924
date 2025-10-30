 // PUBLIC_INTERFACE
 /**
  * normalizeUsersAnalyticsFilters
  * Normalize UI Users Analytics filters to backend query parameters.
  * - organization -> organization_id
  * - department -> department
  * - status -> status (optional)
  * - from, to -> ISO strings
  * Optionally default status to 'active' for engagement metrics when not provided.
  *
  * @param {{ organization?: string, organization_id?: string, department?: string, status?: string, from?: string, to?: string }} filters
  * @param {{ defaultActive?: boolean }} options
  * @returns {{ organization_id?: string, department?: string, status?: string, from?: string, to?: string }}
  */
 export function normalizeUsersAnalyticsFilters(filters = {}, { defaultActive = false } = {}) {
   const {
     organization,
     organization_id,
     department,
     status,
     from,
     to,
   } = filters || {};
   const out = {
     organization_id: organization_id ?? organization ?? '',
     department: department ?? '',
     status: (status ?? '').trim(),
     from: from ?? '',
     to: to ?? '',
   };
   if (defaultActive && !out.status) {
     out.status = 'active';
   }
   Object.keys(out).forEach((k) => {
     if (out[k] === '' || out[k] === undefined || out[k] === null) delete out[k];
   });
   return out;
 }
 
 export default { normalizeUsersAnalyticsFilters };
