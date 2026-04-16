import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    allowedHosts: ["localhost", "127.0.0.1"],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "LIMA — Espace Membres",
        short_name: "LIMA",
        description:
          "Application de gestion pour la Ligue d'Improvisation du Maine-et-Loire",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => {
              const apiBase = process.env.VITE_API_URL ?? "";
              if (!apiBase) return false;
              try {
                const base = new URL(apiBase);
                return url.origin === base.origin;
              } catch {
                return false;
              }
            },
            handler: "NetworkFirst",
            options: {
              cacheName: "lima-api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60,
              },
            },
          },
        ],
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
