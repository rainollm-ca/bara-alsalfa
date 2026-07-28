import { describe, expect, it } from "vitest";

import { buildInviteUrl, readInviteCode } from "../src/lib/invite";

describe("invite routing", () => {
  it("accepts a valid root invite URL and rejects malformed values", () => {
    expect(readInviteCode("?room=abc123")).toBe("ABC123");
    expect(readInviteCode("?room=bad")).toBeNull();
    expect(readInviteCode("")).toBeNull();
  });

  it("builds canonical Lamma room links without leaking the current host", () => {
    expect(buildInviteUrl("ABC123")).toBe("https://lamma.rainomotion.com/?room=ABC123");
  });
});
