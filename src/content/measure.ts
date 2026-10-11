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

/** Clear space kept between a note card and the next result's Note control. */
const NEXT_ROW_GAP = 8;
/** The last card may extend this far below its result, into the space before the footer. */
const LAST_RESULT_EXTRA = 120;

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

  // First-line centre of every title, in document order.
  const centers = items.map((item) => {
    const title = item.titleElement.getBoundingClientRect();
    const lineHeight = view ? Number.parseFloat(view.getComputedStyle(item.titleElement).lineHeight) : Number.NaN;
    return firstLineCenter(title.top, title.height, Number.isFinite(lineHeight) ? lineHeight : null);
  });

  const geometry = new Map<number, EntryGeometry>();
  items.forEach((item, i) => {
    const host = item.host.getBoundingClientRect();
    const center = centers[i] as number;
    const next = centers[i + 1];

    // Room for a note card: down to the next result's title row, where its Note control sits.
    // For the last result (or an unexpected order) fall back to the room inside the result.
    const element = item.element.getBoundingClientRect();
    const room = next !== undefined && next > center ? next - center - NEXT_ROW_GAP : element.bottom - center + LAST_RESULT_EXTRA;

    geometry.set(item.id, {
      titleY: center - host.top,
      badgeX: rail.badgeRight - host.left,
      railX: rail.x - host.left,
      roomY: Math.max(0, room),
    });
  });
  return { rail, geometry };
}
