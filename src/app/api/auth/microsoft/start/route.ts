import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { errorResponse } from "@/lib/errors/error-response";
import { assertMicrosoftIntegrationEnabled } from "@/lib/integrations/microsoft/feature-flag";
import {
  buildMicrosoftAuthUrl,
  generateOAuthNonce,
  generateOAuthState,
  generatePkcePair,
  storeOAuthTransaction,
} from "@/lib/integrations/microsoft/oauth";
import { getMicrosoftConfig } from "@/lib/security/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertMicrosoftIntegrationEnabled();
    await requireAllowedUser();
    getMicrosoftConfig();

    const state = generateOAuthState();
    const nonce = generateOAuthNonce();
    const { verifier, challenge } = await generatePkcePair();

    await storeOAuthTransaction({
      state,
      nonce,
      codeVerifier: verifier,
    });

    const authUrl = await buildMicrosoftAuthUrl({
      state,
      nonce,
      codeChallenge: challenge,
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    return errorResponse(error);
  }
}
