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
  if (appInitialized && handler) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await registerRoutes(httpServer, app);

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
      console.log("App initialized successfully");
    } catch (error: any) {
      console.error("Error initializing app:", error);
      throw error;
    }
  })();

  return initPromise;
}

// Vercel 서버리스 함수 핸들러
export default async function (req: any, res: any) {
  // 타임아웃 설정: 25초 (Vercel의 기본 타임아웃은 10초이지만, 프로 계정은 더 길 수 있음)
  const timeout = setTimeout(() => {
    console.error("Request timeout - taking too long to initialize");
    if (!res.headersSent) {
      res.status(504).json({ message: "Gateway timeout" });
    }
  }, 25000);

  try {
    await initializeApp();
    clearTimeout(timeout);
    
    if (!handler) {
      console.error("Handler not initialized");
      return res.status(500).json({ message: "Handler not initialized" });
    }
    return handler(req, res);
  } catch (error: any) {
    clearTimeout(timeout);
    console.error("Error in serverless handler:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({ 
      message: "Internal server error", 
      error: process.env.NODE_ENV === "development" ? error.message : undefined 
    });
  }
}

