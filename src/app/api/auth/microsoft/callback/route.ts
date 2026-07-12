import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { saveMicrosoftConnection } from "@/lib/data/microsoft-connections";
import { errorResponse } from "@/lib/errors/error-response";
import { ValidationError } from "@/lib/errors/app-error";
import {
  assertMicrosoftIntegrationEnabled,
  MicrosoftIntegrationDisabledError,
} from "@/lib/integrations/microsoft/feature-flag";
import {
  clearOAuthTransaction,
  exchangeAuthorizationCode,
  hashAuthorizationCode,
  loadOAuthTransaction,
  markOAuthTransactionConsumed,
  validateOAuthTransaction,
} from "@/lib/integrations/microsoft/oauth";
import { createSessionSyncContext } from "@/lib/integrations/microsoft/sync-context";
import { getMicrosoftConnectionForUser } from "@/lib/integrations/microsoft/sync-data";
import { listGraphCalendars } from "@/lib/integrations/microsoft/graph-client";
import { upsertDiscoveredMicrosoftCalendars } from "@/lib/integrations/microsoft/calendars";
import {
  createTokenCacheSession,
  acquireGraphAccessToken,
  persistTokenCacheIfChanged,
} from "@/lib/integrations/microsoft/token-cache";
import { getPublicEnv } from "@/lib/security/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const usedAuthorizationCodes = new Set<string>();

function rememberAuthorizationCode(code: string): boolean {
  const hash = hashAuthorizationCode(code);
  if (usedAuthorizationCodes.has(hash)) {
    return false;
  }

  usedAuthorizationCodes.add(hash);
  if (usedAuthorizationCodes.size > 500) {
    const first = usedAuthorizationCodes.values().next().value;
    if (first) {
      usedAuthorizationCodes.delete(first);
    }
  }

  return true;
}

export async function GET(request: Request) {
  try {
    assertMicrosoftIntegrationEnabled();
    await requireAllowedUser();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error");
    const oauthErrorDescription = searchParams.get("error_description");

    const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
    const successRedirect = `${appUrl}/imports?microsoft=connected`;
    const errorRedirect = `${appUrl}/imports?microsoft=error`;

    if (oauthError) {
      await clearOAuthTransaction();
      const description = oauthErrorDescription?.toLowerCase() ?? "";
      if (
        oauthError === "access_denied" ||
        description.includes("consent") ||
        description.includes("admin")
      ) {
        return NextResponse.redirect(
          `${errorRedirect}&reason=consent`,
        );
      }
      return NextResponse.redirect(`${errorRedirect}&reason=denied`);
    }

    if (!code) {
      throw new ValidationError("Microsoft authorization code is missing.");
    }

    if (!rememberAuthorizationCode(code)) {
      return NextResponse.redirect(`${errorRedirect}&reason=replay`);
    }

    const transaction = validateOAuthTransaction(await loadOAuthTransaction(), state);

    const exchanged = await exchangeAuthorizationCode({
      code,
      codeVerifier: transaction.codeVerifier,
      nonce: transaction.nonce,
    });

    await saveMicrosoftConnection({
      serializedCache: exchanged.serializedCache,
      displayLabel: exchanged.displayLabel,
      tenantId: exchanged.tenantId,
      homeAccountId: exchanged.homeAccountId,
    });

    await markOAuthTransactionConsumed();
    await clearOAuthTransaction();

    try {
      const ctx = await createSessionSyncContext();
      const connection = await getMicrosoftConnectionForUser(ctx);
      if (connection) {
        const session = createTokenCacheSession(connection);
        const { accessToken } = await acquireGraphAccessToken(session);
        await persistTokenCacheIfChanged(ctx, connection, session);
        const graphCalendars = await listGraphCalendars(accessToken);
        await upsertDiscoveredMicrosoftCalendars(ctx, {
          connectionId: connection.id,
          calendars: graphCalendars,
        });
      }
    } catch {
      // Calendar discovery can be retried from Import Center.
    }

    return NextResponse.redirect(successRedirect);
  } catch (error) {
    if (error instanceof MicrosoftIntegrationDisabledError) {
      return errorResponse(error);
    }

    await clearOAuthTransaction();
    const response = errorResponse(error);
    if (response.status >= 400) {
      const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
      return NextResponse.redirect(`${appUrl}/imports?microsoft=error`);
    }
    return response;
  }
}
