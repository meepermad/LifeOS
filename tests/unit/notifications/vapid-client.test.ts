import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  VapidKeyError,
  decodeVapidPublicKey,
  isValidVapidPublicKey,
  urlBase64ToUint8Array,
} from "@/lib/notifications/vapid-client";

function toUrlBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

describe("vapid public key decoding", () => {
  it("decodes a valid Base64URL key with restored padding", () => {
    const bytes = new Uint8Array(65).fill(1);
    bytes[0] = 4;
    const encoded = toUrlBase64(bytes);

    const decoded = urlBase64ToUint8Array(encoded);

    expect(decoded).toEqual(bytes);
    expect(isValidVapidPublicKey(encoded)).toBe(true);
  });

  it("rejects an empty key", () => {
    expect(() => decodeVapidPublicKey("")).toThrow(VapidKeyError);
    expect(isValidVapidPublicKey("")).toBe(false);
  });

  it("rejects a malformed key", () => {
    expect(() => decodeVapidPublicKey("not!!!valid")).toThrow(VapidKeyError);
    expect(isValidVapidPublicKey("not!!!valid")).toBe(false);
  });

  it("rejects a key that is too short after decoding", () => {
    const shortKey = toUrlBase64(new Uint8Array([1, 2, 3]));
    expect(() => decodeVapidPublicKey(shortKey)).toThrow(VapidKeyError);
  });

  it("accepts keys with - and _ substitutions", () => {
    const bytes = new Uint8Array(65);
    bytes.fill(255);
    bytes[0] = 4;
    const encoded = toUrlBase64(bytes);
    expect(encoded).toMatch(/[-_]/);
    expect(decodeVapidPublicKey(encoded).length).toBe(65);
  });

  it("migration uses security definer for push subscription RPCs", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260712130000_fix_push_subscription_rpc_security.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("security definer");
    expect(sql).toContain("is_push_endpoint_registered");
    expect(sql).not.toContain("security invoker");
  });
});
