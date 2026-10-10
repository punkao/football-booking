import { ProjectNav } from "@/components/ProjectUi";

/** Phase 10 portal for the instructor: overview, documents, test cases, traceability, test reports */
export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="project-portal" lang="th">
      <div className="container">
        <ProjectNav />
      </div>
      {children}
    </div>
  );
}
