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
  let connectionString = databaseUrl.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is empty after trimming.");
  }

  // Supabase 또는 Pooler 연결인 경우 SSL 처리
  // .env 파일에 이미 sslmode=require가 추가되어 있을 수 있음
  // 하지만 connection string의 sslmode가 Pool의 ssl 옵션과 충돌할 수 있으므로 제거
  // Pool의 ssl 옵션(rejectUnauthorized: false)을 사용하는 것이 더 안정적
  if (connectionString.includes('sslmode=')) {
    try {
      const url = new URL(connectionString);
      // sslmode 파라미터 제거 (Pool의 ssl 옵션 사용)
      url.searchParams.delete('sslmode');
      connectionString = url.toString();
      console.log("Removed sslmode from DATABASE_URL (will use Pool SSL config instead)");
    } catch (urlError) {
      // URL 파싱 실패 시 문자열 방식으로 제거
      connectionString = connectionString.replace(/[?&]sslmode=[^&]*/g, '');
      // ? 다음에 파라미터가 없으면 ? 제거
      connectionString = connectionString.replace(/\?$/, '');
      console.log("Removed sslmode from DATABASE_URL (fallback method)");
    }
  }
  
  // Supabase/Pooler 연결이지만 sslmode가 없는 경우는 추가하지 않음
  // Pool의 ssl 옵션에서 처리

  // Vercel 환경에서 더 상세한 로깅
  if (process.env.VERCEL) {
    try {
      const url = new URL(connectionString);
      console.log("DATABASE_URL parsed - Host:", url.hostname, "Port:", url.port, "Database:", url.pathname.substring(1));
      console.log("SSL required:", connectionString.includes('supabase') || connectionString.includes('pooler'));
    } catch (e) {
      console.log("Could not parse DATABASE_URL as URL");
    }
  }
  
  console.log("DATABASE_URL is set, length:", connectionString.length, "starts with:", connectionString.substring(0, 20));
  return connectionString;
}

// 지연 초기화: pool과 db를 함수로 만들어서 필요할 때 초기화
let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

// Pool 재설정 함수 (연결 에러 시 사용)
// Vercel 환경에서는 pool.end()를 호출하지 않고 즉시 반환하여 함수 종료를 방해하지 않음
export async function resetPool(): Promise<void> {
  if (_pool) {
    const poolToClose = _pool;
    _pool = null; // 먼저 null로 설정하여 새로운 요청이 이 풀을 사용하지 않도록 함
    _db = null;
    
    const isVercel = !!process.env.VERCEL;
    
    if (isVercel) {
      // Vercel 환경에서는 pool.end()를 전혀 호출하지 않음
      // setTimeout도 사용하지 않음 (백그라운드 타이머 방지)
      // 함수가 종료되면 Vercel이 모든 연결을 자동으로 정리함
      // pool.end()나 setTimeout을 호출하면 함수 종료를 방해할 수 있음
      console.log("Pool reset in Vercel (pool.end() not called - Vercel will cleanup automatically)");
    } else {
      // 로컬 환경에서는 graceful shutdown을 위해 await
      try {
        await poolToClose.end().catch((err) => {
          console.error("Error closing pool:", err);
        });
      } catch (err) {
        console.error("Unexpected error in resetPool:", err);
      }
    }
  }
  console.log("Pool reset - will create new connection on next request");
}

export function getPool(): pg.Pool {
  if (!_pool) {
    const connectionString = getDatabaseUrl();
    
    // Vercel serverless 환경에 최적화된 Pool 설정
    const isVercel = !!process.env.VERCEL;
    
    // SSL 설정 결정
    // Supabase/Pooler 연결은 항상 SSL 필요 (로컬/Vercel 모두)
    // connection string에 sslmode가 있으면 pg가 처리하지만, Pool의 ssl 옵션도 명시적으로 설정
    const needsSSL = connectionString.includes('supabase') || 
                     connectionString.includes('pooler') || 
                     connectionString.includes('sslmode=') ||
                     isVercel;
    
    // rejectUnauthorized: false는 자체 서명된 인증서(Supabase 포함)를 허용하기 위함
    // 로컬 개발 환경에서도 Supabase 연결 시 필요
    // connection string의 sslmode와 관계없이 Pool 레벨에서 SSL 설정
    const sslConfig = needsSSL ? { rejectUnauthorized: false } : undefined;
    
    _pool = new Pool({
      connectionString,
      // Serverless 환경에서는 연결 수를 제한
      max: isVercel ? 1 : 10, // Vercel에서는 최대 1개 연결 (serverless 제약)
      min: 0, // Serverless에서는 최소 연결 수를 0으로 설정 (필요할 때만 연결)
      idleTimeoutMillis: isVercel ? 1000 : 30000, // Vercel에서는 1초로 단축 (매우 빠른 정리)
      // Vercel에서는 네트워크 지연과 SSL 핸드셰이크를 고려하여 연결 타임아웃 증가
      // Hobby 플랜 타임아웃(10초) 내에서 쿼리 실행까지 완료할 수 있도록 설정
      connectionTimeoutMillis: isVercel ? 8000 : 30000, // Vercel: 8초, 로컬: 30초
      // SSL 설정 - connection string의 sslmode와 함께 명시적으로 설정
      ssl: sslConfig,
      // Vercel에서는 keep-alive 비활성화 (연결을 빠르게 정리)
      keepAlive: !isVercel, // Vercel에서는 keep-alive 비활성화
      keepAliveInitialDelayMillis: isVercel ? 0 : 0, // Vercel에서는 사용 안 함
    });
            
    // Pool 에러 핸들링 - 연결이 끊어졌을 때 재연결
    // Vercel 환경에서는 이벤트 리스너를 최소화하여 함수 종료를 방해하지 않도록 함
    if (!isVercel) {
      _pool.on('error', (err: any) => {
        console.error('Unexpected error on idle client', err);
        // 연결이 끊어졌을 때 Pool을 재설정
        if (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.message?.includes('Connection terminated')) {
          console.log('Connection error detected, resetting pool...');
          _pool = null;
          _db = null;
        }
      });
      
      // 연결 생성 시 설정 및 이벤트 핸들러 등록 (로컬 환경에서만)
      _pool.on('connect', async (client) => {
        // statement_timeout 설정 (쿼리 실행 시간 제한)
        try {
          await client.query(`SET statement_timeout = 30000`);
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
    } else {
      // Vercel 환경에서는 이벤트 리스너를 전혀 등록하지 않음
      // 이벤트 리스너가 함수 종료를 방해할 수 있으므로 완전히 제거
      // statement_timeout은 쿼리 실행 시 직접 설정하거나 DB 레벨에서 처리
    }
    
    console.log(`Database pool created (max: ${isVercel ? 1 : 10}, min: 0, Vercel: ${isVercel}, connectionTimeout: ${isVercel ? 8000 : 30000}ms, SSL: ${sslConfig ? 'enabled' : 'disabled'})`);
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
