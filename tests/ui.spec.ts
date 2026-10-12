import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "../src/storage/kv";
import { NotesRepository, SITE_NOTE_PREFIX, URL_NOTE_PREFIX } from "../src/storage/notes";
import { SettingsRepository } from "../src/storage/settings";
import ColorPopover from "../src/ui/ColorPopover.vue";
import NoteEditor from "../src/ui/NoteEditor.vue";
import ResultControls from "../src/ui/ResultControls.vue";
import { createUiState, type ResultEntry } from "../src/ui/state";

const ANCHOR = { left: 0, top: 0, bottom: 0 };

const entry = (over: Partial<ResultEntry> = {}): ResultEntry => ({
  id: 1,
  index: 7,
  title: "T",
  urlKey: "https://a.example/x",
  host: "a.example",
  mount: document.createElement("div"),
  geo: { titleY: 20, badgeX: -12, railX: 600, roomY: 140 },
  ...over,
});

async function uiState(initial: Record<string, unknown> = {}) {
  const store = new MemoryStore(initial);
  const notes = new NotesRepository(store);
  const settings = new SettingsRepository(store);
  await Promise.all([notes.init(), settings.init()]);
  return { store, notes, settings, ui: createUiState(notes, settings) };
}

const editorProps = (over: object = {}) => ({
  host: "a.example",
  path: "/x",
  scope: "url" as const,
  texts: { url: "", site: "" },
  ...over,
});

describe("NoteEditor", () => {
  it("emits save with the chosen scope and text", async () => {
    const wrapper = mount(NoteEditor, { props: editorProps({ texts: { url: "old", site: "" } }) });
    await wrapper.find("textarea").setValue("new text");
    await wrapper.findAll(".seg button")[1]!.trigger("click");
    await wrapper.find(".btn.primary").trigger("click");
    expect(wrapper.emitted("save")).toEqual([[{ scope: "site", text: "new text" }]]);
  });

  it("shows the stored text of the other scope until you start typing", async () => {
    const wrapper = mount(NoteEditor, { props: editorProps({ texts: { url: "page note", site: "site note" } }) });
    const area = () => wrapper.find("textarea").element as HTMLTextAreaElement;
    expect(area().value).toBe("page note");
    await wrapper.findAll(".seg button")[1]!.trigger("click");
    expect(area().value).toBe("site note");
    await wrapper.find("textarea").setValue("typed");
    await wrapper.findAll(".seg button")[0]!.trigger("click");
    expect(area().value).toBe("typed");
  });

  it("explains what each scope covers, and which note wins", async () => {
    const wrapper = mount(NoteEditor, { props: editorProps({ texts: { url: "p", site: "" } }) });
    expect(wrapper.find(".hint").text()).toContain("only on this exact page");
    await wrapper.findAll(".seg button")[1]!.trigger("click");
    expect(wrapper.find(".hint").text()).toContain("every page of a.example");
    expect(wrapper.find(".hint").text()).toContain("takes priority");
  });

  it("only allows deleting a note that exists in the selected scope", async () => {
    const wrapper = mount(NoteEditor, { props: editorProps({ texts: { url: "p", site: "" } }) });
    const del = wrapper.find(".icon-btn.danger");
    expect(del.attributes("disabled")).toBeUndefined();
    await del.trigger("click");
    expect(wrapper.emitted("delete")).toEqual([[{ scope: "url" }]]);
    await wrapper.findAll(".seg button")[1]!.trigger("click");
    expect(wrapper.find(".icon-btn.danger").attributes("disabled")).toBeDefined();
  });

  it("Escape cancels without saving; Ctrl+Enter saves", async () => {
    const wrapper = mount(NoteEditor, { props: editorProps({ texts: { url: "keep", site: "" } }) });
    await wrapper.find("[role=dialog]").trigger("keydown", { key: "Escape" });
    expect(wrapper.emitted("close")).toHaveLength(1);
    expect(wrapper.emitted("save")).toBeUndefined();
    await wrapper.find("[role=dialog]").trigger("keydown", { key: "Enter", ctrlKey: true });
    expect(wrapper.emitted("save")).toEqual([[{ scope: "url", text: "keep" }]]);
  });

  it("explains and blocks saving when the result's address could not be determined", async () => {
    const wrapper = mount(NoteEditor, {
      props: editorProps({ available: { url: false, site: true }, texts: { url: "", site: "" } }),
    });
    await wrapper.find("textarea").setValue("text");
    expect(wrapper.find(".hint.warn").text()).toContain("Whole site");
    expect(wrapper.find(".btn.primary").attributes("disabled")).toBeDefined();
    (wrapper.vm as unknown as { save(): void }).save();
    expect(wrapper.emitted("save")).toBeUndefined();

    await wrapper.findAll(".seg button")[1]!.trigger("click");
    expect(wrapper.find(".hint.warn").exists()).toBe(false);
    expect(wrapper.find(".btn.primary").attributes("disabled")).toBeUndefined();
  });

  it("exposes save() for the click-outside behaviour and labels the segmented control", () => {
    const wrapper = mount(NoteEditor, { props: editorProps({ texts: { url: "abc", site: "" } }) });
    (wrapper.vm as unknown as { save(): void }).save();
    expect(wrapper.emitted("save")).toEqual([[{ scope: "url", text: "abc" }]]);
    expect(wrapper.find(".seg").attributes("aria-label")).toBeTruthy();
  });
});

describe("ColorPopover", () => {
  const theme = { bg: "#667eea", text: "#ffffff" };
  const inputs = (w: ReturnType<typeof mount>) => w.findAll("input.hex");

  it("applies a valid theme", async () => {
    const wrapper = mount(ColorPopover, { props: { theme } });
    await inputs(wrapper)[0]!.setValue("#112233");
    await wrapper.find(".btn.primary").trigger("click");
    expect(wrapper.emitted("apply")).toEqual([[{ bg: "#112233", text: "#ffffff" }]]);
  });

  it("blocks invalid colours and says so", async () => {
    const wrapper = mount(ColorPopover, { props: { theme } });
    await inputs(wrapper)[1]!.setValue("not-a-colour");
    const apply = wrapper.find(".btn.primary");
    expect(apply.attributes("disabled")).toBeDefined();
    await apply.trigger("click");
    expect(wrapper.emitted("apply")).toBeUndefined();
    expect(wrapper.find(".contrast").text()).toContain("valid hex");
  });

  it("reports contrast with a grade", async () => {
    const wrapper = mount(ColorPopover, { props: { theme: { bg: "#000000", text: "#ffffff" } } });
    expect(wrapper.find(".contrast").text()).toContain("21.0 : 1");
    expect(wrapper.find(".contrast").classes()).toContain("AAA");
    await inputs(wrapper)[1]!.setValue("#222222");
    expect(wrapper.find(".contrast").classes()).toContain("poor");
  });

  it("presets fill both colours and mark themselves selected", async () => {
    const wrapper = mount(ColorPopover, { props: { theme } });
    await wrapper.findAll(".preset")[1]!.trigger("click");
    expect((inputs(wrapper)[0]!.element as HTMLInputElement).value).toBe("#7c3aed");
    expect(wrapper.findAll(".preset")[1]!.classes()).toContain("selected");
  });

  it("picks a readable text colour automatically when asked", async () => {
    const wrapper = mount(ColorPopover, { props: { theme } });
    await wrapper.find(".toggle-row").trigger("click");
    await inputs(wrapper)[0]!.setValue("#ffeb3b");
    expect((inputs(wrapper)[1]!.element as HTMLInputElement).value).toBe("#111111");
    // choosing a text colour by hand turns automatic mode off again
    await inputs(wrapper)[1]!.setValue("#333333");
    await inputs(wrapper)[0]!.setValue("#000000");
    expect((inputs(wrapper)[1]!.element as HTMLInputElement).value).toBe("#333333");
  });

  it("Reset restores the classic colours; Escape closes", async () => {
    const wrapper = mount(ColorPopover, { props: { theme: { bg: "#000000", text: "#ff0000" } } });
    await wrapper.findAll(".btn")[0]!.trigger("click");
    expect((inputs(wrapper)[0]!.element as HTMLInputElement).value).toBe("#667eea");
    await wrapper.find("[role=dialog]").trigger("keydown", { key: "Escape" });
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});

describe("ResultControls", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the number and an empty ghost chip that opens the editor", async () => {
    const { ui } = await uiState();
    const wrapper = mount(ResultControls, { props: { entry: entry(), state: ui } });
    expect(wrapper.find(".badge").text()).toBe("7");
    expect(wrapper.find(".card").exists()).toBe(false);
    expect(wrapper.find(".chip").classes()).not.toContain("filled");
    await wrapper.find(".chip").trigger("click");
    expect(ui.panel.value?.entry.index).toBe(7);
  });

  it("shows the effective note as a card tagged with its scope", async () => {
    const { ui } = await uiState({
      [SITE_NOTE_PREFIX + "a.example"]: "site note",
      [URL_NOTE_PREFIX + "https://a.example/x"]: "url note",
    });
    const wrapper = mount(ResultControls, { props: { entry: entry(), state: ui } });
    expect(wrapper.find(".card-text").text()).toBe("url note");
    expect(wrapper.find(".tag").text()).toBe("Page");
    expect(wrapper.find(".chip").exists()).toBe(false);
  });

  it("tags a site note as such", async () => {
    const { ui } = await uiState({ [SITE_NOTE_PREFIX + "a.example"]: "site note" });
    const wrapper = mount(ResultControls, { props: { entry: entry(), state: ui } });
    expect(wrapper.find(".tag").text()).toBe("Site");
  });

  it("renders note text as text, never as HTML", async () => {
    const { ui } = await uiState({ [SITE_NOTE_PREFIX + "a.example"]: '<img src=x onerror="alert(1)">' });
    const wrapper = mount(ResultControls, { props: { entry: entry(), state: ui } });
    expect(wrapper.find(".card img").exists()).toBe(false);
    expect(wrapper.find(".card-text").text()).toContain("<img");
  });

  it("opens the colour picker from the badge", async () => {
    const { ui } = await uiState();
    const wrapper = mount(ResultControls, { props: { entry: entry(), state: ui } });
    await wrapper.find(".badge").trigger("click");
    expect(ui.colorPicker.value).not.toBeNull();
  });

  it("updates when the note changes", async () => {
    const { ui, notes } = await uiState();
    const wrapper = mount(ResultControls, { props: { entry: entry(), state: ui } });
    await notes.save("site", "a.example", "appeared");
    await nextTick();
    expect(wrapper.find(".card-text").text()).toBe("appeared");
  });

  it("hides what the toolbar switches off", async () => {
    const { ui, settings } = await uiState({ [SITE_NOTE_PREFIX + "a.example"]: "n" });
    const wrapper = mount(ResultControls, { props: { entry: entry(), state: ui } });
    await settings.update({ numbering: false });
    await nextTick();
    expect(wrapper.find(".badge").exists()).toBe(false);
    expect(wrapper.find(".card").exists()).toBe(true);
    await settings.update({ numbering: true, notes: false });
    await nextTick();
    expect(wrapper.find(".badge").exists()).toBe(true);
    expect(wrapper.find(".card").exists()).toBe(false);
    expect(wrapper.find(".chip").exists()).toBe(false);
  });

  it("falls back to a compact control when there is no room beside the column", async () => {
    const { ui } = await uiState({ [SITE_NOTE_PREFIX + "a.example"]: "n" });
    ui.rail.value = { mode: "icon", width: 30, x: 0, badgeRight: 0 };
    const wrapper = mount(ResultControls, { props: { entry: entry(), state: ui } });
    expect(wrapper.find(".card").exists()).toBe(false);
    expect(wrapper.find(".chip.icon.filled").exists()).toBe(true);
  });

  it("waits for a measurement before showing anything", async () => {
    const { ui } = await uiState();
    const wrapper = mount(ResultControls, { props: { entry: entry({ geo: null }), state: ui } });
    expect(wrapper.find(".badge").exists()).toBe(false);
  });
});

describe("UiState", () => {
  it("opens the editor on the visible note's scope with both texts", async () => {
    const { ui } = await uiState({ [SITE_NOTE_PREFIX + "a.example"]: "site", [URL_NOTE_PREFIX + "https://a.example/x"]: "page" });
    ui.openNote(entry(), ANCHOR);
    expect(ui.panel.value).toMatchObject({ scope: "url", texts: { url: "page", site: "site" } });
  });

  it("saves through the open editor to the right scope and closes it", async () => {
    const { ui, notes } = await uiState();
    ui.openNote(entry(), ANCHOR);
    await ui.saveNote("site", "site wide");
    expect(notes.get("site", "a.example")).toBe("site wide");
    expect(ui.panel.value).toBeNull();
  });

  it("deletes the note of the chosen scope", async () => {
    const { ui, notes } = await uiState({ [URL_NOTE_PREFIX + "https://a.example/x"]: "bye" });
    ui.openNote(entry(), ANCHOR);
    await ui.deleteNote("url");
    expect(notes.get("url", "https://a.example/x")).toBe("");
  });

  it("persists a theme change and closes the picker", async () => {
    const { ui, store } = await uiState();
    ui.openColorPicker(ANCHOR);
    await ui.applyTheme({ bg: "#000000", text: "#ffffff" });
    expect(ui.colorPicker.value).toBeNull();
    expect((await store.getAll()).theme).toEqual({ bg: "#000000", text: "#ffffff" });
  });

  it("closes an open editor when notes are switched off", async () => {
    const { ui, settings } = await uiState();
    ui.openNote(entry(), ANCHOR);
    await settings.update({ notes: false });
    expect(ui.panel.value).toBeNull();
  });
});
