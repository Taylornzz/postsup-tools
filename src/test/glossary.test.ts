import { describe, it, expect } from "vitest";
import { GLOSSARY } from "@/lib/glossary";

/** Mirror of Glossary.tsx's resolution chain: norm-match the full string or its
 *  parenthetical-stripped head against term, then aka, then fall back to the head as a
 *  substring search over term/aka/definition. A "See also" is dead if that search has 0 hits. */
const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
function resolveSeeAlso(s: string): string {
  const head = s.replace(/\s*\(.*$/, "").trim();
  const full = norm(s), headN = norm(head);
  const byTerm = GLOSSARY.find((e) => norm(e.term) === full) || GLOSSARY.find((e) => norm(e.term) === headN);
  if (byTerm) return byTerm.term;
  const byAka = GLOSSARY.find((e) => e.aka?.some((a) => norm(a) === full || norm(a) === headN));
  if (byAka) return byAka.term;
  return head || s;
}
const hits = (q: string) => {
  const n = q.trim().toLowerCase();
  return GLOSSARY.filter((e) =>
    e.term.toLowerCase().includes(n) ||
    (e.aka || []).some((a) => a.toLowerCase().includes(n)) ||
    e.definition.toLowerCase().includes(n),
  ).length;
};

describe("glossary data integrity", () => {
  it("ships a substantial glossary", () => {
    expect(GLOSSARY.length).toBeGreaterThan(500);
  });

  it("no two entries share the same normalized term (duplicates must be merged)", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const e of GLOSSARY) {
      const n = norm(e.term);
      if (seen.has(n)) dupes.push(`"${e.term}" duplicates "${seen.get(n)}"`);
      else seen.set(n, e.term);
    }
    expect(dupes).toEqual([]);
  });

  it("every 'See also' reference resolves to at least one entry", () => {
    const dead: string[] = [];
    for (const e of GLOSSARY) {
      for (const s of e.seeAlso || []) {
        if (hits(resolveSeeAlso(s)) === 0) dead.push(`${e.term} -> ${s}`);
      }
    }
    expect(dead).toEqual([]);
  });
});
