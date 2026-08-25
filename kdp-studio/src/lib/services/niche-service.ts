import type { NicheIdea } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getTextProvider } from "@/lib/ai";
import type { NicheCardDraft } from "@/lib/ai/types";
import { PageServiceError } from "@/lib/services/page-service";
import { createProject } from "@/lib/services/project-service";
import {
  COMPLEXITY_LEVELS,
  TARGET_AUDIENCES,
} from "@/lib/config/book-options";
import {
  COLOURING_MODES,
  DEFAULT_INTERIOR_OPTIONS,
  type NicheIdeaDto,
  type AmazonResearch,
  type NicheMarketData,
  type NicheScores,
  type NicheSeriesIdea,
  type NicheStatus,
  type ProjectDto,
} from "@/lib/types";

// FIND ME A NICHE — transforms broad topics into specific colouring-book
// concepts via AI niche trees. Everything produced here is AI CONCEPT
// ANALYSIS: scores are opinions about the concept, never Amazon market
// data. Genuine research, when added later, lives in the separate
// marketData column so the two can never be confused.

function parseJsonOr<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function toDto(row: NicheIdea): NicheIdeaDto {
  return {
    id: row.id,
    broadTopic: row.broadTopic,
    name: row.name,
    path: parseJsonOr<string[]>(row.path, []),
    audience: row.audience,
    concept: row.concept,
    artwork: row.artwork,
    bookType: row.bookType,
    pageCount: row.pageCount,
    complexity: row.complexity,
    difficulty: row.difficulty,
    positioning: row.positioning,
    giftPotential: row.giftPotential,
    seriesPotential: row.seriesPotential,
    scores: parseJsonOr<NicheScores | null>(row.scores, null),
    seriesIdeas: parseJsonOr<NicheSeriesIdea | null>(row.seriesIdeas, null),
    marketData: parseJsonOr<NicheMarketData | null>(row.marketData, null),
    status: row.status as NicheStatus,
    parentId: row.parentId,
    linkedProjectId: row.linkedProjectId,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface DiscoverInput {
  broadTopic: string;
  market?: string | null;
  audience?: string | null;
  bookType?: string | null;
  count: number;
  /** GO DEEPER from this saved idea. */
  parentId?: string | null;
  /** CROSSOVER topic. */
  combineWith?: string | null;
}

export async function discoverNiches(input: DiscoverInput): Promise<NicheIdeaDto[]> {
  let parentPath: string[] | undefined;
  let broadTopic = input.broadTopic.trim();
  if (input.parentId) {
    const parent = await prisma.nicheIdea.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new PageServiceError("Parent niche idea not found", 404);
    parentPath = [...parseJsonOr<string[]>(parent.path, [])];
    if (parentPath.length === 0) parentPath = [parent.name];
    broadTopic = broadTopic || parent.broadTopic;
  }
  if (!broadTopic) throw new PageServiceError("Enter a broad topic first.", 400);

  const existing = await prisma.nicheIdea.findMany({
    where: { broadTopic },
    select: { name: true },
    take: 100,
    orderBy: { createdAt: "desc" },
  });

  const provider = getTextProvider();
  const { niches, usage } = await provider.discoverNiches({
    broadTopic,
    market: input.market,
    audience: input.audience,
    bookType: input.bookType,
    count: input.count,
    parentPath,
    combineWith: input.combineWith,
    avoidNames: existing.map((e) => e.name),
  });

  const rows = await prisma.$transaction(
    niches.map((n: NicheCardDraft) =>
      prisma.nicheIdea.create({
        data: {
          broadTopic,
          name: n.name.slice(0, 300),
          path: JSON.stringify(n.path?.length ? n.path : [broadTopic, n.name]),
          audience: n.audience,
          concept: n.concept,
          artwork: n.artwork,
          bookType: n.bookType,
          pageCount: Math.max(10, Math.min(300, Math.round(n.pageCount || 30))),
          complexity: COMPLEXITY_LEVELS.some((c) => c.id === n.complexity)
            ? n.complexity
            : "medium",
          difficulty: n.difficulty,
          positioning: n.positioning,
          giftPotential: n.giftPotential,
          seriesPotential: n.seriesPotential,
          scores: JSON.stringify(clampScores(n.scores)),
          status: "new",
          parentId: input.parentId ?? null,
        },
      }),
    ),
  );

  // Log against no specific project — usage tracking only when a project
  // context exists is fine; niche discovery is app-level, so skip the log
  // table (it requires a projectId) and rely on provider billing.
  void usage;

  return rows.map(toDto);
}

function clampScores(s: NicheScores): NicheScores {
  const c = (n: number) => Math.max(1, Math.min(10, Math.round(n || 5)));
  return {
    specificity: c(s?.specificity),
    visualPotential: c(s?.visualPotential),
    variety: c(s?.variety),
    audienceClarity: c(s?.audienceClarity),
    giftPotential: c(s?.giftPotential),
    seriesPotential: c(s?.seriesPotential),
    cbnSuitability: c(s?.cbnSuitability),
    overall: c(s?.overall),
  };
}

export async function listNicheIdeas(filter?: {
  status?: NicheStatus;
}): Promise<NicheIdeaDto[]> {
  const rows = await prisma.nicheIdea.findMany({
    where: filter?.status ? { status: filter.status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return rows.map(toDto);
}

export async function updateNicheStatus(
  id: string,
  status: NicheStatus,
): Promise<NicheIdeaDto> {
  const row = await prisma.nicheIdea.update({ where: { id }, data: { status } })
    .catch(() => null);
  if (!row) throw new PageServiceError("Niche idea not found", 404);
  return toDto(row);
}

/** Merge one channel's research into the niche's marketData JSON. */
export async function mergeNicheMarketData(
  id: string,
  patch: Partial<NicheMarketData>,
): Promise<NicheIdeaDto> {
  const existing = await prisma.nicheIdea.findUnique({ where: { id } });
  if (!existing) throw new PageServiceError("Niche idea not found", 404);
  const current = parseJsonOr<NicheMarketData | null>(existing.marketData, null) ?? {};
  const next: NicheMarketData = { ...current, ...patch };
  const empty = !next.amazon && !next.etsy;
  const row = await prisma.nicheIdea.update({
    where: { id },
    data: { marketData: empty ? null : JSON.stringify(next) },
  });
  return toDto(row);
}

/** Store the user's hand-gathered Amazon research (observed BSR/price only —
 *  estimates are always derived at display time, never stored). */
export async function saveNicheAmazonResearch(
  id: string,
  data: {
    market: AmazonResearch["market"];
    entries: AmazonResearch["entries"];
    note?: string | null;
  } | null,
): Promise<NicheIdeaDto> {
  const stored: AmazonResearch | null = data
    ? {
        market: data.market,
        entries: data.entries.slice(0, 8),
        note: data.note?.trim() || null,
        capturedAt: new Date().toISOString(),
      }
    : null;
  return mergeNicheMarketData(id, { amazon: stored });
}

export async function deleteNicheIdea(id: string): Promise<void> {
  await prisma.nicheIdea.delete({ where: { id } }).catch(() => {
    throw new PageServiceError("Niche idea not found", 404);
  });
}

export async function generateSeriesForNiche(id: string): Promise<NicheIdeaDto> {
  const row = await prisma.nicheIdea.findUnique({ where: { id } });
  if (!row) throw new PageServiceError("Niche idea not found", 404);
  const provider = getTextProvider();
  const { series } = await provider.generateNicheSeries({
    name: row.name,
    concept: row.concept,
    audience: row.audience,
  });
  const updated = await prisma.nicheIdea.update({
    where: { id },
    data: { seriesIdeas: JSON.stringify(series) },
  });
  return toDto(updated);
}

// --- BUILD THIS BOOK -------------------------------------------------------

const STOPWORDS = new Set([
  "a", "an", "the", "of", "for", "and", "or", "in", "on", "with", "to",
  "colouring", "coloring", "book", "books", "pages",
]);

function wordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

function similarity(a: string, b: string): number {
  const sa = wordSet(a);
  const sb = wordSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / Math.min(sa.size, sb.size);
}

export interface DuplicateWarning {
  projectId: string;
  projectName: string;
  similarity: number;
}

/** Existing book substantially similar to this niche concept, if any. */
export async function findSimilarProject(
  idea: NicheIdeaDto,
): Promise<DuplicateWarning | null> {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, title: true, niche: true, subNiche: true, description: true },
  });
  const ideaText = [idea.name, idea.concept ?? "", idea.audience ?? ""].join(" ");
  let best: DuplicateWarning | null = null;
  for (const p of projects) {
    const s = similarity(
      ideaText,
      [p.name, p.title, p.niche, p.subNiche ?? "", p.description ?? ""].join(" "),
    );
    if (s >= 0.5 && (!best || s > best.similarity)) {
      best = { projectId: p.id, projectName: p.name, similarity: Math.round(s * 100) / 100 };
    }
  }
  return best;
}

/** Map the AI's audience phrase onto a known audience id, else custom. */
function mapAudience(audience: string | null): { targetAudience: string; customAudience?: string } {
  if (!audience) return { targetAudience: "adults" };
  const a = audience.toLowerCase();
  const direct = TARGET_AUDIENCES.find(
    (t) => t.id !== "custom" && (t.label.toLowerCase() === a || t.promptText?.toLowerCase() === a),
  );
  if (direct) return { targetAudience: direct.id };
  if (/4\s*[–-]\s*6|4-6/.test(a)) return { targetAudience: "ages_3_5" };
  if (/4\s*[–-]\s*8|6\s*[–-]\s*8/.test(a)) return { targetAudience: "ages_4_8" };
  if (/6\s*[–-]\s*10/.test(a)) return { targetAudience: "ages_6_10" };
  if (/8\s*[–-]\s*12/.test(a)) return { targetAudience: "ages_8_12" };
  if (a.includes("teen")) return { targetAudience: "teens" };
  if (a.includes("christian wom")) return { targetAudience: "christian_women" };
  if (a.includes("christian famil")) return { targetAudience: "christian_families" };
  if (a.includes("famil")) return { targetAudience: "families" };
  if (a.includes("senior") || a.includes("older")) return { targetAudience: "seniors" };
  if (a.includes("women")) return { targetAudience: "women" };
  if (a.includes("men")) return { targetAudience: "men" };
  if (a.includes("beginner")) return { targetAudience: "beginners" };
  if (a.includes("child") || a.includes("kid")) return { targetAudience: "ages_4_8" };
  if (a.includes("adult")) return { targetAudience: "adults" };
  return { targetAudience: "custom", customAudience: audience };
}

export interface BuildBookResult {
  project?: ProjectDto;
  duplicate?: DuplicateWarning;
}

/** Turn a saved niche idea into a prefilled project (all editable after). */
export async function buildBookFromNiche(
  id: string,
  opts: { force?: boolean } = {},
): Promise<BuildBookResult> {
  const row = await prisma.nicheIdea.findUnique({ where: { id } });
  if (!row) throw new PageServiceError("Niche idea not found", 404);
  const idea = toDto(row);

  if (!opts.force) {
    const duplicate = await findSimilarProject(idea);
    if (duplicate) return { duplicate };
  }

  const audience = mapAudience(idea.audience);
  const isChild = ["ages_3_5", "ages_4_8", "ages_6_10", "ages_8_12"].includes(
    audience.targetAudience,
  );
  const colouringMode = COLOURING_MODES.includes(
    (idea.bookType ?? "") as (typeof COLOURING_MODES)[number],
  )
    ? (idea.bookType as (typeof COLOURING_MODES)[number])
    : "standard";
  const scripture =
    /bible|scripture|psalm|christian|verse/i.test(`${idea.name} ${idea.concept ?? ""}`);

  const project = await createProject({
    name: idea.name.slice(0, 200),
    title: idea.name.slice(0, 300),
    subtitle: null,
    author: null,
    niche: idea.path[0] ?? idea.broadTopic,
    subNiche: idea.path.length > 1 ? idea.path[idea.path.length - 1] : idea.name,
    specificAngle: idea.positioning ?? idea.concept,
    description: idea.concept,
    emotionalTones: [],
    artworkTheme: idea.artwork,
    colouringMode,
    cbnSettings: undefined,
    bibleSettings: scripture
      ? {
          enabled: true,
          translation: "kjv",
          verseFont: "serif",
          themes: [],
          includeVerseText: true,
          includeReference: true,
        }
      : undefined,
    targetAudience: audience.targetAudience,
    customAudience: audience.customAudience ?? null,
    trimSize: "8.5x11",
    numberOfDesigns: idea.pageCount ?? 30,
    style: isChild ? "clean_childrens" : "detailed_realistic",
    customStyle: null,
    complexity: idea.complexity ?? "medium",
    complexityOverridden: !!idea.complexity,
    interiorOptions: { ...DEFAULT_INTERIOR_OPTIONS },
  });

  await prisma.nicheIdea.update({
    where: { id },
    data: { status: "building", linkedProjectId: project.id },
  });

  return { project };
}
