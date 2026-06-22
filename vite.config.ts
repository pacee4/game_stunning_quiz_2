import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  server: {
    host: "localhost",
    port: 8080,
    open: true,
  },
});
