// Vercel 서버리스 함수용 Express 앱 래퍼
// Vercel 환경에서는 환경 변수가 자동으로 주입되므로 dotenv 불필요
// 로컬 개발 환경에서만 dotenv 사용
import { config } from "dotenv";
// Vercel 환경에서는 .env 파일이 없으므로 config()가 아무것도 로드하지 않음
// 하지만 dotenv가 "injecting env (0)" 로그를 출력하므로 조건부로 실행
if (!process.env.VERCEL) {
  config(); // Load .env file (로컬 개발 환경에서만)
}

import express from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import { registerRoutes } from "../server/routes.js";
import { serveStatic } from "../server/static.js";
import { createServer } from "http";
import serverless from "serverless-http";

const app = express();
// Vercel 서버리스 환경에서는 httpServer가 필요 없지만,
// registerRoutes가 httpServer를 요구하므로 생성 (실제로는 사용되지 않음)
const httpServer = createServer(app);

declare module "express-session" {
  interface SessionData {
    isAdmin?: boolean;
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set("trust proxy", 1);

// 모든 API 응답에 Content-Type 헤더 설정
app.use((req, res, next) => {
  // API 경로인 경우에만 JSON Content-Type 설정
  if (req.path.startsWith("/api/")) {
    res.setHeader("Content-Type", "application/json");
  }
  next();
});

// Vercel에서는 메모리 스토어 사용 (서버리스 환경)
// Vercel 서버리스에서는 checkPeriod를 비활성화하여 백그라운드 작업 방지
const isVercel = !!process.env.VERCEL;
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
    store: isVercel 
      ? undefined // Vercel에서는 MemoryStore를 사용하지 않음 (메모리만 사용)
      : new (MemoryStore(session))({
          checkPeriod: 86400000, // 로컬: 24시간
        }),
  })
);

// Express 앱 초기화 (비동기)
let appInitialized = false;
let initPromise: Promise<void> | null = null;
let handler: ReturnType<typeof serverless> | null = null;

async function initializeApp() {
  if (appInitialized && handler) {
    console.log("App already initialized, reusing handler");
    return;
  }
  if (initPromise) {
    console.log("App initialization in progress, waiting...");
    return initPromise;
  }

  initPromise = (async () => {
    const initStart = Date.now();
    try {
      console.log("Starting app initialization...");
      
      // registerRoutes는 빠르게 실행되어야 함 (DB 연결 없이)
      const routesStart = Date.now();
      await registerRoutes(httpServer, app);
      const routesTime = Date.now() - routesStart;
      console.log(`Routes registered in ${routesTime}ms`);

      // 404 핸들러는 registerRoutes 내부에서 처리되므로 여기서는 에러 핸들러만 설정
      app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        console.error("Express error:", err);
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        // 응답이 아직 전송되지 않았다면 에러 응답 전송
        if (!res.headersSent) {
          res.status(status).json({ message });
        }
      });

      // 프로덕션에서는 정적 파일 서빙 (API 경로 제외)
      if (process.env.NODE_ENV === "production") {
        serveStatic(app);
      }

      // serverless-http로 래핑
      // Vercel의 요청 객체 구조에 맞게 설정
      // serverless-http는 기본적으로 Vercel을 지원하며 별도의 provider 설정 불필요
      handler = serverless(app, {
        binary: ["image/*", "application/pdf"],
        requestId: 'x-vercel-id',
      });

      appInitialized = true;
      const initTime = Date.now() - initStart;
      console.log(`App initialized successfully in ${initTime}ms`);
    } catch (error: any) {
      console.error("Error initializing app:", error);
      console.error("Error stack:", error.stack);
      throw error;
    }
  })();

  return initPromise;
}

// Vercel 서버리스 함수 핸들러
export default async function (req: any, res: any) {
  const startTime = Date.now();
  
  // Vercel 요청 객체에서 경로가 누락되는 것을 방지
  // Vercel은 req.url 대신 다른 속성을 사용할 수 있으므로 확인
  if (!req.url) {
    // Vercel의 요청 객체 구조에 맞게 경로 추출
    // Vercel은 headers['x-vercel-path'] 또는 query string에서 경로를 제공할 수 있음
    req.url = req.path || req.originalUrl || req.headers?.['x-vercel-path'] || req.headers?.['x-invoke-path'] || '/';
    console.log(`경로 복구 - path: ${req.path}, originalUrl: ${req.originalUrl}, url: ${req.url}, headers:`, {
      'x-vercel-path': req.headers?.['x-vercel-path'],
      'x-invoke-path': req.headers?.['x-invoke-path']
    });
  }
  
  // Express가 인식할 수 있도록 req.path도 설정
  if (!req.path && req.url) {
    req.path = req.url.split('?')[0]; // 쿼리 문자열 제거
  }
  
  // originalUrl도 설정 (Express 라우터가 사용)
  if (!req.originalUrl && req.url) {
    req.originalUrl = req.url;
  }
  
  // Vercel의 타임아웃은 10초 (Hobby), 60초 (Pro), 300초 (Enterprise)
  // ETF 크롤링 등 긴 작업을 위해 60초로 설정 (Pro 플랜 기준)
  // Hobby 플랜 사용자는 Vercel의 10초 제한에 걸릴 수 있음
  const TIMEOUT_MS = 60000; // 60초로 증가
  let timeoutCleared = false;
  const timeout = setTimeout(() => {
    if (!timeoutCleared && !res.headersSent) {
      console.error(`Request timeout after ${TIMEOUT_MS}ms`);
      res.status(504).json({ 
        message: "Gateway timeout",
        hint: "The server is taking too long to respond. Please try again."
      });
    }
  }, TIMEOUT_MS);

  try {
    // 초기화 시작 (빠르게 완료되어야 함)
    const initStart = Date.now();
    await initializeApp();
    const initTime = Date.now() - initStart;
    
    if (initTime > 2000) {
      console.warn(`Slow initialization: ${initTime}ms (should be < 2000ms)`);
    } else {
      console.log(`App initialization took ${initTime}ms`);
    }
    
    timeoutCleared = true;
    clearTimeout(timeout);
    
    if (!handler) {
      console.error("Handler not initialized");
      if (!res.headersSent) {
        return res.status(500).json({ message: "Handler not initialized" });
      }
      return;
    }
    
    // handler 실행
    const handlerStart = Date.now();
    // 경로 정보 확인 (디버깅)
    console.log(`Handler 시작 - url: ${req.url}, path: ${req.path}, originalUrl: ${req.originalUrl}, method: ${req.method}`);
    
    // serverless-http handler는 Promise를 반환함
    // handlerPromise가 완료되면 응답도 완료된 것으로 간주
    // 복잡한 race와 while 루프 대신 직접 await하여 단순화
    const handlerPromise = handler(req, res);
    
    try {
      // handlerPromise가 완료될 때까지 직접 기다림
      // serverless-http가 제공하는 Promise를 믿고 기다리는 방식
      console.log("Handler Promise 대기 시작"); // 디버깅
      await handlerPromise;
      console.log("Handler Promise 완료"); // 디버깅
      
      const handlerTime = Date.now() - handlerStart;
      const totalTime = Date.now() - startTime;
      
      // serverless-http가 응답 완료를 제대로 감지하는지 확인
      // 약간의 지연을 두고 다시 확인 (응답 전송이 비동기일 수 있음)
      await new Promise(resolve => setTimeout(resolve, 10));
      
      console.log(`Handler 완료 - handler: ${handlerTime}ms, total: ${totalTime}ms, headersSent: ${res.headersSent}, finished: ${res.finished}`); // 디버깅
      
      if (totalTime > 5000) {
        console.warn(`Slow request: total ${totalTime}ms, handler ${handlerTime}ms`);
      } else {
        console.log(`Request completed - init: ${initTime}ms, handler: ${handlerTime}ms, total: ${totalTime}ms`);
      }
      
      // 응답이 전송되지 않았다면 에러 응답 전송 (fallback)
      // 하지만 serverless-http의 Promise가 완료되었다면 응답은 이미 전송되었을 것임
      // 이 체크는 실제로 필요하지 않을 수 있지만, 안전을 위해 유지
      if (!res.headersSent && !res.finished) {
        console.warn("Response not sent by handler, but handler promise completed - response may have been sent via serverless-http");
        // serverless-http가 응답을 전송했을 가능성이 높으므로 여기서는 추가 응답을 보내지 않음
        // 중복 응답을 방지
      } else {
        console.log(`Response 전송 확인 - headersSent: ${res.headersSent}, finished: ${res.finished}`); // 디버깅
      }
    } catch (handlerError: any) {
      // handler 실행 중 에러 발생
      const handlerTime = Date.now() - handlerStart;
      console.error(`Handler error after ${handlerTime}ms:`, handlerError);
      
      // 에러 발생 시에도 반드시 JSON 응답 전송
      if (!res.headersSent) {
        res.status(500).json({ 
          message: "Internal server error",
          error: process.env.NODE_ENV === "development" ? handlerError.message : undefined
        });
      }
      // 에러는 상위 catch 블록에서도 처리되므로 여기서는 로그만 남김
    }
  } catch (error: any) {
    timeoutCleared = true;
    clearTimeout(timeout);
    const totalTime = Date.now() - startTime;
    console.error(`Error in serverless handler (after ${totalTime}ms):`, error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      name: error.name,
    });
    
    // 에러 발생 시에도 반드시 JSON 응답 전송
    if (!res.headersSent && !res.finished) {
      res.status(500).json({ 
        message: "Internal server error", 
        error: process.env.NODE_ENV === "development" ? error.message : undefined 
      });
    }
  } finally {
    // Vercel 서버리스 환경에서는 요청 완료 후 반드시 데이터베이스 연결 풀 정리
    // finally 블록에서 실행하여 성공/실패 여부와 관계없이 항상 실행되도록 함
    // 모든 비동기 작업(handlerPromise 포함)이 완료된 후 실행
    if (process.env.VERCEL && process.env.NODE_ENV === "production") {
      try {
        const { resetPool } = await import("../server/db.js");
        // resetPool은 이제 async 함수이므로 await 사용
        await resetPool();
        console.log("Database pool reset in finally block (Vercel)");
      } catch (err) {
        // 연결 풀 정리 실패는 로그만 남기고 무시
        console.warn("Failed to reset pool in finally:", err);
      }
      
      // 응답이 전송되지 않았다면 에러 응답 전송 (빈 응답 방지)
      if (!res.headersSent && !res.finished) {
        console.error("Response not sent, sending error response");
        try {
          res.status(500).json({ 
            message: "Internal server error: no response sent",
            error: "The server failed to send a response"
          });
        } catch (err) {
          // 응답 전송 실패는 로그만 남김
          console.error("Failed to send error response:", err);
        }
      }
      
      // 함수 종료를 명시적으로 처리
      // Vercel 서버리스 함수는 이 시점에서 종료되어야 함
      console.log("Request handler completed, function should exit now");
    }
  }
}

