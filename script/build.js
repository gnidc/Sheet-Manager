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

