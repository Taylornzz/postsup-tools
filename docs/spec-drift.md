# Spec-drift alerts

Delivery specs change. A plan made in June against Netflix's spec can be wrong by September.
This is the "self-checking, self-updating deliverables" idea, built in three layers — two shipped,
one queued behind accounts.

## Core principle — a locked show holds its spec

You set a show up against the spec agreed at the start, and you **deliver to that spec**. If a
platform revises its published doc mid-production, you do **not** re-cut to chase it — that's not how
post works. So drift is strictly **informational**: it tells you *what changed and when*, and you
decide whether it matters. Nothing is ever changed automatically, and the alerting is worded so it
never reads as "you must fix this." Applying a change is always a deliberate, by-hand act via the
per-recipient **Verify spec** diff.

## Shipped

**v1 — freshness + per-recipient Verify.** Every recipient spec carries `verified.at`; the
staleness badge ages it (per spec class — streamers drift fastest, see `recipientSpecClass`). The
per-recipient **Verify spec** button web-checks one platform's current spec and shows a field-level
diff the user applies *by hand* (never auto-merged).

**v2 — batch drift check (on-demand).** The **Check drift** button (`src/lib/driftCheck.ts` →
`runDriftScan`) web-checks the recipients worth checking (`driftCandidates` — named, past their
"fresh" window, to keep the web-search count down). It runs the checks **in parallel with a
per-check timeout** (default 4-wide, 60 s) so the batch finishes in roughly one slow call's time and
a single hung request can never stall it; the button animates with live `3/6` progress. Each drifted
recipient gets an **inline, informational note right under its spec** — the field-level changes
(`was → now`), the date checked, and a reminder that a show in production keeps its agreed spec. A
slim summary line sits above the list; both are dismissible (per-recipient or all). Persisted per
project (`kaos.deliverables.drift-{pid}`).

## Next — v3: automatic weekly drift (lands with accounts, #10)

The on-demand check costs one web search per recipient. The fully-automatic version moves the cost
server-side and shares it across all users:

1. **Reference table** (Supabase): `platform_spec_reference (id, platform_id, name, spec jsonb,
   verified_at, sources jsonb)`, RLS public-read, seeded from `DELIVERY_TEMPLATES`.
2. **Weekly refresh** (Supabase Edge Function + `pg_cron`): for each platform, run the same
   `web_search` verify as `api/verify-spec.ts`, write the result back to the table with a new
   `verified_at`. The Anthropic key lives only in the function's secrets — never in the client.
3. **Cheap client compare**: the app reads the reference table (one anon-key read, no per-user LLM)
   and flags any recipient whose stored spec differs from the current reference — *"Netflix's spec
   was updated 3 days ago; yours differs on container + loudness."*
4. **Notify** (needs accounts): with a signed-in user + saved projects, a drifted reference can push
   an email / in-app alert without the user opening the app.
5. **Respect the lifecycle** (new): a project should carry a simple state — *planning* (not yet
   shooting / not locked) vs *in production* (locked). Background drift should actively nudge only
   while a project is still in **planning** (when changing the plan is free); for a **locked** project
   it stays silent unless the change is severe, and even then it's a quiet FYI, never a prompt to act.
   This is the data-model piece that makes "runs in the background but doesn't nag a show mid-shoot"
   real — it needs a `status` flag on the project plus the cron above.

Why it waits on accounts: per-user notification, saved projects and a project lifecycle flag are what
make a *background* alert meaningful and well-behaved. Until then, the on-demand v2 button delivers the
same detection on demand, and is worded as information rather than a to-do.

### Doctrine (unchanged across all layers)

Never auto-merge a spec change. The platform's own per-title partner-portal spec is always
authoritative; the app proposes, the user confirms. A single bad search result must never silently
rewrite a delivery spec.
