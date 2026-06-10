import { describe, it, expect } from "vitest";
import { orderProjects, type Project } from "@/lib/projects";

const P = (id: string, name: string, created: number, updated: number): Project =>
  ({ id, name, color: "#000", createdAt: created, updatedAt: updated });

describe("orderProjects (sort + pin)", () => {
  const a = P("a", "Beta", 100, 300);   // edited most recently
  const b = P("b", "Alpha", 200, 200);
  const c = P("c", "Gamma", 300, 100);  // created most recently

  it("default sort is last-edited", () => {
    expect(orderProjects([c, b, a], [], "edited").map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
  it("sorts by name A–Z", () => {
    expect(orderProjects([a, b, c], [], "name").map((p) => p.name)).toEqual(["Alpha", "Beta", "Gamma"]);
  });
  it("sorts by newest-created", () => {
    expect(orderProjects([a, b, c], [], "created").map((p) => p.id)).toEqual(["c", "b", "a"]);
  });
  it("pinned come first (top-left), then the rest — each group in the chosen sort", () => {
    expect(orderProjects([a, b, c], ["c"], "name").map((p) => p.id)).toEqual(["c", "b", "a"]); // pin c, rest by name (Alpha b, Beta a)
    expect(orderProjects([a, b, c], ["c", "a"], "name").map((p) => p.id)).toEqual(["a", "c", "b"]); // pins by name (Beta a, Gamma c), rest (Alpha b)
  });
  it("ignores a pinned id that no longer exists", () => {
    expect(orderProjects([a, b], ["gone"], "edited").map((p) => p.id)).toEqual(["a", "b"]);
  });
});
