/**
 * Pure layout maths for the two rails the controls sit on:
 *
 *   [badge]  result column ............................  [note rail]
 *
 * The badge rail is a straight vertical line left of the results, the note rail a straight
 * line right of them. Both are vertically centred on the first line of each result's title,
 * so every badge is level with its note and nothing depends on how tall a result is.
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Gap between the badge and the left edge of the results (as in versions up to 4.0). */
export const BADGE_GAP = 12;
export const BADGE_MIN_WIDTH = 54;
export const RAIL_GAP = 16;
export const EDGE_MARGIN = 8;
export const CARD_MIN_WIDTH = 150;
export const CARD_MAX_WIDTH = 240;
export const CHIP_WIDTH = 64;
export const ICON_WIDTH = 30;
export const CONTROL_HEIGHT = 26;

/**
 * How much of a note fits on the rail:
 * card  - button plus the note text
 * chip  - labelled button, the text opens in a popover
 * icon  - icon-only button
 * inset - no room beside the column; the icon sits at the end of the title row
 */
export type RailMode = "card" | "chip" | "icon" | "inset";

export interface Rail {
  mode: RailMode;
  /** Width available to the note controls. */
  width: number;
  /** Viewport x of the rail's left edge. */
  x: number;
  /** Viewport x the badge's right edge is aligned to. */
  badgeRight: number;
}

export function computeRail(results: readonly Box[], rightLimit: number): Rail | null {
  if (results.length === 0) return null;
  const columnLeft = Math.min(...results.map((r) => r.left));
  const columnRight = Math.max(...results.map((r) => r.right));

  // Keep the badge on screen even when Google's column hugs the window edge.
  const badgeRight = Math.max(columnLeft - BADGE_GAP, BADGE_MIN_WIDTH + 4);

  const x = columnRight + RAIL_GAP;
  const free = rightLimit - x - EDGE_MARGIN;

  if (free >= CARD_MIN_WIDTH) {
    return { mode: "card", width: Math.min(free, CARD_MAX_WIDTH), x, badgeRight };
  }
  if (free >= CHIP_WIDTH) return { mode: "chip", width: CHIP_WIDTH, x, badgeRight };
  if (free >= ICON_WIDTH) return { mode: "icon", width: ICON_WIDTH, x, badgeRight };
  return { mode: "inset", width: ICON_WIDTH, x: columnRight - ICON_WIDTH - 4, badgeRight };
}

/** Vertical centre of the first line of a (possibly wrapping) title. */
export function firstLineCenter(top: number, height: number, lineHeight: number | null): number {
  const line = lineHeight && lineHeight > 0 ? Math.min(lineHeight, height) : height;
  return top + line / 2;
}

export interface EntryGeometry {
  /** y of the title's first-line centre, relative to the entry's host element. */
  titleY: number;
  /** x of the badge's right edge, relative to the host. */
  badgeX: number;
  /** x of the note rail's left edge, relative to the host. */
  railX: number;
  /** Vertical room from the title row down to the next result's Note control, for the card. */
  roomY: number;
}

export function sameGeometry(a: EntryGeometry | null, b: EntryGeometry, epsilon = 0.5): boolean {
  return (
    !!a &&
    Math.abs(a.titleY - b.titleY) < epsilon &&
    Math.abs(a.badgeX - b.badgeX) < epsilon &&
    Math.abs(a.railX - b.railX) < epsilon &&
    Math.abs(a.roomY - b.roomY) < epsilon
  );
}
