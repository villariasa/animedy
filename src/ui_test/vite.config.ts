import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const BACKEND_PORT = process.env.BACKEND_PORT ?? process.env.PORT ?? "3000";

export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL("./src/lib", import.meta.url))
    }
  },
  build: {
    // No source maps in the shipped build — without them, DevTools can only
    // show the minified/mangled bundle, not original filenames or source.
    sourcemap: false,
    minify: "terser",
    terserOptions: {
      compress: {
        passes: 2,
        drop_console: true,
        drop_debugger: true
      },
      mangle: {
        toplevel: true
      },
      format: {
        comments: false
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": `http://localhost:${BACKEND_PORT}`,
      "/docs": `http://localhost:${BACKEND_PORT}`
    }
  }
});
