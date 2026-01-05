// Vercel 서버리스 함수용 Express 앱 래퍼
import { config } from "dotenv";
config(); // Load .env file

import express from "express";
import session from "express-session";
import { registerRoutes } from "../server/routes";
import { serveStatic } from "../server/static";
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
    store: new (require("memorystore"))(session)({
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

    // serverless-http로 래핑
    handler = serverless(app, {
      binary: ["image/*", "application/pdf"],
    });

    appInitialized = true;
  })();

  return initPromise;
}

// Vercel 서버리스 함수 핸들러
export default async function (req: any, res: any) {
  await initializeApp();
  if (!handler) {
    throw new Error("Handler not initialized");
  }
  return handler(req, res);
}

