declare module "next-pwa" {
  import { NextConfig } from "next";

  interface RuntimeCachingEntry {
    urlPattern: RegExp | string | ((params: { url: URL }) => boolean);
    handler:
      | "CacheFirst"
      | "CacheOnly"
      | "NetworkFirst"
      | "NetworkOnly"
      | "StaleWhileRevalidate";
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
    options?: {
      cacheName?: string;
      expiration?: {
        maxEntries?: number;
        maxAgeSeconds?: number;
        purgeOnQuotaError?: boolean;
      };
      networkTimeoutSeconds?: number;
      cacheableResponse?: {
        statuses?: number[];
        headers?: Record<string, string>;
      };
      matchOptions?: {
        ignoreSearch?: boolean;
        ignoreMethod?: boolean;
        ignoreVary?: boolean;
      };
      backgroundSync?: {
        name: string;
        options?: {
          maxRetentionTime?: number;
        };
      };
      fetchOptions?: RequestInit;
      plugins?: unknown[];
    };
  }

  interface PWAConfig {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    scope?: string;
    sw?: string;
    skipWaiting?: boolean;
    cacheOnFrontEndNav?: boolean;
    reloadOnOnline?: boolean;
    subdomainPrefix?: string;
    fallbacks?: {
      document?: string;
      image?: string;
      audio?: string;
      video?: string;
      font?: string;
    };
    cacheStartUrl?: boolean;
    dynamicStartUrl?: boolean;
    dynamicStartUrlRedirect?: string;
    publicExcludes?: string[];
    buildExcludes?: (string | RegExp)[];
    additionalManifestEntries?: Array<{
      url: string;
      revision: string | null;
    }>;
    runtimeCaching?: RuntimeCachingEntry[];
  }

  function withPWA(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;

  export default withPWA;
}
