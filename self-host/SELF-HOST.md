# Self-hosting TRAILS + Supabase (full data ownership)

Run everything on your own machine/server so audit data never leaves your
infrastructure. Two pieces: **Supabase** (database + auth + storage, using their
official Docker stack) and the **TRAILS app + relay** (this repo, pointed at it).

> The browser talks to Supabase directly, and the relay only talks to LLM
> providers — so the two stacks don't need to share a Docker network, just a
> reachable Supabase URL.

Prerequisites: Docker + Docker Compose, and `git`.

---

## Part A — Stand up Supabase (official stack)

Supabase maintains the self-host Docker setup; we use it as-is.

```bash
# 1. Get the Supabase docker stack
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# 2. Create your env from the template
cp .env.example .env
```

**3. Edit `supabase/docker/.env` — change these before anything else:**
- `POSTGRES_PASSWORD` — a strong password
- `JWT_SECRET` — a long random secret (then regenerate `ANON_KEY` and
  `SERVICE_ROLE_KEY` from it; see the Supabase docs link below)
- `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` — for Studio login
- `SITE_URL` / `API_EXTERNAL_URL` — your app + API URLs (for local: keep defaults)
- **`ENABLE_ANONYMOUS_USERS=true`** ← required so auditors can join with just a code

```bash
# 4. Launch
docker compose up -d

# 5. Check it's healthy
docker compose ps
```

Now:
- **Studio (admin UI):** http://localhost:8000  (log in with DASHBOARD_USERNAME/PASSWORD)
- **API URL (for the app):** http://localhost:8000
- **anon key:** the `ANON_KEY` value in `supabase/docker/.env`
- **Postgres:** localhost:5432 (user `postgres`, the password you set)

> Default keys in `.env.example` are demo values — regenerate them for any real
> deployment. See "New API keys / self-hosted auth" in the docs below.

## Part B — Apply the TRAILS schema

From this repo, apply both migrations to the Supabase Postgres. Easiest is the
Studio SQL editor:

1. Open Studio → **SQL Editor → New query**.
2. Paste `supabase/migrations/0001_init.sql` → Run.
3. Paste `supabase/migrations/0002_auth_glue.sql` → Run.

Or via psql from the repo root:
```bash
psql "postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/postgres" \
  -f supabase/migrations/0001_init.sql \
  -f supabase/migrations/0002_auth_glue.sql
```

Verify in Studio → **Table editor** that `profiles`, `studies`,
`study_members`, `access_codes`, `conversations`, `message_reactions` exist.

## Part C — Run the TRAILS app against it

```bash
cd self-host
cp .env.selfhost.example .env
# edit .env:
#   REACT_APP_SUPABASE_URL=http://localhost:8000   (or your domain)
#   REACT_APP_SUPABASE_ANON_KEY=<ANON_KEY from supabase/docker/.env>

docker compose -f docker-compose.trails.yml up -d --build
```

App is now on **http://localhost:3000** with Feature 0 enabled and all three
seams (auth / studies / persistence) pointed at your Supabase.

> Note: `REACT_APP_*` are baked at build time, so if you change the Supabase URL
> or key later, rebuild: `docker compose -f docker-compose.trails.yml up -d --build`.

## Part D — Adapter bodies (already implemented)

The Supabase adapters are now implemented against supabase-js v2:
- `src/tools/supabaseClient.js` — shared, lazily-created client
- `src/tools/auth/SupabaseAuthProvider.js`
- `src/tools/studies/SupabaseStudyService.js`
- `src/tools/stores/SupabaseStore.js`

`@supabase/supabase-js` is in `package.json`, so the Docker build installs it
automatically. These haven't been run against a live instance yet — verify with
Part E and report any errors.

## Part E — Verify end to end

1. Open http://localhost:3000 → "I'm an investigator" → create account →
   create a study → **Generate code**.
2. Incognito window → "I have a code" → paste → the audit runs.
3. Studio → Table editor: confirm rows in `profiles`, `studies`,
   `study_members`, `access_codes`, and (after a session) `conversations`.
4. Confirm isolation: a second investigator account cannot see the first's
   studies (RLS at work).

---

## Production hardening (when you go beyond local)
- Put both stacks behind HTTPS (a reverse proxy / Caddy / nginx); set
  `REACT_APP_SUPABASE_URL` and `API_EXTERNAL_URL` to the https domain.
- Set the relay `ALLOWED_ORIGINS` to your exact app origin (not `*`).
- Rotate all Supabase secrets/keys; restrict Postgres exposure.
- Configure SMTP in the Supabase `.env` for investigator email verification/invites.
- Back up the Postgres volume.

## References
- Supabase self-hosting with Docker: https://supabase.com/docs/guides/self-hosting/docker
- The `.env` reference: https://github.com/supabase/supabase/blob/master/docker/.env.example
- Regenerating self-hosted auth keys: https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys
