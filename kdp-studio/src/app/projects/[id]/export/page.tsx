import { notFound } from "next/navigation";
import { getProject } from "@/lib/services/project-service";
import { getExportReadiness } from "@/lib/services/export-service";
import { ExportScreen } from "@/components/export/export-screen";

export const dynamic = "force-dynamic";

export default async function ExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const readiness = await getExportReadiness(id);

  return <ExportScreen project={project} readiness={readiness} />;
}
