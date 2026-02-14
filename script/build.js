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

  // shared 디렉토리의 stale .js 파일 삭제 후 TypeScript → JavaScript 재컴파일
  // esbuild가 .ts 대신 stale .js를 읽는 문제를 방지
  // Vercel은 api/만 자동 컴파일하므로 shared/는 수동으로 컴파일 필요
  console.log("building shared files...");
  const { readdir } = await import("fs/promises");
  const { join, extname } = await import("path");

  async function cleanSharedJs(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await cleanSharedJs(fullPath);
      } else if (extname(entry.name) === ".js") {
        await rm(fullPath, { force: true });
      }
    }
  }

  // 1단계: stale .js 파일 삭제
  await cleanSharedJs("shared");
  console.log("Cleaned stale shared .js files");

  // 2단계: .ts → .js 재컴파일
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
          bundle: false,
          format: "esm",
          outfile: outPath,
          define: {
            "process.env.NODE_ENV": '"production"',
          },
          minify: false,
          logLevel: "warning",
        });
      }
    }
  }

  await compileSharedDir("shared");
  console.log("Shared files build completed");

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
    logLevel: "warning",
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

