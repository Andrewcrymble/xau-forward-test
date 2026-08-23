import { BookSetupForm } from "@/components/book-setup-form";

export default function CreateBookPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">New Colouring Book</h1>
        <p className="text-sm text-stone-500">
          Set up your book — you can change any of this later from the
          project&apos;s Setup tab.
        </p>
      </div>
      <BookSetupForm mode="create" />
    </div>
  );
}
