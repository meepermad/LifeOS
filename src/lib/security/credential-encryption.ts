import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { ConfigurationError } from "@/lib/errors/app-error";
import { getTokenEncryptionKeyBytes } from "@/lib/security/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const CURRENT_VERSION = 1;

type EncryptedPayload = {
  v: number;
  iv: string;
  tag: string;
  data: string;
};

export function encryptCredential(plaintext: string): string {
  const key = getTokenEncryptionKeyBytes();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    v: CURRENT_VERSION,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

export function decryptCredential(encoded: string): string {
  const key = getTokenEncryptionKeyBytes();
  let payload: EncryptedPayload;

  try {
    const json = Buffer.from(encoded, "base64").toString("utf8");
    payload = JSON.parse(json) as EncryptedPayload;
  } catch {
    throw new ConfigurationError("Stored credential is not valid encrypted data");
  }

  if (payload.v !== CURRENT_VERSION) {
    throw new ConfigurationError("Unsupported credential encryption version");
  }

  if (!payload.iv || !payload.tag || !payload.data) {
    throw new ConfigurationError("Stored credential is missing encryption fields");
  }

  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const data = Buffer.from(payload.data, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new ConfigurationError("Stored credential has an invalid IV");
  }

  if (tag.length !== AUTH_TAG_LENGTH) {
    throw new ConfigurationError("Stored credential has an invalid auth tag");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    throw new ConfigurationError("Failed to decrypt stored credential");
  }
}
