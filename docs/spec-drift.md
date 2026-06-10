# Spec-drift alerts

Delivery specs change. A plan made in June against Netflix's spec can be wrong by September.
This is the "self-checking, self-updating deliverables" idea, built in three layers — two shipped,
one queued behind accounts.

## Shipped

**v1 — freshness + per-recipient Verify.** Every recipient spec carries `verified.at`; the
staleness badge ages it (per spec class — streamers drift fastest, see `recipientSpecClass`). The
per-recipient **Verify spec** button web-checks one platform's current spec and shows a field-level
diff the user applies *by hand* (never auto-merged).

**v2 — batch drift check (on-demand).** The **Check drift** button (`src/lib/driftCheck.ts`) runs
the same web verify across the recipients worth checking (`driftCandidates` — named, and past their
"fresh" window, to keep the web-search count down), remembers which ones changed, and shows a
persistent **"Possible spec drift"** banner naming them and the fields that differ. Detection only —
applying a change still goes through the per-recipient Verify diff. The result persists per project
(`kaos.deliverables.drift-{pid}`) so the alert survives a reload.

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

Why it waits on accounts: per-user notification and saved projects are what make a *background* alert
meaningful. Until then, the on-demand v2 button delivers the same detection on demand.

### Doctrine (unchanged across all layers)

Never auto-merge a spec change. The platform's own per-title partner-portal spec is always
authoritative; the app proposes, the user confirms. A single bad search result must never silently
rewrite a delivery spec.
