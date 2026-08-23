import Link from "next/link";
import { listProjects } from "@/lib/services/project-service";
import { audienceLabel } from "@/lib/config/book-options";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Projects</h1>
          <p className="text-sm text-stone-500">All colouring book projects</p>
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
          title="No projects yet"
          description="Projects you create will appear here so you can leave and return any time."
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
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Niche</th>
                <th className="px-5 py-3">Audience</th>
                <th className="px-5 py-3">Pages</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Last edited</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-stone-50">
                  <td className="px-5 py-3 font-medium text-stone-900">
                    {p.name}
                    <span className="block text-xs font-normal text-stone-500">
                      {p.title}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-stone-600">{p.niche}</td>
                  <td className="px-5 py-3 text-stone-600">
                    {audienceLabel(p.targetAudience, p.customAudience)}
                  </td>
                  <td className="px-5 py-3 text-stone-600">
                    {p.approvedPageCount}/{p.numberOfDesigns}
                  </td>
                  <td className="px-5 py-3 capitalize text-stone-600">{p.status}</td>
                  <td className="px-5 py-3 text-stone-500">
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/projects/${p.id}/setup`}
                      className="font-semibold text-stone-900 underline-offset-2 hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
