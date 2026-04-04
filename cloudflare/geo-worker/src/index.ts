/**
 * geo-worker — Cloudflare Worker for geoblocking
 *
 * TODO: Read CF-IPCountry header and deny requests from blocked regions.
 * Cloudflare sets CF-IPCountry on every incoming request at the edge.
 */

export default {
  async fetch(_request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    // Placeholder — geoblocking logic to be implemented
    return new Response(JSON.stringify({ message: 'geo-worker placeholder' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  },
}

interface Env {
  // ALLOWED_COUNTRIES: string  // comma-separated ISO-3166-1 alpha-2 codes
}
