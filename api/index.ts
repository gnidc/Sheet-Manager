// Vercel 서버리스 함수 - Express를 직접 사용 (serverless-http 불필요)
import { config } from "dotenv";
if (!process.env.VERCEL) {
  config();
}

import express from "express";
import cookieSession from "cookie-session";
import { registerRoutes } from "../server/routes.js";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "express" {
  interface Request {
    session: {
      isAdmin?: boolean;
      userId?: number;
      userEmail?: string;
      userName?: string;
      userPicture?: string;
    } | null;
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set("trust proxy", 1);

// cookie-session (Vercel 서버리스에 적합 - 쿠키에 세션 데이터 저장)
app.use(
  cookieSession({
    name: "session",
    keys: [process.env.SESSION_SECRET || "default-secret-change-in-production"],
    maxAge: 24 * 60 * 60 * 1000, // 기본 24시간 (rememberMe 미체크시 핸들러에서 2시간으로 변경)
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",        // 모든 경로에서 쿠키 전송
    overwrite: true,  // 매 응답마다 쿠키 갱신 (만료시간 롤링)
    signed: true,     // HMAC 서명 사용 (기본값이지만 명시)
  })
);

// ========== Fast Path: 초기화 없이 즉시 응답하는 엔드포인트 ==========
// cookie-session 미들웨어만으로 처리 가능 (DB 불필요)

// 헬스체크 (DB 미사용)
app.get("/api/ping", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), env: !!process.env.VERCEL });
});

// 인증 상태 확인 - Fast Path (서버 초기화 없이 즉시 응답)
// cookie-session이 쿠키를 읽어 req.session에 데이터를 복원하므로 DB 불필요
app.get("/api/auth/me", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  
  const response = {
    isAdmin: !!req.session?.isAdmin,
    userId: req.session?.userId || null,
    userEmail: req.session?.userEmail || null,
    userName: req.session?.userName || null,
    userPicture: req.session?.userPicture || null,
  };
  
  res.status(200).json(response);
});

// ========== 초기화 (무거운 라우트 등록) ==========
let initialized = false;
let initPromise: Promise<void> | null = null;

async function initializeApp() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const start = Date.now();
    try {
      console.log("[Init] Starting route registration...");
      await registerRoutes(httpServer, app);
      console.log(`[Init] Routes registered in ${Date.now() - start}ms`);

      // 404 핸들러 - 매칭되지 않는 라우트
      app.use((req, res) => {
        if (!res.headersSent) {
          res.status(404).json({ message: "API endpoint not found", path: req.path });
        }
      });

      // 에러 핸들러
      app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        console.error("[Error]", err.message);
        if (!res.headersSent) {
          res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
        }
      });

      initialized = true;
      console.log(`[Init] Complete in ${Date.now() - start}ms`);
    } catch (error: any) {
      console.error("[Init] FAILED:", error.message);
      initPromise = null; // 다음 요청에서 재시도 가능
      throw error;
    }
  })();

  return initPromise;
}

// Vercel 서버리스 핸들러
export default async function handler(req: any, res: any) {
  try {
    await initializeApp();
  } catch (error: any) {
    console.error("[Handler] Init failed:", error.message);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Server initialization failed", error: error.message }));
    return;
  }

  // Express에 직접 전달 (serverless-http 불필요)
  return app(req, res);
}
