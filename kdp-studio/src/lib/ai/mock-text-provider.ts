import type {
  BookPlanRequest,
  BookPlanResult,
  PageConceptDraft,
  TextAIProvider,
} from "./types";

// Built-in sample planner used when no AI provider key is configured.
// Produces varied, deterministic placeholder concepts so the whole planning
// workflow (generate → edit → reorder → approve) can be exercised without
// any API key or cost. Clearly labelled in the UI as sample output.

const SUBJECT_PATTERNS = [
  "a detailed close-up of {niche}",
  "a wide panoramic scene featuring {niche}",
  "{niche} seen from a low, dramatic angle",
  "{niche} viewed from above, bird's-eye style",
  "a peaceful everyday moment involving {niche}",
  "{niche} framed by foreground foliage",
  "a bustling, lively scene built around {niche}",
  "{niche} in a quiet early-morning setting",
  "a celebratory, festive scene around {niche}",
  "{niche} beside water with gentle reflections",
  "{niche} in a seasonal winter setting",
  "{niche} in a bright summer setting",
  "a night-time scene of {niche} with a starry sky",
  "an old-fashioned, vintage take on {niche}",
  "a whimsical, imaginative twist on {niche}",
  "{niche} with a decorative patterned border",
  "a small, charming corner scene of {niche}",
  "{niche} at the centre of a symmetrical composition",
  "a journey or path leading towards {niche}",
  "{niche} surrounded by its natural companions",
];

export class MockTextProvider implements TextAIProvider {
  readonly name = "mock";

  private makeConcept(niche: string, index: number): PageConceptDraft {
    const pattern = SUBJECT_PATTERNS[index % SUBJECT_PATTERNS.length];
    const variation = Math.floor(index / SUBJECT_PATTERNS.length) + 1;
    const scene = pattern.replace("{niche}", niche);
    const suffix = variation > 1 ? ` (variation ${variation})` : "";
    return {
      title: `Sample page ${index + 1}${suffix}`,
      concept:
        `${scene.charAt(0).toUpperCase()}${scene.slice(1)}.` +
        ` Sample concept — replace with a real AI provider by adding an API key in the app's environment settings.`,
    };
  }

  async generateBookPlan(req: BookPlanRequest): Promise<BookPlanResult> {
    const start = req.avoidTitles?.length ?? 0;
    const concepts = Array.from({ length: req.count }, (_, i) =>
      this.makeConcept(req.niche, start + i),
    );
    return {
      concepts,
      usage: { provider: this.name, model: "sample-generator", tokensUsed: 0 },
    };
  }

  async generateReplacementConcept(req: Omit<BookPlanRequest, "count">) {
    const { concepts, usage } = await this.generateBookPlan({ ...req, count: 1 });
    return { concept: concepts[0], usage };
  }
}
