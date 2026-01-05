// Vercel에서는 환경 변수가 자동으로 설정되므로 dotenv는 로컬 개발 환경에서만 사용
// Vercel 환경에서는 process.env에 자동으로 환경 변수가 설정됨
// 항상 dotenv를 로드하되, Vercel 환경에서는 .env 파일이 없으므로 아무것도 로드하지 않음
import { config } from "dotenv";
config(); // Load .env file (로컬 개발 환경에서만, Vercel에서는 무시됨)

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Available env vars:", Object.keys(process.env).filter(k => k.includes("DATABASE") || k.includes("DB")));
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database? " +
    "Please check Vercel environment variables."
  );
}

// connectionString이 문자열인지 확인
if (typeof databaseUrl !== "string") {
  throw new Error(
    "DATABASE_URL must be a string. Current type: " + typeof databaseUrl,
  );
}

// connectionString이 유효한 URL 형식인지 확인
if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
  throw new Error(
    "DATABASE_URL must be a valid PostgreSQL connection string. " +
    "It should start with 'postgresql://' or 'postgres://'"
  );
}

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema });
