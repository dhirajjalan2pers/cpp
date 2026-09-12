import { beforeEach, describe, expect, it } from "vitest";
import { decrypt, encrypt, sha256 } from "./crypto";

describe("encrypted storage", () => {
  beforeEach(() => { process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64"); });
  it("round trips without exposing plaintext", () => {
    const encrypted = encrypt("private payload");
    expect(encrypted.toString("utf8")).not.toContain("private payload");
    expect(decrypt(encrypted).toString("utf8")).toBe("private payload");
  });
  it("rejects authenticated-ciphertext tampering", () => {
    const encrypted = encrypt("private payload"); encrypted[encrypted.length - 1] ^= 1;
    expect(() => decrypt(encrypted)).toThrow();
  });
  it("creates stable hashes", () => expect(sha256("same")).toBe(sha256("same")));
});

