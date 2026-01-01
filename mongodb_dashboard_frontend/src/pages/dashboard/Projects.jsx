import React from "react";
import ProjectsList from "../../components/ProjectsList.jsx";

/**
 * PUBLIC_INTERFACE
 * Projects dashboard page
 * Shows the paginated Projects list.
 */
export default function Projects() {
  return (
    <div>
      <ProjectsList title="Projects" subtitle="All projects" />
    </div>
  );
}
