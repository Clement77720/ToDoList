import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TypeScript 7 n'expose plus l'API compilateur attendue par Next :
  // on passe par la CLI tsc.
  experimental: { useTypeScriptCli: true },
};

export default nextConfig;
