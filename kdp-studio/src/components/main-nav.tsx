"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/projects", label: "Projects", icon: "📚" },
  { href: "/create", label: "Create Book", icon: "＋" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function MainNav() {
  const pathname = usePathname();
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-stone-200 bg-white">
      <Link href="/dashboard" className="border-b border-stone-200 px-5 py-5">
        <span className="block text-sm font-bold uppercase tracking-wider text-stone-900">
          KDP Studio
        </span>
        <span className="block text-xs text-stone-500">Colouring Book Creator</span>
      </Link>
      <nav className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              <span aria-hidden className="w-5 text-center">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
