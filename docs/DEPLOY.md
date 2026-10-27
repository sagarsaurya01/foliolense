# Go live on Railway

FolioLense runs as two Railway services from this one repo: **web** (Next.js) and **worker**
(Python), plus a **cron** that refreshes prices each evening. The database stays on Supabase.

## 1. Services

In the Railway project, add two services from the GitHub repo `sagarsaurya01/foliolense`:

| Service | Root directory | Start command | Notes |
|---|---|---|---|
| `web` | `web` | `npm run start` (railway.json sets it) | Next.js; Railway runs `npm run build` automatically |
| `worker` | `worker` | `uvicorn main:app --host 0.0.0.0 --port $PORT` | FastAPI; parses statements |

A third service, `prices` (cron), uses the **same `worker` root** but:
- Start command: `python -m jobs.run all`
- Cron schedule: `0 13 * * 1-5` (18:30 IST, after market close) and a second at `0 2 * * 1-5` (07:30 IST); add `30 18 * * *` for NAVs.

## 2. Variables

**web**
- `NEXT_PUBLIC_SUPABASE_URL` = the Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon key (public-safe)
- `NEXT_PUBLIC_WORKER_URL` = the worker service's public URL (from Railway, after the worker deploys)

**worker** and **prices**
- `SUPABASE_URL` = the Supabase project URL
- `SUPABASE_SERVICE_KEY` = the **service_role** key (server-only — never put it in the web service)

Add the service key in Railway's Variables, never in chat or in git.

## 3. Supabase settings for production

- Authentication → URL Configuration → add the web service's URL to **Redirect URLs** and **Site URL**.
- The daily `prices` cron keeps the free project from pausing.

## 4. Custom domain (optional)

Personal use runs fine on `*.up.railway.app`. To use a domain, add it on the web service and point the DNS CNAME as Railway shows; then add that URL to Supabase redirect URLs too.

## 5. Backup

`.github/workflows/backup.yml` dumps the database weekly to a downloadable artifact. Add the
repo secret `SUPABASE_DB_URL` (Supabase → Settings → Database → Connection string, URI with the
db password). Run it once from the Actions tab to confirm.
