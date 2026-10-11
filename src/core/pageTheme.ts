export type PageTheme = "light" | "dark";

function parseRgb(value: string): { r: number; g: number; b: number; a: number } | null {
  const m = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/i);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] === undefined ? 1 : Number(m[4]) };
}

/**
 * Whether Google is currently showing its dark theme. Looks at the declared colour scheme
 * first, then at the actual page background, then at the OS preference.
 */
export function detectPageTheme(doc: Document): PageTheme {
  const view = doc.defaultView;
  if (!view) return "light";

  const scheme = view.getComputedStyle(doc.documentElement).colorScheme?.toLowerCase() ?? "";
  if (scheme.includes("dark") && !scheme.includes("light")) return "dark";
  if (scheme.includes("light") && !scheme.includes("dark")) return "light";

  for (const el of [doc.body, doc.documentElement]) {
    const rgb = el ? parseRgb(view.getComputedStyle(el).backgroundColor) : null;
    if (rgb && rgb.a > 0) {
      const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
      return luminance < 128 ? "dark" : "light";
    }
  }
  return view.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
