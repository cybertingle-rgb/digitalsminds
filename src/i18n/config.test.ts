import { describe, expect, it } from "vitest";
import { localizePath, publicPathname, resolveLocaleRoute, splitLocale } from "./config";

describe("localizePath", () => {
  it("keeps English unprefixed and prefixes Urdu", () => {
    expect(localizePath("/about", "en")).toBe("/about");
    expect(localizePath("/", "en")).toBe("/");
    expect(localizePath("/about", "ur")).toBe("/ur/about");
    expect(localizePath("/", "ur")).toBe("/ur");
  });
});

describe("splitLocale", () => {
  it("detects the locale prefix", () => {
    expect(splitLocale("/ur/services/web-ecommerce")).toEqual({ locale: "ur", path: "/services/web-ecommerce" });
    expect(splitLocale("/ur")).toEqual({ locale: "ur", path: "/" });
    expect(splitLocale("/blog")).toEqual({ locale: "en", path: "/blog" });
    expect(splitLocale("/en/blog")).toEqual({ locale: "en", path: "/blog" });
    expect(splitLocale("/en")).toEqual({ locale: "en", path: "/" });
  });
});

describe("publicPathname", () => {
  it("gives the same URL for the server (internal /en) and browser forms", () => {
    expect(publicPathname("/en/services")).toBe("/services");
    expect(publicPathname("/en")).toBe("/");
    expect(publicPathname("/services")).toBe("/services");
    expect(publicPathname("/ur/services")).toBe("/ur/services");
  });
});

describe("resolveLocaleRoute", () => {
  it("rewrites unprefixed paths to English", () => {
    expect(resolveLocaleRoute("/")).toEqual({ action: "rewrite", pathname: "/en" });
    expect(resolveLocaleRoute("/about")).toEqual({ action: "rewrite", pathname: "/en/about" });
  });
  it("redirects explicit /en URLs to the canonical unprefixed URL", () => {
    expect(resolveLocaleRoute("/en")).toEqual({ action: "redirect", pathname: "/" });
    expect(resolveLocaleRoute("/en/contact")).toEqual({ action: "redirect", pathname: "/contact" });
  });
  it("serves Urdu paths as they are", () => {
    expect(resolveLocaleRoute("/ur/about")).toEqual({ action: "next" });
    expect(resolveLocaleRoute("/ur")).toEqual({ action: "next" });
  });
  it("does not treat lookalike segments as locales", () => {
    expect(resolveLocaleRoute("/urdu-guide")).toEqual({ action: "rewrite", pathname: "/en/urdu-guide" });
    expect(resolveLocaleRoute("/english")).toEqual({ action: "rewrite", pathname: "/en/english" });
  });
});
