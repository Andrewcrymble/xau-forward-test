import { listNicheIdeas } from "@/lib/services/niche-service";
import { NicheFinder } from "@/components/niches/niche-finder";

export const dynamic = "force-dynamic";

export default async function NichesPage() {
  const ideas = await listNicheIdeas();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Find Me a Niche</h1>
        <p className="text-sm text-stone-500">
          Turn a broad subject into specific, differentiated colouring-book
          concepts — explore the niche tree, go deeper, combine niches, plan
          series and build books.
        </p>
      </div>
      <NicheFinder initialIdeas={ideas} />
    </div>
  );
}
