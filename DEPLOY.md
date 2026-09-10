# Deploy guide

## Requirements

- Node.js 20+ (works on Node 24)
- One persistent disk location: the app writes a SQLite file at
  `apex-assessment/data/apex.db`. Hosts with ephemeral filesystems
  (Vercel, free-tier Render) lose the database on every redeploy.

## Run

```bash
cd apex-assessment
npm ci
npm run build
npm start          # serves on port 3000; use -p <port> to change
```

First run creates and seeds the database automatically (rubric, demo roster,
superadmin).

## First sign-in

- Seeded superadmin: `vladimir` / `apex2026`
- Change this password (or create your own superadmin and disable this one)
  before loading real data. Create accounts under **Users & Access**.

## Environment variables (all optional)

Set in `.env.local` or the host's env config. See `.env.example`.

| Variable | Purpose |
|---|---|
| `MOONSHOT_API_KEY` | Enables AI-written PDF narrative + APEX Assistant chat |
| `MOONSHOT_MODEL` | Default `kimi-latest`, auto-falls back if unavailable |
| `MOONSHOT_ENABLED=0` | Force AI off |

Without a key the app is fully functional; the PDF narrative uses the built-in
generator.

## Hosting options

- **Any VM / on-prem server** — simplest, full control of the SQLite file.
- **Render (paid)** — use `render.yaml` at the repo root and attach a
  persistent disk mounted at `apex-assessment/data`.
- **Containers** — any Node base image; mount a volume at the data path.

## Tests

```bash
rm -rf apex-assessment/data        # suite needs a fresh database
npm run build && npx next start -p 3111 &
MOONSHOT_ENABLED=0 node e2e/smoke.mjs
```
