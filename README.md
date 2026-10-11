# SERP Counter + Notes - Free SERP Tool for SEO

Also works in any Chromium-based browser (Microsoft Edge, Opera, Brave, Vivaldi, etc.).

Adds a counter to organic Google results and lets you save notes for any site (a single URL or the entire domain).

Works not only for the top 10 but across all result pages. The extension counts only organic results and ignores
third-party SERP blocks (Products, People Also Ask, videos and similar) as well as paid ads, so it is a simple way to
see the exact position of a specific website for any query.

**Notes:** add notes to websites directly in the SERP. Apply a note to a specific URL or to an entire domain, so you can
save quick insights while analysing competitors, or any other text you want to keep next to the results.

**Credits:** https://brokenseo.net/ · More info: https://brokenseo.net/blog/serp-counter-extension

## Features

- Position badge left of every organic result; click it to change the badge colours (live preview, presets,
  contrast check).
- Notes per page or per whole site, shown next to the result. The editor adapts to Google's light or dark theme.
- Toolbar popup: switch **Numbering** and **Notes** on or off (applies instantly on open tabs), pick a badge
  colour, export and import your notes as JSON.
- Badges and notes sit on two straight vertical lines, level with each result's title, whatever the height of
  the result or its thumbnail. The page's own layout is never shifted.

## Privacy

Everything stays in your browser (`chrome.storage.local`). The extension makes no network requests, has no
background script and asks for a single permission: `storage`.

## Install from source

```bash
npm ci
npm run build
```

Open `chrome://extensions`, enable *Developer mode*, choose *Load unpacked* and select the `dist/` folder.

## Development

| Command | What it does |
| --- | --- |
| `npm run dev` | Rebuilds `dist/` on every change (reload the extension in `chrome://extensions`) |
| `npm run check` | Typecheck + lint + unit tests |
| `npm test` / `npm run test:watch` | Vitest (jsdom) |
| `npm run test:e2e` | Builds, then runs the Playwright suite in a real Chromium (`npx playwright install chromium` once) |
| `npm run package` | Builds and zips `dist/` into `serp-counter-tool.zip` for the store |

CI runs typecheck, lint, unit tests, build and the e2e suite on every push.

Set `localStorage.serpCounterDebug = "1"` on a Google results page to get debug output in the console.

## How it works

```
src/
  core/        Pure logic, no extension APIs
    parser.ts    finds organic results (all Google-markup knowledge lives here)
    layout.ts    the two rails: where badges and notes go, and how much room a note gets
    numbering.ts page context (start/num) and the number of the first result on a page
    urls.ts      URL/host normalisation and redirect unwrapping
    theme.ts, contrast.ts, pageTheme.ts   badge colours, WCAG contrast, light/dark detection
  storage/     Persistence behind a small KeyValueStore interface
    notes.ts     notes + theme, one storage key per note, syncs across tabs
    settings.ts  Numbering / Notes switches
    counts.ts    organic result count per visited page (LRU, capped)
    backup.ts    export/import format (validated)
    migration.ts one-off import of the pre-4.0 note format
  ui/          Vue 3 components, rendered inside Shadow DOM
  content/     controller.ts reconciles the page with the UI, measure.ts reads the layout
  popup/       toolbar popup (separate Vite build)
  manifest.ts  manifest generator (version comes from package.json)
tests/         Vitest + jsdom; SERP markup builders in tests/helpers
e2e/           Playwright: layout, editor, settings and popup against Google-like fixtures
```

Design decisions worth knowing:

- **Idempotent scanning.** Results are tracked by their DOM element, so any number of re-scans cannot create
  duplicate badges, and removed results are cleaned up automatically.
- **Rails, not per-result positioning.** Each result gets a zero-size, out-of-flow host element. Controls are placed
  from measured geometry: x from the widest result column, y from the first line of the title. Positions are
  re-measured on resize, font load and DOM changes. If there is no room beside the column (narrow window,
  knowledge panel, clipping container) the note shrinks from a card to a chip, an icon, or sits inside the column.
- **Shadow DOM.** Styles can't leak into Google's page or be changed by it.
- **Language-independent filtering.** Non-organic modules are detected by structure and Google's own attributes,
  never by visible text, so it works on every Google locale and does not drop results that merely mention words
  like "products".
- **Numbering.** The number of the first result on page *N* is `1 +` the organic counts recorded for pages before it
  (a full page is assumed for pages that were not visited in this search). Different `num`, `gl`, `hl`, `tbs`, ... are
  different searches.
- **Storage.** `n:u:<url>` and `n:s:<host>` hold notes, `theme` the badge colours, `settings` the switches,
  `counts_v2` the page counts. Notes written by versions before 4.0 are imported on first run; the old object is left
  untouched.

### When Google changes its markup

The selectors (`.MjjYud`, `.yuRUbf`, `.VwiC3b`, module class names) are collected at the top of
`src/core/parser.ts`. If numbering breaks, update them there and add the new shape to `tests/helpers/serp.ts`
and `e2e/fixtures.ts`.
