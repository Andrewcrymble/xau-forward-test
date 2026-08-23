# KDP Colouring Book Studio

A web application for creating complete Amazon KDP-ready colouring books:
book concept → page plan → AI image generation → review → print-ready
interior PDF → wraparound cover → Amazon listing → export package.

**Status: Phase 1 (Foundation) complete** — navigation, database, project
creation wizard, dashboard, project setup with autosave. Later phases add
book planning, image generation, interior/cover builders, listing generation
and ZIP export (their tabs are visible as placeholders).

## Stack

- Next.js (App Router) + TypeScript + React + Tailwind CSS
- Prisma ORM with SQLite for development (schema is PostgreSQL-compatible —
  no enums or JSON columns; switch the datasource provider to move)
- Zod for schema validation

## Getting started

```bash
cd kdp-studio
npm install                      # also runs `prisma generate`
cp .env.example .env             # SQLite needs no further config
npx prisma migrate dev           # create/update the local database
npm run dev                      # http://localhost:3000
```

Other commands:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # production build
npm start           # serve production build
npm run db:studio   # browse the database
```

## Project structure

```
prisma/schema.prisma        Database schema (User, Project, ColouringPage,
                            ImageVersion, Cover, Export, GenerationLog)
src/app/                    Routes (App Router)
  dashboard/                Project cards overview
  projects/                 Project list + per-project workspace
    [id]/{setup,plan,images,interior,cover,listing,export}/
  create/                   New Colouring Book wizard
  settings/
  api/projects/             Typed JSON API (list/create/get/update/delete)
src/components/             Reusable UI components
src/lib/
  config/colouring-rules.ts COLOURING_PAGE_MASTER_RULES + prompt composer —
                            the single source for image-generation rules
  config/kdp-spec.ts        Trim sizes, margins, bleed, spine rates,
                            2550×3300 normalisation target, queue limits
  config/book-options.ts    Audiences, page counts, complexity, styles
  services/                 Business logic (no logic in UI components)
  validation/               Zod schemas
  types.ts                  Domain types and statuses
```

All KDP measurements, image rules and generation limits live in
`src/lib/config/` — never hard-code them elsewhere.

## Environment

See `.env.example`. AI provider keys are server-side only and are first used
in Phase 2+. `DATABASE_URL` defaults to a local SQLite file.
