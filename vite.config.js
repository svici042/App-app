import { defineConfig } from "vite";

import basicSsl from '@vitejs/plugin-basic-ssl'

/**
 * Vite development/build configuration.
 *
 * The HTTPS dev server matches the Capacitor Android scheme and proxies `/api`
 * to the local provider proxy so browser tests exercise the same request paths
 * used by the app.
 */
export default defineConfig({
  plugins: [basicSsl()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  }
})
