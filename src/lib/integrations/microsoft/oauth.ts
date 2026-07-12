import { createHash, randomBytes } from "crypto";
import {
  ConfidentialClientApplication,
  CryptoProvider,
  type AuthenticationResult,
  type Configuration,
} from "@azure/msal-node";
import { cookies } from "next/headers";
import { AuthenticationError, ValidationError } from "@/lib/errors/app-error";
import {
  MICROSOFT_DELEGATED_SCOPES,
  MICROSOFT_OAUTH_TX_COOKIE,
  MICROSOFT_OAUTH_TX_MAX_AGE_SECONDS,
} from "@/lib/integrations/microsoft/config";
import {
  oauthTransactionSchema,
  type OAuthTransaction,
} from "@/lib/integrations/microsoft/schemas";
import { encryptCredential, decryptCredential } from "@/lib/security/credential-encryption";
import { getMicrosoftConfig } from "@/lib/security/env";

const cryptoProvider = new CryptoProvider();

function buildMsalConfig(): Configuration {
  const config = getMicrosoftConfig();
  return {
    auth: {
      clientId: config.clientId,
      authority: config.authority,
      clientSecret: config.clientSecret,
    },
  };
}

export function createMsalClient(cacheJson?: string): ConfidentialClientApplication {
  const msalConfig = buildMsalConfig();
  const client = new ConfidentialClientApplication(msalConfig);

  if (cacheJson) {
    client.getTokenCache().deserialize(cacheJson);
  }

  return client;
}

export async function generatePkcePair(): Promise<{
  verifier: string;
  challenge: string;
}> {
  return cryptoProvider.generatePkceCodes();
}

export function generateOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function generateOAuthNonce(): string {
  return randomBytes(32).toString("base64url");
}

function serializeTransaction(transaction: OAuthTransaction): string {
  return encryptCredential(JSON.stringify(transaction));
}

function parseTransaction(encoded: string): OAuthTransaction {
  const json = decryptCredential(encoded);
  return oauthTransactionSchema.parse(JSON.parse(json));
}

export async function storeOAuthTransaction(
  transaction: Omit<OAuthTransaction, "expiresAt" | "consumed">,
): Promise<void> {
  const payload: OAuthTransaction = {
    ...transaction,
    expiresAt: Date.now() + MICROSOFT_OAUTH_TX_MAX_AGE_SECONDS * 1000,
    consumed: false,
  };

  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set(MICROSOFT_OAUTH_TX_COOKIE, serializeTransaction(payload), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: MICROSOFT_OAUTH_TX_MAX_AGE_SECONDS,
  });
}

export async function loadOAuthTransaction(): Promise<OAuthTransaction | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(MICROSOFT_OAUTH_TX_COOKIE)?.value;
  if (!value) {
    return null;
  }

  try {
    return parseTransaction(value);
  } catch {
    return null;
  }
}

export async function clearOAuthTransaction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(MICROSOFT_OAUTH_TX_COOKIE);
}

export async function markOAuthTransactionConsumed(): Promise<void> {
  const transaction = await loadOAuthTransaction();
  if (!transaction) {
    return;
  }

  await storeOAuthTransaction({
    state: transaction.state,
    nonce: transaction.nonce,
    codeVerifier: transaction.codeVerifier,
  });

  const cookieStore = await cookies();
  const consumed: OAuthTransaction = { ...transaction, consumed: true };
  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set(MICROSOFT_OAUTH_TX_COOKIE, serializeTransaction(consumed), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60,
  });
}

export function validateOAuthTransaction(
  transaction: OAuthTransaction | null,
  state: string | null,
): OAuthTransaction {
  if (!transaction) {
    throw new AuthenticationError("Microsoft sign-in session expired. Please try again.");
  }

  if (transaction.consumed) {
    throw new AuthenticationError("Microsoft sign-in request was already processed.");
  }

  if (Date.now() > transaction.expiresAt) {
    throw new AuthenticationError("Microsoft sign-in session expired. Please try again.");
  }

  if (!state || state !== transaction.state) {
    throw new AuthenticationError("Invalid Microsoft sign-in state.");
  }

  if (!transaction.codeVerifier) {
    throw new ValidationError("Microsoft sign-in is missing PKCE verification.");
  }

  return transaction;
}

export async function buildMicrosoftAuthUrl(input: {
  state: string;
  nonce: string;
  codeChallenge: string;
}): Promise<string> {
  const config = getMicrosoftConfig();
  const client = createMsalClient();

  return client.getAuthCodeUrl({
    scopes: [...MICROSOFT_DELEGATED_SCOPES],
    redirectUri: config.redirectUri,
    state: input.state,
    nonce: input.nonce,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: "S256",
    prompt: "select_account",
  });
}

export function validateIdTokenNonce(
  authResult: AuthenticationResult,
  expectedNonce: string,
): void {
  const idTokenClaims = authResult.idTokenClaims as Record<string, unknown> | undefined;
  const nonce = idTokenClaims?.nonce;
  if (typeof nonce !== "string" || nonce !== expectedNonce) {
    throw new AuthenticationError("Microsoft sign-in nonce validation failed.");
  }
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  nonce: string;
}): Promise<{
  authResult: AuthenticationResult;
  serializedCache: string;
  tenantId: string | null;
  homeAccountId: string;
  displayLabel: string;
  username: string | null;
}> {
  const config = getMicrosoftConfig();
  const client = createMsalClient();

  let authResult: AuthenticationResult;
  try {
    authResult = await client.acquireTokenByCode({
      code: input.code,
      scopes: [...MICROSOFT_DELEGATED_SCOPES],
      redirectUri: config.redirectUri,
      codeVerifier: input.codeVerifier,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("consent") ||
      message.includes("interaction_required") ||
      message.includes("admin_consent")
    ) {
      throw new ValidationError(
        "Your organization has not granted consent for LifeOS to read your calendar. Contact your IT administrator or use a personal Microsoft account.",
      );
    }
    throw new AuthenticationError("Microsoft sign-in failed. Please try again.");
  }

  validateIdTokenNonce(authResult, input.nonce);

  const account = authResult.account;
  if (!account?.homeAccountId) {
    throw new AuthenticationError("Microsoft account information is missing.");
  }

  const serializedCache = client.getTokenCache().serialize();
  const displayLabel =
    account.name?.trim() ||
    account.username?.trim() ||
    "Microsoft 365 account";

  return {
    authResult,
    serializedCache,
    tenantId: account.tenantId ?? null,
    homeAccountId: account.homeAccountId,
    displayLabel,
    username: account.username ?? null,
  };
}

export function hashAuthorizationCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
