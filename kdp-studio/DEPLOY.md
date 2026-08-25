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

## 3. Image storage (needed for Phase 3 image generation)

Serverless hosting has no permanent disk, so generated artwork needs a
hosted store. Vercel's own Blob storage has a free tier and is a two-minute
setup:

1. In your Vercel project, open the **Storage** tab.
2. Click **Create Database → Blob** and connect it to the project.
3. Vercel adds the `BLOB_READ_WRITE_TOKEN` environment variable
   automatically — the app detects it and switches from local disk to Blob
   with no other configuration.
4. Redeploy (Deployments → ⋯ → Redeploy) so the new variable takes effect.

### Bigger free storage: Cloudflare R2 (10 GB free)

Vercel Blob's free tier is 1 GB. Cloudflare R2 gives 10 GB free with no
egress fees, and the app supports it natively. Browser-only setup:

1. Create a free account at https://dash.cloudflare.com and open **R2
   Object Storage** (it asks for a payment card for overage, but the 10 GB
   free tier costs nothing).
2. **Create bucket** — name it e.g. `kdp-artwork` (location: automatic).
3. In the bucket's **Settings**, under **Public Development URL**, click
   **Enable** and copy the URL (looks like `https://pub-xxxxxxxx.r2.dev`).
4. Back on the R2 overview page, open **API → Manage API tokens** →
   **Create API token**: permissions **Object Read & Write**, scoped to
   your bucket. Copy the *Access Key ID* and *Secret Access Key*. Your
   *Account ID* is shown on the same page (and in the dashboard URL).
5. In your GitHub repository → Settings → Secrets and variables → Actions,
   add five secrets:
   - `R2_ACCOUNT_ID` — your Cloudflare account id
   - `R2_ACCESS_KEY_ID` — from the API token
   - `R2_SECRET_ACCESS_KEY` — from the API token
   - `R2_BUCKET` — the bucket name, e.g. `kdp-artwork`
   - `R2_PUBLIC_BASE_URL` — the public URL from step 3
6. Re-run the **Deploy KDP Studio to Vercel** workflow (Actions tab →
   Run workflow). The app now stores all new artwork in R2.
7. Finally, open the app's **Settings → Storage** card: it shows
   `Cloudflare R2` as the backend and a **Migrate files to current
   storage** button — tap it (repeatedly, if it reports files remaining)
   to move your existing books from Vercel Blob into R2, update every
   link, and free the old Blob quota.

## 4. OpenAI image generation

With `OPENAI_API_KEY` set, colouring pages generate with **gpt-image-1**
(portrait, then normalised to 2550 × 3300 print resolution). Optional
variables:

- `OPENAI_IMAGE_MODEL` — `gpt-image-1` (default) or `dall-e-3`
- `OPENAI_IMAGE_QUALITY` — `low` / `medium` (default) / `high` for
  gpt-image-1 (`standard` / `hd` for dall-e-3). Medium costs roughly
  $0.06 per page; high roughly $0.25 per page.

Note: gpt-image-1 requires a verified OpenAI organisation (a one-time step
at platform.openai.com under Settings → Organization → Verification). If
generation returns a 403 mentioning verification, either complete that or
set `OPENAI_IMAGE_MODEL=dall-e-3`.

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

## Etsy market scans (optional, free)

The Niche Finder's "Scan Etsy market" button pulls live competition data
(active listing counts, price range, favourites, top shops' lifetime sales)
from Etsy's official Open API. It needs a free personal API key:

1. Sign in to Etsy, then open https://www.etsy.com/developers/register
2. Create a new app — name it anything (e.g. "KDP Studio research"),
   describe it as "personal market research", and agree to the terms.
   Personal apps get instant provisional access, which is all this needs.
3. On the app's page copy the **KEYSTRING** value.
4. In GitHub: repository → Settings → Secrets and variables → Actions →
   New repository secret. Name: `ETSY_API_KEY`, value: the keystring.
5. Re-run the "Deploy KDP Studio to Vercel" workflow (Actions tab →
   Run workflow) so the key syncs to Vercel.

Without the key everything else still works — the scan button just explains
what's missing. The Amazon research panel needs no key at all: it generates
the search links and estimates sales from the BSR numbers you type in.

## Automatic OneDrive delivery (optional)

When configured, every "Download Complete KDP Package" and "Build Etsy
Printable Pack" also uploads the ZIP to OneDrive under
`Business/ColourJoy/<book name>/` — no taps needed. Setup is a one-time
Azure app registration (server-to-server; no sign-in screens afterwards):

1. Open https://portal.azure.com and sign in with the SAME Microsoft
   account as the OneDrive (e.g. andrew@…).
2. Search "App registrations" → **New registration**:
   - Name: `KDP Studio OneDrive`
   - Supported account types: **Accounts in this organizational directory
     only** (single tenant)
   - Redirect URI: leave empty → **Register**
3. On the app's Overview page copy two values:
   - **Application (client) ID** → GitHub secret `MS_CLIENT_ID`
   - **Directory (tenant) ID**  → GitHub secret `MS_TENANT_ID`
4. Left menu **Certificates & secrets** → **New client secret** →
   Add → copy the secret **Value** immediately (it hides later)
   → GitHub secret `MS_CLIENT_SECRET`
5. Left menu **API permissions** → **Add a permission** →
   **Microsoft Graph** → **Application permissions** → search
   `Files.ReadWrite.All` → tick it → Add permissions.
   Then press **Grant admin consent for <your org>** and confirm —
   the Status column must show a green tick.
6. Two more GitHub secrets:
   - `ONEDRIVE_USER` — the OneDrive owner's sign-in address
   - `ONEDRIVE_BASE_PATH` — optional; defaults to `Business/ColourJoy`
7. Re-run the "Deploy KDP Studio to Vercel" workflow so the values sync.

The Export tab reports the outcome after every build: "Saved to
OneDrive: …" on success, or the exact Microsoft error if something is
misconfigured (the download link always still works either way).
