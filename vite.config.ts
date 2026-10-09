import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    svelte(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      includeManifestIcons: false,
      manifest: {
        name: "Qanvas — learn q by drawing",
        short_name: "Qanvas",
        description: "A creative-coding studio for the q language. Works offline.",
        theme_color: "#15141d",
        background_color: "#15141d",
        display: "standalone",
        start_url: "./",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,json}"],
        // the OS fetches the 512px install icons once; no need to precache them for every visitor
        globIgnores: ["**/icon-512.png", "**/icon-maskable-512.png"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  build: { target: "es2022", chunkSizeWarningLimit: 3000 },
  test: { include: ["test/**/*.test.ts"] },
});
