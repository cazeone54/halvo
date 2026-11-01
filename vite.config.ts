import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: { port: 8080 },
  // Never inline a font into the stylesheet: every visitor would download it
  // before the first paint, for an alphabet almost no page uses.
  build: { assetsInlineLimit: (file) => (file.endsWith(".woff2") ? false : undefined) },
  plugins: [tailwindcss(), tsConfigPaths({ projects: ["./tsconfig.json"] }), tanstackStart(), viteReact()],
});
