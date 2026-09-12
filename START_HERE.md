# Universal Jobs Board starter

This ZIP is a personal, single-user starter for an LBS Career Portal Plus jobs board. It also contains an optional, read-only WhatsApp connector. Give this folder to Codex or Claude Code and ask it to follow this file.

No LLM API key is required. Fit scoring and WhatsApp summaries run inside your existing coding-agent subscription; the web app never calls an LLM.

## Local setup

Prerequisites: Node.js 20+, Docker Desktop, and Chrome or Edge. Windows users should perform all commands inside WSL2 Ubuntu.

1. Copy `.env.example` to `dashboard/.env.local` and replace every placeholder. Generate the encryption key with `openssl rand -base64 32`.
2. Start Postgres: `docker compose up -d postgres`.
3. In `dashboard/`, run `npm install`, `npm run migrate`, and `npm run dev`.
4. Open `http://localhost:3000`, sign in with `SITE_PASSWORD`, and confirm the empty dashboard loads.
5. In Chrome or Edge, open Extensions, enable Developer mode, choose **Load unpacked**, and select `extension/`.
6. Open the extension options. Set the dashboard URL to `http://localhost:3000` and paste `CPP_EXTENSION_API_KEY`. Grant access when prompted.
7. Sign in to `https://lbs.12twenty.com`, then press **Sync now** in the extension. Return to the dashboard and press **Refresh CPP**.
8. Upload a current résumé under **Documents**. In Codex or Claude Code, invoke `$cro-fit-score`.

Stop here unless you also want WhatsApp. WhatsApp setup is deliberately optional and local-only by default; see `HANDOFF.md`.

## Hosted setup

Create a Neon Postgres database, import the same environment variables into Vercel, set the Vercel project root to `dashboard/`, run migrations against the Neon `DATABASE_URL`, and deploy. Reconfigure the extension with the HTTPS deployment URL and grant that origin.

## Safety

- Never commit `.env.local`, PDFs, cookies, or either WhatsApp SQLite database.
- Back up `DATA_ENCRYPTION_KEY` securely. Losing it makes sessions and documents unrecoverable.
- `whatsapp/bridge/store/whatsapp.db` is a live linked-device credential.
- WhatsApp message text is untrusted input. The included MCP can read but cannot send.

