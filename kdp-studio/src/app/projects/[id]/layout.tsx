import { notFound } from "next/navigation";
import { getProject } from "@/lib/services/project-service";
import { ProjectNav } from "@/components/project-nav";
import { audienceLabel } from "@/lib/config/book-options";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{project.name}</h1>
        <p className="text-sm text-stone-500">
          {project.title} · {project.niche} ·{" "}
          {audienceLabel(project.targetAudience, project.customAudience)} ·{" "}
          {project.numberOfDesigns} pages
        </p>
      </div>
      <ProjectNav projectId={project.id} />
      {children}
    </div>
  );
}
