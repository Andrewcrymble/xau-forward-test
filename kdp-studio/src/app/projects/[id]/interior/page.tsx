import { notFound } from "next/navigation";
import { getProject } from "@/lib/services/project-service";
import {
  computeInteriorLayout,
  latestInteriorExport,
} from "@/lib/services/interior-service";
import { InteriorScreen } from "@/components/interior/interior-screen";

export const dynamic = "force-dynamic";

export default async function InteriorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [layout, latest] = await Promise.all([
    computeInteriorLayout(id),
    latestInteriorExport(id),
  ]);

  return (
    <InteriorScreen
      project={project}
      initialLayout={layout}
      latestExport={latest}
    />
  );
}
