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

  console.log("building api/index...");
  // api/index.ts를 빌드 - 모든 로컬 파일(server/*, shared/*)은 번들에 포함
  // npm 패키지는 external로 설정하여 node_modules에서 로드
  // allowlist에 있는 패키지는 번들에 포함 (이미 번들링됨)
  const apiExternals = allDeps.filter((dep) => !allowlist.includes(dep));
  
  await esbuild({
    entryPoints: ["api/index.ts"],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: "api/index.js",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    // npm 패키지만 external로 설정, 로컬 파일(server/*, shared/*)은 번들에 포함
    external: apiExternals,
    // path alias 해결 (@shared/* -> shared/*)
    alias: {
      "@shared": "./shared",
      "@": "./client/src",
    },
    logLevel: "info", // 빌드 과정 확인을 위해 info로 변경
  });
  console.log("API build completed");
  
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

