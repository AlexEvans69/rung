/** Google-like SERP pages for layout tests. Deliberately includes the awkward cases. */

export interface ResultSpec {
  host: string;
  title: string;
  snippet?: string;
  thumbnail?: boolean;
  rating?: boolean;
  sitelinks?: boolean;
}

export interface PageOpts {
  results?: ResultSpec[];
  dark?: boolean;
  /** Knowledge panel in the right-hand column. */
  knowledgePanel?: boolean;
  /** Mark result containers `position: relative` (Google's markup varies). */
  positionedResults?: boolean;
  /** Clip anything outside the main column. */
  clipColumn?: boolean;
  /** `?start=` offset. */
  paa?: boolean;
}

export const DEFAULT_RESULTS: ResultSpec[] = [
  { host: "reboxed.co", title: "Buy Refurbished iPhones | Best Deals Up to 40% Off", thumbnail: true, rating: true },
  { host: "comparethemarket.com", title: "Compare Our BEST iPhone Deals 2026", snippet: "latest iPhone 18 Pro range and iPhone Duo start at £1,199 to buy outright. The iPhone 16 is the cheapest model that Apple makes at the moment, starting at £799." },
  { host: "backmarket.co.uk", title: "Cheap Refurbished iPhones - Deals up to 50% off - Free delivery and 12 month warranty on every device we sell", thumbnail: true, rating: true },
  { host: "apple.com", title: "Buying iPhone", thumbnail: true },
  { host: "o2.co.uk", title: "iPhone deals", sitelinks: true },
];

const SNIPPET = "Purchase your next iPhone from the Apple Store. Get answers about network providers, offers, payments, trade-in, setup and more.";

function result(r: ResultSpec, i: number, positioned: boolean): string {
  const slug = r.host.replace(/[^a-z0-9]/g, "");
  return `
<div class="MjjYud"><div data-hveid="h${i}" class="res" style="${positioned ? "position:relative;" : ""}${r.thumbnail ? "" : "width:560px;"}">
  <div class="meta"><span class="fav"></span><div><div class="site">${r.host}</div><div class="crumb">https://${r.host} › home</div></div><span class="dots">⋮</span></div>
  <div class="body">
    <div class="text">
      <div class="yuRUbf"><a href="https://${r.host}/p${i}"><h3>${r.title}</h3></a></div>
      <div class="VwiC3b">${r.snippet ?? SNIPPET}</div>
      ${r.rating ? '<div class="rate">4.3 ★ store rating (1.9k) · Free delivery · 30-day returns</div>' : ""}
      ${r.sitelinks ? '<div class="links"><a href="https://' + r.host + '/a">Sim only</a><a href="https://' + r.host + '/b">Pay monthly</a><a href="https://' + r.host + '/c">Trade-in</a></div>' : ""}
    </div>
    ${r.thumbnail ? `<div class="thumb" aria-label="${slug}"></div>` : ""}
  </div>
</div></div>`;
}

export function serpPage(opts: PageOpts = {}): string {
  const dark = opts.dark ?? false;
  const results = opts.results ?? DEFAULT_RESULTS;
  const html = results.map((r, i) => result(r, i, !!opts.positionedResults)).join("");
  const paa = opts.paa
    ? `<div class="MjjYud"><div data-hveid="paa" class="related-question-pair"><div class="yuRUbf"><div role="button" data-initq="q"><a href="#"><h3>Is a refurbished iPhone worth it?</h3></a></div></div><div class="VwiC3b">Usually yes.</div></div></div>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>q - Google Search</title><style>
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:arial,sans-serif;background:${dark ? "#202124" : "#fff"};color:${dark ? "#bdc1c6" : "#4d5156"}}
header{position:sticky;top:0;height:64px;background:${dark ? "#303134" : "#fff"};border-bottom:1px solid #8884;z-index:50;padding:16px 160px}
#center_col{margin-left:160px;width:652px;padding-top:12px;${opts.clipColumn ? "overflow:hidden;" : ""}}
#rhs{position:absolute;top:84px;left:900px;width:340px;height:300px;background:${dark ? "#303134" : "#f1f3f4"};border-radius:12px}
.MjjYud{margin-bottom:28px}
.res{display:block}
.meta{display:flex;align-items:center;gap:12px;height:28px;margin-bottom:6px}
.fav{width:26px;height:26px;border-radius:50%;background:#e8eaed}
.site{font-size:14px;color:${dark ? "#dadce0" : "#202124"}}.crumb{font-size:12px}
.dots{margin-left:8px}
.body{display:flex;gap:16px;justify-content:space-between}
.text{min-width:0}
h3{margin:0;font-size:20px;line-height:26px;font-weight:400;color:${dark ? "#8ab4f8" : "#1a0dab"}}
.VwiC3b{font-size:14px;line-height:22px;margin-top:3px}
.rate{margin-top:10px;font-size:14px}
.links{display:flex;gap:16px;margin-top:10px}
.thumb{flex:none;width:92px;height:92px;border-radius:8px;background:#9aa0a6;margin-top:4px}
</style>
<script>
(function(){
  var mem={};var cp=function(o){return JSON.parse(JSON.stringify(o))};
  window.chrome={runtime:{id:'e2e'},storage:{local:{
    get:async function(){return cp(mem)},
    set:async function(o){Object.assign(mem,cp(o))},
    remove:async function(k){(Array.isArray(k)?k:[k]).forEach(function(x){delete mem[x]})}},
    onChanged:{addListener:function(){},removeListener:function(){}}}};
  window.__mem=mem;
})();
</script></head><body>
<header>Search bar</header>
<div id="center_col"><div id="search"><div id="rso">${paa}${html}</div></div></div>
${opts.knowledgePanel ? '<div id="rhs">Knowledge panel</div>' : ""}
</body></html>`;
}
