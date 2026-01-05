import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Vercel에서는 dist/public 경로 사용
  const distPath = process.env.VERCEL 
    ? path.resolve(process.cwd(), "dist", "public")
    : path.resolve(__dirname, "public");
    
  if (!fs.existsSync(distPath)) {
    console.warn(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
    return;
  }

  // 정적 파일 서빙 (API 경로 제외)
  app.use(express.static(distPath, {
    // API 경로는 제외
    setHeaders: (res, path) => {
      // API 경로는 건너뛰기
    }
  }));

  // API 경로가 아닌 경우에만 index.html 반환
  app.get("*", (req, res, next) => {
    // API 경로는 건너뛰기
    if (req.path.startsWith("/api/")) {
      return next();
    }
    // 정적 파일이 존재하지 않는 경우 index.html 반환
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
