## Quick context

- This repository is a Vite + React + TypeScript single-page app (see `package.json`). The main UI and app logic live in `src/app.tsx`; `src/main.tsx` mounts the React app.
- Primary purpose: manage wire records, import spreadsheets, preview/print labels and run-lists using AG Grid and `xlsx` parsing.

## How to run

- Dev server: `npm run dev` (uses `vite` with HMR).
- Build: `npm run build` (runs `tsc -b` then `vite build`).
- Preview production build: `npm run preview`.
- Lint: `npm run lint`.

## Architecture & key files

- `src/app.tsx` — single large component that contains UI, state, grid definition, CSV/XLSX import, label builder (`buildLabelLine`), and CSS-in-JS styles (`GRID_STYLES`). Agents modifying UI or behavior should start here.
- `src/main.tsx` — app bootstrap and mount point.
- `package.json` — dependencies include `ag-grid-community`, `ag-grid-react`, `xlsx`, and `file-saver`. Dev commands (vite + tsc) are defined here.
- `tsconfig.app.json` — project TypeScript config used by the build step.

## Important patterns and conventions (do not break)

- Single-component pattern: Most logic lives in `src/app.tsx`. Prefer small, focused changes rather than large re-architectures unless requested.
- Local persistence: app reads/writes the key `conneks.data.v1` in `localStorage`. Preserve this key/shape when migrating formats or transforming records to avoid user data loss.
- Import parsing: the spreadsheet import looks for a marker row containing `RECORDS START` and then maps columns to fields by fixed indices. If changing parsing, update the marker lookup and the mapping block in `handleFileUpload` in `src/app.tsx`.
- Save history before destructive edits: code calls `saveHistory()` prior to import, add, clone, and delete operations — preserve or reuse this pattern when adding new mutating flows.
- AG Grid usage: columns are defined in `colDefs` with visibility controlled by boolean state flags (e.g., `showLoc1`). When adding/removing columns update `colDefs` and the corresponding show/hide state and UI checkbox in the sidebar.
- Styling: a large CSS block `GRID_STYLES` is injected via `<style>{GRID_STYLES}</style>` in `src/app.tsx`. Edit here for global app style changes rather than scattering CSS files.

## Integration points & external libraries

- AG Grid: `ag-grid-react` + `ag-grid-community` — modules are registered via `ModuleRegistry.registerModules([ AllCommunityModule ])` (see top of `src/app.tsx`).
- XLSX import: uses `xlsx` file parsing; `FileReader.readAsBinaryString` is used and then `XLSX.read(..., {type:'binary'})`. When modifying imports, keep the same read flow or update consumer logic accordingly.
- File-saver & xlsx: present for export/print features — locate usage if implementing download/ export improvements.

## Code-editing guidance and examples

- To add a new column: update `colDefs` in `src/app.tsx`, add a UI checkbox in the sidebar mapping to a new `showX` state, and respect `saveHistory()` semantics before applying changes to `rowData`.
- To change how labels print: edit `buildLabelLine()` which composes the printed label lines; label layout is also affected by `labelStock` and `printLoc*` flags.
- To change import behavior: update `handleFileUpload()` and keep the `markerIdx` lookup (search for `RECORDS START`) and the column indices mapping.

## Debugging tips

- Use `npm run dev` and the browser console; React is mounted with `StrictMode` in `src/main.tsx`.
- Inspect `localStorage` for `conneks.data.v1` to view persisted `rowData` during development.
- AG Grid debugging: use the `gridRef` reference in `src/app.tsx` to call APIs (e.g., `gridRef.current.api.getSelectedRows()`).

## Tests & CI

- There are no automated tests configured. Keep changes minimal and manually verify via `npm run dev` and test import/export and label preview flows.

## When to ask the repo owner

- If you plan to split `src/app.tsx` into multiple components or change the localStorage schema, confirm migration strategy to preserve user data.
- If you need to add a backend or persist records server-side, ask about authentication, database choice, and expected API shape — there are currently no backend hooks in the code.

---
If anything here is unclear or you'd like more detail (for example, a suggested refactor plan to split `src/app.tsx`), tell me which area and I'll expand or update this file.
