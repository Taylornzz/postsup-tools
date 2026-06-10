# Accounts & cross-device sync

## What's built

**Accounts (was already wired).** When the app has Supabase env vars (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`), `AuthGate` shows a real email/password sign-in (sign up → email confirm →
sign in). The `projects` table is per-user with RLS, so your project *list* already syncs across
devices when signed in. Without those env vars the app runs in local mode behind the preview
password. (The old AppMenu "Login — coming soon" button was stale and is now an accurate
account/local-mode control.)

**Cross-device sync of the actual planning data (new).** Each tool stores its per-project state in
`localStorage` under keys suffixed with the project id (`kaos.deliverables.v1-{pid}`,
`kaos.board.v1-{pid}`, `postsup-gantt-v1-{pid}`, …). Rather than rewrite every tool, `projectSync.ts`
**snapshots** all of a project's keys into one object that travels two ways:

- **File backup (works for everyone, signed-in or not).** Projects → a project's ⋯ menu → **Back up**
  downloads a `.json`. On another device, Projects → **Restore** loads it into a fresh project
  (re-keyed onto the new id) and opens it. This is the guaranteed, verifiable portability path.
- **Cloud snapshot (signed-in).** The snapshot is stored in the project's `data.snapshot` (the same
  `projects` row the list already uses — no new table). `ProjectGate` **pulls** a newer snapshot into
  local storage *before* the project mounts (so tools hydrate from it), and **pushes** the latest
  state when you leave a project. There's also a manual **Sync to cloud** in the ⋯ menu. Conflict
  policy is last-write-wins by `syncedAt` — right for a solo operator; a multi-editor project would
  want finer merging.

## Supabase wiring — verified correct (2026-06-11)

There are two *different* Supabase projects in play, so this was checked carefully:

- The **app** uses project **`lijtvekgvpwuuofdocgf`** (the Kaos project).
- The **Supabase MCP tool** in this workspace is bound to a **different** project
  (`vwoiqjnbqhmvtntgvefl`, the memorial project). **Never** make DB changes via the MCP — it would hit
  the wrong database. No DB changes were ever made through it.

Verified end-to-end via read-only checks (no DB writes, no MCP):

1. **Live bundle → right project.** The deployed `kaostheory.vercel.app` JS bundle contains
   `lijtvekgvpwuuofdocgf.supabase.co` and *not* the memorial ref. ✔
2. **Vercel env present.** `ANTHROPIC_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` are all set
   in Production (the Supabase pair since ~5 days before this date). ✔
3. **Schema correct.** Hitting the Kaos project's public REST API
   (`/rest/v1/projects?select=id,name,data,user_id`) with the anon key returns `200 []`; a fake column
   returns `400 column … does not exist`. So the `projects` table exists with the `data jsonb` column
   the snapshot sync writes to. ✔
4. **RLS active.** The unauthenticated read returns `[]` (not other users' rows); the signed-in app
   loading the user's own projects proves authenticated reads work. ✔

So accounts + cloud sync are live and pointed at the correct project. **Confirmed working: the owner
ran the two-device sign-in test on 2026-06-11 — edits made on one device pulled down on the other.**
Cloud sync is fully operational. The **file Back up / Restore** path also works regardless and is
unit-tested (`src/test/projectSync.test.ts`).

## Not done (future)

- Real-time / multi-device live merge (currently last-write-wins on open/leave).
- Migrating each tool to read/write `projects.data` directly (the snapshot approach avoids needing
  this, but a native migration would enable partial/field-level sync and server-side queries).
- Auth niceties: password reset, OAuth providers, account deletion.
