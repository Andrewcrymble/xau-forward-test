import { prisma } from "@/lib/db";
import { PageServiceError } from "@/lib/services/page-service";
import { COLOURING_PAGE_FORMAT_INSTRUCTION } from "@/lib/config/colouring-rules";

// BOOK QUALITY CHECK — runs before a book is assembled/exported. Combines
// the stored per-page validation results (dimensions, colour/grey, margins,
// colour-by-numbers checks) with whole-book analysis: duplicate concepts,
// near-identical compositions, duplicate verses, motif over-repetition and
// workflow gaps. Returns READY or ISSUES FOUND with the exact pages.

export interface QualityIssue {
  severity: "error" | "warning";
  message: string;
  pageNumbers: number[];
}

export interface QualityReport {
  ready: boolean;
  checkedAt: string;
  totalPages: number;
  approvedPages: number;
  issues: QualityIssue[];
}

const STOPWORDS = new Set([
  "a", "an", "the", "of", "for", "and", "or", "in", "on", "with", "to", "at",
  "by", "from", "into", "over", "under", "its", "his", "her", "their", "this",
  "that", "is", "are", "as", "one", "two", "sample", "concept", "page",
  "scene", "view", "colouring", "coloring", "book", "style", "detailed",
  "background", "foreground", "featuring", "surrounded",
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

function similarity(a: string, b: string): number {
  const sa = new Set(words(a));
  const sb = new Set(words(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / Math.min(sa.size, sb.size);
}

export async function runBookQualityCheck(projectId: string): Promise<QualityReport> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new PageServiceError("Project not found", 404);
  const pages = await prisma.colouringPage.findMany({
    where: { projectId },
    orderBy: { pageNumber: "asc" },
  });

  const issues: QualityIssue[] = [];
  const push = (severity: "error" | "warning", message: string, pageNumbers: number[]) =>
    issues.push({ severity, message, pageNumbers });

  if (pages.length === 0) {
    push("error", "The book has no pages — generate a book plan first.", []);
  }
  if (pages.length > 0 && pages.length < project.numberOfDesigns) {
    push(
      "warning",
      `The plan has ${pages.length} pages but the book is set up for ${project.numberOfDesigns}.`,
      [],
    );
  }

  // Missing / failed artwork and per-page validation flags.
  const notGenerated = pages.filter((p) => !p.processedImage);
  if (notGenerated.length > 0) {
    push(
      "error",
      `${notGenerated.length} page(s) have no artwork yet.`,
      notGenerated.map((p) => p.pageNumber),
    );
  }
  const failedValidation = pages.filter((p) => p.validationStatus === "failed");
  if (failedValidation.length > 0) {
    push(
      "error",
      "Automatic image checks FAILED on these pages (wrong dimensions, corruption or unusable output) — regenerate them.",
      failedValidation.map((p) => p.pageNumber),
    );
  }
  const needsReview = pages.filter((p) => p.validationStatus === "needs_review");
  if (needsReview.length > 0) {
    push(
      "warning",
      "Automatic image checks flagged these pages (possible colour/grey areas, dark edges, margin or region problems) — review before approving.",
      needsReview.map((p) => p.pageNumber),
    );
  }
  const unapproved = pages.filter(
    (p) => p.processedImage && p.approvalStatus !== "approved",
  );
  if (unapproved.length > 0) {
    push(
      "warning",
      `${unapproved.length} generated page(s) are not approved and will be left out of the book.`,
      unapproved.map((p) => p.pageNumber),
    );
  }
  const rejected = pages.filter((p) => p.approvalStatus === "rejected");
  if (rejected.length > 0) {
    push("warning", "Rejected pages still sit in the plan — replace or delete them.",
      rejected.map((p) => p.pageNumber));
  }

  // Colour-by-numbers findings.
  const cbnProblem: number[] = [];
  for (const p of pages) {
    if (!p.cbnData) continue;
    try {
      const data = JSON.parse(p.cbnData) as { validation?: string[] };
      if ((data.validation?.length ?? 0) > 0) cbnProblem.push(p.pageNumber);
    } catch {
      cbnProblem.push(p.pageNumber);
    }
  }
  if (cbnProblem.length > 0) {
    push(
      "warning",
      "Colour-by-numbers validation flagged these pages (small regions or key mismatches) — open them to review the findings.",
      cbnProblem,
    );
  }

  // Prompt integrity: every prompt must carry the mandatory KDP instruction.
  const badPrompts = pages.filter(
    (p) => p.pageType === "standard" && !p.prompt.includes(COLOURING_PAGE_FORMAT_INSTRUCTION),
  );
  if (badPrompts.length > 0) {
    push(
      "warning",
      "These pages' prompts are missing the mandatory KDP format instruction (probably heavy manual edits) — regenerate the prompt or re-add it.",
      badPrompts.map((p) => p.pageNumber),
    );
  }

  // Duplicate / very similar concepts.
  const dupPairs: string[] = [];
  const dupPages = new Set<number>();
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const s = similarity(
        `${pages[i].title} ${pages[i].concept}`,
        `${pages[j].title} ${pages[j].concept}`,
      );
      if (s >= 0.75) {
        dupPairs.push(`${pages[i].pageNumber}+${pages[j].pageNumber}`);
        dupPages.add(pages[i].pageNumber);
        dupPages.add(pages[j].pageNumber);
      }
    }
  }
  if (dupPairs.length > 0) {
    push(
      "warning",
      `Very similar page concepts detected (pairs: ${dupPairs.slice(0, 10).join(", ")}) — vary the composition or replace one of each pair.`,
      [...dupPages].sort((a, b) => a - b),
    );
  }

  // Duplicate verses / page text.
  const textSeen = new Map<string, number[]>();
  for (const p of pages) {
    if (!p.pageText?.trim()) continue;
    const key = p.pageText.trim().toLowerCase().replace(/\s+/g, " ");
    textSeen.set(key, [...(textSeen.get(key) ?? []), p.pageNumber]);
  }
  for (const [, nums] of textSeen) {
    if (nums.length > 1) {
      push("error", "The same verse/text appears on more than one page.", nums);
    }
  }
  const versePages = pages.filter((p) => p.pageText?.trim());
  if (versePages.length > 0) {
    push(
      "warning",
      "Scripture/text pages: verify every verse's wording and reference against a printed copy of your translation, and check the translation's commercial licensing.",
      versePages.map((p) => p.pageNumber),
    );
  }

  // Motif over-repetition across concepts.
  if (pages.length >= 8) {
    const nicheWords = new Set(words(`${project.niche} ${project.subNiche ?? ""}`));
    const counts = new Map<string, number>();
    for (const p of pages) {
      for (const w of new Set(words(p.concept))) {
        if (nicheWords.has(w)) continue;
        counts.set(w, (counts.get(w) ?? 0) + 1);
      }
    }
    const overused = [...counts.entries()]
      .filter(([, c]) => c / pages.length >= 0.6)
      .map(([w]) => w)
      .slice(0, 8);
    if (overused.length > 0) {
      push(
        "warning",
        `These motifs appear in most page concepts (${overused.join(", ")}) — fine if intentional (recurring motifs), repetitive if not.`,
        [],
      );
    }
  }

  const approvedPages = pages.filter(
    (p) => p.approvalStatus === "approved" && p.processedImage,
  ).length;
  const ready = !issues.some((i) => i.severity === "error");
  return {
    ready,
    checkedAt: new Date().toISOString(),
    totalPages: pages.length,
    approvedPages,
    issues,
  };
}
