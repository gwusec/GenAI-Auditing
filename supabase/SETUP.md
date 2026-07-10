# Supabase setup — activating Feature 0 (auth + studies + persistence)

Follow these top to bottom. Steps 1–5 stand up the backend; steps 6–8 point the
app at it. Until you do this, the app keeps running on the mock backend (no
change needed).

> Dashboard labels move around between Supabase releases — if a menu name differs,
> check the current docs at https://supabase.com/docs. The SQL and env vars below
> are what matter.

---

## 1. Create a project (pick one)

**A. Hosted (fastest — good for your beta)**
1. Go to https://supabase.com → sign in → **New project**.
2. Name it, set a strong database password, pick a region near your users.
3. Wait ~2 min for it to provision.

**B. Self-host (full data ownership — for real studies)**
- Use the turnkey stack (planned `docker-compose`) that ships the app + relay +
  Supabase together. Until that lands, you can run Supabase's own stack:
  `git clone https://github.com/supabase/supabase && cd supabase/docker && cp .env.example .env && docker compose up -d`.

## 2. Get your credentials
In the project: **Project Settings → API**. Copy:
- **Project URL** → `REACT_APP_SUPABASE_URL`
- **anon public** key → `REACT_APP_SUPABASE_ANON_KEY`

(The `service_role` key is secret — never put it in the frontend.)

## 3. Apply the database schema
Easiest path — the SQL editor:
1. Dashboard → **SQL Editor → New query**.
2. Paste the contents of `supabase/migrations/0001_init.sql`, run it.
3. New query, paste `supabase/migrations/0002_auth_glue.sql`, run it.

Or with the Supabase CLI (`npm i -g supabase`):
```bash
supabase link --project-ref <your-project-ref>
supabase db push        # applies files in supabase/migrations/
```

## 4. Enable anonymous sign-ins (required for code-based auditors)
Dashboard → **Authentication → Sign In / Providers** (or **Settings**) → enable
**Allow anonymous sign-ins**. This is what lets an auditor join with just a code.

## 5. (Optional now) Email/SMTP
Only needed for investigator email verification + invites. Dashboard →
**Authentication → Emails / SMTP**. For anon-only testing you can skip this; for
self-host you must configure SMTP for account emails to work.

---

## 6. Point the frontend at Supabase
```bash
npm i @supabase/supabase-js
```
Add to `.env` (and to Render/host env in production):
```bash
REACT_APP_SUPABASE_URL=https://<ref>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<anon-key>

# flip the three seams from mock -> supabase
REACT_APP_AUTH=supabase
REACT_APP_STUDIES=supabase
REACT_APP_PERSISTENCE=supabase

# turn on Feature 0
REACT_APP_FEATURE0=on
```

Create one shared client (`src/tools/supabaseClient.js`):
```js
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);
```

## 7. Finish the adapter method bodies
The skeletons already have the intended queries in comments. Wire the shared
`supabase` client into and implement:
- `src/tools/auth/SupabaseAuthProvider.js` → `supabase.auth.*`
- `src/tools/studies/SupabaseStudyService.js` → `from('studies' | 'study_members' | 'access_codes')`, and `redeemAccessCode` → `supabase.rpc('redeem_access_code', { p_code })`
- `src/tools/stores/SupabaseStore.js` → `from('conversations')`

(When you're ready, I can fill these in — they're small and mechanical once a
project exists to test against.)

## 8. Run and verify
```bash
npm start
```
- Investigator: create account → create study → **Generate code**.
- Auditor (incognito): **I have a code** → paste → audit runs.
- In the Supabase dashboard → **Table editor**, confirm rows appear in
  `profiles`, `studies`, `study_members`, `access_codes`, `conversations`.
- Confirm isolation: a second investigator cannot see the first's studies.

---

## Notes / gotchas
- **Codes are compared upper-cased** by the RPC — store access codes upper-case
  when you create them in `SupabaseStudyService.createAccessCode`.
- **RLS is on for every table.** If a query returns nothing unexpectedly, it's
  almost always a policy scoping it correctly — check the user's role/membership.
- **Anonymous → account upgrade:** use `supabase.auth.updateUser({ email, password })`
  on the existing anonymous session so the user id (and their data) is preserved.
- Keep the `service_role` key server-side only (e.g. the relay), never in the app.
