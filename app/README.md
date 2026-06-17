# Shotcaller

Browser-based **camera-script management and live cueing** for multi-camera
video directors and ADs — theatre recordings, concert films, broadcast, live
events. It replaces the "build the camera script in Excel, print it, call shots
from paper" workflow with a structured build environment and a dark-room,
keyboard-driven live cueing view.

Fully **client-side and offline-first** — no backend, no accounts. Everything
lives in `localStorage`; the app keeps working with no internet after first load.

---

## Run it

```bash
cd app
npm install
npm run dev      # http://localhost:5173
```

Build for production:

```bash
npm run build    # outputs to app/dist (also generates the PWA service worker)
npm run preview
```

Requires a modern desktop browser. The UI is **desktop-only**, minimum 1280px
wide (a professional gallery tool, not responsive).

### Tests

An end-to-end Playwright suite (`tests/full.mjs`) drives the real app and covers
every flow — corrupt-data recovery, create/import, cue assignment by drag,
drag-handle resize, shotlist filters/search, the detail panel, text-mode round
trip, scenes, exports, the full Live-Mode keyboard workflow, and persistence
across reload. It writes screenshots to `tests/shots/`.

```bash
npm run dev      # in one terminal
npm test         # in another (needs the dev server on :5173)
```

### Recovering from corrupt local data

Stored projects are normalised on load, so old-schema or corrupt data self-heals
automatically — just reload. If a render ever fails outright, an error screen
offers **Reset App Data** (clears all `cueflow*` localStorage keys).

---

## What it does (MVP)

1. **Script import** — paste, `.docx` (via mammoth), or `.txt`, with automatic
   ALL-CAPS character detection that seeds the vocabulary.
2. **Cameras** — define number, label and colour (12-colour dark-safe palette).
3. **Cue assignment** — in **Cue Mode**, drag across the script to select text,
   then assign a camera + shot type in the popover. Resize cues with drag handles.
4. **Text Mode** — edit the underlying script with rich-text formatting; the
   contenteditable is never re-rendered by React mid-edit (cursor stays put).
5. **Shotlist** — 4 columns (`#`, Next Action, Cam/Shot, Script Text), camera
   buffer indicators (SHORT / OK / SAFE), camera filters, search, chapter dividers,
   and a slide-in shot detail panel.
6. **Live Mode** — full-screen cue table. `Space` / `↓` advance, `↑` back,
   `J` jump, `P` pause. Current cue is a subtle grey tint; per-camera status
   strip on the right; running time persisted across refresh.
7. **Exports** — project `.json`, shotlist PDF/CSV, live cue-log PDF/CSV.
8. **Autosave** — 500 ms debounced to `localStorage`, multi-project index.

## Design system

The entire UI is built on the **CueFlow UI Kit** tokens (see
`../CueFlow UI Kit.html`): the exact colour tokens, IBM Plex Sans / JetBrains
Mono / IBM Plex Sans Condensed typography, hairline borders, **zero border-radius**,
no shadows-as-depth. Tokens live in `src/styles/tokens.css`, primitives in
`src/styles/components.css`, layout in `src/styles/app.css`.

## Architecture

- **React + TypeScript + Vite.** State is a single `Project` object driven by
  `useReducer` + Context (`src/state/`). All mutations are atomic dispatches.
- **Data model** in `src/types.ts` mirrors the spec. Shot/chapter character
  indices reference `scene.rawScript.plainText` (blocks joined by newlines), and
  Cue Mode renders that string in a single `white-space: pre-wrap` node so
  index → DOM-offset mapping is exact (selection & highlight rects via
  `Range.getClientRects()`, never DOM injection).
- **Storage** (`src/lib/storage.ts`) — `cueflow_index` + `cueflow_project_<id>`
  keys, with legacy single-key migration.
- **Heavy libs are lazy-loaded** (mammoth for `.docx`, jsPDF for PDF) so the
  initial offline bundle stays small.

---

## Route to market (next builds — not yet implemented)

The product ships as an installable, offline PWA sold once via WooCommerce on
wannesvideo.com (see `../Route to market`). The foundation is already in place:

- **PWA**: configured in `vite.config.ts` (`vite-plugin-pwa`, standalone display,
  Google-Fonts runtime cache, offline precache). Installable after serving over
  HTTPS. ✅ done.
- **License activation** (todo): add a first-launch activation screen that
  validates an HMAC license key locally and stores it in `localStorage` — no
  server call. Slot it ahead of `<App/>` in `src/main.tsx`.
- **WordPress key generator** (todo): a small PHP snippet on the WordPress server
  that signs keys with a held secret; WooCommerce + Stripe emails the key on
  purchase.
- **Landing + shop page** (todo): on the existing WordPress site.

Pricing target: €149–199 individual, €249 studio (one-time).
