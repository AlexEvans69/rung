import { createApp } from "vue";
import { debug } from "../core/log";
import { ChromeStorageStore, isExtensionContextValid } from "../storage/kv";
import { PageCounts } from "../storage/counts";
import { migrateLegacyNotes } from "../storage/migration";
import { NotesRepository } from "../storage/notes";
import App from "../ui/App.vue";
import { createAppMount } from "../ui/shadow";
import { createUiState } from "../ui/state";
import { SerpController } from "./controller";

const GUARD = "__serpCounterTool";

async function main(): Promise<void> {
  const w = window as unknown as Record<string, unknown>;
  if (w[GUARD] || !isExtensionContextValid()) return;
  w[GUARD] = true;

  const store = new ChromeStorageStore();
  await migrateLegacyNotes(store);

  const notes = new NotesRepository(store);
  const counts = new PageCounts(store);
  await Promise.all([notes.init(), counts.init()]);

  const ui = createUiState(notes);
  const { host, mount } = createAppMount(document);
  document.body.appendChild(host);
  createApp(App, { state: ui }).mount(mount);

  new SerpController({ doc: document, location, counts, ui }).start();
  debug("started");
}

main().catch((error) => debug("fatal", error));
