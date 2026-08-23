# Hosting KDP Colouring Book Studio on the web

The app deploys to **Vercel** (free Hobby plan) with a free hosted
**PostgreSQL** database from **Neon**. Everything below can be done entirely
from a browser — no terminal needed — so it works fine from an iPad.

The repo is already prepared: the `vercel-build` script switches Prisma from
SQLite (local dev) to PostgreSQL, syncs the database schema, and builds the
app automatically on every deploy.

## 1. Create the database (Neon)

1. Go to [neon.tech](https://neon.tech) and sign up (free tier is fine).
2. Create a project (any name, nearest region).
3. On the project dashboard, copy the **connection string** — it looks like
   `postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`.

## 2. Deploy the app (Vercel)

1. Go to [vercel.com](https://vercel.com) and sign up **with your GitHub
   account**.
2. Click **Add New → Project** and import the `xau-forward-test` repository.
3. **Important:** set **Root Directory** to `kdp-studio`.
4. Under **Environment Variables**, add:
   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the Neon connection string from step 1 |
   | `OPENAI_API_KEY` | your OpenAI key (optional — without it the app uses the built-in sample planner) |
5. Click **Deploy**. First build takes a couple of minutes.
6. You'll get a URL like `https://kdp-studio-xxxx.vercel.app` — open it on
   any device. Add it to your iPad home screen for an app-like experience.

### Deploying updates

Vercel redeploys automatically whenever the connected branch changes. By
default it tracks the repo's production branch — in **Project Settings →
Git** you can point production at `claude/kdp-colouring-book-studio-1s7szl`
(the branch this app is developed on), or merge that branch into `main`.

## Notes & limits

- **Interior images (Phase 3+):** Vercel serverless storage is ephemeral, so
  generated artwork will use a hosted store (e.g. Vercel Blob — has a free
  tier). The app's storage layer is an abstraction, so this is a
  configuration choice, not a rewrite.
- **Secrets** only ever live in Vercel's environment settings — never in the
  repo.
- **Alternative hosts:** anything that runs Next.js + Postgres works
  (Railway, Render, Fly.io). Vercel is recommended because deploys are
  automatic from GitHub with zero terminal use.
