"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    // Explicit confirmation guards against accidental loss.
    const confirmed = window.confirm(
      `Delete "${projectName}"?\n\nThis permanently removes the project, its page plan and all generated images. This cannot be undone.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setError(json.error ?? "Failed to delete project");
    } catch {
      setError("Could not reach the server. Please try again.");
    }
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-3">
      <Button variant="danger" type="button" disabled={busy} onClick={onDelete}>
        {busy ? "Deleting…" : "Delete project"}
      </Button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
