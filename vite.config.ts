import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves this repository beneath /star_battle_solver/.
  // Keep the local development server available from the site root.
  base: process.env.GITHUB_ACTIONS ? "/star_battle_solver/" : "/",
  plugins: [react()],
});
