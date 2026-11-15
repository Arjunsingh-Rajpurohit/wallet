# Wallet

Every rupee you spend, by day and by category. Free, no account, no ads.

**Open it:** https://arjunsingh-rajpurohit.github.io/wallet/

On your phone, open the link in Chrome → ⋮ → **Add to Home screen**. It then opens like an app, even with no internet.

| Screen | What you do there |
|---|---|
| **Money** | What you spent this month, by category and by day, how much of your budget is left, and the last 6 months. |
| **＋** | Add an expense in a few taps — or snap the bill and the amount, shop and date fill in. |

## Where your data lives

- **On your phone**, in the browser. Nobody else can see it — not even the person who made Wallet.
- **A copy in your own Google Drive** (optional): Settings → **Sign in with Google**. New phone? Open the link, sign in,
  and everything comes back. Wallet can see only its own one file in your Drive, nothing else. Photos are not in the copy.
- **A backup file** (optional): Settings → **Save backup** / **Restore backup**.

## Free AI for photos (optional)

Settings → **Get free key** → sign in with Google → **Create API key** → paste it → **Test**. It is Google's free Gemini
plan (no card). Only the photo you scan is sent to Google.

## Google Drive — one-time setup by the owner

"Sign in with Google" shows up once a free Google client id is set:

1. https://console.cloud.google.com → new project → **APIs & Services** → enable **Google Drive API**.
2. **OAuth consent screen**: External, app name "Wallet", your email; add the scope `.../auth/drive.appdata`; then **Publish app**.
3. **Credentials** → **Create credentials** → **OAuth client ID** → Web application →
   Authorised JavaScript origin: `https://arjunsingh-rajpurohit.github.io`.
4. Put the client id in `src/app/core/variant.ts` (`GOOGLE_CLIENT_ID`) and push.

A client id is not a secret — it is fine in public code.

## For developers

```bash
npm install
npm start        # http://localhost:4200
npm test
```

Angular + Ionic. Data: IndexedDB (Dexie). No server. Pushing to `main` publishes the site.
