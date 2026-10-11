import { createApp } from "vue";
import { debug } from "../core/log";
import { ChromeStorageStore, isExtensionContextValid } from "../storage/kv";
import { PageCounts } from "../storage/counts";
import { migrateLegacyNotes } from "../storage/migration";
import { NotesRepository } from "../storage/notes";
import { SettingsRepository } from "../storage/settings";
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
  const settings = new SettingsRepository(store);
  await Promise.all([notes.init(), counts.init(), settings.init()]);

  const ui = createUiState(notes, settings);
  const { host, mount } = createAppMount(document);
  document.body.appendChild(host);
  createApp(App, { state: ui }).mount(mount);

  const controller = new SerpController({ doc: document, location, counts, ui });

  // With both features off there is nothing to show, so stop watching the page altogether.
  let running = false;
  const apply = ({ numbering, notes: notesOn }: { numbering: boolean; notes: boolean }) => {
    const wanted = numbering || notesOn;
    if (wanted && !running) controller.start();
    else if (!wanted && running) controller.stop();
    running = wanted;
  };
  apply(settings.get());
  settings.subscribe(apply);
  debug("started");
}

main().catch((error) => debug("fatal", error));
