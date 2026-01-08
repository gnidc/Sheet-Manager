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
      handler = serverless(app, {
        binary: ["image/*", "application/pdf"],
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
  
  // Vercel의 타임아웃은 10초 (Hobby), 60초 (Pro)이지만 안전하게 8초로 설정
  // 초기화와 첫 요청이 빠르게 완료되어야 함
  const TIMEOUT_MS = 8000;
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
    
    // serverless-http handler는 Promise를 반환함
    // handlerPromise가 완료되면 응답도 완료된 것으로 간주
    const handlerPromise = handler(req, res);
    
    // handlerPromise가 완료될 때까지 반드시 기다림
    // 응답이 전송되기 전에 함수가 종료되지 않도록 보장
    try {
      // handlerPromise가 완료될 때까지 기다림
      // Vercel의 실제 타임아웃(10초 Hobby, 60초 Pro)보다 짧게 설정
      const handlerTimeout = 8000; // 8초 (Hobby 기준 안전 마진)
      
      // 타임아웃 Promise 생성
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Handler execution timeout"));
        }, handlerTimeout);
      });
      
      // handlerPromise가 완료되거나 타임아웃될 때까지 기다림
      await Promise.race([handlerPromise, timeoutPromise]);
      
      // handlerPromise가 완료되었지만 Express가 응답을 전송하는데 시간이 걸릴 수 있음
      // serverless-http는 Express 앱을 래핑하지만, 실제 응답 전송은 비동기로 이루어질 수 있음
      // 따라서 응답이 전송될 때까지 기다림
      let responseCheckAttempts = 0;
      const maxCheckAttempts = 100; // 최대 1초 대기 (100 * 10ms)
      
      while (!res.headersSent && !res.finished && responseCheckAttempts < maxCheckAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10));
        responseCheckAttempts++;
      }
      
      const handlerTime = Date.now() - handlerStart;
      const totalTime = Date.now() - startTime;
      
      if (totalTime > 5000) {
        console.warn(`Slow request: total ${totalTime}ms, handler ${handlerTime}ms`);
      } else {
        console.log(`Request completed - init: ${initTime}ms, handler: ${handlerTime}ms, total: ${totalTime}ms`);
      }
      
      // 응답이 전송되지 않았다면 에러 응답 전송
      // 하지만 이미 응답이 전송 중일 수 있으므로 주의
      if (!res.headersSent && !res.finished) {
        console.warn("Response not sent by handler after waiting, sending default response");
        try {
          res.status(500).json({ message: "Internal server error: response not sent" });
        } catch (err) {
          // 응답 전송 중 에러 발생 (이미 전송되었을 수 있음)
          console.warn("Failed to send error response (may already be sent):", err);
        }
      } else {
        // 응답이 전송되었음을 확인
        console.log(`Response sent successfully - headersSent: ${res.headersSent}, finished: ${res.finished}`);
      }
    } catch (timeoutError: any) {
      if (timeoutError.message === "Handler execution timeout") {
        const handlerTime = Date.now() - handlerStart;
        console.error(`Handler timeout after ${handlerTime}ms`);
        // 타임아웃 시에도 반드시 JSON 응답 전송
        if (!res.headersSent) {
          res.status(504).json({ 
            message: "Request processing timeout",
            error: "The server took too long to process your request"
          });
        }
        // 타임아웃은 에러로 처리하지 않고 로그만 남김
        // 응답은 이미 전송되었으므로 함수는 정상 종료
      } else {
        // 다른 에러는 상위 catch 블록에서 처리
        throw timeoutError;
      }
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

