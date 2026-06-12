import type { BoardColumn } from "./boardExport";

/** One-way push of the Task Board to Trello via its REST API (client-side; Trello
 *  allows CORS). The user supplies their own API key + token — both stay in this
 *  browser's localStorage, never sent anywhere except api.trello.com.
 *
 *  Getting credentials (free):
 *  1. API key: https://trello.com/power-ups/admin → create a Power-Up → API key.
 *  2. Token: the authorize URL below (uses your key), approve, paste the token. */

const AUTH_KEY = "kaos.trello.auth";

export interface TrelloAuth { key: string; token: string; }

export function loadTrelloAuth(): TrelloAuth {
  try { return { key: "", token: "", ...(JSON.parse(localStorage.getItem(AUTH_KEY) || "{}")) }; }
  catch { return { key: "", token: "" }; }
}
export function saveTrelloAuth(a: TrelloAuth) {
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); } catch { /* ignore */ }
}

export const trelloAuthorizeUrl = (key: string) =>
  `https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=${encodeURIComponent("Kaos Theory")}&key=${encodeURIComponent(key)}`;

async function trello<T>(auth: TrelloAuth, method: "GET" | "POST", path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, key: auth.key, token: auth.token });
  const resp = await fetch(`https://api.trello.com/1${path}?${qs}`, { method });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    if (resp.status === 401) throw new Error("Trello rejected the key/token — re-check both (the token must be authorized for this key).");
    throw new Error(`Trello ${resp.status}: ${body.slice(0, 120) || "request failed"}`);
  }
  return resp.json() as Promise<T>;
}

/** Create a new Trello board mirroring the task board: lists in order, cards with
 *  notes/due dates, checklists with ticked items. Returns the new board's URL. */
export async function sendBoardToTrello(
  auth: TrelloAuth, cols: BoardColumn[], boardName: string,
  onProgress?: (msg: string) => void,
): Promise<string> {
  if (!auth.key.trim() || !auth.token.trim()) throw new Error("Add your Trello API key and token first.");
  onProgress?.("Creating board…");
  const board = await trello<{ id: string; url: string; shortUrl?: string }>(auth, "POST", "/boards/", {
    name: boardName || "Kaos Theory board",
    defaultLists: "false",
    desc: "Pushed from Kaos Theory (kaostheory.vercel.app)",
  });

  let cardCount = 0;
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    onProgress?.(`List ${i + 1}/${cols.length}: ${col.name}…`);
    const list = await trello<{ id: string }>(auth, "POST", "/lists", {
      name: col.name, idBoard: board.id, pos: "bottom",
    });
    for (const card of col.cards) {
      cardCount++;
      const c = await trello<{ id: string }>(auth, "POST", "/cards", {
        idList: list.id,
        name: card.title,
        ...(card.notes ? { desc: card.notes } : {}),
        // Noon LOCAL converted to an instant — Trello renders dues in the viewer's timezone,
        // so a fixed `T12:00:00Z` displays as the NEXT day at UTC+12 and beyond (e.g. NZ).
        ...(card.due ? { due: new Date(`${card.due}T12:00:00`).toISOString() } : {}),
        pos: "bottom",
      });
      if (card.checks.length) {
        const cl = await trello<{ id: string }>(auth, "POST", "/checklists", { idCard: c.id, name: "Checklist" });
        for (const item of card.checks) {
          await trello(auth, "POST", `/checklists/${cl.id}/checkItems`, { name: item.text, checked: String(item.done) });
        }
      }
    }
  }
  onProgress?.(`Done — ${cardCount} cards pushed.`);
  return board.shortUrl || board.url;
}
