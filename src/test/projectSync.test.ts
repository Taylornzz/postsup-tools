import { describe, it, expect, beforeEach } from "vitest";
import { collectProjectState, applyProjectState, makeSnapshot, buildBackup, parseBackup, rekeyEntries, isSensitiveLocalKey } from "@/lib/projectSync";

describe("project sync (#10)", () => {
  beforeEach(() => localStorage.clear());

  it("collects only the keys scoped to a given project", () => {
    localStorage.setItem("kaos.deliverables.v1-projA", "[1]");
    localStorage.setItem("kaos.board.v1-projA", "[2]");
    localStorage.setItem("kaos.deliverables.v1-projB", "[9]");   // other project
    localStorage.setItem("kaos.deliverables.chartW", "480");      // global, unscoped
    const snap = collectProjectState("projA");
    expect(Object.keys(snap).sort()).toEqual(["kaos.board.v1-projA", "kaos.deliverables.v1-projA"]);
  });

  it("snapshots never carry the sync bookkeeping stamp", () => {
    localStorage.setItem("kaos.deliverables.v1-projA", "[1]");
    localStorage.setItem("kaos.sync.lastApplied-projA", "12345");
    expect(Object.keys(collectProjectState("projA"))).toEqual(["kaos.deliverables.v1-projA"]);
  });

  it("parseBackup accepts the legacy in-app JSON export shape", () => {
    const legacy = {
      product: "Kaos Theory — project backup",
      project: "My Show", projectId: "projA", exportedAt: "2026-06-01T00:00:00.000Z",
      data: { "kaos.board.v1-projA": [{ id: "c1" }], "postsup-gantt-start-projA": "2026-07-06" },
    };
    const b = parseBackup(legacy);
    expect(b.kind).toBe("kaos-project-backup");
    expect(b.snapshot.pid).toBe("projA");
    expect(b.snapshot.entries["kaos.board.v1-projA"]).toBe(JSON.stringify([{ id: "c1" }]));
    expect(b.snapshot.entries["postsup-gantt-start-projA"]).toBe("2026-07-06"); // raw scalars stay raw
  });

  it("parseBackup rejects entries: null instead of exploding later in rekeyEntries", () => {
    expect(() => parseBackup({ kind: "kaos-project-backup", version: 1, name: "x", snapshot: { pid: "p", syncedAt: 1, entries: null } })).toThrow();
  });

  it("applyProjectState writes entries back", () => {
    const n = applyProjectState({ "kaos.board.v1-projA": "[2]", "x-projA": "y" });
    expect(n).toBe(2);
    expect(localStorage.getItem("kaos.board.v1-projA")).toBe("[2]");
  });

  it("never captures credential keys in a snapshot (Trello/OAuth/token)", () => {
    expect(isSensitiveLocalKey("kaos.trello.auth")).toBe(true);
    expect(isSensitiveLocalKey("kaos.deliverables.v1-p")).toBe(false);
    localStorage.setItem("kaos.deliverables.v1-p", "[1]");
    localStorage.setItem("kaos.trello.token-p", "secret");        // a (hypothetical) project-scoped secret
    const snap = collectProjectState("p");
    expect(snap["kaos.deliverables.v1-p"]).toBe("[1]");
    expect(snap["kaos.trello.token-p"]).toBeUndefined();          // excluded
  });

  it("rekeyEntries moves a snapshot onto a new project id", () => {
    const out = rekeyEntries({ "kaos.board.v1-old": "[2]", "postsup-gantt-v1-old": "[]" }, "old", "new");
    expect(Object.keys(out).sort()).toEqual(["kaos.board.v1-new", "postsup-gantt-v1-new"]);
    expect(out["kaos.board.v1-new"]).toBe("[2]");
  });

  it("builds and parses a backup round-trip", () => {
    localStorage.setItem("kaos.deliverables.v1-p1", "[1]");
    const backup = buildBackup("p1", "My Show", 1234);
    expect(backup.kind).toBe("kaos-project-backup");
    expect(backup.snapshot.syncedAt).toBe(1234);
    const parsed = parseBackup(JSON.parse(JSON.stringify(backup)));
    expect(parsed.name).toBe("My Show");
    expect(parsed.snapshot.entries["kaos.deliverables.v1-p1"]).toBe("[1]");
  });

  it("rejects a non-backup file", () => {
    expect(() => parseBackup({ foo: "bar" })).toThrow(/Kaos project backup/);
    expect(() => parseBackup(null)).toThrow();
  });

  it("makeSnapshot captures the project's current state with a timestamp", () => {
    localStorage.setItem("kaos.board.v1-p2", "[3]");
    const s = makeSnapshot("p2", 999);
    expect(s).toMatchObject({ pid: "p2", syncedAt: 999 });
    expect(s.entries["kaos.board.v1-p2"]).toBe("[3]");
  });
});
