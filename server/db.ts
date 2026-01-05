// Vercel에서는 환경 변수가 자동으로 설정되므로 dotenv는 로컬 개발 환경에서만 사용
// Vercel 환경에서는 process.env에 자동으로 환경 변수가 설정됨
import { config } from "dotenv";
if (typeof process.env.DATABASE_URL === "undefined") {
  config(); // Load .env file (로컬 개발 환경에서만)
}

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// connectionString이 문자열인지 확인
if (typeof databaseUrl !== "string") {
  throw new Error(
    "DATABASE_URL must be a string. Current type: " + typeof databaseUrl,
  );
}

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema });
