import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      allowedHosts: true,
    },
    preview: {
      allowedHosts: true,
    },
    build: {
      minify: 'esbuild',
    },
    esbuild: {
      drop: ['console', 'debugger'],
    },
  },
  nitro: {
    preset: "netlify",
  },
  tanstackStart: {
    server: {
      entry: "server",
    },
  },
});