/**
 * geo-worker — Cloudflare Worker for geoblocking
 *
 * Intercepts all requests at the edge before they reach the Railway API.
 * Blocked countries are defined as a static set — no env var needed,
 * changes require a redeploy (intentional: avoids runtime misconfiguration).
 *
 * Portfolio demo — block only sanctioned/high-risk countries.
 * A real gambling platform would invert this logic to allowlist
 * licensed jurisdictions only.
 *
 * CF-IPCountry is a two-letter ISO 3166-1 alpha-2 code added automatically
 * by Cloudflare on every request. Value is "T1" for Tor exit nodes.
 */

const BLOCKED_COUNTRIES = new Set([
  'KP', // North Korea
  'IR', // Iran
  'CU', // Cuba
  'SY', // Syria
  'RU', // Russia
  'BY', // Belarus
])

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // /health bypasses geoblocking — Railway uses this for container health checks.
    // If geoblocking blocked it, Railway would think the service is down.
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const country = request.headers.get('CF-IPCountry')

    if (country && BLOCKED_COUNTRIES.has(country)) {
      return new Response(
        JSON.stringify({
          error: 'Service not available in your region',
          country,
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Forward allowed request to origin, preserving method, headers, and body.
    // Reconstruct the URL against ORIGIN_URL to avoid sending the worker's
    // hostname to the Railway API.
    const targetUrl = new URL(url.pathname + url.search, env.ORIGIN_URL)
    return fetch(new Request(targetUrl.toString(), request))
  },
}

interface Env {
  /** Base URL of the Railway API, e.g. https://betplatform-api.up.railway.app */
  ORIGIN_URL: string
}
