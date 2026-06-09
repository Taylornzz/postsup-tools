# Google Drive import — setup (~10 min)

The "Drive" button on a recipient's AI box lets you pick deliverable docs from your Google Drive
(read-only). They download into the app's on-device store and the AI reads them on build. The
access token is held only in memory — never persisted.

It needs two **browser-side** credentials from a Google Cloud project you own. Neither is a
secret: the API key is locked to your domain by HTTP referrer, and the OAuth client ID is public
by design. (Contrast the Anthropic key, which must stay server-side.)

## Steps

1. **Project** — go to <https://console.cloud.google.com> → create or pick a project.

2. **Enable two APIs** — APIs & Services → Library → enable:
   - **Google Picker API**
   - **Google Drive API**

3. **OAuth consent screen** — APIs & Services → OAuth consent screen:
   - User type: **External** (or Internal if you're on Workspace).
   - Fill the app name + your email.
   - Scopes: add **`.../auth/drive.readonly`**.
   - Test users: add the Google account(s) you'll sign in with (while the app is in "Testing").

4. **OAuth client ID** — APIs & Services → Credentials → Create credentials → **OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins** — add both:
     - `https://kaostheory.vercel.app`
     - `http://localhost:8080`
   - Create → copy the **Client ID** → this is `VITE_GOOGLE_CLIENT_ID`.

5. **API key** — Credentials → Create credentials → **API key**:
   - Copy it → this is `VITE_GOOGLE_API_KEY`.
   - Click the key → **Application restrictions: HTTP referrers** → add `https://kaostheory.vercel.app/*`
     and `http://localhost:8080/*`. (Optionally restrict it to the Picker API.)

6. **Add the env vars**
   - **Vercel**: Settings → Environment Variables → add `VITE_GOOGLE_CLIENT_ID` and
     `VITE_GOOGLE_API_KEY` (Production) → **redeploy** (Vite inlines them at build time).
   - **Local**: put them in `.env` (see `.env.example`) and restart `vite`.

That's it — the "Drive" button goes live (until then it shows a setup hint). Pick files, they
import into the recipient's docs, and Build/Grow with AI reads them.

## Notes
- Scope is **read-only** (`drive.readonly`) — the app can't modify or delete your Drive.
- Google-native Docs/Sheets are exported to **PDF** on import; uploaded PDFs/Office files come
  through as-is.
- While the OAuth app is in "Testing", only the test users you listed can connect. To open it up,
  submit it for verification (not needed for personal/internal use).
