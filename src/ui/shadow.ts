import css from "./styles.css?inline";

/** Tag of the element injected into every result. Used to recognise (and ignore) our own DOM. */
export const RESULT_HOST_TAG = "serp-counter-host";
export const APP_HOST_ID = "serp-counter-app";

let sharedSheet: CSSStyleSheet | null | undefined;

function getSharedSheet(): CSSStyleSheet | null {
  if (sharedSheet !== undefined) return sharedSheet;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    sharedSheet = sheet;
  } catch {
    sharedSheet = null;
  }
  return sharedSheet;
}

/** Styles live inside each shadow root, so they can neither leak into Google's page nor be hit by it. */
export function attachStyles(root: ShadowRoot): void {
  const sheet = getSharedSheet();
  if (sheet && "adoptedStyleSheets" in root) {
    root.adoptedStyleSheets = [sheet];
    return;
  }
  const style = root.ownerDocument.createElement("style");
  style.textContent = css;
  root.appendChild(style);
}

export interface ShadowMount {
  host: HTMLElement;
  mount: HTMLElement;
}

function createShadowMount(doc: Document, tag: string): ShadowMount {
  const host = doc.createElement(tag);
  const root = host.attachShadow({ mode: "open" });
  attachStyles(root);
  const mount = doc.createElement("div");
  root.appendChild(mount);
  return { host, mount };
}

/**
 * The host is an out-of-flow zero-size box: it can never move Google's layout (it takes no
 * space and is not a flex/grid item), and it is the positioned ancestor of the controls, so
 * their offsets are measured from a known point instead of whatever Google positioned.
 */
export function createResultMount(doc: Document): ShadowMount {
  const mount = createShadowMount(doc, RESULT_HOST_TAG);
  const s = mount.host.style;
  s.position = "absolute";
  s.width = "0";
  s.height = "0";
  s.overflow = "visible";
  s.margin = "0";
  s.padding = "0";
  s.border = "0";
  s.zIndex = "2";
  return mount;
}

export function createAppMount(doc: Document): ShadowMount {
  const result = createShadowMount(doc, "div");
  result.host.id = APP_HOST_ID;
  result.host.style.display = "contents";
  return result;
}
