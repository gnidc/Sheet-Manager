// JavaScript 버전의 빌드 스크립트 (Vercel 호환성)
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  console.log("Starting build process...");
  await rm("dist", { recursive: true, force: true });
  console.log("Cleaned dist directory");

  console.log("building client...");
  await viteBuild();
  console.log("Client build completed");

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "warning", // chunk size 경고는 표시하되 info 레벨 로그는 줄임
  });
  console.log("Server build completed");

  // api/index.ts는 빌드하지 않고 TypeScript 그대로 사용
  // Vercel이 자동으로 TypeScript를 컴파일하므로 소스 파일만 배포하면 됨
  console.log("Skipping api/index.ts build - Vercel will compile TypeScript automatically");
  
  // shared 디렉토리의 TypeScript 파일들을 JavaScript로 컴파일
  // Vercel은 api/만 자동 컴파일하므로 shared/는 수동으로 컴파일 필요
  console.log("building shared files...");
  const { readdir, stat } = await import("fs/promises");
  const { join, extname, basename } = await import("path");
  
  async function compileSharedDir(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await compileSharedDir(fullPath);
      } else if (extname(entry.name) === ".ts" && !entry.name.endsWith(".d.ts")) {
        const outPath = fullPath.replace(/\.ts$/, ".js");
        await esbuild({
          entryPoints: [fullPath],
          platform: "node",
          bundle: false, // shared 파일들은 번들링하지 않음
          format: "esm",
          outfile: outPath,
          define: {
            "process.env.NODE_ENV": '"production"',
          },
          minify: false, // shared 파일들은 minify하지 않음
          // bundle: false일 때는 external 옵션을 사용할 수 없음
          logLevel: "warning",
        });
      }
    }
  }
  
  await compileSharedDir("shared");
  console.log("Shared files build completed");
  
  // Verify dist/public exists
  const { existsSync } = await import("fs");
  const distPublicPath = "dist/public";
  if (existsSync(distPublicPath)) {
    console.log(`✓ ${distPublicPath} directory exists`);
  } else {
    console.error(`✗ ${distPublicPath} directory not found!`);
    process.exit(1);
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});

