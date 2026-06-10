import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      allowedHosts: true,
    },
    preview: {
      allowedHosts: true,
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
