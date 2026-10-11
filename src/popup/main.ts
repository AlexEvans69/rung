import { createApp } from "vue";
import { ChromeStorageStore } from "../storage/kv";
import { NotesRepository } from "../storage/notes";
import { SettingsRepository } from "../storage/settings";
import Popup from "./Popup.vue";
import "./popup.css";

async function main(): Promise<void> {
  const store = new ChromeStorageStore();
  const notes = new NotesRepository(store);
  const settings = new SettingsRepository(store);
  await Promise.all([notes.init(), settings.init()]);
  createApp(Popup, { store, notes, settings }).mount("#app");
}

void main();
