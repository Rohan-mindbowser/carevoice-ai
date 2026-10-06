/**
 * Supplies the bearer token for FHIR requests. This seam lets the same adapter talk to the open
 * sandbox today (no token) and a SMART-secured endpoint later (SMART Backend Services /
 * client-credentials), without the client code changing — only the provider does (spec §31/§22).
 */
export interface TokenProvider {
  /** Returns an access token, or null when the endpoint needs no authentication. */
  getAccessToken(): Promise<string | null>;
}

/** No-auth provider for Cerner's open (public) sandbox. */
export class OpenTokenProvider implements TokenProvider {
  async getAccessToken(): Promise<string | null> {
    return null;
  }
}
