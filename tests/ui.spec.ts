import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "../src/storage/kv";
import { NotesRepository, SITE_NOTE_PREFIX, URL_NOTE_PREFIX } from "../src/storage/notes";
import ColorPicker from "../src/ui/ColorPicker.vue";
import NotePanel from "../src/ui/NotePanel.vue";
import ResultControls from "../src/ui/ResultControls.vue";
import { createUiState, type ResultEntry } from "../src/ui/state";

const entry = (over: Partial<ResultEntry> = {}): ResultEntry => ({
  id: 1,
  index: 7,
  title: "T",
  urlKey: "https://a.example/x",
  host: "a.example",
  mount: document.createElement("div"),
  geo: { titleY: 20, badgeX: -12, railX: 600, roomY: 90 },
  ...over,
});

async function uiState(initial: Record<string, unknown> = {}) {
  const store = new MemoryStore(initial);
  const notes = new NotesRepository(store);
  await notes.init();
  return { store, notes, ui: createUiState(notes) };
}

describe("NotePanel", () => {
  it("emits save with the chosen scope and text", async () => {
    const wrapper = mount(NotePanel, { props: { scope: "url", text: "old" } });
    await wrapper.find("textarea").setValue("new text");
    await wrapper.findAll(".scope-btn")[1]!.trigger("click");
    await wrapper.find(".action.primary").trigger("click");
    expect(wrapper.emitted("save")).toEqual([[{ scope: "site", text: "new text" }]]);
  });

  it("emits delete for the active scope", async () => {
    const wrapper = mount(NotePanel, { props: { scope: "site", text: "x" } });
    await wrapper.find(".action.danger").trigger("click");
    expect(wrapper.emitted("delete")).toEqual([[{ scope: "site" }]]);
  });

  it("Escape cancels without saving; Ctrl+Enter saves", async () => {
    const wrapper = mount(NotePanel, { props: { scope: "url", text: "keep" } });
    await wrapper.find("[role=dialog]").trigger("keydown", { key: "Escape" });
    expect(wrapper.emitted("close")).toHaveLength(1);
    expect(wrapper.emitted("save")).toBeUndefined();
    await wrapper.find("[role=dialog]").trigger("keydown", { key: "Enter", ctrlKey: true });
    expect(wrapper.emitted("save")).toEqual([[{ scope: "url", text: "keep" }]]);
  });

  it("exposes save() for the overlay click", () => {
    const wrapper = mount(NotePanel, { props: { scope: "url", text: "abc" } });
    (wrapper.vm as unknown as { save(): void }).save();
    expect(wrapper.emitted("save")).toEqual([[{ scope: "url", text: "abc" }]]);
  });
});

describe("ColorPicker", () => {
  const theme = { bg: "#667eea", text: "#ffffff" };

  it("applies a valid theme", async () => {
    const wrapper = mount(ColorPicker, { props: { theme } });
    await wrapper.findAll("input.color-text")[0]!.setValue("#112233");
    await wrapper.find(".action.primary").trigger("click");
    expect(wrapper.emitted("apply")).toEqual([[{ bg: "#112233", text: "#ffffff" }]]);
  });

  it("blocks invalid colours", async () => {
    const wrapper = mount(ColorPicker, { props: { theme } });
    await wrapper.findAll("input.color-text")[1]!.setValue("not-a-colour");
    const apply = wrapper.find(".action.primary");
    expect(apply.attributes("disabled")).toBeDefined();
    await apply.trigger("click");
    expect(wrapper.emitted("apply")).toBeUndefined();
  });

  it("presets fill both colours and Reset restores the defaults", async () => {
    const wrapper = mount(ColorPicker, { props: { theme } });
    await wrapper.find(".preset").trigger("click");
    expect((wrapper.findAll("input.color-text")[0]!.element as HTMLInputElement).value).toBe("#5a67d8");
    await wrapper.findAll(".action.ghost")[0]!.trigger("click");
    expect((wrapper.findAll("input.color-text")[0]!.element as HTMLInputElement).value).toBe("#667eea");
  });
});

describe("ResultControls", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the result number and opens the note panel", async () => {
    const { ui } = await uiState();
    const wrapper = mount(ResultControls, { props: { entry: entry(), state: ui } });
    expect(wrapper.find(".badge").text()).toBe("7");
    expect(wrapper.find(".note-preview").exists()).toBe(false);
    await wrapper.find(".note-btn").trigger("click");
    expect(ui.panel.value?.entry.index).toBe(7);
  });

  it("shows the effective note, preferring the URL note", async () => {
    const { ui } = await uiState({
      [SITE_NOTE_PREFIX + "a.example"]: "site note",
      [URL_NOTE_PREFIX + "https://a.example/x"]: "url note",
    });
    const wrapper = mount(ResultControls, { props: { entry: entry(), state: ui } });
    expect(wrapper.find(".note-preview-text").text()).toBe("url note");
  });

  it("renders note text as text, never as HTML", async () => {
    const { ui } = await uiState({ [SITE_NOTE_PREFIX + "a.example"]: '<img src=x onerror="alert(1)">' });
    const wrapper = mount(ResultControls, { props: { entry: entry(), state: ui } });
    expect(wrapper.find(".note-preview img").exists()).toBe(false);
    expect(wrapper.find(".note-preview-text").text()).toContain("<img");
  });

  it("opens the colour picker from the badge", async () => {
    const { ui } = await uiState();
    const wrapper = mount(ResultControls, { props: { entry: entry(), state: ui } });
    await wrapper.find(".badge").trigger("click");
    expect(ui.colorPickerOpen.value).toBe(true);
  });

  it("updates when the note changes", async () => {
    const { ui, notes } = await uiState();
    const wrapper = mount(ResultControls, { props: { entry: entry(), state: ui } });
    await notes.save("site", "a.example", "appeared");
    await nextTick();
    expect(wrapper.find(".note-preview-text").text()).toBe("appeared");
  });
});

describe("UiState", () => {
  it("saves through the open panel to the right scope and closes it", async () => {
    const { ui, notes } = await uiState();
    ui.openNote(entry(), { left: 0, top: 0, bottom: 0 });
    await ui.saveNote("site", "site wide");
    expect(notes.get("site", "a.example")).toBe("site wide");
    expect(ui.panel.value).toBeNull();
  });

  it("deletes the note of the chosen scope", async () => {
    const { ui, notes } = await uiState({ [URL_NOTE_PREFIX + "https://a.example/x"]: "bye" });
    ui.openNote(entry(), { left: 0, top: 0, bottom: 0 });
    await ui.deleteNote("url");
    expect(notes.get("url", "https://a.example/x")).toBe("");
  });

  it("persists a theme change", async () => {
    const { ui, store } = await uiState();
    ui.openColorPicker();
    await ui.applyTheme({ bg: "#000000", text: "#ffffff" });
    expect(ui.colorPickerOpen.value).toBe(false);
    expect((await store.getAll()).theme).toEqual({ bg: "#000000", text: "#ffffff" });
  });
});
