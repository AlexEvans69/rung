import { BRAND } from "./brand";
import { GOOGLE_DOMAINS } from "./google-domains";

export const ICON_SIZES = [16, 32, 48, 128] as const;

const icons = Object.fromEntries(ICON_SIZES.map((size) => [String(size), `icons/icon${size}.png`]));

/** The content script only has to run on the search results page, not on Maps, Drive, etc. */
export const SEARCH_PATH = "/search*";

export function createMatches(domains: readonly string[] = GOOGLE_DOMAINS): string[] {
  return domains.map((domain) => `*://www.${domain}${SEARCH_PATH}`);
}

export function createManifest(version: string) {
  return {
    manifest_version: 3,
    name: BRAND.storeTitle,
    version,
    description: BRAND.description,
    permissions: ["storage"],
    content_scripts: [
      {
        matches: createMatches(),
        js: ["contentScript.js"],
        run_at: "document_idle",
      },
    ],
    action: {
      default_title: BRAND.name,
      default_popup: "popup.html",
      default_icon: icons,
    },
    icons,
  };
}
