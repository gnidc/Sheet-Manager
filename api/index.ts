// Vercel 서버리스 함수용 Express 앱 래퍼
import { config } from "dotenv";
config(); // Load .env file

import express from "express";
import session from "express-session";
import { registerRoutes } from "../server/routes";
import { serveStatic } from "../server/static";
import { createServer } from "http";
import type { VercelRequest, VercelResponse } from "@vercel/node";

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
    store: new (require("memorystore"))(session)({
      checkPeriod: 86400000, // 24 hours
    }),
  })
);

// Express 앱 초기화 (비동기)
let appInitialized = false;
let initPromise: Promise<void> | null = null;

async function initializeApp() {
  if (appInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await registerRoutes(httpServer, app);

    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    // 프로덕션에서는 정적 파일 서빙
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    }

    appInitialized = true;
  })();

  return initPromise;
}

// Vercel 서버리스 함수 핸들러
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initializeApp();
  
  // Vercel Request/Response를 Express Request/Response로 변환
  return new Promise((resolve) => {
    app(req as any, res as any, () => {
      resolve(undefined);
    });
  });
}

