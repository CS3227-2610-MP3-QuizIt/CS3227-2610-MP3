import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Unprefixed configuration stays in the Vite server and out of browser bundles.
  const { BACKEND_SERVER_URL } = loadEnv(
    mode,
    process.cwd(),
    "BACKEND_SERVER_URL",
  );
  if (command === "serve" && !BACKEND_SERVER_URL) {
    throw new Error(
      "Set BACKEND_SERVER_URL in frontend/.env before starting Vite.",
    );
  }
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: BACKEND_SERVER_URL
        ? {
            "/api": {
              target: BACKEND_SERVER_URL,
              // Use the backend Host for virtual hosting and HTTPS SNI.
              // The browser Origin remains intact for backend CSRF checks.
              changeOrigin: true,
              secure: true,
            },
          }
        : undefined,
    },
  };
});
