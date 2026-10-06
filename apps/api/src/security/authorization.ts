/**
 * Authorization primitives (spec §19/§22). The MCP tool boundary is where access is enforced, so
 * the AI can never reach a capability the caller isn't allowed to use — regardless of what the LLM
 * decides. Combines coarse RBAC (role allowlist) with fine-grained SMART-on-FHIR scope checks.
 *
 * In Phase 5 the AuthContext is produced by a dev helper; Phase 12 derives it from a verified
 * OAuth/SMART token. Nothing downstream changes when that swap happens.
 */

export interface AuthContext {
  userId: string;
  tenantId: string;
  /** Coarse roles for RBAC, e.g. 'clinician', 'nurse'. */
  roles: string[];
  /** Effective SMART scopes, e.g. 'patient/Observation.read', 'patient/*.read'. */
  scopes: string[];
}

export interface AuthorizationResult {
  allowed: boolean;
  /** Machine-readable, PHI-free reason when denied (safe to audit). */
  reason?: string;
}

const CLINICAL_ROLES = new Set(['clinician', 'nurse', 'physician', 'admin']);

interface ParsedScope {
  compartment: string;
  resource: string;
  access: string;
}

/** Parse a SMART scope like `patient/Observation.read` → { patient, Observation, read }. */
function parseScope(scope: string): ParsedScope | null {
  const [compartmentResource, access] = scope.split('.');
  if (!compartmentResource || !access) return null;
  const [compartment, resource] = compartmentResource.split('/');
  if (!compartment || !resource) return null;
  return { compartment, resource, access };
}

/** A granted scope satisfies a required one on exact match or a resource wildcard (`patient/*.read`). */
function scopeSatisfies(granted: string, required: string): boolean {
  if (granted === required) return true;
  const g = parseScope(granted);
  const r = parseScope(required);
  if (!g || !r) return false;
  return (
    g.compartment === r.compartment &&
    (g.resource === '*' || g.resource === r.resource) &&
    g.access === r.access
  );
}

/** Decide whether this caller may invoke a tool requiring the given scopes. */
export function authorizeTool(auth: AuthContext, requiredScopes: string[]): AuthorizationResult {
  const hasClinicalRole = auth.roles.some((role) => CLINICAL_ROLES.has(role));
  if (!hasClinicalRole) {
    return { allowed: false, reason: 'role_not_permitted' };
  }
  for (const required of requiredScopes) {
    const satisfied = auth.scopes.some((granted) => scopeSatisfies(granted, required));
    if (!satisfied) {
      return { allowed: false, reason: `missing_scope:${required}` };
    }
  }
  return { allowed: true };
}

/** Dev-only identity used until SMART/OAuth is wired in Phase 12. Read-only clinician. */
export function devAuthContext(): AuthContext {
  return {
    userId: 'dev-user',
    tenantId: 'dev-tenant',
    roles: ['clinician'],
    scopes: ['patient/*.read'],
  };
}
