# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is **Shotcaller** — a browser-based camera-script management and live-cueing tool for
multi-camera video directors (theatre/concert/broadcast galleries).

- `app/` — the actual application (Vite + React + TypeScript). **All commands run from `app/`.**
- `CueFlow UI Kit.html` — the design-system source of truth (a bundled HTML kit). The app's
  tokens/primitives in `app/src/styles/` are lifted from it. Consult it before adding UI.
- `Route to market` — product/business direction: ship as an **offline PWA**, sold once via
  WooCommerce, gated by a local HMAC license key. Architect new work to fit this (no backend,
  no accounts, works fully offline). License activation + WordPress key generator are **not yet
  built** — see `app/README.md` for where they slot in.
- `Todo.md` — the running list of requested changes/fixes (items get checked off when done).

## Commands (run from `app/`)

```bash
npm install
npm run dev       # Vite dev server on http://localhost:5173
npm run build     # tsc -b && vite build  (also emits the PWA service worker)
npm run preview   # serve the production build
npm test          # Playwright end-to-end suite (REQUIRES `npm run dev` already running on :5173)
```

There is no unit-test framework and no linter beyond `tsc`. Type-check with `npx tsc -b`
(strict mode, `noUnusedLocals`/`noUnusedParameters` are on — unused symbols fail the build).

`npm test` runs the single end-to-end script `tests/full.mjs`, which drives the real app in
headless Chromium and writes screenshots to `tests/shots/`. To run a subset, edit/comment
sections in that file. Testing notes that matter:
- Drag-to-select needs **intermediate `mouse.move({steps})`** — a single jump won't trigger the
  geometric selection handler.
- `localStorage` lags the **500ms autosave debounce**, so assert against the DOM or wait before
  reading storage.

## Architecture (the big picture)

**Fully client-side, offline-first. No backend, no API, no auth.** All data lives in
`localStorage`. State is one `Project` object (`src/types.ts`) driven by `useReducer` + Context.

### State flow
- `src/state/reducer.ts` is the single reducer for every mutation (shots, chapters, cameras,
  vocab, scenes, live-mode advance/jump/etc.). All mutations are **atomic dispatches**; components
  hold only transient UI state.
- `src/state/context.tsx` wires the reducer, exposes `useApp()`, and runs the **debounced (500ms)
  autosave** to `localStorage`.
- `src/lib/storage.ts` — multi-project persistence (`cueflow_index` + `cueflow_project_<id>`).
  `restoreLastProject()` save-backs the normalized project on load (don't rely on autosave to
  persist the initial/repaired project — React StrictMode double-invoke drops the first debounce).
- `src/lib/normalize.ts` — **every loaded/imported project is run through `normalizeProject`**,
  which repairs old-schema/partial/corrupt data so a bad blob never crashes the app. Treat stored
  data as untrusted. `ErrorBoundary` is the last-resort recovery screen (offers "Reset App Data").

### The shared-text model (most important cross-file concept)
Cue Mode and Text Mode render **one shared DOM element** (`.sv-doc` in
`src/components/script/ScriptViewer.tsx`). Switching modes only toggles `contentEditable` and
shows/hides the cue overlay — the user must see **no change in the text**, only in interaction.
- Shots/chapters store **character indices into `scene.rawScript.plainText`** (not the HTML).
- `src/lib/textmodel.ts` maps `plainText` indices ⇄ live DOM positions via a TreeWalker, so cue
  highlights are drawn with `Range.getClientRects()` (never by injecting spans).
- **Invariant:** `htmlToPlainText` (in `src/lib/script.ts`, used by the reducer) and the live
  `textmodel` walk MUST produce identical `plainText` — they share the same block-walk + whitespace
  rules. If you change one, change both, or shot indices will drift.
- Do **not** reset the shared element's `innerHTML` during a text edit — the `lastHtmlRef` guard in
  ScriptViewer distinguishes our own commits from external changes (import/scene switch).

### Top-level structure
- `src/App.tsx` switches between **Edit mode** (`components/EditMode.tsx`) and **Live mode**
  (`components/live/LiveMode.tsx`).
- Edit mode = icon rail + sliding sidebar (`components/sidebar/`), Script Viewer (left), Shotlist
  (right). Live mode = full-screen keyboard-driven cue table (Space/↑/↓ advance, J jump, P pause).
- `src/lib/derive.ts` — pure selectors (ordered rows, camera buffer SHORT/OK/SAFE, clocks).
- `src/lib/exporters.ts` — JSON/CSV/PDF export and project import. **Heavy libs (`jspdf`,
  `mammoth`) are dynamically imported** to keep the offline bundle small — preserve that pattern.

### Design system constraints (from the CueFlow UI Kit)
- `border-radius: 0` everywhere (enforced in `styles/tokens.css`); hairline 1px borders; no shadows
  as depth. Fonts: IBM Plex Sans (body), JetBrains Mono (numbers/mono), IBM Plex Sans Condensed
  (labels). Use the existing CSS tokens/classes — **don't introduce new colors or radii.**

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
