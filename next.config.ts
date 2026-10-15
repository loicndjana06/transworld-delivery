import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async headers() {
    return [{source:'/:path*',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'Content-Security-Policy',value:"frame-ancestors 'self' https://aistudio.google.com; base-uri 'self'; object-src 'none'"},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}
    ]}];
  }
};
export default nextConfig;
