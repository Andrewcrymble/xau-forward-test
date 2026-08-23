import { notFound } from "next/navigation";
import { getProject } from "@/lib/services/project-service";
import { BookSetupForm } from "@/components/book-setup-form";
import { DeleteProjectButton } from "@/components/delete-project-button";

export const dynamic = "force-dynamic";

export default async function ProjectSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <div className="space-y-8">
      <BookSetupForm mode="edit" project={project} />
      <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
        <h2 className="text-sm font-semibold text-red-800">Danger zone</h2>
        <p className="mb-3 mt-1 text-xs text-red-700">
          Deleting a project removes everything it contains.
        </p>
        <DeleteProjectButton projectId={project.id} projectName={project.name} />
      </div>
    </div>
  );
}
