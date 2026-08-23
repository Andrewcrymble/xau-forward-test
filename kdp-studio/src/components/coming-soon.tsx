import { EmptyState } from "@/components/ui";

/** Placeholder for project tabs delivered in later development phases. */
export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: number;
}) {
  return (
    <EmptyState
      title={title}
      description={`${description} This will be available in Phase ${phase}.`}
    />
  );
}
