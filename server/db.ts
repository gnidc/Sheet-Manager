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
// async 함수로 변경하여 연결이 완전히 닫힐 때까지 기다림
export async function resetPool(): Promise<void> {
  if (_pool) {
    const poolToClose = _pool;
    _pool = null; // 먼저 null로 설정하여 새로운 요청이 이 풀을 사용하지 않도록 함
    _db = null;
    
    try {
      // Vercel 환경에서는 즉시 종료 (타임아웃 방지)
      const isVercel = !!process.env.VERCEL;
      
      if (isVercel) {
        // Vercel에서는 타임아웃을 짧게 설정하여 빠르게 종료
        await Promise.race([
          poolToClose.end(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Pool close timeout")), 1000)
          )
        ]).catch((err) => {
          // 타임아웃이 발생해도 계속 진행 (연결은 이미 닫히고 있을 수 있음)
          if (err.message !== "Pool close timeout") {
            console.error("Error closing pool:", err);
          } else {
            console.warn("Pool close timeout - forcing termination");
          }
        });
        console.log("Pool closed in Vercel environment");
      } else {
        // 로컬 환경에서는 graceful shutdown
        await poolToClose.end().catch((err) => {
          console.error("Error closing pool:", err);
        });
      }
    } catch (err) {
      console.error("Unexpected error in resetPool:", err);
    }
  }
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
              idleTimeoutMillis: isVercel ? 1000 : 30000, // Vercel에서는 1초로 단축 (매우 빠른 정리)
              connectionTimeoutMillis: isVercel ? 1000 : 30000, // 로컬에서는 30초로 증가 (Supabase 연결 시간 고려)
              // SSL 설정 (Supabase는 SSL이 필요함)
              // 로컬 개발 환경에서도 SSL을 사용해야 Supabase에 연결 가능
              ssl: connectionString.includes('supabase') || connectionString.includes('pooler') 
                ? { rejectUnauthorized: false } 
                : (isVercel ? { rejectUnauthorized: false } : undefined),
              // Vercel에서는 keep-alive 비활성화 (연결을 빠르게 정리)
              keepAlive: !isVercel, // Vercel에서는 keep-alive 비활성화
              keepAliveInitialDelayMillis: isVercel ? 0 : 0, // Vercel에서는 사용 안 함
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
    
    // 연결 생성 시 설정 및 이벤트 핸들러 등록
    _pool.on('connect', async (client) => {
      // statement_timeout 설정 (쿼리 실행 시간 제한)
      try {
        // 로컬에서는 30초, Vercel에서는 10초
        await client.query(`SET statement_timeout = ${isVercel ? 10000 : 30000}`);
      } catch (err) {
        console.warn("Failed to set statement_timeout:", err);
      }
      
      // 클라이언트 에러 핸들링
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
