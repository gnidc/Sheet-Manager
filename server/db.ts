// Vercel에서는 환경 변수가 자동으로 설정되므로 dotenv는 로컬 개발 환경에서만 사용
// Vercel 환경에서는 process.env에 자동으로 환경 변수가 설정됨
// 항상 dotenv를 로드하되, Vercel 환경에서는 .env 파일이 없으므로 아무것도 로드하지 않음
import { config } from "dotenv";
config(); // Load .env file (로컬 개발 환경에서만, Vercel에서는 무시됨)

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

// 지연 초기화를 위한 함수
function getDatabaseUrl(): string {
  // 디버깅: 모든 환경 변수 확인
  console.log("=== DATABASE_URL Debug ===");
  console.log("DATABASE_URL exists:", "DATABASE_URL" in process.env);
  console.log("DATABASE_URL value:", process.env.DATABASE_URL ? `[${process.env.DATABASE_URL.length} chars]` : "undefined");
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("VERCEL:", process.env.VERCEL);
  
  const databaseUrl = process.env.DATABASE_URL;

  // DATABASE_URL이 없거나 빈 문자열인지 확인
  if (!databaseUrl || databaseUrl.trim() === "") {
    const availableEnvVars = Object.keys(process.env).filter(k => 
      k.includes("DATABASE") || k.includes("DB") || k.includes("POSTGRES")
    );
    console.error("DATABASE_URL is not set or empty.");
    console.error("Available env vars:", availableEnvVars);
    console.error("All env vars (first 20):", Object.keys(process.env).slice(0, 20));
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database? " +
      "Please check Vercel environment variables. " +
      `Available vars: ${availableEnvVars.join(", ")}`
    );
  }

  // connectionString이 문자열인지 확인
  if (typeof databaseUrl !== "string") {
    throw new Error(
      "DATABASE_URL must be a string. Current type: " + typeof databaseUrl + ", value: " + String(databaseUrl),
    );
  }

  // connectionString이 유효한 URL 형식인지 확인
  if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
    throw new Error(
      "DATABASE_URL must be a valid PostgreSQL connection string. " +
      "It should start with 'postgresql://' or 'postgres://'. " +
      `Current value: ${databaseUrl.substring(0, 20)}...`
    );
  }

  // Pool 생성 전에 connectionString이 유효한지 확인
  const connectionString = databaseUrl.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is empty after trimming.");
  }

  console.log("DATABASE_URL is set, length:", connectionString.length, "starts with:", connectionString.substring(0, 20));
  return connectionString;
}

// 지연 초기화: pool과 db를 함수로 만들어서 필요할 때 초기화
let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

// Pool 재설정 함수 (연결 에러 시 사용)
export function resetPool() {
  if (_pool) {
    _pool.end().catch((err) => {
      console.error("Error closing pool:", err);
    });
  }
  _pool = null;
  _db = null;
  console.log("Pool reset - will create new connection on next request");
}

export function getPool(): pg.Pool {
  if (!_pool) {
    const connectionString = getDatabaseUrl();
    
    // Vercel serverless 환경에 최적화된 Pool 설정
    const isVercel = !!process.env.VERCEL;
    
    _pool = new Pool({
      connectionString,
      // Serverless 환경에서는 연결 수를 제한
      max: isVercel ? 1 : 10, // Vercel에서는 최대 1개 연결 (serverless 제약)
      min: 0, // Serverless에서는 최소 연결 수를 0으로 설정 (필요할 때만 연결)
      idleTimeoutMillis: isVercel ? 2000 : 30000, // Vercel에서는 2초로 단축 (더 빠른 정리)
      connectionTimeoutMillis: isVercel ? 1000 : 5000, // Vercel에서는 1초로 단축 (더 빠른 실패)
      // SSL 설정 (Supabase는 SSL이 필요할 수 있음)
      ssl: isVercel ? { rejectUnauthorized: false } : undefined,
      // Keep-alive 설정으로 연결 유지
      keepAlive: true,
      keepAliveInitialDelayMillis: 0, // 즉시 시작
    });
    
    // Pool 에러 핸들링 - 연결이 끊어졌을 때 재연결
    _pool.on('error', (err: any) => {
      console.error('Unexpected error on idle client', err);
      // 연결이 끊어졌을 때 Pool을 재설정
      if (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.message?.includes('Connection terminated')) {
        console.log('Connection error detected, resetting pool...');
        _pool = null;
        _db = null;
      }
    });
    
    // 연결 종료 시 Pool 정리
    _pool.on('connect', (client) => {
      client.on('error', (err) => {
        console.error('Client error:', err);
      });
      
      client.on('end', () => {
        console.log('Client connection ended');
      });
    });
    
    console.log(`Database pool created (max: ${isVercel ? 1 : 10}, min: 0, Vercel: ${isVercel})`);
  }
  return _pool;
}

export function getDb() {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

// 기존 코드와의 호환성을 위해 export (완전 지연 초기화)
// 모듈 레벨에서 즉시 실행하지 않고, 실제 사용 시점에 초기화
// Proxy를 사용하여 속성 접근 시에만 초기화
const poolProxy = new Proxy({} as pg.Pool, {
  get(_target, prop, _receiver) {
    const pool = getPool();
    const value = (pool as any)[prop];
    if (typeof value === 'function') {
      return value.bind(pool);
    }
    return value;
  }
});

const dbProxy = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop, _receiver) {
    const db = getDb();
    const value = (db as any)[prop];
    if (typeof value === 'function') {
      return value.bind(db);
    }
    return value;
  }
});

export const pool = poolProxy;
export const db = dbProxy;
