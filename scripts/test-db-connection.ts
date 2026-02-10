// 데이터베이스 연결 테스트 스크립트
import { config } from "dotenv";
config();

import { getPool, getDb } from "../server/db.js";
import { sql } from "drizzle-orm";

async function testConnection() {
  console.log("=== 데이터베이스 연결 테스트 시작 ===\n");
  
  try {
    // 1. DATABASE_URL 확인
    console.log("1. DATABASE_URL 확인:");
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error("❌ DATABASE_URL이 설정되지 않았습니다.");
      console.log("   .env 파일에 DATABASE_URL을 설정해주세요.");
      process.exit(1);
    }
    
    // 보안을 위해 비밀번호는 마스킹
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ":****@");
    console.log(`   ✅ DATABASE_URL 존재: ${maskedUrl.substring(0, 50)}...`);
    console.log(`   길이: ${dbUrl.length} 문자\n`);
    
    // 2. DATABASE_URL 파싱
    console.log("2. DATABASE_URL 파싱:");
    try {
      const url = new URL(dbUrl);
      console.log(`   호스트: ${url.hostname}`);
      console.log(`   포트: ${url.port || '5432 (기본값)'}`);
      console.log(`   데이터베이스: ${url.pathname.substring(1)}`);
      console.log(`   사용자: ${url.username}\n`);
    } catch (err) {
      console.log(`   ⚠️  URL 파싱 실패: ${err}\n`);
    }
    
    // 3. Pool 생성 테스트
    console.log("3. Connection Pool 생성:");
    const pool = getPool();
    console.log("   ✅ Pool 생성 성공\n");
    
    // 4. 간단한 쿼리 테스트 (타임아웃 설정)
    console.log("4. 데이터베이스 쿼리 테스트:");
    const db = getDb();
    const startTime = Date.now();
    
    // 타임아웃을 20초로 설정 (Supabase 연결 시간 고려)
    const queryPromise = db.execute(sql`SELECT 1 as test, NOW() as current_time`);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Query timeout after 20 seconds")), 20000);
    });
    
    const result = await Promise.race([queryPromise, timeoutPromise]);
    const queryTime = Date.now() - startTime;
    
    console.log(`   ✅ 쿼리 성공 (${queryTime}ms)`);
    console.log(`   결과:`, result.rows[0]);
    console.log();
    
    // 5. ETF 테이블 확인
    console.log("5. ETF 테이블 확인:");
    try {
      const etfCount = await db.execute(sql`SELECT COUNT(*) as count FROM etfs`);
      const count = etfCount.rows[0]?.count || 0;
      console.log(`   ✅ ETF 테이블 접근 성공`);
      console.log(`   현재 ETF 개수: ${count}\n`);
    } catch (err: any) {
      console.log(`   ⚠️  ETF 테이블 접근 실패: ${err.message}`);
      console.log(`   (테이블이 아직 생성되지 않았을 수 있습니다. 'npm run db:push' 실행 필요)\n`);
    }
    
    // 6. 연결 풀 정보
    console.log("6. Connection Pool 정보:");
    console.log(`   총 연결 수: ${pool.totalCount}`);
    console.log(`   사용 중인 연결: ${pool.idleCount}`);
    console.log(`   대기 중인 연결: ${pool.waitingCount}\n`);
    
    console.log("=== ✅ 데이터베이스 연결 테스트 성공 ===\n");
    process.exit(0);
    
  } catch (error: any) {
    console.error("\n=== ❌ 데이터베이스 연결 테스트 실패 ===\n");
    console.error("에러 타입:", error.constructor.name);
    console.error("에러 메시지:", error.message);
    
    if (error.code) {
      console.error("에러 코드:", error.code);
    }
    
    if (error.stack) {
      console.error("\n스택 트레이스:");
      console.error(error.stack.split('\n').slice(0, 10).join('\n'));
    }
    
    // 일반적인 에러 원인 안내
    console.error("\n=== 문제 해결 가이드 ===");
    if (error.message?.includes("DATABASE_URL")) {
      console.error("1. .env 파일에 DATABASE_URL이 올바르게 설정되어 있는지 확인하세요.");
      console.error("2. DATABASE_URL 형식: postgresql://user:password@host:port/database");
    } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND" || error.message?.includes("timeout")) {
      console.error("1. 데이터베이스 서버가 실행 중인지 확인하세요.");
      console.error("2. DATABASE_URL의 호스트와 포트가 올바른지 확인하세요.");
      console.error("3. Supabase의 경우:");
      console.error("   - Connection Pooling URL을 사용하고 있는지 확인 (포트 6543)");
      console.error("   - Direct Connection URL을 사용하는 경우 포트 5432 사용");
      console.error("   - Supabase 대시보드 → Settings → Database → Connection Pooling 확인");
      console.error("4. 방화벽이나 네트워크 설정을 확인하세요.");
      console.error("5. 인터넷 연결을 확인하세요.");
    } else if (error.code === "28P01" || error.message?.includes("password")) {
      console.error("1. 데이터베이스 비밀번호가 올바른지 확인하세요.");
      console.error("2. Supabase의 경우 비밀번호를 재설정할 수 있습니다.");
    } else if (error.code === "3D000" || error.message?.includes("database")) {
      console.error("1. 데이터베이스가 존재하는지 확인하세요.");
      console.error("2. DATABASE_URL의 데이터베이스 이름이 올바른지 확인하세요.");
    }
    
    process.exit(1);
  }
}

testConnection();

