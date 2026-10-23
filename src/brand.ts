/** One place for everything that carries the product's name. */
export const BRAND = {
  name: "Rung",
  tagline: "SERP counter and notes",
  /** Chrome Web Store title (`name` in the manifest); max 75 characters, no "Google". */
  storeTitle: "Rung SERP Counter - Free SERP Checker Tool",
  /** Store summary (`description` in the manifest); max 132 characters. */
  description:
    "Numbers every organic result on Google Search and pins your notes to any page or whole site. Free, private, no account.",
  color: "#4f46e5",
} as const;

/** The author's other tool, linked once from the popup footer. */
export const AUTHOR_TOOL = {
  name: "allclicks",
  blurb: "a Search Console dashboard for all your sites",
  url: "https://allclicks.net/?utm_source=rung&utm_medium=extension&utm_campaign=popup",
} as const;
