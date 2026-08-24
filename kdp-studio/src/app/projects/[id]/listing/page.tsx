import { notFound } from "next/navigation";
import { getProject } from "@/lib/services/project-service";
import { getListing } from "@/lib/services/listing-service";
import { getTextProviderInfo } from "@/lib/ai";
import { ListingScreen } from "@/components/listing/listing-screen";

export const dynamic = "force-dynamic";

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const listing = await getListing(id);

  return (
    <ListingScreen
      project={project}
      initialListing={listing}
      provider={getTextProviderInfo()}
    />
  );
}
