# Vendor directory — maintenance runbook

The vendor directory (`src/lib/vendors.ts`) is the single source of truth for both the
**Vendors** tab and the **"Who do I use for…"** AI advisor (`api/vendor-advisor.ts`). The advisor
can only recommend companies in this file, so the no-defunct-companies guarantee is only as good as
this list is current.

The post industry is moving fast (the 2024–26 contraction took out Technicolor/MPC, Milk VFX,
Jellyfish, Pixomondo, Glassworks, Éclair and more). So the directory needs a scheduled re-check.

## Cadence

- **Re-verify every ~6 months.**
- Last full pass: **`VENDORS_VERIFIED` = June 2026**.
- Next due: **`VENDORS_REVERIFY_BY` = December 2026** (shown in the tab's "Verified" badge tooltip).

When you finish a pass, bump both constants in `src/lib/vendors.ts` and update the excluded-defunct
list in the header comment.

## What to check for each region

Regions: NZ, AU, SE Asia, US, UK, France, Germany, Western Europe, Global (software/hardware).

For every listed vendor, confirm three things:

1. **Still trading** — not in administration / liquidation / "ceased operations". This is the one that
   matters most for the guarantee.
2. **Still doing the listed service** — labs drop film lines, facilities drop departments.
3. **Name / ownership** — M&A and rebrands (e.g. Picture Shop UK → The Farm + Home Post). Update the
   `name`, `url` and `blurb`; keep the entry if the capability survived under a new name.

Then sweep for **gaps** — major facilities that should be listed but aren't (new builds, expansions
into a region).

## Process

1. Run a web search per region. Useful queries (current month matters — the tool defaults to it):
   - `"<region> post production facility" 2026 closed OR administration OR liquidation`
   - `"<region> film lab" 35mm develop scan 2026`
   - `"<region> DCP mastering" OR "DCI DCP" facility 2026`
   - `"<region> Dolby Atmos mix stage" 2026`
   - `largest VFX OR post houses <region> 2026`
2. Cross-check any "maybe closed" against a second source before removing.
3. Edit `src/lib/vendors.ts`:
   - Remove failed companies; add them to the header's excluded-defunct list with the date + reason.
   - Add new/missed vendors (match the `Vendor` shape: `name, region, city?, types[], blurb, url`).
   - Fix renames/moves in place.
4. Update the curated `VENDOR_SCENARIOS` answers if a named vendor in them changed.
5. Bump `VENDORS_VERIFIED` and `VENDORS_REVERIFY_BY`.
6. `npx vitest run` (the deliverables/vendor tests must stay green), then deploy.

## Optional: semi-automate the check

The same web-search-grounded pattern used by `api/verify-spec.ts` (Anthropic `web_search_20250305`
tool + a structured result tool) can be pointed at the directory: feed it the current vendor list and
ask it to flag any that look closed/renamed and any obvious gaps, returning a structured diff for a
human to confirm. Keep it **propose-only** — never auto-remove a vendor — for the same reason spec
verification never auto-merges: a single bad search result shouldn't silently drop a working facility.
If/when this is built, wire it as `api/verify-vendors.ts` and surface a "Re-verify directory" action
behind the badge.

## The guarantee, restated

Because the advisor is grounded **exclusively** in this file (hard rule in its system prompt: never
recall vendors from memory), keeping this list clean is what lets the advisor promise it will never
recommend a company that's gone bust. Maintenance here = accuracy everywhere.
