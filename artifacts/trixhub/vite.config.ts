import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Injecter VITE_APP_URL depuis REPLIT_DOMAINS (prod) ou REPLIT_DEV_DOMAIN (dev)
// Vite remplace %VITE_APP_URL% dans index.html au moment du build.
if (!process.env.VITE_APP_URL) {
  const domains = process.env.REPLIT_DOMAINS || "";
  const preferred =
    domains
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean)
      .find((d) => d.includes("trixhub") || !d.includes("replit.dev")) ||
    domains.split(",")[0]?.trim();
  const fallback = process.env.REPLIT_DEV_DOMAIN?.trim();
  const resolved = preferred || fallback;
  if (resolved) {
    process.env.VITE_APP_URL = resolved.startsWith("http")
      ? resolved
      : `https://${resolved}`;
  }
}

// Gestion sécurisée du PORT : utilise process.env.PORT si présent, sinon fallback sur 5000
const rawPort = process.env.PORT;
const parsedPort = rawPort ? Number(rawPort) : 5000;
const port = !Number.isNaN(parsedPort) && parsedPort > 0 ? parsedPort : 5000;

// Gestion sécurisée du BASE_PATH : utilise process.env.BASE_PATH si présent, sinon "/"
const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
