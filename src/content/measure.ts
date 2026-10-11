import { computeRail, firstLineCenter, type Box, type EntryGeometry, type Rail } from "../core/layout";

export interface Measurable {
  id: number;
  element: HTMLElement;
  titleElement: HTMLElement;
  host: HTMLElement;
}

export interface Measurement {
  rail: Rail;
  geometry: Map<number, EntryGeometry>;
}

const CLIPPING = new Set(["hidden", "clip", "scroll", "auto"]);

const toBox = (r: DOMRect): Box => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });

/** Right-most x the note rail may use before something clips it or is in its way. */
function rightLimit(doc: Document, first: HTMLElement, columnRight: number): number {
  const view = doc.defaultView;
  let limit = doc.documentElement.clientWidth || view?.innerWidth || Number.POSITIVE_INFINITY;

  // Knowledge panel / right-hand column.
  const rhs = doc.getElementById("rhs");
  if (rhs) {
    const r = rhs.getBoundingClientRect();
    if (r.width > 0 && r.left >= columnRight) limit = Math.min(limit, r.left);
  }

  // Ancestors that would clip anything placed beside the column.
  if (view) {
    for (let node = first.parentElement; node && node !== doc.body && node !== doc.documentElement; node = node.parentElement) {
      const cs = view.getComputedStyle(node);
      if (CLIPPING.has(cs.overflowX)) {
        const r = node.getBoundingClientRect();
        if (r.width > 0 && r.right >= columnRight) limit = Math.min(limit, r.right);
      }
    }
  }
  return limit;
}

/** Reads the page's layout and returns where each entry's controls go (host-relative). */
export function measureLayout(doc: Document, items: readonly Measurable[]): Measurement | null {
  const first = items[0];
  if (!first) return null;
  const view = doc.defaultView;

  const boxes: Box[] = [];
  for (const { element } of items) {
    boxes.push(toBox(element.getBoundingClientRect()));
    const wrapper = element.closest("div.MjjYud");
    if (wrapper) boxes.push(toBox(wrapper.getBoundingClientRect()));
  }
  const columnRight = Math.max(...boxes.map((b) => b.right));
  const rail = computeRail(boxes, rightLimit(doc, first.element, columnRight));
  if (!rail) return null;

  const geometry = new Map<number, EntryGeometry>();
  for (const item of items) {
    const host = item.host.getBoundingClientRect();
    const title = item.titleElement.getBoundingClientRect();
    const element = item.element.getBoundingClientRect();
    const lineHeight = view ? Number.parseFloat(view.getComputedStyle(item.titleElement).lineHeight) : Number.NaN;
    const center = firstLineCenter(title.top, title.height, Number.isFinite(lineHeight) ? lineHeight : null);

    geometry.set(item.id, {
      titleY: center - host.top,
      badgeX: rail.badgeRight - host.left,
      railX: rail.x - host.left,
      roomY: Math.max(0, element.bottom - center),
    });
  }
  return { rail, geometry };
}
