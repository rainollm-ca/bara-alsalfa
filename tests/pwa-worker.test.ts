import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("service worker safety policy", () => {
  const worker = readFileSync("public/sw.js", "utf8");

  it("versions and cleans its app-shell cache", () => {
    expect(worker).toContain("lamma-shell-v");
    expect(worker).toContain('key.startsWith("bara-")');
    expect(worker).toContain("caches.delete");
    expect(worker).toContain('cache.addAll(APP_SHELL)');
    expect(worker).not.toContain("caches.match(");
  });

  it("never caches API, room, or token-bearing invite requests", () => {
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain('url.searchParams.has("room")');
    expect(worker).toContain('url.searchParams.has("invite")');
    expect(worker).toContain('request.credentials === "include"');
    expect(worker).toContain('request.headers.has("authorization")');
    expect(worker).toContain('request.headers.has("cookie")');
  });

  it("uses network-first navigation with a cached root fallback", () => {
    expect(worker).toContain('request.mode === "navigate"');
    expect(worker).toContain('cache.match("/")');
    expect(worker).toMatch(/url\.pathname\s*!==\s*"\/"\s*\|\|\s*url\.search/);
    expect(worker).toContain('url.pathname.startsWith("/_next/static/")');
  });
});
