import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deliberately NOT enabling cacheComponents:
  // the dashboard is session-gated and fully dynamic on every route, so PPR/`use cache`
  // discipline would buy nothing here while removing the `dynamic`/`revalidate` route
  // segment configs we do rely on. Revisit only if a genuinely static, cacheable route
  // (e.g. a public marketing page) needs it.
};

export default nextConfig;
