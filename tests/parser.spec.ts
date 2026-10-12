import { beforeEach, describe, expect, it } from "vitest";
import { findOrganicResults, type Rejection } from "../src/core/parser";
import { adBlock, mountSerp, organic, peopleAlsoAsk, productPack, serp, videoCarousel } from "./helpers/serp";

const PAGE = "https://www.google.com/search?q=test";
const find = (html: string) => findOrganicResults(mountSerp(html), PAGE);

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("findOrganicResults", () => {
  it("returns classic organic results in document order", () => {
    const results = find(serp(organic({ title: "A" }), organic({ title: "B" }), organic({ title: "C" })));
    expect(results.map((r) => r.title)).toEqual(["A", "B", "C"]);
  });

  it("extracts url, urlKey and host", () => {
    const [r] = find(serp(organic({ url: "https://www.Example.com/path?a=1#top" })));
    expect(r?.finalUrl).toBe("https://www.example.com/path?a=1#top");
    expect(r?.urlKey).toBe("https://www.example.com/path?a=1");
    expect(r?.host).toBe("example.com");
  });

  it("unwraps /url?q= redirect links", () => {
    const [r] = find(serp(organic({ url: "https://example.com/real", redirect: true })));
    expect(r?.finalUrl).toBe("https://example.com/real");
    expect(r?.host).toBe("example.com");
  });

  // Regression: signed-out / incognito Google wraps every link as /url?q=&url=<target>.
  // The parser used to treat all of them as Google's own pages and numbered nothing.
  it("numbers results whose links go through Google's signed-out redirect", () => {
    const results = find(
      serp(
        organic({ title: "A", url: "https://alpha.example/a", redirect: "url" }),
        organic({ title: "B", url: "https://beta.example/b", redirect: "url" }),
      ),
    );
    expect(results.map((r) => r.title)).toEqual(["A", "B"]);
    expect(results.map((r) => r.host)).toEqual(["alpha.example", "beta.example"]);
    expect(results[0]?.urlKey).toBe("https://alpha.example/a");
  });

  it("gives a redirected link the same note key as the direct one", () => {
    const direct = find(serp(organic({ url: "https://alpha.example/a?x=1" })))[0];
    const wrapped = find(serp(organic({ url: "https://alpha.example/a?x=1", redirect: "url" })))[0];
    expect(wrapped?.urlKey).toBe(direct?.urlKey);
  });

  it("uses the first link that leads somewhere real when an earlier one belongs to Google", () => {
    const html = `<div id="search"><div class="MjjYud"><div data-hveid="x1"><div class="yuRUbf">
      <a href="https://www.google.com/search?q=related"><span>menu</span></a>
      <h3>Real title</h3>
      <a href="/url?sa=t&q=&url=https%3A%2F%2Freal.example%2Fpage"><span>site</span></a>
    </div><div class="VwiC3b">snippet text</div></div></div></div>`;
    const [r] = find(html);
    expect(r?.title).toBe("Real title");
    expect(r?.host).toBe("real.example");
  });

  it("reports why every skipped title was skipped", () => {
    const reasons: Rejection[] = [];
    findOrganicResults(
      mountSerp(
        serp(
          organic({ title: "no snippet", snippet: null }),
          organic({ title: "to google", url: "https://www.google.com/maps/place/x" }),
          peopleAlsoAsk(),
          organic({ title: "fine" }),
        ),
      ),
      PAGE,
      (r) => reasons.push(r),
    );
    const byTitle = Object.fromEntries(reasons.map((r) => [r.title, r.reason]));
    expect(byTitle["no snippet"]).toMatch(/no snippet/);
    expect(byTitle["to google"]).toMatch(/Google/);
    expect(byTitle["Is a refurbished iPhone worth it?"] ?? byTitle["Why is the sky blue?"]).toMatch(/control|module/);
    expect(byTitle["fine"]).toBeUndefined();
    expect(reasons.find((r) => r.title === "to google")?.href).toContain("google.com/maps");
  });

  it("skips paid results, wherever the container is", () => {
    expect(find(serp(adBlock(), organic())).length).toBe(1);
    expect(find(`<div id="search">${adBlock()}${organic()}</div>`).length).toBe(1);
  });

  it("skips People-also-ask, video and product modules", () => {
    const html = serp(organic({ title: "keep" }), peopleAlsoAsk(), videoCarousel(), productPack());
    expect(find(html).map((r) => r.title)).toEqual(["keep"]);
  });

  it("skips results without a snippet (sitelink fragments, widgets)", () => {
    expect(find(serp(organic({ snippet: null }), organic({ title: "ok" }))).map((r) => r.title)).toEqual(["ok"]);
  });

  it("skips YouTube, Google's own pages and in-page links, but keeps Google News", () => {
    const html = serp(
      organic({ url: "https://www.youtube.com/watch?v=1" }),
      organic({ url: "https://youtu.be/abc" }),
      organic({ url: "https://www.google.com/maps/place/x" }),
      organic({ url: "https://news.google.com/articles/abc", title: "news" }),
      organic({ url: "https://example.com/", title: "site" }),
    );
    expect(find(html).map((r) => r.title)).toEqual(["news", "site"]);
  });

  it("counts a URL only once", () => {
    const html = serp(
      organic({ url: "https://example.com/a", title: "first" }),
      organic({ url: "https://example.com/a", title: "duplicate" }),
      organic({ url: "https://example.com/a#section", title: "same page, other hash" }),
      organic({ url: "https://example.com/b", title: "other" }),
    );
    expect(find(html).map((r) => r.title)).toEqual(["first", "other"]);
  });

  // Regression: pre-4.0 dropped results whose title/snippet merely contained one of these
  // English words, because modules were detected through visible text.
  it.each(["products", "related searches", "more sites", "people also ask", "shopping results"])(
    'keeps a result that mentions "%s" in its title or snippet',
    (phrase) => {
      const html = serp(organic({ title: `Best ${phrase} guide`, snippet: `Everything about ${phrase}.` }));
      expect(find(html)).toHaveLength(1);
    },
  );

  it("does not depend on the UI language", () => {
    const html = serp(organic({ title: "Лучшие товары — обзор", snippet: "Сравнение товаров." }), peopleAlsoAsk());
    expect(find(html)).toHaveLength(1);
  });

  it("falls back to any <h3> when Google renames the title container", () => {
    const html = `<div id="search"><div class="MjjYud"><div data-hveid="x1"><a href="https://example.com/"><h3>Renamed</h3></a><div class="VwiC3b">snippet</div></div></div></div>`;
    expect(find(html).map((r) => r.title)).toEqual(["Renamed"]);
  });

  it("returns nothing for an empty SERP", () => {
    expect(find(serp())).toEqual([]);
  });

  it("anchors controls to the result's data-hveid element", () => {
    const [r] = find(serp(organic()));
    expect(r?.element.hasAttribute("data-hveid")).toBe(true);
  });
});
