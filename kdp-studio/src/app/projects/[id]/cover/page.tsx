import { notFound } from "next/navigation";
import { getProject } from "@/lib/services/project-service";
import { getCover, latestCoverExport } from "@/lib/services/cover-service";
import { getImageProviderInfo } from "@/lib/ai";
import { CoverScreen } from "@/components/cover/cover-screen";

export const dynamic = "force-dynamic";

export default async function CoverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [cover, latest] = await Promise.all([getCover(id), latestCoverExport(id)]);

  return (
    <CoverScreen
      project={project}
      initialCover={cover}
      provider={getImageProviderInfo()}
      latestExport={latest}
    />
  );
}
