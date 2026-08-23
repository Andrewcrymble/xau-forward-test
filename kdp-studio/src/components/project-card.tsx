import Link from "next/link";
import type { ProjectDto } from "@/lib/types";
import { audienceLabel, styleLabel } from "@/lib/config/book-options";
import { ProgressBar } from "@/components/ui";

const STATUS_LABELS: Record<string, string> = {
  setup: "Setup",
  planning: "Planning",
  generating: "Generating images",
  reviewing: "Reviewing images",
  interior: "Building interior",
  cover: "Designing cover",
  listing: "Writing listing",
  complete: "Complete",
};

export function ProjectCard({ project }: { project: ProjectDto }) {
  const lastEdited = new Date(project.updatedAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Cover thumbnail placeholder until cover artwork exists (Phase 5) */}
      <div className="flex h-36 items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
        <span className="px-6 text-center text-lg font-bold text-stone-400">
          {project.title}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="font-semibold text-stone-900">{project.name}</h3>
          <p className="text-sm text-stone-500">
            {project.niche} · {audienceLabel(project.targetAudience, project.customAudience)} ·{" "}
            {styleLabel(project.style, project.customStyle)}
          </p>
        </div>
        <div className="mt-auto space-y-1.5">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>{STATUS_LABELS[project.status] ?? project.status}</span>
            <span>
              {project.approvedPageCount} / {project.numberOfDesigns} pages approved
            </span>
          </div>
          <ProgressBar value={project.approvedPageCount} max={project.numberOfDesigns} />
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-stone-400">Edited {lastEdited}</span>
            <Link
              href={`/projects/${project.id}/setup`}
              className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-700"
            >
              Continue →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
