import {
  InteractionRequiredAuthError,
  type AuthenticationResult,
  type ConfidentialClientApplication,
} from "@azure/msal-node";
import { DatabaseError, ValidationError } from "@/lib/errors/app-error";
import { createMsalClient } from "@/lib/integrations/microsoft/oauth";
import { MICROSOFT_DELEGATED_SCOPES } from "@/lib/integrations/microsoft/config";
import type { MicrosoftSyncContext } from "@/lib/integrations/microsoft/sync-context";
import { encryptCredential, decryptCredential } from "@/lib/security/credential-encryption";
import type { ConnectionRow } from "@/types/domain";

export type TokenCacheSession = {
  client: ConfidentialClientApplication;
  accountHomeId: string;
  credentialsVersion: number;
};

export function deserializeTokenCache(encrypted: string): string {
  return decryptCredential(encrypted);
}

export function serializeTokenCache(cacheJson: string): string {
  return encryptCredential(cacheJson);
}

export function createTokenCacheSession(
  connection: ConnectionRow,
): TokenCacheSession {
  if (!connection.encrypted_credentials) {
    throw new DatabaseError("Microsoft credentials are missing");
  }

  const cacheJson = deserializeTokenCache(connection.encrypted_credentials);
  const client = createMsalClient(cacheJson);

  if (!connection.external_home_account_id) {
    throw new DatabaseError("Microsoft account reference is missing");
  }

  return {
    client,
    accountHomeId: connection.external_home_account_id,
    credentialsVersion: connection.credentials_version ?? 0,
  };
}

export async function acquireGraphAccessToken(
  session: TokenCacheSession,
): Promise<{ accessToken: string; authResult: AuthenticationResult }> {
  const accounts = await session.client.getTokenCache().getAllAccounts();
  const account = accounts.find(
    (entry) => entry.homeAccountId === session.accountHomeId,
  );

  if (!account) {
    throw new ValidationError("Microsoft account not found in token cache");
  }

  try {
    const authResult = await session.client.acquireTokenSilent({
      account,
      scopes: [...MICROSOFT_DELEGATED_SCOPES],
    });

    if (!authResult?.accessToken) {
      throw new ValidationError("Microsoft access token unavailable");
    }

    return { accessToken: authResult.accessToken, authResult };
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      throw error;
    }
    throw error;
  }
}

export async function persistTokenCacheIfChanged(
  ctx: MicrosoftSyncContext,
  connection: ConnectionRow,
  session: TokenCacheSession,
): Promise<ConnectionRow> {
  const serialized = session.client.getTokenCache().serialize();
  const encrypted = serializeTokenCache(serialized);
  const expectedVersion = session.credentialsVersion;

  const { data, error } = await ctx.client
    .from("connections")
    .update({
      encrypted_credentials: encrypted,
      credentials_version: expectedVersion + 1,
      requires_reauthentication: false,
    })
    .eq("id", connection.id)
    .eq("user_id", ctx.userId)
    .eq("credentials_version", expectedVersion)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to persist Microsoft token cache");
  }

  if (data) {
    return data;
  }

  const { data: latest, error: latestError } = await ctx.client
    .from("connections")
    .select("*")
    .eq("id", connection.id)
    .eq("user_id", ctx.userId)
    .single();

  if (latestError || !latest) {
    throw new DatabaseError("Failed to reload Microsoft connection after token cache conflict");
  }

  return latest;
}

export async function markMicrosoftReauthenticationRequired(
  ctx: MicrosoftSyncContext,
  connectionId: string,
  message: string,
): Promise<void> {
  const { error } = await ctx.client
    .from("connections")
    .update({
      requires_reauthentication: true,
      status: "error",
      last_error: message,
    })
    .eq("id", connectionId)
    .eq("user_id", ctx.userId);

  if (error) {
    throw new DatabaseError("Failed to mark Microsoft connection for reauthentication");
  }
}

export function isInteractionRequiredError(error: unknown): boolean {
  return error instanceof InteractionRequiredAuthError;
}
