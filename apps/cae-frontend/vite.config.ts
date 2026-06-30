import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/cae/",
  plugins: [react()],
  build: {
    outDir: "../../public/cae",
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 3000,
    allowedHosts: ["simulearn.cn", "localhost", ".simulearn.cn"],
    proxy: {
      "/api/cae": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cae/, "/api/v1"),
      },
    },
  },
});
