import { GOOGLE_DOMAINS } from "./google-domains";

/** The content script only has to run on the search results page, not on Maps, Drive, etc. */
export const SEARCH_PATH = "/search*";

export function createMatches(domains: readonly string[] = GOOGLE_DOMAINS): string[] {
  return domains.map((domain) => `*://www.${domain}${SEARCH_PATH}`);
}

export function createManifest(version: string) {
  return {
    manifest_version: 3,
    name: "SERP Counter + Notes - Free SERP Tool for SEO",
    version,
    description:
      "Adds a counter to organic Google results + save notes for any site (URL or entire domain)",
    permissions: ["storage"],
    content_scripts: [
      {
        matches: createMatches(),
        js: ["contentScript.js"],
        run_at: "document_idle",
      },
    ],
    action: { default_icon: { "128": "icons/icon128.png" } },
    icons: { "128": "icons/icon128.png" },
  };
}
