import { describe, it, expect } from "vitest";
import { FILE_TOKEN_TTL_MS, signFileToken, verifyFileToken } from "./file-token";

const FILE = "11111111-1111-1111-1111-111111111111";
const OWNER = "22222222-2222-2222-2222-222222222222";
const SECRET = "s3cret";

describe("the seller's file ticket", () => {
  it("round-trips the file and its owner", async () => {
    const token = await signFileToken(FILE, OWNER, SECRET, 1000);
    expect(await verifyFileToken(token, SECRET, 2000)).toEqual({ fileId: FILE, ownerId: OWNER });
  });

  it("is refused by another secret", async () => {
    const token = await signFileToken(FILE, OWNER, SECRET, 1000);
    expect(await verifyFileToken(token, "other", 2000)).toBeNull();
  });

  it("expires", async () => {
    const token = await signFileToken(FILE, OWNER, SECRET, 1000);
    expect(await verifyFileToken(token, SECRET, 1000 + FILE_TOKEN_TTL_MS + 1)).toBeNull();
    expect(await verifyFileToken(token, SECRET, 1000 + FILE_TOKEN_TTL_MS)).not.toBeNull();
  });

  it("refuses a tampered payload", async () => {
    const token = await signFileToken(FILE, OWNER, SECRET, 1000);
    const [, signature] = token.split(".");
    const forged = btoa(JSON.stringify({ f: "33333333-3333-3333-3333-333333333333", o: OWNER, x: 9e12 }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(await verifyFileToken(`${forged}.${signature}`, SECRET, 2000)).toBeNull();
  });

  it("refuses junk", async () => {
    for (const bad of ["", "garbage", "a.b.c", "nodot"]) {
      expect(await verifyFileToken(bad, SECRET, 2000)).toBeNull();
    }
  });
});
