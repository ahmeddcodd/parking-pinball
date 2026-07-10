import { defineConfig } from "vite";

export default defineConfig({
  /**
   * Emit RELATIVE asset paths ("./assets/…" rather than "/assets/…").
   *
   * The Playables bundle is a zip that YouTube serves from its own location,
   * not necessarily a domain root. Vite's default `base: "/"` would produce
   * absolute paths that 404 there and the game would never boot. Relative
   * paths work both inside the zip and on a plain static host like Vercel.
   */
  base: "./",
  build: {
    // The Babylon engine is one big chunk by nature; splitting it would only
    // add round-trips. The initial bundle is well under the 30 MiB limit.
    chunkSizeWarningLimit: 1500,
  },
});
