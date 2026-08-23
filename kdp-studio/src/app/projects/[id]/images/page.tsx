import { notFound } from "next/navigation";
import { getProject } from "@/lib/services/project-service";
import { listPages } from "@/lib/services/page-service";
import { getImageProviderInfo } from "@/lib/ai";
import { ImagesScreen } from "@/components/images/images-screen";

export const dynamic = "force-dynamic";

const PLAN_APPROVED_STATUSES = new Set([
  "plan_approved",
  "generating",
  "reviewing",
  "interior",
  "cover",
  "listing",
  "complete",
]);

export default async function ImagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const pages = await listPages(id);
  const provider = getImageProviderInfo();

  return (
    <ImagesScreen
      project={project}
      initialPages={pages}
      provider={provider}
      planApproved={PLAN_APPROVED_STATUSES.has(project.status)}
    />
  );
}
