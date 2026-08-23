import { Card } from "@/components/ui";
import { INTERIOR_IMAGE, MAX_CONCURRENT_GENERATIONS } from "@/lib/config/kdp-spec";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Settings</h1>
        <p className="text-sm text-stone-500">Application configuration</p>
      </div>
      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-stone-900">AI providers</h2>
        <p className="text-sm text-stone-600">
          Text and image AI providers are configured server-side via environment
          variables (<code className="rounded bg-stone-100 px-1">.env.local</code>).
          API keys are never exposed to the browser. Provider selection will be
          used from Phase 2 (book planning) and Phase 3 (image generation)
          onwards.
        </p>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-stone-900">Print defaults</h2>
        <ul className="space-y-1 text-sm text-stone-600">
          <li>
            Interior images normalised to {INTERIOR_IMAGE.widthPx} ×{" "}
            {INTERIOR_IMAGE.heightPx} px ({INTERIOR_IMAGE.dpi} DPI)
          </li>
          <li>Interior: no bleed (illustrations stay inside a white margin)</li>
          <li>Max concurrent image generations: {MAX_CONCURRENT_GENERATIONS}</li>
        </ul>
        <p className="text-xs text-stone-400">
          These values live in <code>src/lib/config/kdp-spec.ts</code> and are
          maintained centrally.
        </p>
      </Card>
    </div>
  );
}
