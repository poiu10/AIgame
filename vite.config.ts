import { defineConfig } from "vite";

export default defineConfig({
  // 상대 경로를 사용해 사용자/조직 Pages와 프로젝트 Pages 모두 지원합니다.
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
