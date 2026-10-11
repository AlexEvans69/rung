export type NoteScope = "url" | "site";

export interface BadgeTheme {
  /** Background colour, `#rgb` or `#rrggbb`. */
  bg: string;
  /** Text colour, `#rgb` or `#rrggbb`. */
  text: string;
}

export interface OrganicResult {
  /** The result container (`div[data-hveid]`) the controls are attached to. */
  element: HTMLElement;
  anchor: HTMLAnchorElement;
  title: string;
  /** Destination URL with Google's redirect unwrapped, if it could be resolved. */
  finalUrl: string | null;
  /** Normalised URL used as the key for per-URL notes. */
  urlKey: string | null;
  /** Normalised host (lower-case, no `www.`) used as the key for per-site notes. */
  host: string | null;
}

export interface EffectiveNote {
  text: string;
  scope: NoteScope;
}
