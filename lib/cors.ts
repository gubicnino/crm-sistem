/**
 * CORS for the public, unauthenticated endpoints (/api/leads, the form-config
 * route). Origin is unknown — any trainer's external site may call these —
 * so it's deliberately wide open. No Access-Control-Allow-Credentials: it's
 * invalid alongside `*`, and these endpoints are cookieless by design
 * (site_key identifies the caller, it never authorizes via a session).
 */
export function corsHeaders(methods: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": `${methods}, OPTIONS`,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export function preflight(methods: string): Response {
  return new Response(null, { status: 204, headers: corsHeaders(methods) });
}
