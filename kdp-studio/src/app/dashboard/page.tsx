import Link from "next/link";
import { listProjects } from "@/lib/services/project-service";
import { ProjectCard } from "@/components/project-card";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const projects = await listProjects();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>
          <p className="text-sm text-stone-500">
            Your colouring book projects at a glance
          </p>
        </div>
        <Link
          href="/create"
          className="rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-700"
        >
          + Create New Book
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="No books yet"
          description="Create your first colouring book project. Enter a niche or idea and the studio will guide you from plan to KDP-ready files."
          action={
            <Link
              href="/create"
              className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-700"
            >
              + Create New Book
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
