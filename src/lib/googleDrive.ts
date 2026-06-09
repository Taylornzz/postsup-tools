/* Google Drive import via the Picker API. Read-only: the user picks files from their Drive,
 * we download them into the app's on-device store (the same place uploads go) and the AI reads
 * them on build. The OAuth access token is held only in memory for the picker + download, never
 * persisted. Needs (public, browser-side) credentials from the project owner's Google Cloud:
 *   VITE_GOOGLE_CLIENT_ID  — OAuth 2.0 Web client ID
 *   VITE_GOOGLE_API_KEY    — browser API key (restrict by HTTP referrer)
 * See docs/google-drive-setup.md. These are NOT secrets (the API key is origin-restricted and
 * the client ID is public) — unlike the Anthropic key, which stays server-side. */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export const driveConfigured = () => Boolean(CLIENT_ID && API_KEY);

/* eslint-disable @typescript-eslint/no-explicit-any */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

let ready = false;
async function ensureScripts() {
  if (ready) return;
  await loadScript("https://apis.google.com/js/api.js");
  await loadScript("https://accounts.google.com/gsi/client");
  await new Promise<void>((res) => (window as any).gapi.load("picker", () => res()));
  ready = true;
}

function getToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const tc = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp: any) => (resp?.access_token ? resolve(resp.access_token) : reject(new Error(resp?.error || "Authorisation cancelled"))),
    });
    tc.requestAccessToken({ prompt: "" });
  });
}

/** Open the Google Picker, let the user choose files, download them, and return them as Files
 *  (Google-native docs are exported to PDF). The token lives only for this call. */
export async function pickDriveFiles(): Promise<File[]> {
  if (!driveConfigured()) throw new Error("Google Drive isn't set up — add VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY (see docs/google-drive-setup.md).");
  await ensureScripts();
  const token = await getToken();
  const g = (window as any).google;

  const picked: { id: string; name: string; mimeType: string }[] = await new Promise((resolve) => {
    const view = new g.picker.DocsView(g.picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(false);
    const picker = new g.picker.PickerBuilder()
      .enableFeature(g.picker.Feature.MULTISELECT_ENABLED)
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .setCallback((data: any) => {
        if (data.action === g.picker.Action.PICKED) resolve((data.docs || []).map((d: any) => ({ id: d.id, name: d.name, mimeType: d.mimeType })));
        else if (data.action === g.picker.Action.CANCEL) resolve([]);
      })
      .build();
    picker.setVisible(true);
  });

  const files = await Promise.all(picked.map(async (d) => {
    const isNative = (d.mimeType || "").startsWith("application/vnd.google-apps");
    const url = isNative
      ? `https://www.googleapis.com/drive/v3/files/${d.id}/export?mimeType=application/pdf`
      : `https://www.googleapis.com/drive/v3/files/${d.id}?alt=media`;
    try {
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      const name = isNative && !/\.pdf$/i.test(d.name) ? `${d.name}.pdf` : d.name;
      return new File([blob], name, { type: blob.type || d.mimeType || "application/octet-stream" });
    } catch { return null; }
  }));
  return files.filter(Boolean) as File[];
}
