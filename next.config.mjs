/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PGlite (dev/test driver) is a Node/WASM module; keep it external so it isn't bundled.
  serverExternalPackages: ['@electric-sql/pglite'],
  eslint: {
    // Lint is run explicitly via `npm run lint`; don't fail production builds on lint.
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};
    if (!isServer) {
      // ブラウザ内OCR（@gutenye/ocr-browser→@techstark/opencv-js / onnxruntime-web）は
      // node コアモジュールの分岐を含む。クライアントビルドでは空モジュールにフォールバックする。
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
        crypto: false,
        os: false,
      };
    } else {
      // ブラウザ内OCR一式はクライアント専用（クリック時に動的import／サーバでは決して実行しない）。
      // サーバ(Cloudflare Worker)バンドルに巻き込まれると 10MB近く肥大化するため、空モジュールへ解決する。
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        'onnxruntime-web': false,
        '@techstark/opencv-js': false,
        '@gutenye/ocr-browser': false,
        '@gutenye/ocr-common': false,
      };
    }
    return config;
  },
};

export default nextConfig;
