/** Outline icons (24x24, stroke 2). Paths are from the Tabler icon set (MIT). */
export const ICONS = {
  plus: ["M12 5v14", "M5 12h14"],
  x: ["M18 6 6 18", "M6 6l12 12"],
  trash: ["M4 7h16", "M10 11v6", "M14 11v6", "M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12", "M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"],
  pencil: ["M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16v4", "M13.5 6.5l4 4"],
  chevronDown: ["M6 9l6 6 6-6"],
  note: ["M14 3v4a1 1 0 0 0 1 1h4", "M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z", "M9 13h6", "M9 17h6"],
  check: ["M5 12l5 5L20 7"],
  alert: [
    "M12 9v4",
    "M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636-2.87L13.637 3.59a1.914 1.914 0 0 0-3.274 0z",
    "M12 16h.01",
  ],
} as const;

export type IconName = keyof typeof ICONS;
