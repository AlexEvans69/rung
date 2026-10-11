# SERP Counter + Notes - Free SERP Tool for SEO

Also works in any Chromium-based browser (Microsoft Edge, Opera, Brave, Vivaldi, etc.).

Adds a counter to organic Google results and lets you save notes for any site (a single URL or the entire domain).

Works not only for the top 10 but across all result pages. The extension counts only organic results and ignores
third-party SERP blocks (Products, People Also Ask, videos and similar) as well as paid ads, so it is a simple way to
see the exact position of a specific website for any query.

**Notes:** add notes to websites directly in the SERP. Apply a note to a specific URL or to an entire domain, so you can
save quick insights while analysing competitors, or any other text you want to keep next to the results.

**Credits:** https://brokenseo.net/ · More info: https://brokenseo.net/blog/serp-counter-extension

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
| `npm run check` | Typecheck + lint + tests (run by CI) |
| `npm test` / `npm run test:watch` | Vitest |
| `npm run package` | Builds and zips `dist/` into `serp-counter-tool.zip` for the store |

Set `localStorage.serpCounterDebug = "1"` on a Google results page to get debug output in the console.

## How it works

```
src/
  core/        Pure logic, no extension APIs
    parser.ts    finds organic results (all Google-markup knowledge lives here)
    numbering.ts page context (start/num) and the number of the first result on a page
    urls.ts      URL/host normalisation and redirect unwrapping
    theme.ts     badge colours: presets and validation
  storage/     Persistence behind a small KeyValueStore interface
    notes.ts     notes + theme, one storage key per note, syncs across tabs
    counts.ts    organic result count per visited page (LRU, capped)
    migration.ts one-off import of the pre-4.0 note format
  ui/          Vue 3 components, rendered inside Shadow DOM
  content/     controller.ts reconciles the page with the UI, index.ts is the entry point
  manifest.ts  manifest generator (version comes from package.json)
tests/         Vitest + jsdom, SERP markup builders in tests/helpers
```

Design decisions worth knowing:

- **Idempotent scanning.** Results are tracked by their DOM element, so any number of re-scans cannot create
  duplicate badges, and removed results are cleaned up automatically.
- **Shadow DOM.** Styles can't leak into Google's page or be changed by it.
- **Language-independent filtering.** Non-organic modules are detected by structure and Google's own attributes,
  never by visible text, so it works on every Google locale and does not drop results that merely mention words
  like "products".
- **Numbering.** The number of the first result on page *N* is `1 +` the organic counts recorded for pages before it
  (a full page is assumed for pages that were not visited in this search). Different `num`, `gl`, `hl`, `tbs`, ... are
  different searches.
- **Storage.** `n:u:<url>` and `n:s:<host>` hold notes, `theme` the badge colours, `counts_v2` the page counts.
  Notes written by versions before 4.0 are imported on first run; the old object is left untouched.

### When Google changes its markup

The selectors (`.MjjYud`, `.yuRUbf`, `.VwiC3b`, module class names) are collected at the top of
`src/core/parser.ts`. If numbering breaks, update them there and add the new shape to `tests/helpers/serp.ts`.
