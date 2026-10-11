const FOCUSABLE = "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/** Keeps Tab / Shift+Tab inside `root` (works across a shadow root boundary). */
export function trapTab(event: KeyboardEvent, root: HTMLElement): void {
  if (event.key !== "Tab") return;
  const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const scope = root.getRootNode() as Document | ShadowRoot;
  const active = scope.activeElement;
  if (event.shiftKey && active === first) {
    last.focus();
    event.preventDefault();
  } else if (!event.shiftKey && active === last) {
    first.focus();
    event.preventDefault();
  }
}
