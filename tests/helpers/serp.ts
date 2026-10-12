/** Builders for Google-SERP-like markup used across the tests. */

export interface OrganicOpts {
  title?: string;
  url?: string;
  snippet?: string | null;
  /** Wrap the link the way Google sometimes does: /url?q=<target>, or /url?q=&url=<target> when signed out. */
  redirect?: boolean | "url";
}

let counter = 0;

export function organic({ title, url, snippet = "A useful description of the page.", redirect }: OrganicOpts = {}): string {
  const n = ++counter;
  const target = url ?? `https://site${n}.example/page`;
  const href =
    redirect === "url"
      ? `/url?sa=t&rct=j&q=&esrc=s&source=web&cd=&ved=2ah&url=${encodeURIComponent(target)}&usg=AOv`
      : redirect
        ? `/url?q=${encodeURIComponent(target)}&sa=U`
        : target;
  const snippetHtml = snippet === null ? "" : `<div class="VwiC3b"><span>${snippet}</span></div>`;
  return `<div class="MjjYud"><div data-hveid="h${n}"><div class="yuRUbf"><a href="${href}"><h3>${title ?? `Result ${n}`}</h3></a></div>${snippetHtml}</div></div>`;
}

/** "People also ask" block: question titles are <h3>-like controls inside accordions. */
export function peopleAlsoAsk(): string {
  const n = ++counter;
  return `<div class="MjjYud"><div data-hveid="p${n}" class="related-question-pair"><div class="yuRUbf"><div role="button" data-initq="why"><a href="#"><h3>Why is the sky blue?</h3></a></div></div><div class="VwiC3b">Because of scattering.</div></div></div>`;
}

export function videoCarousel(): string {
  const n = ++counter;
  return `<div class="MjjYud"><div class="nVcaUb"><div data-hveid="v${n}"><div class="yuRUbf"><a href="https://video.example/watch"><h3>A video</h3></a></div><div class="VwiC3b">Video description</div></div></div></div>`;
}

export function productPack(): string {
  const n = ++counter;
  return `<div class="MjjYud"><div data-attrid="kc:/shopping:products" data-hveid="s${n}"><div class="yuRUbf"><a href="https://shop.example/item"><h3>Some product</h3></a></div><div class="VwiC3b">$19.99</div></div></div>`;
}

export function adBlock(): string {
  const n = ++counter;
  return `<div id="tads"><div class="MjjYud"><div data-hveid="a${n}"><div class="yuRUbf"><a href="https://ads.example/"><h3>Sponsored</h3></a></div><div class="VwiC3b">Buy now</div></div></div></div>`;
}

export function serp(...blocks: string[]): string {
  return `<div id="search"><div id="rso">${blocks.join("")}</div></div>`;
}

export function mountSerp(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.getElementById("search") as HTMLElement;
}
