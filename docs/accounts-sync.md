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

## ⚠️ Important: Supabase project mismatch (action needed before relying on cloud sync)

The app's `.env.local` points at Supabase project **`lijtvekgvpwuuofdocgf`**. The Supabase MCP tool in
this workspace is bound to a **different** project (`vwoiqjnbqhmvtntgvefl`). Because of the standing
rule not to touch the wrong (memorial) project, **no database changes were made via the MCP**, and the
cloud-sync path was **not** verified end-to-end here. Before relying on it:

1. Confirm `lijtvekgvpwuuofdocgf` is the correct Kaos project and that its `projects` table has a
   `data jsonb` column (the app already reads/writes `data.url`, so it should).
2. Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in the **Vercel** project env (production), then
   redeploy — that's what flips the deployed site from local mode to real accounts.
3. Sign in on two devices and confirm: open project on A → edit → leave; open on B → the edits pulled
   down. The **file Back up / Restore** path works regardless and is the fallback.

The file-backup engine is unit-tested (`src/test/projectSync.test.ts`). The cloud push/pull reuses the
already-working `projects.ts` API (anon key + RLS), so it targets whatever project the **app** is
configured with — never the MCP's project.

## Not done (future)

- Real-time / multi-device live merge (currently last-write-wins on open/leave).
- Migrating each tool to read/write `projects.data` directly (the snapshot approach avoids needing
  this, but a native migration would enable partial/field-level sync and server-side queries).
- Auth niceties: password reset, OAuth providers, account deletion.
