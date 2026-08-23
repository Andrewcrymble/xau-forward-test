"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "setup", label: "Setup" },
  { slug: "plan", label: "Book Plan" },
  { slug: "images", label: "Images" },
  { slug: "interior", label: "Interior" },
  { slug: "cover", label: "Cover" },
  { slug: "listing", label: "Listing" },
  { slug: "export", label: "Export" },
];

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b border-stone-200 pb-px">
      {TABS.map((tab) => {
        const href = `/projects/${projectId}/${tab.slug}`;
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={tab.slug}
            href={href}
            className={`rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-stone-900 text-stone-900"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
