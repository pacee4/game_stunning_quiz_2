import { defineConfig, UserConfig } from "vite";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig(({mode})=>({
    base: "./",
    server: {
        host: "localhost",
        port: 8080,
        open: true
    },
    build: {
        target: "es2020"
    },
    esbuild: {
        pure: mode === "production" ? ["console.log", "console.warn"] : []
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src')
        }
    }
}));
