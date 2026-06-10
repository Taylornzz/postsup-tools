import type { Recipient } from "./deliverables";
import { DR_OPTIONS } from "./deliverables";
import { CATEGORIES, type DelivCategory, type DelivStatus } from "./deliverablesList";

/** Phase 1 of the artifact ⟂ delivery model (see docs/deliverables-artifact-model.md):
 *  a read-only rollup that groups every recipient's deliverable items into unique
 *  *artifacts* (the things you actually make once), keyed spec-aware so the same label
 *  at a different loudness/resolution stays a separate artifact — never an auto-merge of
 *  the underlying data, just a lens. Each group lists the recipients that consume it. */

export interface ArtifactGroup {
  key: string;
  label: string;
  category: DelivCategory;
  spec: string;                                                              // the distinguishing spec, e.g. "-27 LKFS · -2 dBTP"
  specKey: string;                                                           // the inferred content identity (category|label|spec)
  linked: boolean;                                                           // grouped by an explicit user-confirmed artifactId
  artifactId?: string;                                                       // present when linked
  consumers: { recipientId: string; recipientName: string; itemId: string; inScope: boolean; status: DelivStatus; version: number }[];
  inScope: boolean;                                                          // produced by post for at least one recipient
}

const drLabel = (id: string) => DR_OPTIONS.find((d) => d.id === id)?.label || id;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

let _aseq = 0;
const newArtifactId = () => `a${Date.now().toString(36)}${(_aseq++).toString(36)}`;

// What distinguishes two artifacts within a category (beyond the label). Audio and picture
// carry real content differences (a different loudness IS a different render); subs/metadata
// are keyed on the label alone for now.
function specFor(cat: DelivCategory, r: Recipient): string {
  // Identity must distinguish a genuinely different render: a different frame rate IS a
  // different picture master; a different channel layout IS a different audio render.
  if (cat === "audio") return [r.audio, r.loudness, r.truePeak].filter(Boolean).join(" · ");
  if (cat === "picture") return [r.resolution, drLabel(r.dr), r.fps ? `${r.fps} fps` : ""].filter(Boolean).join(" · ");
  return "";
}
const specKeyOf = (cat: DelivCategory, label: string, spec: string) => `${cat}|${norm(label)}|${spec}`;

export function rollupDeliverables(recipients: Recipient[]): ArtifactGroup[] {
  // Pass 1: map each content identity (specKey) to a confirmed artifactId, if any item in
  // that cluster carries one. This lets a later identical-but-unlinked item join the same
  // make-once group instead of splitting off into a second row (partial-link reconciliation).
  const specKeyToArtifact = new Map<string, string>();
  for (const r of recipients) {
    for (const item of r.deliverables || []) {
      if (!item.label.trim() || !item.artifactId) continue;
      const sk = specKeyOf(item.category, item.label, specFor(item.category, r));
      if (!specKeyToArtifact.has(sk)) specKeyToArtifact.set(sk, item.artifactId);
    }
  }

  const map = new Map<string, ArtifactGroup>();
  for (const r of recipients) {
    for (const item of r.deliverables || []) {
      if (!item.label.trim()) continue;
      const spec = specFor(item.category, r);
      const specKey = specKeyOf(item.category, item.label, spec);
      // A user-confirmed link groups durably (survives a label edit on one recipient); an
      // unlinked item adopts a sibling's artifactId when the content matches; otherwise the
      // inferred content identity (specKey) groups identical items.
      const artifactId = item.artifactId || specKeyToArtifact.get(specKey);
      const linked = !!artifactId;
      const key = linked ? `art:${artifactId}` : `spec:${specKey}`;
      let g = map.get(key);
      if (!g) { g = { key, label: item.label.trim(), category: item.category, spec, specKey, linked, artifactId, consumers: [], inScope: false }; map.set(key, g); }
      g.consumers.push({ recipientId: r.id, recipientName: r.name?.trim() || "Recipient", itemId: item.id, inScope: item.inScope, status: item.status, version: item.version || 1 });
      if (item.inScope) g.inScope = true;
    }
  }
  const order = CATEGORIES.map((c) => c.id);
  return [...map.values()].sort((a, b) => (order.indexOf(a.category) - order.indexOf(b.category)) || a.label.localeCompare(b.label));
}

/** itemId → how many recipients share this artifact (for the per-item "shared ×N" tag). */
export function shareCounts(groups: ArtifactGroup[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of groups) {
    if (g.consumers.length > 1) for (const c of g.consumers) m.set(c.itemId, g.consumers.length);
  }
  return m;
}

/** Aggregate delivery status for one make-once artifact across all the recipients that
 *  consume it. The same physical master can be Accepted by one platform and still To-do
 *  for another — this is what makes per-(item×recipient) status visible on the rollup.
 *  `tone` drives the UI/PDF colour; a QC fail anywhere dominates, then unfinished, etc. */
export type GroupTone = "fail" | "pending" | "partial" | "done" | "neutral";
export function groupStatus(g: ArtifactGroup): { label: string; tone: GroupTone; done: number; total: number } {
  const total = g.consumers.length;
  const done = g.consumers.filter((c) => c.status === "delivered" || c.status === "accepted").length;
  const failed = g.consumers.some((c) => c.status === "qc-fail" || c.status === "redeliver");
  if (failed) {
    const n = g.consumers.filter((c) => c.status === "qc-fail" || c.status === "redeliver").length;
    return { label: total > 1 ? `${n} of ${total} need re-delivery` : "Needs re-delivery", tone: "fail", done, total };
  }
  if (done === 0) return { label: total > 1 ? `To do (×${total})` : "To do", tone: "pending", done, total };
  if (done < total) return { label: `${done} of ${total} delivered`, tone: "partial", done, total };
  return { label: total > 1 ? `All ${total} delivered` : "Delivered", tone: "done", done, total };
}

// ---------------------------------------------------------------------------
// Phase 2 — durable artifact links. The rollup INFERS shared artifacts from the
// spec key; linking makes that a first-class, user-confirmed fact so shared items
// stop being treated as separate makes (and the link survives a label edit).
// Doctrine: never auto-merge — we only ever SUGGEST; the user clicks to link.
// ---------------------------------------------------------------------------

export interface LinkSuggestion {
  specKey: string;
  label: string;
  category: DelivCategory;
  spec: string;
  recipientNames: string[];                 // who shares this inferred artifact
  itemRefs: { recipientId: string; itemId: string }[];
}

/** One reference cluster per content identity (specKey), gathering every matching item
 *  across recipients with whatever artifactId it currently carries. */
function clustersBySpec(recipients: Recipient[]) {
  const m = new Map<string, { specKey: string; label: string; category: DelivCategory; spec: string;
    refs: { recipientId: string; recipientName: string; itemId: string; artifactId?: string }[] }>();
  for (const r of recipients) {
    for (const item of r.deliverables || []) {
      if (!item.label.trim()) continue;
      const spec = specFor(item.category, r);
      const specKey = specKeyOf(item.category, item.label, spec);
      let c = m.get(specKey);
      if (!c) { c = { specKey, label: item.label.trim(), category: item.category, spec, refs: [] }; m.set(specKey, c); }
      c.refs.push({ recipientId: r.id, recipientName: r.name?.trim() || "Recipient", itemId: item.id, artifactId: item.artifactId });
    }
  }
  return m;
}

/** Identical items across ≥2 recipients that aren't yet unified under a single artifactId.
 *  These are the "link as one master, N deliveries?" prompts. */
export function linkSuggestions(recipients: Recipient[]): LinkSuggestion[] {
  const out: LinkSuggestion[] = [];
  for (const c of clustersBySpec(recipients).values()) {
    if (c.refs.length < 2) continue;
    const ids = new Set(c.refs.map((r) => r.artifactId || ""));
    const alreadyUnified = ids.size === 1 && !ids.has(""); // all share one real artifactId
    if (alreadyUnified) continue;
    out.push({
      specKey: c.specKey, label: c.label, category: c.category, spec: c.spec,
      recipientNames: [...new Set(c.refs.map((r) => r.recipientName))],
      itemRefs: c.refs.map((r) => ({ recipientId: r.recipientId, itemId: r.itemId })),
    });
  }
  return out;
}

/** Link every item in a spec cluster to one artifactId (reusing an existing one in the
 *  cluster if present, else minting). Returns updated recipients — pure, no mutation. */
export function linkBySpecKey(recipients: Recipient[], specKey: string): Recipient[] {
  const cluster = clustersBySpec(recipients).get(specKey);
  if (!cluster) return recipients;
  const existing = cluster.refs.map((r) => r.artifactId).find(Boolean);
  const artifactId = existing || newArtifactId();
  const itemIds = new Set(cluster.refs.map((r) => r.itemId));
  return recipients.map((r) => ({
    ...r,
    deliverables: (r.deliverables || []).map((it) => (itemIds.has(it.id) ? { ...it, artifactId } : it)),
  }));
}

/** Remove an artifact link from every item carrying it (back to inferred grouping). */
export function unlinkArtifact(recipients: Recipient[], artifactId: string): Recipient[] {
  return recipients.map((r) => ({
    ...r,
    deliverables: (r.deliverables || []).map((it) => {
      if (it.artifactId !== artifactId) return it;
      const { artifactId: _drop, ...rest } = it;
      return rest;
    }),
  }));
}
