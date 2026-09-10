# Third-party licenses

All direct dependencies are permissively licensed. No copyleft (GPL / AGPL / SSPL)
anywhere in the direct dependency tree.

## Runtime dependencies

| Package | License |
|---|---|
| next | MIT |
| react, react-dom | MIT |
| better-sqlite3 | MIT (bundles SQLite, public domain) |
| @react-pdf/renderer | MIT |

## Dev dependencies (not shipped)

| Package | License |
|---|---|
| typescript | Apache-2.0 |
| playwright-core | Apache-2.0 |
| @types/* | MIT |

## Data assets

- World map geometry (`src/app/(shell)/analysis/world-geo.ts`): derived from
  Natural Earth 110m, public domain.
- Full license texts ship inside each package under `node_modules/<pkg>/LICENSE`
  after `npm install`.
