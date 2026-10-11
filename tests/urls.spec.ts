import { describe, expect, it } from "vitest";
import {
  extractFinalUrl,
  hostFromUrl,
  isGoogleHost,
  isYouTubeHost,
  normalizeHost,
  normalizeUrlKey,
} from "../src/core/urls";

describe("normalizeUrlKey", () => {
  it("keeps origin, path and query but drops the hash", () => {
    expect(normalizeUrlKey("https://Example.com/a/b?x=1#frag")).toBe("https://example.com/a/b?x=1");
  });

  it("returns null for invalid input", () => {
    expect(normalizeUrlKey("not a url")).toBeNull();
  });
});

describe("normalizeHost / hostFromUrl", () => {
  it("lower-cases and strips www.", () => {
    expect(normalizeHost("WWW.Example.COM")).toBe("example.com");
    expect(normalizeHost("blog.example.com")).toBe("blog.example.com");
  });

  it("handles empty values", () => {
    expect(normalizeHost("")).toBeNull();
    expect(normalizeHost(null)).toBeNull();
    expect(normalizeHost("   ")).toBeNull();
  });

  it("extracts hosts from URLs", () => {
    expect(hostFromUrl("https://www.example.com/x")).toBe("example.com");
    expect(hostFromUrl("nope")).toBeNull();
  });
});

describe("host classification", () => {
  it.each(["google.com", "www.google.com", "google.co.uk", "google.com.au", "news.google.com"])(
    "%s is a Google host",
    (host) => expect(isGoogleHost(host)).toBe(true),
  );

  it.each(["example.com", "notgoogle.com", "google.example.com", null])("%s is not", (host) =>
    expect(isGoogleHost(host)).toBe(false),
  );

  it("recognises YouTube hosts but not look-alikes", () => {
    expect(isYouTubeHost("youtube.com")).toBe(true);
    expect(isYouTubeHost("m.youtube.com")).toBe(true);
    expect(isYouTubeHost("youtu.be")).toBe(true);
    expect(isYouTubeHost("notyoutube.com")).toBe(false);
    expect(isYouTubeHost("example.com")).toBe(false);
  });
});

describe("extractFinalUrl", () => {
  const base = "https://www.google.com/search?q=x";

  it("returns absolute links as is", () => {
    expect(extractFinalUrl("https://example.com/a", base)).toBe("https://example.com/a");
  });

  it("unwraps Google redirect links", () => {
    expect(extractFinalUrl("/url?q=https%3A%2F%2Fexample.com%2Fa&sa=U", base)).toBe("https://example.com/a");
    expect(extractFinalUrl("https://www.google.com/url?url=https%3A%2F%2Fexample.com%2F", base)).toBe(
      "https://example.com/",
    );
  });

  it("does not unwrap /url on non-Google hosts", () => {
    expect(extractFinalUrl("https://example.com/url?q=https://evil.test", base)).toBe(
      "https://example.com/url?q=https://evil.test",
    );
  });

  it("unwraps /url on the page's own origin even when it is not a Google domain", () => {
    expect(extractFinalUrl("/url?q=https%3A%2F%2Fexample.com%2Fa", "http://127.0.0.1:8765/search?q=x")).toBe(
      "https://example.com/a",
    );
  });

  it("rejects non-http(s) and empty links", () => {
    expect(extractFinalUrl("javascript:void(0)", base)).toBeNull();
    expect(extractFinalUrl("mailto:a@b.c", base)).toBeNull();
    expect(extractFinalUrl("", base)).toBeNull();
  });
});
