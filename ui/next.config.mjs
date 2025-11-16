/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },

  // :white_check_mark: Experimental: allow certain Node packages in server components
  experimental: {
    serverComponentsExternalPackages: [
      "@browserbasehq/stagehand",
      "playwright-core",
      "tree-sitter",         // :zap: externalize tree-sitter
      "chromium-bidi",        // :zap: externalize chromium-bidi
      "@opentelemetry/sdk-node",
      "@opentelemetry/instrumentation",
      "ws",                   // ⚡ externalize websocket
      "bufferutil",          // ⚡ externalize native ws dependency
      "utf-8-validate",      // ⚡ externalize native ws dependency
    ],
  },

  webpack(config, { isServer }) {
    if (isServer) {
      // :zap: Fully externalize Playwright + chromium-bidi to avoid bundling Node-only modules
      config.externals.push(
        /playwright-core/,
        /chromium-bidi/,
        "@browserbasehq/stagehand",
        "ws",
        "bufferutil",
        "utf-8-validate"
      );

      // :zap: Ignore Playwright HTML/SVG files to prevent module-not-found
      config.module.rules.push({
        test: /playwright-core\/.*\.(html|svg)$/,
        loader: "null-loader",
      });
    }

    // :zap: Add fallback for dynamic require calls
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    return config;
  },
};

export default nextConfig;
