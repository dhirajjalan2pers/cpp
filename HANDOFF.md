# Handoff guide

## What is included

The dashboard is a Next.js application backed solely by Postgres. A Chromium extension captures the owner’s authenticated LBS Career Portal Plus cookies and sends them to a dedicated extension endpoint. Cookies and PDFs are encrypted before storage. Jobs, per-job state, and imported fit-score analyses remain queryable.

The optional WhatsApp subsystem links a personal account through the WhatsApp multi-device protocol, stores messages locally in SQLite, and exposes read/search/context tools through a read-only MCP server. Optional web sync mirrors messages into the dashboard Postgres database only after explicit opt-in.

## Architecture and trust boundaries

1. Dashboard login uses `SITE_PASSWORD` and an HMAC-signed, HTTP-only session cookie.
2. The extension uses only `CPP_EXTENSION_API_KEY`; it does not know the site password.
3. CPP cookies and document bytes use AES-256-GCM with `DATA_ENCRYPTION_KEY`.
4. Optional WhatsApp agent reads use either the site session or `WHATSAPP_AGENT_API_KEY`.
5. The dashboard never calls an LLM. The fit-score and CCO skills use the active Codex/Claude Code session.

## Setup phases

### 1. Dashboard and database

Follow `START_HERE.md`. Migrations are explicit and tracked in `dashboard/migrations/`; rerunning `npm run migrate` is safe. `npm run doctor` checks required configuration without printing secret values.

For Neon, use its pooled Postgres URL. For Vercel, set the project root to `dashboard`, configure all non-WhatsApp secrets, deploy, and run `npm run migrate` locally with the Neon URL. Do not enable preview deployments against production data unless that is intentional.

### 2. CPP extension

Load `extension/` unpacked. The options page requests access only to the configured dashboard origin. The API key lives in `chrome.storage.local`, not synced Chrome storage. Automatic sync is debounced for 30 minutes and runs only after a non-login `lbs.12twenty.com` tab finishes loading. The popup shows last result and session expiry.

If refresh returns 401, sign into CPP again and resync. If extension upload returns 403, verify that its API key matches the dashboard environment. If network access fails, revisit Options and grant the current dashboard origin.

### 3. Documents and fit scores

Upload a PDF résumé (one active résumé) and optional cover letters (multiple). Files are limited to 10 MB. Invoke `$cro-fit-score` from the starter root. The skill exports decrypted résumé content to a user-selected temporary path, instructs the active agent to score jobs, validates the JSON contract, imports scores, and deletes the temporary résumé after the workflow. Scores become stale when the résumé or job description hash changes.

### 4. Optional WhatsApp

Prerequisites: Go 1.25+, Python 3.11+, and `uv`. In `whatsapp/bridge`, run `go run .` and scan the QR code in WhatsApp → Linked devices. The bridge creates `store/whatsapp.db` (credential) and `store/messages.db` (private content).

Configure the MCP command shown in `whatsapp/mcp/README.md`. For persistent operation use the templates in `whatsapp/services/`: launchd on macOS or a systemd user service on Linux/WSL2. WSL2 users must enable systemd in `/etc/wsl.conf` and restart WSL.

The MCP intentionally has no send or media-download tools. `$cco-whatsapp` summarizes data and proposes follow-ups but never acts on them.

### 5. Optional WhatsApp web sync

Set `ENABLE_WHATSAPP_WEB_SYNC=true`, configure a distinct `WHATSAPP_AGENT_API_KEY`, verify `WHATSAPP_SQLITE_PATH`, then run `npm run whatsapp:sync -- --once`. The sync is incremental by SQLite row ID and records a heartbeat. Run it periodically with your service manager if desired.

This opt-in stores private message text in Postgres. The only web interfaces are protected `GET /api/whatsapp/health` and `GET /api/whatsapp/context?hours=72&limit=30`. There is no WhatsApp web UI and no outbound action.

## Operations and recovery

- Back up Postgres and all secrets. Restoring encrypted rows requires the original encryption key.
- Re-link WhatsApp by stopping the bridge, moving its two databases to a secure backup location, and restarting. Never delete databases until a backup exists.
- CPP refresh is transactional. Existing jobs are marked inactive rather than deleted if they disappear upstream.
- Run `npm test`, `npm run build`, and `npm run audit:whatsapp` after changes.

## Deliberate exclusions

No accounts, LBS email login, multi-tenancy, Redis, LLM APIs, automated résumé rewriting, outbound WhatsApp, email, Slack, scheduling, Firefox, or native Windows support.
