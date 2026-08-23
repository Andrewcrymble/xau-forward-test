import { notFound } from "next/navigation";
import { getProject } from "@/lib/services/project-service";
import { listPages } from "@/lib/services/page-service";
import { getTextProviderInfo } from "@/lib/ai";
import { BookPlanEditor } from "@/components/plan/book-plan-editor";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [pages, provider] = await Promise.all([
    listPages(id),
    Promise.resolve(getTextProviderInfo()),
  ]);

  return (
    <BookPlanEditor project={project} initialPages={pages} provider={provider} />
  );
}
