import { describe, expect, it } from "vitest";
import { computeBase, getPageContext } from "../src/core/numbering";

describe("getPageContext", () => {
  it("defaults to page 0 with 10 results per page", () => {
    expect(getPageContext("?q=cats")).toMatchObject({ start: 0, pageSize: 10 });
  });

  it("reads start and num", () => {
    expect(getPageContext("?q=cats&start=20&num=50")).toMatchObject({ start: 20, pageSize: 50 });
  });

  it("falls back for garbage and caps num", () => {
    expect(getPageContext("?start=abc&num=-3")).toMatchObject({ start: 0, pageSize: 10 });
    expect(getPageContext("?num=0")).toMatchObject({ pageSize: 10 });
    expect(getPageContext("?num=5000").pageSize).toBe(100);
  });

  it("gives pages of one search the same signature, and other searches different ones", () => {
    const page1 = getPageContext("?q=cats&start=0").signature;
    const page2 = getPageContext("?q=cats&start=10&ei=abc&sxsrf=zzz").signature;
    expect(page1).toBe(page2);
    expect(getPageContext("?q=dogs").signature).not.toBe(page1);
    expect(getPageContext("?q=cats&gl=de").signature).not.toBe(page1);
    expect(getPageContext("?q=cats&num=50").signature).not.toBe(page1);
  });
});

describe("computeBase", () => {
  it("is 1 on the first page", () => {
    expect(computeBase(0, 10, {})).toBe(1);
  });

  it("sums the real organic counts of previous pages", () => {
    expect(computeBase(20, 10, { 0: 9, 10: 8 })).toBe(18);
  });

  it("assumes a full page for pages that were never visited", () => {
    expect(computeBase(30, 10, { 10: 8 })).toBe(1 + 10 + 8 + 10);
  });

  it("works with a custom page size", () => {
    expect(computeBase(100, 50, { 0: 47 })).toBe(1 + 47 + 50);
    expect(computeBase(100, 100, {})).toBe(101);
  });

  it("ignores the current and later pages", () => {
    expect(computeBase(10, 10, { 0: 9, 10: 7, 20: 6 })).toBe(10);
  });
});
