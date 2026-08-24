import Link from "next/link";
import { BookSetupForm } from "@/components/book-setup-form";

export default function CreateBookPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">New Colouring Book</h1>
        <p className="text-sm text-stone-500">
          Already know your niche? Set the book up below — everything stays
          editable from the project&apos;s Setup tab.
        </p>
      </div>
      <Link
        href="/niches"
        className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 transition-colors hover:bg-sky-100"
      >
        <span>
          <span className="font-semibold">Not sure what to make?</span>{" "}
          Let the Niche Finder turn a broad topic into specific book concepts —
          then build the book with one tap.
        </span>
        <span className="font-semibold">Find me a niche →</span>
      </Link>
      <BookSetupForm mode="create" />
    </div>
  );
}
