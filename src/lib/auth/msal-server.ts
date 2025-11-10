import { ConfidentialClientApplication, Configuration, LogLevel } from "@azure/msal-node";
import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";

let cca: ConfidentialClientApplication | null = null;

function getEnv(name: string, optional = false): string {
  const val = process.env[name];
  if (!val && !optional) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val || "";
}

function getAuthority(): string {
  const tenantId = getEnv("AZURE_TENANT_ID");
  return `https://login.microsoftonline.com/${tenantId}`;
}

export function getConfidentialClient(): ConfidentialClientApplication {
  if (cca) return cca;

  const config: Configuration = {
    auth: {
      clientId: getEnv("AZURE_BACKEND_CLIENT_ID"),
      authority: getAuthority(),
      clientSecret: getEnv("AZURE_BACKEND_CLIENT_SECRET"),
    },
    system: {
      loggerOptions: {
        loggerCallback(_level, _message, _containsPii) {
          // no-op; wire to your logger if desired
        },
        piiLoggingEnabled: false,
        logLevel: LogLevel.Warning,
      },
    },
  };

  cca = new ConfidentialClientApplication(config);
  return cca;
}

/**
 * On-Behalf-Of: Exchange a user access token (for this API) for a Microsoft Graph access token.
 */
export async function acquireOboToken(userAccessToken: string, scopes: string[]): Promise<string> {
  const client = getConfidentialClient();

  const result = await client.acquireTokenOnBehalfOf({
    oboAssertion: userAccessToken,
    scopes,
    authority: getAuthority(),
    skipCache: true,
  });

  if (!result?.accessToken) {
    throw new Error("OBO failed: no access token returned");
  }
  return result.accessToken;
}

export type VerifiedAccessToken = JWTPayload & {
  aud: string | string[];
  iss: string;
  tid?: string;
  oid?: string;
  sub?: string;
  preferred_username?: string;
  scp?: string;
  roles?: string[];
};

/**
 * Optionally verify the inbound API access token using tenant JWKS and expected audience.
 * Accepts both GUID clientId and api://<clientId> audiences.
 */
export async function verifyApiAccessToken(token: string): Promise<VerifiedAccessToken> {
  const tenantId = getEnv("AZURE_TENANT_ID");
  const backendClientId = getEnv("AZURE_BACKEND_CLIENT_ID");
  const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  const jwksUri = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;

  const JWKS = createRemoteJWKSet(new URL(jwksUri));

  const acceptableAudience = [backendClientId, `api://${backendClientId}`];

  const { payload } = await jwtVerify(token, JWKS, {
    issuer,
    audience: acceptableAudience,
  });

  return payload as VerifiedAccessToken;
}
