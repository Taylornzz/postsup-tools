# Deliverables — Artifact ⟂ Delivery model (spec)

Status: proposal · v0.1 · not built yet

## The problem

Per-recipient deliverables lists duplicate shared work — the M&E, textless, and
graded masters get re-listed under every recipient. But you can't just collapse
duplicates, because the **same file** often ships to several recipients under
**different names, due dates, and wrappers**. Naive merge loses that detail;
naive duplication inflates the make-count and hides that it's really one job.

## The model: two entities, one-to-many

Split "a deliverable" into the thing you **make** and the thing you **send**.

- **Artifact** — a media file you actually produce. Identity is its *content*. Made once.
- **Delivery** — one recipient receiving one artifact, with its own packaging metadata. Many per artifact.

```
Artifact: "M&E 5.1 @ -24 LKFS" ──< Delivery → Netflix  (name, due, wrap, QC, status)
                                  ├─ Delivery → Amazon   (name, due, wrap, QC, status)
                                  └─ Delivery → ABC AU    (name, due, wrap, QC, status)
```

### Artifact
- `id`, `label`, `category` (picture / audio / subs / metadata / marketing)
- `spec` — the content-defining attributes (see **Identity**)
- `source` — which artifact it derives from (the grade-once-derive chain); `null` = original
- `isHero` — the ⭐ master the others derive from
- `notes` + source quote

### Delivery
- `id`, `artifactId`, `recipientId`
- `naming` — this recipient's filename convention
- `dueDate` — the timing for *this* recipient
- `wrapper` / `container`, `sidecars`
- `qc`, `status` (todo / in-progress / delivered)
- `inScope`, `owner`, `notes`

## Identity — when is it "the same artifact"?

A spec-aware key, per category — **not the label alone**:

| Category    | Identity key                                   | Note                                            |
|-------------|------------------------------------------------|-------------------------------------------------|
| audio       | config (5.1.4 / 5.1 / 2.0) + loudness + true-peak | different loudness = different render = different artifact |
| picture     | resolution + range (HDR/SDR) + frame rate      | a fps/standards convert = a different artifact   |
| subtitles   | language + type (SDH / forced / open)          |                                                 |
| metadata    | label + key params                             |                                                 |

Two artifacts are "the same" iff the key matches → **one make, multiple deliveries**.

- **Wrapper is a delivery attribute, not identity** — *unless* the wrap is a genuinely
  distinct file/transcode (IMF vs ProRes of the same essence). Then they're two artifacts,
  both `source`-linked to the master. So: the *grade/essence* is one artifact, each
  rendition is a derived artifact, each named/dated send is a delivery.
- **Never auto-merge.** The app *suggests*; the user confirms. Silently merging two
  subtly-different things is worse than a visible duplicate.

## Views (same data, two lenses)

1. **Production list (make-once)** — unique *artifacts*; the real make-count. Each row
   shows its deliveries inline:
   *"M&E 5.1 @ −24 → Netflix `<name>` 12 Jul · ABC `<name>` 20 Jul."*
   Answers **"what do I actually have to produce, and who's it for?"**
2. **Per-recipient (today's view)** — each recipient's deliveries; a shared one is tagged
   *"same master as Netflix — not a separate make."* Answers **"what does this platform get?"**
3. **Schedule (later)** — all deliveries ordered by `dueDate`; can feed / sync the Planner.

## The AI's role

- **Build** (as now): a recipient's brief → its deliveries.
- **Suggest links** — after a build, flag likely-same artifacts across recipients:
  *"Netflix and ABC both want M&E 5.1 @ −24 — link as one master, two deliveries?"*
  One click to link. Never silent.
- **Build-aware reuse** — when building a recipient, the AI sees existing artifacts and
  creates a *delivery* of an existing one rather than a fresh make where the spec matches.

## Mapping to what already exists

- `Recipient.naming` → `Delivery.naming`
- timing → `Delivery.dueDate` (new) → Planner
- ⭐ `Recipient.isMain` → the hero **artifact**
- today's `DeliverableItem` → becomes a `Delivery` carrying an `artifactId` (nullable until
  linked); the artifact is inferred from the item's spec key

## Build phasing

- **Phase 1 — the rollup (no change to building).** Keep the per-recipient items, compute
  the spec-key, add the **Production-list** view that groups identical items and shows the
  consumer recipients, plus a "shared ×N" tag in the per-recipient view. Pure read-side —
  immediate value, low risk, reversible.
- **Phase 2 — real links.** AI suggests links; a "link as same artifact" action; the
  artifact becomes a first-class record; shared items stop being re-made.
- **Phase 3 — timing.** Per-delivery due dates + the schedule view + Planner sync.

## Open questions / decisions

- **Wrapper**: delivery attribute, or a derived artifact? *Recommend:* delivery attribute,
  unless it's a real transcode/QC step — then a derived artifact under the master.
- **Scope/owner vs naming/timing**: *Recommend:* scope + owner live at the **artifact**
  level (it's the make); naming + due date + QC live at the **delivery** level.
- **Versioning** (v1 vs a v2 redelivery): out of scope for v0.1; a delivery could later
  carry a version stamp.
