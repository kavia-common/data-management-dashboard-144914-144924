 /**
  * CHANGE LOG (Users Projects dedupe + cancel):
  * - Uses shared hook useUserProjects which dedupes and cancels in-flight requests by key.
  * - Restores required call to /api/users/:id/projects for this view when preloaded data is absent.
  * - Ensures one request per change (page, limit, from, to, userId), and cancels inflight on parameter change.
  * - Keeps UI and pagination behavior intact.
  */

 import React, { useMemo, useState } from 'react';
 import PropTypes from 'prop-types';
 import { useAuth } from '../../context/AuthContext';
 import { useUserProjects } from '../../hooks/useUserProjects';

 /**
  * PUBLIC_INTERFACE
  * ProjectDetails
  * This component renders project details for a selected user within the Users modal tab.
  * It attempts to read project details (project_id, project_name) from the selectedUser object when available.
  * If not present, it will fetch from the backend using the /api/users/{userId}/projects endpoint,
  * requiring tenant/organization scoping taken from auth context when available.
  */
 export default function ProjectDetails({ selectedUser }) {
   const { organizationId: authOrgId } = useAuth?.() || {};
   const [projects, setProjects] = useState([]);

   // Local pagination state to drive a single request per change.
   const [page, setPage] = useState(1);
   const [limit, setLimit] = useState(10);

   // Optional time filters if present on the selected user context; kept stable to avoid duplicate fetches.
   const from = selectedUser?.from ?? null;
   const to = selectedUser?.to ?? null;

   const userId = useMemo(() => {
     if (!selectedUser) return null;
     return selectedUser._id || selectedUser.id || selectedUser.user_id || null;
   }, [selectedUser]);

   const orgId = useMemo(() => {
     return authOrgId || selectedUser?.organization_id || selectedUser?.tenant_id || selectedUser?.tenantId || null;
   }, [authOrgId, selectedUser]);

   const preloadedProjects = useMemo(() => {
     if (!selectedUser) return null;
     // Try common shapes possibly embedded on user object
     // Accept: selectedUser.projects (array), or single project fields at root
     if (Array.isArray(selectedUser.projects) && selectedUser.projects.length > 0) {
       // Normalize map to { project_id, project_name }
       return selectedUser.projects
         .map((p) => ({
           project_id: p.project_id || p.projectId || p.id || null,
           project_name: p.project_name || p.projectName || p.name || null,
           last_activity: p.last_activity || p.lastActivity || null,
         }))
         .filter((p) => p.project_id || p.project_name);
     }
     const single = {
       project_id:
         selectedUser.project_id ||
         selectedUser.projectId ||
         (selectedUser.project && (selectedUser.project.id || selectedUser.project.project_id)),
       project_name:
         selectedUser.project_name ||
         selectedUser.projectName ||
         (selectedUser.project && (selectedUser.project.name || selectedUser.project.project_name)),
     };
     if (single.project_id || single.project_name) {
       return [single];
     }
     return null;
   }, [selectedUser]);

   // Use preloaded projects when present to avoid any API request
   const {
     projects: fetchedProjects,
     loading,
     error,
   } = useUserProjects({
     userId,
     organizationId: orgId,
     page,
     limit,
     from,
     to,
   });

   useMemo(() => {
     if (preloadedProjects) {
       setProjects(preloadedProjects);
     } else {
       setProjects(Array.isArray(fetchedProjects) ? fetchedProjects : []);
     }
   }, [preloadedProjects, fetchedProjects]);

   if (!selectedUser) {
     return (
       <div className="p-4 text-sm text-gray-600">
         No user selected.
       </div>
     );
   }

   return (
     <div className="p-4">
       {/* Simple pagination controls to drive a single fetch per change */}
       {!preloadedProjects && (
         <div className="mb-3 flex items-center gap-2">
           <label className="text-xs text-gray-300">
             Page:
             <input
               aria-label="Projects page"
               type="number"
               min={1}
               value={page}
               onChange={(e) => setPage(Math.max(1, Number(e.target.value) || 1))}
               className="ml-1 rounded bg-gray-800 text-white px-2 py-1 w-20"
             />
           </label>
           <label className="text-xs text-gray-300">
             Limit:
             <input
               aria-label="Projects page size"
               type="number"
               min={1}
               max={200}
               value={limit}
               onChange={(e) => {
                 const n = Number(e.target.value) || 10;
                 setLimit(Math.min(200, Math.max(1, n)));
                 setPage(1); // reset to first page when limit changes
               }}
               className="ml-1 rounded bg-gray-800 text-white px-2 py-1 w-24"
             />
           </label>
           {from && to && (
             <span className="text-xs text-gray-400 ml-2">
               Range: {new Date(from).toLocaleDateString()} – {new Date(to).toLocaleDateString()}
             </span>
           )}
         </div>
       )}

       {loading && (
         <div className="p-2 text-sm">
           Loading project details...
         </div>
       )}

       {!loading && error && (
         <div className="p-2 text-sm text-red-500">{error}</div>
       )}

       {!loading && !error && (!projects || projects.length === 0) && (
         <div className="p-2 text-sm">No project details available for this user.</div>
       )}

       {!loading && !error && Array.isArray(projects) && projects.length > 0 && (
         <ul className="space-y-2">
           {projects.map((p, idx) => (
             <li
               key={`${p.project_id || 'unknown'}-${idx}`}
               className="rounded-md border border-gray-700 bg-gray-900 p-3 shadow-sm"
             >
               <div className="text-sm space-y-1">
                 {/* Project Name */}
                 <div className="font-medium text-white">
                   <span className="font-semibold">Project Name:</span>
                   <span className="font-mono ml-1"> {p.project_name || '—'}</span>
                 </div>

                 {/* Project ID */}
                 <div className="text-white">
                   <span className="font-semibold">Project ID:</span>
                   <span className="font-mono ml-1">{p.project_id || '—'}</span>
                 </div>

                 {/* Last Activity */}
                 {p.last_activity && (
                   <div className="text-xs text-gray-300">
                     <span className="font-semibold">Last activity:</span>
                     <span className="ml-1">
                       {new Date(p.last_activity).toLocaleString()}
                     </span>
                   </div>
                 )}
               </div>
             </li>
           ))}
         </ul>
       )}
     </div>
   );
 }

 ProjectDetails.propTypes = {
   selectedUser: PropTypes.object,
 };
