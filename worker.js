/**
 * Cloudflare Worker entry point for audit-report
 * Handles root routing and serves static application assets via env.ASSETS
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Root redirect: preserve existing /cctv-ops-v2/ URL and root redirect
    if (url.pathname === "/" || url.pathname === "") {
      return Response.redirect(new URL("/cctv-ops-v2/", request.url), 302);
    }

    // Ensure trailing slash for /cctv-ops-v2 so relative links in index.html resolve properly
    if (url.pathname === "/cctv-ops-v2") {
      return Response.redirect(new URL("/cctv-ops-v2/", request.url), 301);
    }

    // Serve static assets from binding
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      let response = await env.ASSETS.fetch(request);

      // SPA fallback: If missing sub-route under /cctv-ops-v2/, serve /cctv-ops-v2/index.html
      if (response.status === 404 && url.pathname.startsWith("/cctv-ops-v2")) {
        const spaIndexUrl = new URL("/cctv-ops-v2/index.html", request.url);
        return env.ASSETS.fetch(new Request(spaIndexUrl, request));
      }

      return response;
    }

    return new Response("Static asset binding ASSETS not configured", { status: 500 });
  }
};

