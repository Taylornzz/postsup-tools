import type { Recipient } from "./deliverables";
import { DR_OPTIONS } from "./deliverables";
import { CATEGORIES, type DelivCategory } from "./deliverablesList";

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
  consumers: { recipientId: string; recipientName: string; itemId: string; inScope: boolean }[];
  inScope: boolean;                                                          // produced by post for at least one recipient
}

const drLabel = (id: string) => DR_OPTIONS.find((d) => d.id === id)?.label || id;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// What distinguishes two artifacts within a category (beyond the label). Audio and picture
// carry real content differences (a different loudness IS a different render); subs/metadata
// are keyed on the label alone for now.
function specFor(cat: DelivCategory, r: Recipient): string {
  if (cat === "audio") return [r.loudness, r.truePeak].filter(Boolean).join(" · ");
  if (cat === "picture") return [r.resolution, drLabel(r.dr)].filter(Boolean).join(" · ");
  return "";
}

export function rollupDeliverables(recipients: Recipient[]): ArtifactGroup[] {
  const map = new Map<string, ArtifactGroup>();
  for (const r of recipients) {
    for (const item of r.deliverables || []) {
      if (!item.label.trim()) continue;
      const spec = specFor(item.category, r);
      const key = `${item.category}|${norm(item.label)}|${spec}`;
      let g = map.get(key);
      if (!g) { g = { key, label: item.label.trim(), category: item.category, spec, consumers: [], inScope: false }; map.set(key, g); }
      g.consumers.push({ recipientId: r.id, recipientName: r.name?.trim() || "Recipient", itemId: item.id, inScope: item.inScope });
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
