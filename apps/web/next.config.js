/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@suro-buya/shared', '@suro-buya/engine-v2', '@suro-buya/ui'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    domains: ['localhost', 'vercel.app'],
  },
  webpack: (config, { isServer }) => {
    // Workspace packages (@suro-buya/engine-v2 in particular) are authored
    // as TypeScript ESM and internally import their own modules with an
    // explicit ".js" extension (e.g. `export * from './commands.js'`, which
    // really resolves to `commands.ts`). tsc's `moduleResolution: "bundler"`
    // handles that remapping automatically, but webpack's default resolver
    // does not — it only tries alternate extensions for *extensionless*
    // imports. Without this, `next build` fails with "Module not found"
    // for every re-export in packages/engine-v2/src/index.ts once tsconfig
    // "paths" resolves the package to its source (for transpilePackages)
    // instead of its built dist/ output.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    };

    // Handle native binary modules from onnxruntime-node (via @xenova/transformers)
    // These .node files cannot be processed by webpack, so we ignore them
    config.module.rules.push({
      test: /\.node$/,
      use: 'ignore-loader',
    });

    // Exclude onnxruntime-node from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
      };
      
      // Don't bundle onnxruntime-node in client
      config.externals = config.externals || [];
      config.externals.push({
        'onnxruntime-node': 'onnxruntime-node',
        '@xenova/transformers': '@xenova/transformers',
      });
    }

    return config;
  },
};

module.exports = nextConfig;
