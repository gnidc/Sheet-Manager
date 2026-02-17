// Vercel에서는 환경 변수가 자동으로 설정되므로 dotenv는 로컬 개발 환경에서만 사용
// Vercel 환경에서는 process.env에 자동으로 환경 변수가 설정됨
// 항상 dotenv를 로드하되, Vercel 환경에서는 .env 파일이 없으므로 아무것도 로드하지 않음
import { config } from "dotenv";
config(); // Load .env file (로컬 개발 환경에서만, Vercel에서는 무시됨)

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const { Pool, Client } = pg;

// 캐시된 connectionString (매 호출마다 파싱하지 않도록)
let _cachedConnectionString: string | null = null;

// 지연 초기화를 위한 함수 (최소 로깅)
function getDatabaseUrl(): string {
  // 이미 파싱된 결과가 있으면 즉시 반환
  if (_cachedConnectionString) return _cachedConnectionString;
  
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || databaseUrl.trim() === "") {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?"
    );
  }

  if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
    throw new Error(
      "DATABASE_URL must be a valid PostgreSQL connection string."
    );
  }

  let connectionString = databaseUrl.trim();

  // sslmode 파라미터 제거 (Pool의 ssl 옵션 사용)
  if (connectionString.includes('sslmode=')) {
    try {
      const url = new URL(connectionString);
      url.searchParams.delete('sslmode');
      connectionString = url.toString();
    } catch {
      connectionString = connectionString.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');
    }
  }
  
  // 최초 1회만 로깅
  console.log("[DB] Connection configured, length:", connectionString.length);
  
  _cachedConnectionString = connectionString;
  return connectionString;
}

// 지연 초기화: pool과 db를 함수로 만들어서 필요할 때 초기화
// Vercel 환경에서는 각 요청마다 새로운 Pool이 생성되고 요청 종료 시 정리됨
let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

// Pool 참조를 외부에서 접근할 수 있도록 export (Vercel에서 강제 정리용)
export function clearPoolReference(): void {
  _pool = null;
  _db = null;
}

// Vercel 환경에서 Pool의 모든 활성 연결을 강제로 종료
export async function forceClosePool(): Promise<void> {
  if (!_pool) {
    return;
  }
  
  const poolToClose = _pool;
  _pool = null;
  _db = null;
  
  const isVercel = !!process.env.VERCEL;
  
  if (isVercel) {
    // Vercel 환경에서는 pool.end()를 호출하되 await하지 않음
    // pool.end()가 완료되지 않아도 함수가 종료되도록 함
    // 비동기 작업이므로 Promise를 반환하지만 await하지 않음
    poolToClose.end().catch(() => {
      // 에러는 무시 (이미 종료되었을 수 있음)
    });
    
    console.log("Pool end() called in Vercel (non-blocking)");
  } else {
    // 로컬 환경에서는 정상적으로 종료
    try {
      await poolToClose.end();
    } catch (err) {
      console.error("Error closing pool:", err);
    }
  }
}

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
      max: isVercel ? 3 : 10, // Vercel에서는 최대 3개 연결 (동시 쿼리 지원)
      min: 0, // Serverless에서는 최소 연결 수를 0으로 설정 (필요할 때만 연결)
      idleTimeoutMillis: isVercel ? 10000 : 30000, // Vercel: 10초 (함수 수명 내 연결 재사용)
      // Vercel에서는 네트워크 지연과 SSL 핸드셰이크를 고려하여 연결 타임아웃 증가
      // Hobby 플랜 타임아웃(10초) 내에서 쿼리 실행까지 완료할 수 있도록 설정
      connectionTimeoutMillis: isVercel ? 8000 : 30000, // Vercel: 8초, 로컬: 30초
      // SSL 설정 - connection string의 sslmode와 함께 명시적으로 설정
      ssl: sslConfig,
      // keep-alive 활성화: 함수 수명 내에서 연결 재사용 극대화
      keepAlive: true,
      keepAliveInitialDelayMillis: 0,
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
      // Vercel 환경: 최소한의 에러 핸들러 + statement_timeout 설정
      _pool.on('error', (err: any) => {
        console.error('[DB Pool Error]', err.message);
        _pool = null;
        _db = null;
      });
      // Vercel에서도 statement_timeout 설정 (쿼리 무한 실행 방지)
      _pool.on('connect', (client) => {
        client.query('SET statement_timeout = 15000').catch(() => {}); // 15초
      });
    }
    
    console.log(`Database pool created (max: ${isVercel ? 1 : 10}, min: 0, Vercel: ${isVercel}, connectionTimeout: ${isVercel ? 8000 : 30000}ms, SSL: ${sslConfig ? 'enabled' : 'disabled'})`);
  }
  return _pool;
}

// Vercel 환경에서 Client를 사용하여 쿼리를 실행하는 helper 함수
export async function executeWithClient<T>(callback: (db: ReturnType<typeof drizzle>) => Promise<T>): Promise<T> {
  const connectionString = getDatabaseUrl();
  const needsSSL = connectionString.includes('supabase') || 
                   connectionString.includes('pooler') || 
                   connectionString.includes('sslmode=');
  const sslConfig = needsSSL ? { rejectUnauthorized: false } : undefined;
  
  const client = new Client({
    connectionString,
    ssl: sslConfig,
    connectionTimeoutMillis: 8000,
  });
  
  try {
    await client.connect();
    const db = drizzle(client, { schema });
    return await callback(db);
  } finally {
    await client.end();
  }
}

export function getDb() {
  // 로컬/Vercel 모두 Pool 기반 drizzle 인스턴스 사용
  // Vercel에서도 Pool(max:1)이 개별 Client보다 훨씬 효율적
  // (TCP+SSL 핸드셰이크 재사용으로 DB 응답시간 대폭 개선)
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

// db Proxy: Pool 기반으로 통합 (로컬/Vercel 모두)
// 이전: Vercel에서 매 쿼리마다 새 Client 생성 → TCP+SSL 핸드셰이크 반복 → DB 응답 1500ms+
// 이후: Pool(max:1) 사용 → 연결 재사용 → DB 응답 50-200ms
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
