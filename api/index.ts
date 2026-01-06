// Vercel 서버리스 함수용 Express 앱 래퍼
import { config } from "dotenv";
config(); // Load .env file

import express from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import { registerRoutes } from "../server/routes.js";
import { serveStatic } from "../server/static.js";
import { createServer } from "http";
import serverless from "serverless-http";

const app = express();
const httpServer = createServer(app);

declare module "express-session" {
  interface SessionData {
    isAdmin?: boolean;
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set("trust proxy", 1);

// Vercel에서는 메모리 스토어 사용 (서버리스 환경)
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
    store: new (MemoryStore(session))({
      checkPeriod: 86400000, // 24 hours
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

      app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        console.error("Express error:", err);
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
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
  const TIMEOUT_MS = 8000;
  const timeout = setTimeout(() => {
    console.error(`Request timeout after ${TIMEOUT_MS}ms - taking too long to initialize`);
    if (!res.headersSent) {
      res.status(504).json({ message: "Gateway timeout" });
    }
  }, TIMEOUT_MS);

  try {
    // 초기화 시작
    const initStart = Date.now();
    await initializeApp();
    const initTime = Date.now() - initStart;
    console.log(`App initialization took ${initTime}ms`);
    
    clearTimeout(timeout);
    
    if (!handler) {
      console.error("Handler not initialized");
      return res.status(500).json({ message: "Handler not initialized" });
    }
    
    // handler 실행
    const handlerStart = Date.now();
    const result = await handler(req, res);
    const handlerTime = Date.now() - handlerStart;
    const totalTime = Date.now() - startTime;
    
    console.log(`Request completed - init: ${initTime}ms, handler: ${handlerTime}ms, total: ${totalTime}ms`);
    
    return result;
  } catch (error: any) {
    clearTimeout(timeout);
    const totalTime = Date.now() - startTime;
    console.error(`Error in serverless handler (after ${totalTime}ms):`, error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({ 
      message: "Internal server error", 
      error: process.env.NODE_ENV === "development" ? error.message : undefined 
    });
  }
}

