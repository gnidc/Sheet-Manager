import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage.js";

import { z } from "zod";
import axios from "axios";
import bcrypt from "bcryptjs";
import * as kisApi from "./kisApi.js";
import * as cheerio from "cheerio";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

// 관리자 권한을 가진 Google 이메일 목록
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "kwonjs77@gmail.com").split(",").map(e => e.trim().toLowerCase());

// AI API: Gemini 네이티브 REST API 또는 OpenAI
interface UserAiKeyOption {
  provider?: string;     // "gemini" | "openai"
  geminiApiKey?: string;
  openaiApiKey?: string;
}

async function callAI(prompt: string, userKey?: UserAiKeyOption): Promise<string> {
  // 사용자 키가 있으면 우선 사용, 없으면 서버 기본 키 사용
  let geminiKey: string | undefined;
  let openaiKey: string | undefined;

  if (userKey) {
    if (userKey.provider === "openai" && userKey.openaiApiKey) {
      openaiKey = userKey.openaiApiKey;
    } else if (userKey.geminiApiKey) {
      geminiKey = userKey.geminiApiKey;
    } else if (userKey.openaiApiKey) {
      openaiKey = userKey.openaiApiKey;
    }
  }

  // 사용자 키가 없으면 서버 기본 키 사용
  if (!geminiKey && !openaiKey) {
    geminiKey = process.env.GEMINI_API_KEY;
    openaiKey = process.env.OPENAI_API_KEY;
  }

  if (geminiKey) {
    // Gemini 네이티브 REST API 사용 (자동 재시도 포함)
    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await axios.post(url, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192 },
        }, { timeout: 90000 });
        
        // gemini-2.5-flash는 thinking 파트와 text 파트를 분리하여 반환할 수 있음
        const parts = res.data?.candidates?.[0]?.content?.parts || [];
        const content = parts.filter((p: any) => p.text && !p.thought).map((p: any) => p.text).join("\n") 
          || parts.map((p: any) => p.text).filter(Boolean).pop();
        if (!content) throw new Error("AI 응답이 비어있습니다.");
        return content;
      } catch (err: any) {
        if (err.response?.status === 429 && attempt < maxRetries) {
          const retryInfo = err.response?.data?.error?.details?.find((d: any) => d.retryDelay);
          const delaySec = parseInt(retryInfo?.retryDelay) || 10;
          console.log(`[AI] Rate limited, retrying in ${delaySec}s (attempt ${attempt}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, delaySec * 1000));
          continue;
        }
        if (err.response?.status === 429) {
          throw new Error("Gemini API 할당량 초과. 잠시 후 다시 시도하세요.");
        }
        // API 키가 잘못된 경우 명확한 에러 메시지
        if (err.response?.status === 400 || err.response?.status === 403) {
          throw new Error("AI API 키가 유효하지 않습니다. 키를 확인해주세요.");
        }
        throw err;
      }
    }
    throw new Error("AI API 최대 재시도 횟수 초과");
  }
  
  if (openaiKey) {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: openaiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.7,
    });
    return completion.choices[0]?.message?.content || "분석 생성에 실패했습니다.";
  }

  throw new Error("AI API 키가 설정되지 않았습니다. 설정에서 Gemini 또는 OpenAI API 키를 등록해주세요.");
}

// 환경 변수 확인 (디버깅)
if (process.env.VERCEL) {
  console.log("=== Vercel 환경 변수 확인 ===");
  console.log("ADMIN_USERNAME exists:", !!ADMIN_USERNAME);
  console.log("ADMIN_PASSWORD_HASH exists:", !!ADMIN_PASSWORD_HASH);
  console.log("SESSION_SECRET exists:", !!process.env.SESSION_SECRET);
  console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);
  console.log("GOOGLE_CLIENT_ID exists:", !!GOOGLE_CLIENT_ID);
  console.log("NODE_ENV:", process.env.NODE_ENV);
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.isAdmin) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// 로그인한 사용자 (Google 유저 또는 Admin) 필요
function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId && !req.session?.isAdmin) {
    return res.status(401).json({ message: "로그인이 필요합니다" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // 헬스체크 엔드포인트 (가벼운 DB 연결 확인만)
  app.get("/api/health", async (req, res) => {
    try {
      const dbStart = Date.now();
      // 매우 가벼운 쿼리로 연결만 확인 (LIMIT 1 사용)
      const { db } = await import("./db.js");
      const { sql } = await import("drizzle-orm");
      // 단순히 연결 테스트만 수행
      await db.execute(sql`SELECT 1 as test`);
      const dbTime = Date.now() - dbStart;
      
      res.json({
        status: "ok",
        database: "connected",
        dbQueryTime: `${dbTime}ms`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Health check failed:", error);
      res.status(503).json({
        status: "error",
        database: "disconnected",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password, rememberMe } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }
    
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
      console.log("Admin credentials check - USERNAME exists:", !!ADMIN_USERNAME, "HASH exists:", !!ADMIN_PASSWORD_HASH);
      return res.status(503).json({ message: "Admin credentials not configured" });
    }
    
    console.log("Login attempt - input username:", username, "expected:", ADMIN_USERNAME, "match:", username === ADMIN_USERNAME);
    
    if (username !== ADMIN_USERNAME) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    const isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    console.log("Password check - isValid:", isValid);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    req.session.isAdmin = true;

    // "로그인 유지" 체크 시 쿠키 만료를 24시간으로 설정
    const REMEMBER_MAX_AGE = 24 * 60 * 60 * 1000; // 24시간
    if (rememberMe) {
      // express-session (로컬 개발)
      if (req.session.cookie) {
        req.session.cookie.maxAge = REMEMBER_MAX_AGE;
      }
      // cookie-session (Vercel)
      if ((req as any).sessionOptions) {
        (req as any).sessionOptions.maxAge = REMEMBER_MAX_AGE;
      }
    }

    console.log("Login successful, rememberMe:", !!rememberMe);
    res.json({ success: true, isAdmin: true });
  });
  
  app.post("/api/auth/logout", (req, res) => {
    // 모든 세션 정보 초기화 (admin + user)
    if (process.env.VERCEL) {
      // Vercel: cookie-session → null 할당으로 쿠키 제거
      (req as any).session = null;
      return res.json({ success: true });
    }
    // 로컬: express-session → destroy()로 세션 제거
    if (req.session?.destroy) {
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
        }
        res.clearCookie("connect.sid");
        res.json({ success: true });
      });
    } else {
      // fallback
      req.session = null as any;
      res.json({ success: true });
    }
  });
  
  app.get("/api/auth/me", (req, res) => {
    console.log("/api/auth/me - isAdmin:", req.session?.isAdmin, "userId:", req.session?.userId);
    const response = {
      isAdmin: !!req.session?.isAdmin,
      userId: req.session?.userId || null,
      userEmail: req.session?.userEmail || null,
      userName: req.session?.userName || null,
      userPicture: req.session?.userPicture || null,
    };
    res.status(200).json(response);
  });

  // Google OAuth 로그인/계정생성
  app.post("/api/auth/google", async (req, res) => {
    const { credential, accessToken, userInfo, rememberMe } = req.body;

    if (!credential && !accessToken) {
      return res.status(400).json({ message: "Google credential or accessToken is required" });
    }

    if (!GOOGLE_CLIENT_ID) {
      return res.status(503).json({ message: "Google OAuth is not configured" });
    }

    try {
      let googleId: string;
      let email: string;
      let name: string;
      let picture: string | null;

      if (credential) {
        // 방법 1: ID 토큰 검증 (One Tap / renderButton 방식)
        const verifyRes = await axios.get(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`,
          { timeout: 5000 }
        );

        const payload = verifyRes.data;

        if (payload.aud !== GOOGLE_CLIENT_ID) {
          return res.status(401).json({ message: "Invalid token audience" });
        }

        googleId = payload.sub;
        email = payload.email;
        name = payload.name || payload.email;
        picture = payload.picture || null;
      } else {
        // 방법 2: Access Token + UserInfo (OAuth2 popup 방식)
        // access_token으로 직접 userinfo를 서버에서 검증
        const verifyRes = await axios.get(
          `https://www.googleapis.com/oauth2/v3/userinfo`,
          { 
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 5000 
          }
        );

        const payload = verifyRes.data;

        googleId = payload.sub;
        email = payload.email;
        name = payload.name || payload.email;
        picture = payload.picture || null;
      }

      if (!googleId || !email) {
        return res.status(400).json({ message: "Invalid Google profile data" });
      }

      // DB에서 유저 찾기 또는 생성
      let user = await storage.getUserByGoogleId(googleId);
      if (!user) {
        user = await storage.createUser({ googleId, email, name, picture });
        console.log(`[Auth] New Google user created: ${email} (id: ${user.id})`);
      } else {
        console.log(`[Auth] Existing Google user logged in: ${email} (id: ${user.id})`);
      }

      // 세션 설정
      req.session.userId = user.id;
      req.session.userEmail = user.email;
      req.session.userName = user.name || undefined;
      req.session.userPicture = user.picture || undefined;

      // 관리자 이메일 목록에 포함된 경우 admin 권한 부여
      if (ADMIN_EMAILS.includes(email.toLowerCase())) {
        req.session.isAdmin = true;
        console.log(`[Auth] Admin privilege granted to Google user: ${email}`);
      }

      // "로그인 유지" 체크 시 쿠키 만료를 24시간으로 설정
      const REMEMBER_MAX_AGE = 24 * 60 * 60 * 1000;
      if (rememberMe) {
        if (req.session.cookie) {
          req.session.cookie.maxAge = REMEMBER_MAX_AGE;
        }
        if ((req as any).sessionOptions) {
          (req as any).sessionOptions.maxAge = REMEMBER_MAX_AGE;
        }
      }

      const isAdminUser = ADMIN_EMAILS.includes(email.toLowerCase());
      res.json({
        success: true,
        isAdmin: isAdminUser,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
      });
    } catch (err: any) {
      console.error("[Auth] Google OAuth error:", err.message);
      res.status(401).json({ message: "Google 인증에 실패했습니다" });
    }
  });
  // ETF CRUD 라우트 제거됨 (Tracked ETFs 삭제)

  app.get("/api/etf-trends", async (req, res) => {
    try {
      const trends = await storage.getEtfTrends();
      res.json(trends);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch ETF trends" });
    }
  });

  app.post("/api/etf-trends", requireAdmin, async (req, res) => {
    try {
      const { url, comment } = req.body;
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      let title = "";
      let thumbnail = "";
      let sourceType = "article";

      if (url.includes("youtube.com") || url.includes("youtu.be")) {
        sourceType = "youtube";
        const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
        if (videoId) {
          thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          try {
            const oembedRes = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
            title = oembedRes.data.title || "YouTube Video";
          } catch {
            title = "YouTube Video";
          }
        }
      } else if (url.includes("blog.naver.com")) {
        sourceType = "blog";
        try {
          const response = await axios.get(url, { 
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          const html = response.data as string;
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          title = titleMatch ? titleMatch[1].replace(/\s*[:|-].*$/, '').trim() : "네이버 블로그";
        } catch {
          title = "네이버 블로그 글";
        }
      } else {
        try {
          const response = await axios.get(url, { 
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          const html = response.data as string;
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          title = titleMatch ? titleMatch[1].trim() : url;
        } catch {
          title = url;
        }
      }

      const trend = await storage.createEtfTrend({
        url,
        title,
        comment: comment || "",
        thumbnail,
        sourceType,
      });

      res.status(201).json(trend);
    } catch (err) {
      console.error("Error creating ETF trend:", err);
      res.status(500).json({ message: "Failed to create ETF trend" });
    }
  });

  app.patch("/api/etf-trends/:id", requireAdmin, async (req, res) => {
    try {
      const { comment } = req.body;
      const trend = await storage.updateEtfTrend(Number(req.params.id), comment || "");
      res.json(trend);
    } catch (err) {
      res.status(500).json({ message: "Failed to update ETF trend" });
    }
  });

  app.delete("/api/etf-trends/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteEtfTrend(Number(req.params.id));
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete ETF trend" });
    }
  });

  // seed/export/import 라우트 제거됨 (Tracked ETFs 삭제)

  // ========== KIS 자동매매 API ==========

  // 헬퍼: 현재 세션의 사용자 인증정보를 가져오는 함수
  // admin이면 env 기반 (null 반환), 일반 유저면 DB에서 조회
  async function getUserCredentials(req: Request): Promise<{ userId: number; creds: kisApi.UserKisCredentials } | null> {
    if (req.session?.isAdmin) {
      return null; // admin은 기존 env 기반 사용
    }
    const userId = req.session?.userId;
    if (!userId) return null;

    const config = await storage.getUserTradingConfig(userId);
    if (!config) return null;

    return {
      userId,
      creds: {
        appKey: config.appKey,
        appSecret: config.appSecret,
        accountNo: config.accountNo,
        accountProductCd: config.accountProductCd || "01",
        mockTrading: config.mockTrading ?? true,
      },
    };
  }

  // 헬퍼: userId로 직접 인증정보를 가져오는 함수 (손절 감시 등 백그라운드 작업용)
  async function getUserCredentialsById(userId: number): Promise<{ userId: number; creds: kisApi.UserKisCredentials } | null> {
    const config = await storage.getUserTradingConfig(userId);
    if (!config) return null;
    return {
      userId,
      creds: {
        appKey: config.appKey,
        appSecret: config.appSecret,
        accountNo: config.accountNo,
        accountProductCd: config.accountProductCd || "01",
        mockTrading: config.mockTrading ?? true,
      },
    };
  }

  // ---- 사용자 KIS 인증정보 관리 ----

  // 인증정보 조회 (마스킹됨)
  app.get("/api/trading/config", requireUser, async (req, res) => {
    try {
      // admin은 env 기반 사용
      if (req.session?.isAdmin) {
        const st = kisApi.getTradingStatus();
        return res.json({
          configured: st.tradingConfigured,
          isAdmin: true,
          accountNo: st.accountNo,
          mockTrading: st.mockTrading,
        });
      }

      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ message: "로그인이 필요합니다" });

      const config = await storage.getUserTradingConfig(userId);
      if (!config) {
        return res.json({ configured: false });
      }

      res.json({
        configured: true,
        appKey: config.appKey.slice(0, 6) + "****",
        accountNo: config.accountNo.slice(0, 4) + "****",
        accountProductCd: config.accountProductCd,
        mockTrading: config.mockTrading,
        updatedAt: config.updatedAt,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "설정 조회 실패" });
    }
  });

  // 인증정보 등록/수정
  app.post("/api/trading/config", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(400).json({ message: "Google 계정으로 로그인한 사용자만 개별 설정이 가능합니다" });
      }

      const { appKey, appSecret, accountNo, accountProductCd, mockTrading } = req.body;

      if (!appKey || !appSecret || !accountNo) {
        return res.status(400).json({ message: "앱 키, 앱 시크릿, 계좌번호는 필수입니다" });
      }

      const creds: kisApi.UserKisCredentials = {
        appKey,
        appSecret,
        accountNo,
        accountProductCd: accountProductCd || "01",
        mockTrading: mockTrading ?? true,
      };

      // 인증 검증
      const validation = await kisApi.validateUserCredentials(userId, creds);
      if (!validation.success) {
        return res.status(400).json({ message: `인증 실패: ${validation.message}` });
      }

      // DB에 저장
      const config = await storage.upsertUserTradingConfig({
        userId,
        appKey,
        appSecret,
        accountNo,
        accountProductCd: accountProductCd || "01",
        mockTrading: mockTrading ?? true,
      });

      res.json({
        success: true,
        message: "KIS API 설정이 저장되었습니다",
        config: {
          configured: true,
          appKey: config.appKey.slice(0, 6) + "****",
          accountNo: config.accountNo.slice(0, 4) + "****",
          mockTrading: config.mockTrading,
        },
      });
    } catch (error: any) {
      console.error("Failed to save trading config:", error);
      res.status(500).json({ message: error.message || "설정 저장 실패" });
    }
  });

  // 인증정보 삭제
  app.delete("/api/trading/config", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(400).json({ message: "권한 없음" });

      await storage.deleteUserTradingConfig(userId);
      kisApi.clearUserTokenCache(userId);
      res.json({ success: true, message: "KIS API 설정이 삭제되었습니다" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "설정 삭제 실패" });
    }
  });

  // KIS API 연결 상태
  app.get("/api/trading/status", requireUser, async (req, res) => {
    try {
      const userCreds = await getUserCredentials(req);
      if (userCreds) {
        const status = kisApi.getUserTradingStatus(userCreds.creds);
        return res.json(status);
      }
      // admin 또는 인증정보 없는 유저 → env 기반 상태
      const status = kisApi.getTradingStatus();
      
      // 일반 유저이면서 config 없는 경우 unconfigured로 표시
      if (!req.session?.isAdmin && req.session?.userId) {
        const config = await storage.getUserTradingConfig(req.session.userId);
        if (!config) {
          return res.json({ configured: false, tradingConfigured: false, mockTrading: false, accountNo: "", accountProductCd: "01", needsSetup: true });
        }
      }
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "상태 조회 실패" });
    }
  });

  // 계좌 잔고 조회
  app.get("/api/trading/balance", requireUser, async (req, res) => {
    try {
      const userCreds = await getUserCredentials(req);
      if (userCreds) {
        const balance = await kisApi.getUserAccountBalance(userCreds.userId, userCreds.creds);
        return res.json(balance);
      }
      const balance = await kisApi.getAccountBalance();
      res.json(balance);
    } catch (error: any) {
      console.error("Failed to get balance:", error);
      res.status(500).json({ message: error.message || "잔고 조회 실패" });
    }
  });

  // 현재가 조회
  app.get("/api/trading/price/:stockCode", requireUser, async (req, res) => {
    try {
      const priceData = await kisApi.getCurrentPrice(req.params.stockCode);
      if (!priceData) {
        return res.status(404).json({ message: "가격 정보를 찾을 수 없습니다" });
      }
      res.json(priceData);
    } catch (error: any) {
      console.error("Failed to get price:", error);
      res.status(500).json({ message: error.message || "가격 조회 실패" });
    }
  });

  // 호가 조회
  app.get("/api/trading/asking-price/:stockCode", requireUser, async (req, res) => {
    try {
      const askingPrice = await kisApi.getAskingPrice(req.params.stockCode);
      if (!askingPrice) {
        return res.status(404).json({ message: "호가 정보를 찾을 수 없습니다" });
      }
      res.json(askingPrice);
    } catch (error: any) {
      console.error("Failed to get asking price:", error);
      res.status(500).json({ message: error.message || "호가 조회 실패" });
    }
  });

  // 일봉 차트 데이터 조회
  app.get("/api/trading/daily-chart/:stockCode", requireUser, async (req, res) => {
    try {
      const period = (req.query.period as string) || "3M";
      const validPeriods = ["1M", "3M", "6M", "1Y"];
      if (!validPeriods.includes(period)) {
        return res.status(400).json({ message: "유효하지 않은 기간입니다 (1M, 3M, 6M, 1Y)" });
      }
      const prices = await kisApi.getStockDailyPrices(req.params.stockCode, period as any);
      res.json(prices);
    } catch (error: any) {
      console.error("Failed to get daily chart:", error);
      res.status(500).json({ message: error.message || "차트 데이터 조회 실패" });
    }
  });

  // 매매 주문
  app.post("/api/trading/order", requireUser, async (req, res) => {
    try {
      const { stockCode, stockName, orderType, quantity, price, orderMethod } = req.body;
      
      if (!stockCode || !orderType || !quantity) {
        return res.status(400).json({ message: "종목코드, 주문유형, 수량은 필수입니다" });
      }
      
      if (!["buy", "sell"].includes(orderType)) {
        return res.status(400).json({ message: "주문유형은 buy 또는 sell이어야 합니다" });
      }
      
      // 사용자별 인증정보 분기
      const userCreds = await getUserCredentials(req);
      let result;
      if (userCreds) {
        result = await kisApi.userPlaceOrder(userCreds.userId, userCreds.creds, {
          stockCode,
          orderType,
          quantity: Number(quantity),
          price: price ? Number(price) : undefined,
          orderMethod: orderMethod || "limit",
        });
      } else {
        result = await kisApi.placeOrder({
          stockCode,
          orderType,
          quantity: Number(quantity),
          price: price ? Number(price) : undefined,
          orderMethod: orderMethod || "limit",
        });
      }
      
      // 주문 결과를 DB에 기록
      const userId = req.session?.userId || null;
      const order = await storage.createTradingOrder({
        stockCode,
        stockName: stockName || stockCode,
        orderType,
        orderMethod: orderMethod || "limit",
        quantity: Number(quantity),
        price: price ? String(price) : null,
        totalAmount: result.success && price ? String(Number(price) * Number(quantity)) : null,
        status: result.success ? "filled" : "failed",
        kisOrderNo: result.orderNo || null,
        errorMessage: result.success ? null : result.message,
        executedAt: result.success ? new Date() : null,
        userId,
      });
      
      res.json({ ...result, order });
    } catch (error: any) {
      console.error("Failed to place order:", error);
      res.status(500).json({ message: error.message || "주문 실패" });
    }
  });

  // KIS 주문 체결 내역 조회
  app.get("/api/trading/kis-orders", requireUser, async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      
      const userCreds = await getUserCredentials(req);
      if (userCreds) {
        const history = await kisApi.getUserOrderHistory(userCreds.userId, userCreds.creds, startDate, endDate);
        return res.json(history);
      }
      const history = await kisApi.getOrderHistory(startDate, endDate);
      res.json(history);
    } catch (error: any) {
      console.error("Failed to get order history:", error);
      res.status(500).json({ message: error.message || "주문내역 조회 실패" });
    }
  });

  // DB 주문 기록 조회
  app.get("/api/trading/orders", requireUser, async (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const userId = req.session?.userId || undefined;
      const orders = await storage.getTradingOrders(limit, userId);
      res.json(orders);
    } catch (error: any) {
      console.error("Failed to get trading orders:", error);
      res.status(500).json({ message: error.message || "주문 기록 조회 실패" });
    }
  });

  // 자동매매 규칙 목록
  app.get("/api/trading/rules", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId || undefined;
      const rules = await storage.getAutoTradeRules(userId);
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "규칙 조회 실패" });
    }
  });

  // 자동매매 규칙 추가
  app.post("/api/trading/rules", requireUser, async (req, res) => {
    try {
      const { name, stockCode, stockName, ruleType, targetPrice, quantity, orderMethod } = req.body;
      
      if (!name || !stockCode || !stockName || !ruleType || !targetPrice || !quantity) {
        return res.status(400).json({ message: "필수 필드가 누락되었습니다" });
      }
      
      if (!["buy_below", "sell_above", "trailing_stop"].includes(ruleType)) {
        return res.status(400).json({ message: "유효하지 않은 규칙 유형입니다" });
      }

      const userId = req.session?.userId || null;
      const rule = await storage.createAutoTradeRule({
        name,
        stockCode,
        stockName,
        ruleType,
        targetPrice: String(targetPrice),
        quantity: Number(quantity),
        orderMethod: orderMethod || "limit",
        isActive: true,
        status: "active",
        userId,
      });
      
      res.status(201).json(rule);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "규칙 추가 실패" });
    }
  });

  // 자동매매 규칙 수정
  app.put("/api/trading/rules/:id", requireUser, async (req, res) => {
    try {
      const rule = await storage.updateAutoTradeRule(Number(req.params.id), req.body);
      res.json(rule);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "규칙 수정 실패" });
    }
  });

  // 자동매매 규칙 삭제
  app.delete("/api/trading/rules/:id", requireUser, async (req, res) => {
    try {
      await storage.deleteAutoTradeRule(Number(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message || "규칙 삭제 실패" });
    }
  });

  // 자동매매 규칙 활성화/비활성화 토글
  app.post("/api/trading/rules/:id/toggle", requireUser, async (req, res) => {
    try {
      const rule = await storage.getAutoTradeRule(Number(req.params.id));
      if (!rule) {
        return res.status(404).json({ message: "규칙을 찾을 수 없습니다" });
      }
      const updated = await storage.updateAutoTradeRule(rule.id, {
        isActive: !rule.isActive,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "규칙 토글 실패" });
    }
  });

  // 자동매매 규칙 실행 (수동 트리거 또는 cron)
  app.post("/api/trading/execute-rules", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId || undefined;
      const activeRules = await storage.getActiveAutoTradeRules(userId);
      
      if (activeRules.length === 0) {
        return res.json({ message: "활성화된 규칙이 없습니다", executed: 0 });
      }

      // 사용자별 인증정보 분기
      const userCreds = await getUserCredentials(req);
      
      const results: Array<{ ruleId: number; ruleName: string; action: string; result: string }> = [];
      
      for (const rule of activeRules) {
        try {
          // 현재가 조회
          const priceData = await kisApi.getCurrentPrice(rule.stockCode);
          if (!priceData) {
            results.push({ ruleId: rule.id, ruleName: rule.name, action: "skip", result: "가격 조회 실패" });
            continue;
          }
          
          const currentPrice = parseInt(priceData.price);
          const targetPrice = parseFloat(rule.targetPrice);
          let shouldExecute = false;
          let orderType: "buy" | "sell" = "buy";
          
          if (rule.ruleType === "buy_below" && currentPrice <= targetPrice) {
            shouldExecute = true;
            orderType = "buy";
          } else if (rule.ruleType === "sell_above" && currentPrice >= targetPrice) {
            shouldExecute = true;
            orderType = "sell";
          }
          
          if (shouldExecute) {
            let orderResult;
            if (userCreds) {
              orderResult = await kisApi.userPlaceOrder(userCreds.userId, userCreds.creds, {
                stockCode: rule.stockCode,
                orderType,
                quantity: rule.quantity,
                price: currentPrice,
                orderMethod: (rule.orderMethod as "market" | "limit") || "limit",
              });
            } else {
              orderResult = await kisApi.placeOrder({
                stockCode: rule.stockCode,
                orderType,
                quantity: rule.quantity,
                price: currentPrice,
                orderMethod: (rule.orderMethod as "market" | "limit") || "limit",
              });
            }
            
            // 주문 기록 저장
            await storage.createTradingOrder({
              stockCode: rule.stockCode,
              stockName: rule.stockName,
              orderType,
              orderMethod: rule.orderMethod || "limit",
              quantity: rule.quantity,
              price: String(currentPrice),
              totalAmount: String(currentPrice * rule.quantity),
              status: orderResult.success ? "filled" : "failed",
              kisOrderNo: orderResult.orderNo || null,
              autoTradeRuleId: rule.id,
              errorMessage: orderResult.success ? null : orderResult.message,
              executedAt: orderResult.success ? new Date() : null,
              userId: userId || null,
            });
            
            // 규칙 상태 업데이트
            if (orderResult.success) {
              await storage.updateAutoTradeRule(rule.id, {
                status: "executed",
                isActive: false,
                executedAt: new Date(),
              });
            }
            
            results.push({
              ruleId: rule.id,
              ruleName: rule.name,
              action: `${orderType} ${rule.quantity}주 @ ${currentPrice}원`,
              result: orderResult.success ? "성공" : `실패: ${orderResult.message}`,
            });
          } else {
            results.push({
              ruleId: rule.id,
              ruleName: rule.name,
              action: "대기",
              result: `현재가 ${currentPrice}원 (목표: ${targetPrice}원)`,
            });
          }
          
          // API Rate Limit 방지
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (ruleError: any) {
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            action: "오류",
            result: ruleError.message || "실행 중 오류",
          });
        }
      }
      
      res.json({ executed: results.filter(r => r.action !== "대기" && r.action !== "skip").length, results });
    } catch (error: any) {
      console.error("Failed to execute auto-trade rules:", error);
      res.status(500).json({ message: error.message || "자동매매 실행 실패" });
    }
  });

  // ========== 시가급등 추세추종 전략 ==========
  const gapStrategyModule = await import("./gapStrategy.js");

  // 전략 설정 조회
  app.get("/api/trading/gap-strategy", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(400).json({ message: "로그인 필요" });
      const strategy = await storage.getGapStrategy(userId);
      res.json(strategy || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "전략 조회 실패" });
    }
  });

  // 전략 설정 저장/수정
  app.post("/api/trading/gap-strategy", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(400).json({ message: "로그인 필요" });
      const data = { ...req.body, userId };
      const strategy = await storage.upsertGapStrategy(data);
      res.json(strategy);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "전략 저장 실패" });
    }
  });

  // 전략 활성화/비활성화 토글
  app.post("/api/trading/gap-strategy/toggle", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(400).json({ message: "로그인 필요" });
      const strategy = await storage.getGapStrategy(userId);
      if (!strategy) return res.status(404).json({ message: "전략 설정이 없습니다" });
      const updated = await storage.updateGapStrategy(strategy.id, { isActive: !strategy.isActive } as any);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "전략 토글 실패" });
    }
  });

  // 포지션 목록 조회
  app.get("/api/trading/gap-strategy/positions", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(400).json({ message: "로그인 필요" });
      const strategy = await storage.getGapStrategy(userId);
      if (!strategy) return res.json([]);
      const filter = req.query.filter as string;
      if (filter === "active") {
        res.json(await storage.getActiveGapPositions(strategy.id));
      } else {
        res.json(await storage.getGapPositions(strategy.id));
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message || "포지션 조회 실패" });
    }
  });

  // 실행 로그 조회
  app.get("/api/trading/gap-strategy/logs", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(400).json({ message: "로그인 필요" });
      const strategy = await storage.getGapStrategy(userId);
      if (!strategy) return res.json([]);
      const limit = parseInt(req.query.limit as string) || 50;
      res.json(await storage.getGapLogs(strategy.id, limit));
    } catch (error: any) {
      res.status(500).json({ message: error.message || "로그 조회 실패" });
    }
  });

  // 수동 실행 (테스트용)
  app.post("/api/trading/gap-strategy/execute", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(400).json({ message: "로그인 필요" });
      const { phase } = req.body; // 'scan' | 'gap' | 'buy' | 'sell' | 'auto'
      if (phase === "auto") {
        const result = await gapStrategyModule.executeGapStrategy(userId);
        return res.json(result);
      }
      if (!["scan", "gap", "buy", "sell"].includes(phase)) {
        return res.status(400).json({ message: "유효하지 않은 실행 단계입니다 (scan/gap/buy/sell/auto)" });
      }
      const result = await gapStrategyModule.executePhase(userId, phase);
      res.json(result);
    } catch (error: any) {
      console.error("[GapStrategy] Execute error:", error);
      res.status(500).json({ message: error.message || "전략 실행 실패" });
    }
  });

  // 포지션 수동 청산
  app.post("/api/trading/gap-strategy/positions/:id/close", requireUser, async (req, res) => {
    try {
      const posId = Number(req.params.id);
      const pos = await storage.getGapPosition(posId);
      if (!pos) return res.status(404).json({ message: "포지션을 찾을 수 없습니다" });
      const updated = await storage.updateGapPosition(posId, {
        status: "closed",
        closedAt: new Date(),
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "포지션 청산 실패" });
    }
  });

  // 시가급등 전략 자동 스케줄러 (3분 간격)
  setInterval(async () => {
    try {
      const now = new Date();
      const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const day = kst.getDay();
      // 주말 제외
      if (day === 0 || day === 6) return;
      const hour = kst.getHours();
      const minute = kst.getMinutes();
      const timeCode = hour * 100 + minute;
      // 08:50 ~ 15:30 사이에만 실행
      if (timeCode < 850 || timeCode > 1530) return;

      const activeStrategies = await storage.getAllActiveGapStrategies();
      for (const strategy of activeStrategies) {
        try {
          await gapStrategyModule.executeGapStrategy(strategy.userId);
        } catch (e: any) {
          console.error(`[GapScheduler] User ${strategy.userId} 실행 오류:`, e.message);
        }
      }
    } catch (e: any) {
      console.error("[GapScheduler] 스케줄러 오류:", e.message);
    }
  }, 3 * 60 * 1000); // 3분 간격

  // ========== 손절/트레일링 스탑 감시 ==========

  // 손절 감시 목록 조회
  app.get("/api/trading/stop-loss", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId || undefined;
      const orders = await storage.getStopLossOrders(userId);
      res.json(orders);
    } catch (error: any) {
      console.error("Failed to get stop-loss orders:", error);
      res.status(500).json({ message: error.message || "손절 감시 조회 실패" });
    }
  });

  // 손절 감시 등록
  app.post("/api/trading/stop-loss", requireUser, async (req, res) => {
    try {
      const { stockCode, stockName, buyPrice, quantity, stopLossPercent, stopType } = req.body;

      if (!stockCode || !buyPrice || !quantity || !stopLossPercent) {
        return res.status(400).json({ message: "종목코드, 매수가, 수량, 손절비율은 필수입니다" });
      }

      if (!["simple", "trailing"].includes(stopType || "simple")) {
        return res.status(400).json({ message: "손절 유형은 simple 또는 trailing이어야 합니다" });
      }

      const bPrice = Number(buyPrice);
      const slPercent = Number(stopLossPercent);
      // 손절가 = 매수가 * (1 - 손절비율/100)
      const stopPrice = Math.floor(bPrice * (1 - slPercent / 100));

      const userId = req.session?.userId || null;
      const order = await storage.createStopLossOrder({
        userId,
        stockCode,
        stockName: stockName || stockCode,
        buyPrice: String(bPrice),
        quantity: Number(quantity),
        stopLossPercent: String(slPercent),
        stopType: stopType || "simple",
        stopPrice: String(stopPrice),
        highestPrice: stopType === "trailing" ? String(bPrice) : null,
        status: "active",
      });

      console.log(`[StopLoss] Created: ${stockName || stockCode} buyPrice=${bPrice} stopPrice=${stopPrice} type=${stopType || "simple"} percent=${slPercent}%`);
      res.status(201).json(order);
    } catch (error: any) {
      console.error("Failed to create stop-loss order:", error);
      res.status(500).json({ message: error.message || "손절 감시 등록 실패" });
    }
  });

  // 손절 감시 취소
  app.delete("/api/trading/stop-loss/:id", requireUser, async (req, res) => {
    try {
      await storage.cancelStopLossOrder(Number(req.params.id));
      console.log(`[StopLoss] Cancelled: id=${req.params.id}`);
      res.status(204).send();
    } catch (error: any) {
      console.error("Failed to cancel stop-loss order:", error);
      res.status(500).json({ message: error.message || "손절 감시 취소 실패" });
    }
  });

  // 손절 감시 수동 실행 (체크) - 네이버 bulk API 사용
  app.post("/api/trading/stop-loss/check", requireUser, async (req, res) => {
    try {
      const activeOrders = await storage.getActiveStopLossOrders();
      if (activeOrders.length === 0) {
        return res.json({ message: "활성화된 손절 감시가 없습니다", checked: 0, triggered: 0 });
      }

      // 1. 네이버 bulk API로 일괄 시세 조회
      const stockCodes = Array.from(new Set(activeOrders.map(o => o.stockCode)));
      const priceMap = await kisApi.fetchNaverBulkPrices(stockCodes);

      const results: Array<{ id: number; stockCode: string; stockName: string; currentPrice: number; stopPrice: number; action: string; result: string }> = [];
      let triggered = 0;

      for (const sl of activeOrders) {
        try {
          const priceData = priceMap.get(sl.stockCode);
          if (!priceData) {
            results.push({ id: sl.id, stockCode: sl.stockCode, stockName: sl.stockName || sl.stockCode, currentPrice: 0, stopPrice: Number(sl.stopPrice), action: "skip", result: "가격 조회 실패" });
            continue;
          }

          const currentPrice = Number(priceData.price);
          let currentStopPrice = Number(sl.stopPrice);

          // 가격 캐시 업데이트
          stopLossLatestPrices.set(sl.stockCode, {
            price: currentPrice,
            changePercent: priceData.changePercent,
            checkedAt: new Date(),
          });

          // 트레일링 스탑: 최고가 갱신 시 손절가도 갱신
          if (sl.stopType === "trailing") {
            const prevHighest = Number(sl.highestPrice || sl.buyPrice);
            if (currentPrice > prevHighest) {
              const newStopPrice = Math.floor(currentPrice * (1 - Number(sl.stopLossPercent) / 100));
              await storage.updateStopLossOrder(sl.id, {
                highestPrice: String(currentPrice),
                stopPrice: String(newStopPrice),
              });
              currentStopPrice = newStopPrice;
            }
          }

          // 손절 조건 확인: 현재가 <= 손절가
          if (currentPrice <= currentStopPrice) {
            const userCreds = sl.userId ? await getUserCredentialsById(sl.userId) : null;
            let orderResult;
            if (userCreds) {
              orderResult = await kisApi.userPlaceOrder(userCreds.userId, userCreds.creds, {
                stockCode: sl.stockCode,
                orderType: "sell",
                quantity: sl.quantity,
                orderMethod: "market",
              });
            } else {
              orderResult = await kisApi.placeOrder({
                stockCode: sl.stockCode,
                orderType: "sell",
                quantity: sl.quantity,
                orderMethod: "market",
              });
            }

            await storage.createTradingOrder({
              stockCode: sl.stockCode,
              stockName: sl.stockName || sl.stockCode,
              orderType: "sell",
              orderMethod: "market",
              quantity: sl.quantity,
              price: String(currentPrice),
              totalAmount: String(currentPrice * sl.quantity),
              status: orderResult.success ? "filled" : "failed",
              kisOrderNo: orderResult.orderNo || null,
              errorMessage: orderResult.success ? null : orderResult.message,
              executedAt: orderResult.success ? new Date() : null,
              userId: sl.userId,
            });

            await storage.updateStopLossOrder(sl.id, {
              status: orderResult.success ? "triggered" : "error",
              kisOrderNo: orderResult.orderNo || null,
              triggerPrice: String(currentPrice),
              triggeredAt: new Date(),
              errorMessage: orderResult.success ? null : orderResult.message,
            });

            triggered++;
            results.push({
              id: sl.id, stockCode: sl.stockCode, stockName: sl.stockName || sl.stockCode,
              currentPrice, stopPrice: currentStopPrice,
              action: `매도 ${sl.quantity}주 @ 시장가`,
              result: orderResult.success ? "✅ 손절 매도 성공" : `❌ 실패: ${orderResult.message}`,
            });
          } else {
            const gap = ((currentPrice - currentStopPrice) / currentStopPrice * 100).toFixed(1);
            results.push({
              id: sl.id, stockCode: sl.stockCode, stockName: sl.stockName || sl.stockCode,
              currentPrice, stopPrice: currentStopPrice,
              action: "대기",
              result: `현재가 ${currentPrice.toLocaleString()}원 (손절가까지 +${gap}%)`,
            });
          }
        } catch (checkError: any) {
          results.push({
            id: sl.id, stockCode: sl.stockCode, stockName: sl.stockName || sl.stockCode,
            currentPrice: 0, stopPrice: Number(sl.stopPrice),
            action: "오류",
            result: checkError.message || "감시 중 오류",
          });
        }
      }

      stopLossLastCheckedAt = new Date();
      res.json({ checked: activeOrders.length, triggered, results, isMarketOpen: isMarketOpen() });
    } catch (error: any) {
      console.error("Failed to check stop-loss orders:", error);
      res.status(500).json({ message: error.message || "손절 감시 체크 실패" });
    }
  });

  // ========== 즐겨찾기 (북마크) ==========
  app.get("/api/bookmarks", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId || undefined;
      const items = await storage.getBookmarks(userId);
      res.json(items);
    } catch (error: any) {
      console.error("Failed to get bookmarks:", error);
      res.status(500).json({ message: error.message || "즐겨찾기 목록 불러오기 실패" });
    }
  });

  app.post("/api/bookmarks", requireUser, async (req, res) => {
    try {
      const { title, url, sortOrder, section } = req.body;
      if (!title || !url) {
        return res.status(400).json({ message: "제목과 URL은 필수입니다." });
      }
      const userId = req.session?.userId || null;
      const bookmark = await storage.createBookmark({ title, url, sortOrder: sortOrder || 0, userId, section: section || "기본" });
      res.json(bookmark);
    } catch (error: any) {
      console.error("Failed to create bookmark:", error);
      res.status(500).json({ message: error.message || "즐겨찾기 추가 실패" });
    }
  });

  app.put("/api/bookmarks/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // 소유권 확인: 자기 북마크만 수정 가능
      const existing = await storage.getBookmarkById(id);
      if (!existing) {
        return res.status(404).json({ message: "즐겨찾기를 찾을 수 없습니다" });
      }
      const sessionUserId = req.session?.userId || null;
      if (existing.userId !== sessionUserId) {
        return res.status(403).json({ message: "다른 사용자의 즐겨찾기는 수정할 수 없습니다" });
      }
      const { title, url, sortOrder, section } = req.body;
      const updated = await storage.updateBookmark(id, { title, url, sortOrder, section });
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update bookmark:", error);
      res.status(500).json({ message: error.message || "즐겨찾기 수정 실패" });
    }
  });

  app.delete("/api/bookmarks/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // 소유권 확인: 자기 북마크만 삭제 가능
      const existing = await storage.getBookmarkById(id);
      if (!existing) {
        return res.status(404).json({ message: "즐겨찾기를 찾을 수 없습니다" });
      }
      const sessionUserId = req.session?.userId || null;
      if (existing.userId !== sessionUserId) {
        return res.status(403).json({ message: "다른 사용자의 즐겨찾기는 삭제할 수 없습니다" });
      }
      await storage.deleteBookmark(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete bookmark:", error);
      res.status(500).json({ message: error.message || "즐겨찾기 삭제 실패" });
    }
  });

  // ========== 주요뉴스 (많이 본 뉴스 - 네이버 금융 RANK) ==========
  app.get("/api/news/market", async (req, res) => {
    try {
      const newsResults: { title: string; link: string; source: string; time: string; category: string }[] = [];

      // 네이버 금융 많이 본 뉴스 (RANK)
      const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

      // 페이지 1~2를 가져옴
      for (const page of [1, 2]) {
        try {
          const rankRes = await axios.get(`https://finance.naver.com/news/news_list.naver?mode=RANK&page=${page}`, {
            headers: { "User-Agent": UA },
            timeout: 8000,
            responseType: "arraybuffer",
          });
          const html = new TextDecoder("euc-kr").decode(rankRes.data);
          const $ = cheerio.load(html);

          // 많이 본 뉴스 리스트 파싱
          $("dl dd, .realtimeNewsList li, .newsList li, .type06_headline li, .simpleNewsList li").each((_i, el) => {
            const $el = $(el);
            const $a = $el.find("a").first();
            const title = $a.text().trim();
            let link = $a.attr("href") || "";
            if (link && !link.startsWith("http")) {
              link = "https://finance.naver.com" + link;
            }
            const source = $el.find(".press, .info_press, .writing").text().trim();
            const time = $el.find(".wdate, .date").text().trim();
            if (title && title.length > 5 && link) {
              newsResults.push({ title, link, source, time, category: "주요뉴스" });
            }
          });

          // dt 안의 a도 확인 (일부 레이아웃)
          $("dl dt a").each((_i, el) => {
            const $a = $(el);
            const title = $a.text().trim();
            let link = $a.attr("href") || "";
            if (link && !link.startsWith("http")) {
              link = "https://finance.naver.com" + link;
            }
            if (title && title.length > 5 && link) {
              newsResults.push({ title, link, source: "", time: "", category: "주요뉴스" });
            }
          });
        } catch (e: any) {
          console.error(`네이버 RANK 뉴스 page ${page} 스크래핑 실패:`, e.message);
        }
      }

      // 중복 제거 (제목 기준)
      const seen = new Set<string>();
      const uniqueNews = newsResults.filter(item => {
        const key = item.title.replace(/\s+/g, "").substring(0, 30);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // 중요도 점수 부여 (키워드 기반)
      const importanceKeywords = [
        { keywords: ["금리", "기준금리", "한은", "한국은행", "미연준", "Fed", "FOMC"], score: 10 },
        { keywords: ["코스피", "코스닥", "증시", "주가", "지수"], score: 8 },
        { keywords: ["환율", "달러", "원화", "엔화", "유로"], score: 8 },
        { keywords: ["반도체", "삼성전자", "SK하이닉스", "AI", "인공지능", "엔비디아"], score: 7 },
        { keywords: ["유가", "원유", "국제유가", "WTI", "브렌트"], score: 7 },
        { keywords: ["인플레이션", "물가", "CPI", "PPI", "소비자물가"], score: 9 },
        { keywords: ["GDP", "경제성장", "성장률"], score: 9 },
        { keywords: ["실적", "영업이익", "순이익", "매출"], score: 6 },
        { keywords: ["IPO", "상장", "공모"], score: 5 },
        { keywords: ["ETF", "펀드"], score: 6 },
        { keywords: ["외국인", "기관", "순매수", "순매도"], score: 7 },
        { keywords: ["채권", "국채", "회사채"], score: 6 },
        { keywords: ["부동산", "아파트", "부동산시장"], score: 5 },
        { keywords: ["무역", "수출", "수입", "무역수지"], score: 7 },
        { keywords: ["긴급", "속보", "충격", "급등", "급락", "폭락", "폭등"], score: 10 },
      ];

      const scoredNews = uniqueNews.map((item, idx) => {
        let score = 0;
        const titleLower = item.title.toLowerCase();
        for (const group of importanceKeywords) {
          for (const kw of group.keywords) {
            if (titleLower.includes(kw.toLowerCase())) {
              score += group.score;
              break;
            }
          }
        }
        // 순서가 앞일수록 가산점 (많이 본 뉴스이므로 원래 순서도 중요)
        score += Math.max(0, 30 - idx);
        if (item.time) score += 1;
        return { ...item, score };
      });

      scoredNews.sort((a, b) => b.score - a.score);
      const top25 = scoredNews.slice(0, 25).map(({ score, ...rest }) => rest);

      res.json({
        news: top25,
        updatedAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        totalScraped: newsResults.length,
      });
    } catch (error: any) {
      console.error("Failed to fetch market news:", error);
      res.status(500).json({ message: error.message || "뉴스 가져오기 실패" });
    }
  });

  // ========== 증권사 리서치 리포트 (stock.naver.com API) ==========
  app.get("/api/news/research", async (req, res) => {
    try {
      const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

      // 두 API를 병렬로 호출
      const [popularRes, strategyRes] = await Promise.allSettled([
        // 1) 요즘 많이 보는 리포트
        axios.get("https://stock.naver.com/api/domestic/research/recent-popular", {
          headers: { "User-Agent": UA },
          timeout: 10000,
        }),
        // 2) 카테고리별 최신 리포트 > 투자전략
        axios.get("https://stock.naver.com/api/domestic/research/category", {
          params: { category: "INVEST", pageSize: 20 },
          headers: { "User-Agent": UA },
          timeout: 10000,
        }),
      ]);

      // stock.naver.com API 응답을 공통 포맷으로 변환
      const mapItem = (item: any) => ({
        title: item.title || "",
        link: (item.endUrl || "").replace("m.stock.naver.com", "stock.naver.com"),
        source: item.brokerName || "",
        date: item.writeDate || "",
        file: "", // stock.naver.com API에는 PDF 직접 링크 없음
        readCount: item.readCount || "0",
        category: item.category || item.researchCategory || "",
        analyst: item.analyst || "",
      });

      // 요즘 많이 보는 리포트 (다양한 카테고리)
      let popularItems: any[] = [];
      if (popularRes.status === "fulfilled" && popularRes.value?.data) {
        const rawPopular = Array.isArray(popularRes.value.data) ? popularRes.value.data : [];
        popularItems = rawPopular.map(mapItem);
      }

      // 투자전략 최신 리포트
      let strategyItems: any[] = [];
      if (strategyRes.status === "fulfilled" && strategyRes.value?.data) {
        const rawStrategy = strategyRes.value.data?.content || (Array.isArray(strategyRes.value.data) ? strategyRes.value.data : []);
        strategyItems = rawStrategy.map(mapItem);
      }

      res.json({
        popular: popularItems,
        strategy: strategyItems,
        // 하위 호환을 위해 전체 합쳐서 research 필드도 제공
        research: [...popularItems, ...strategyItems.filter(s => !popularItems.some(p => p.title === s.title))],
        updatedAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        total: popularItems.length + strategyItems.length,
      });
    } catch (error: any) {
      console.error("Failed to fetch research:", error);
      res.status(500).json({ message: error.message || "리서치 데이터 가져오기 실패" });
    }
  });

  // ========== 주요 리서치 저장/조회 (서버 메모리 기반, 모든 유저 공유) ==========
  let savedKeyResearch: Array<{ title: string; link: string; source: string; date: string; file: string }> = [];

  // AI 분석 보고서는 DB(ai_reports 테이블)에 저장

  // 주요 리서치 조회 (모든 유저)
  app.get("/api/research/key-research", requireUser, async (_req, res) => {
    res.json({ items: savedKeyResearch });
  });

  // 주요 리서치 저장 (admin 전용)
  app.post("/api/research/key-research", requireAdmin, async (req, res) => {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ message: "items 배열이 필요합니다." });
      }
      // 중복 제거 후 추가
      for (const item of items) {
        const exists = savedKeyResearch.some(k => k.title === item.title && k.source === item.source);
        if (!exists) {
          savedKeyResearch.push(item);
        }
      }
      res.json({ items: savedKeyResearch, added: items.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "주요 리서치 저장 실패" });
    }
  });

  // 주요 리서치 전체 교체 (admin 전용)
  app.put("/api/research/key-research", requireAdmin, async (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ message: "items 배열이 필요합니다." });
      }
      savedKeyResearch = items;
      res.json({ items: savedKeyResearch });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "주요 리서치 업데이트 실패" });
    }
  });

  // ========== 리서치 AI 분석 ==========
  app.post("/api/research/ai-analyze", requireUser, async (req, res) => {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "분석할 리서치 항목을 선택해주세요." });
      }

      const researchList = items.map((item: any, i: number) =>
        `${i + 1}. [${item.source || ""}] ${item.title} (${item.date || ""})`
      ).join("\n");

      const prompt = `다음은 증권사 투자전략 리서치 리포트 제목 목록입니다. 이 리포트들의 공통 주제, 시장 전망, 주요 투자전략을 분석하여 한국어로 요약해주세요.

분석할 리서치 목록:
${researchList}

다음 형식으로 답변해주세요:
## 📊 주요 리서치 AI 분석 요약

### 1. 공통 주제 및 키워드
- 리포트들에서 공통으로 다루는 주제와 핵심 키워드를 정리

### 2. 시장 전망
- 증권사들의 시장 전망을 종합적으로 정리

### 3. 주요 투자전략
- 리포트들에서 제시하는 투자전략과 추천 업종/종목

### 4. 종합 의견
- 전체적인 시장 방향성과 투자자 참고 사항

간결하되 핵심 내용을 놓치지 않도록 정리해주세요.`;

      const result = await callAI(prompt);
      res.json({ analysis: result, analyzedAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) });
    } catch (error: any) {
      console.error("[Research AI] Error:", error.message);
      res.status(500).json({ message: error.message || "AI 분석 실패" });
    }
  });

  // ========== AI 분석 보고서 저장/조회 (DB 기반) ==========
  // 보고서 조회 (모든 유저)
  app.get("/api/research/ai-reports", requireUser, async (_req, res) => {
    try {
      const reports = await storage.getAiReports(20);
      // DB의 items 필드는 JSON 문자열이므로 파싱
      const parsed = reports.map(r => ({
        ...r,
        id: r.id.toString(),
        items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
      }));
      res.json({ reports: parsed });
    } catch (error: any) {
      console.error("[AI Reports] GET error:", error.message);
      res.json({ reports: [] });
    }
  });

  // 보고서 저장 (admin 전용)
  app.post("/api/research/ai-reports", requireAdmin, async (req, res) => {
    try {
      const { analysis, analyzedAt, items } = req.body;
      if (!analysis || !items) {
        return res.status(400).json({ message: "분석 내용과 항목이 필요합니다." });
      }
      const savedAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
      const itemsJson = JSON.stringify(
        items.map((item: any) => ({ title: item.title, source: item.source, date: item.date }))
      );
      const report = await storage.createAiReport({
        analysis,
        analyzedAt: analyzedAt || savedAt,
        savedAt,
        items: itemsJson,
      });
      const totalReports = await storage.getAiReports(20);
      res.json({
        report: {
          ...report,
          id: report.id.toString(),
          items: JSON.parse(report.items),
        },
        total: totalReports.length,
      });
    } catch (error: any) {
      console.error("[AI Reports] POST error:", error.message);
      res.status(500).json({ message: error.message || "보고서 저장 실패" });
    }
  });

  // 보고서 삭제 (admin 전용)
  app.delete("/api/research/ai-reports/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAiReport(parseInt(id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("[AI Reports] DELETE error:", error.message);
      res.status(500).json({ message: error.message || "보고서 삭제 실패" });
    }
  });

  // ========== ETF 구성종목 + 실시간 시세 ==========
  app.get("/api/etf/components/:code", async (req, res) => {
    try {
      const etfCode = req.params.code;
      if (!etfCode || !/^[0-9A-Za-z]{6}$/.test(etfCode)) {
        return res.status(400).json({ message: "유효한 6자리 ETF 코드를 입력해주세요." });
      }

      if (!kisApi.isConfigured()) {
        return res.status(503).json({ message: "KIS API가 설정되지 않았습니다." });
      }

      const result = await kisApi.getEtfComponents(etfCode);
      res.json(result);
    } catch (error: any) {
      console.error("Failed to fetch ETF components:", error);
      res.status(500).json({ message: error.message || "ETF 구성종목 조회 실패" });
    }
  });

  // ========== ETF 전체 목록 캐시 (네이버 금융 API) ==========
  interface EtfListItem {
    code: string;
    name: string;
    nowVal: number;
    changeVal: number;
    changeRate: number;
    risefall: string;
    nav: number;
    quant: number;
    amount: number;
    marketCap: number;
    threeMonthEarnRate: number;
  }
  let etfListCache: { items: EtfListItem[]; expiry: number } | null = null;
  const ETF_LIST_CACHE_TTL = 5 * 60 * 1000; // 5분 캐시 (실시간성 강화)

  async function getEtfFullList(): Promise<EtfListItem[]> {
    // 캐시 유효하면 반환
    if (etfListCache && Date.now() < etfListCache.expiry) {
      return etfListCache.items;
    }

    try {
      const response = await axios.get(
        "https://finance.naver.com/api/sise/etfItemList.nhn",
        {
          params: { etfType: 0, targetColumn: "change_rate", sortOrder: "desc" },
          headers: { "User-Agent": "Mozilla/5.0" },
          timeout: 15000,
          responseType: "arraybuffer",
        }
      );

      // EUC-KR → UTF-8 디코딩
      const iconv = await import("iconv-lite");
      const decoded = iconv.default.decode(Buffer.from(response.data), "euc-kr");
      const data = JSON.parse(decoded);
      const rawItems = data?.result?.etfItemList || [];

      const items: EtfListItem[] = rawItems.map((item: any) => ({
        code: item.itemcode || "",
        name: item.itemname || "",
        nowVal: parseFloat(item.nowVal) || 0,
        changeVal: parseFloat(item.changeVal) || 0,
        changeRate: parseFloat(item.changeRate) || 0,
        risefall: item.risefall || "",
        nav: parseFloat(item.nav) || 0,
        quant: parseFloat(item.quant) || 0,
        amount: parseFloat(item.amonut) || 0, // 네이버 API 오타 (amonut)
        marketCap: parseFloat(item.marketSum) || 0,
        threeMonthEarnRate: parseFloat(item.threeMonthEarnRate) || 0,
      }));

      etfListCache = { items, expiry: Date.now() + ETF_LIST_CACHE_TTL };
      console.log(`[ETF] Loaded ${items.length} ETFs from Naver Finance`);
      return items;
    } catch (err: any) {
      console.error("[ETF] Failed to load ETF list:", err.message);
      // 캐시가 만료되었어도 있으면 반환 (fallback)
      if (etfListCache) return etfListCache.items;
      return [];
    }
  }

  // ETF 실시간 상승 상위 (레버리지/인버스 제외)
  app.get("/api/etf/top-gainers", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 15, 50);
      const allEtfs = await getEtfFullList();

      // 레버리지/인버스 제외 필터
      const EXCLUDE_KEYWORDS = ["레버리지", "인버스", "2X", "bear", "BEAR", "곱버스", "숏", "SHORT", "울트라"];
      const filtered = allEtfs.filter((etf) => {
        const name = etf.name;
        return !EXCLUDE_KEYWORDS.some((kw) => name.includes(kw));
      });

      // 상승률 순 정렬 (이미 change_rate desc로 정렬되어 있지만, 필터 후 재확인)
      const rising = filtered
        .filter((etf) => etf.changeRate > 0)
        .sort((a, b) => b.changeRate - a.changeRate)
        .slice(0, limit)
        .map((etf) => ({
          code: etf.code,
          name: etf.name,
          nowVal: etf.nowVal,
          changeVal: etf.changeVal,
          changeRate: etf.changeRate,
          risefall: etf.risefall,
          quant: etf.quant,
          amount: etf.amount,
          marketCap: etf.marketCap,
          nav: etf.nav,
        }));

      res.json({ items: rising, updatedAt: new Date().toLocaleString("ko-KR") });
    } catch (error: any) {
      console.error("[ETF] Failed to get top gainers:", error.message);
      res.status(500).json({ message: "ETF 상승 데이터 조회 실패" });
    }
  });

  // ===== 관심(Core) ETF 실시간 시세 (top-gainers와 동일 포맷 + 배당수익률) =====
  app.get("/api/watchlist-etfs/realtime", async (req, res) => {
    try {
      const watchlist = await storage.getWatchlistEtfs();
      if (watchlist.length === 0) return res.json({ items: [], updatedAt: new Date().toLocaleString("ko-KR") });

      const allEtfs = await getEtfFullList();
      const etfMap = new Map<string, EtfListItem>();
      allEtfs.forEach((e) => etfMap.set(e.code, e));

      // 배당수익률 병렬 조회
      const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
      const dividendMap = new Map<string, number | null>();
      const batchSize = 10;
      for (let i = 0; i < watchlist.length; i += batchSize) {
        const batch = watchlist.slice(i, i + batchSize);
        await Promise.all(batch.map(async (w) => {
          try {
            const intRes = await axios.get(
              `https://m.stock.naver.com/api/stock/${w.etfCode}/integration`,
              { headers: { "User-Agent": UA }, timeout: 5000 }
            );
            const eki = intRes.data?.etfKeyIndicator;
            dividendMap.set(w.etfCode, eki?.dividendYieldTtm ?? null);
          } catch {
            dividendMap.set(w.etfCode, null);
          }
        }));
      }

      const items = watchlist
        .map((w) => {
          const naver = etfMap.get(w.etfCode);
          if (!naver) return null;
          return {
            code: naver.code,
            name: naver.name,
            nowVal: naver.nowVal,
            changeVal: naver.changeVal,
            changeRate: naver.changeRate,
            risefall: naver.risefall,
            quant: naver.quant,
            amount: naver.amount,
            marketCap: naver.marketCap,
            nav: naver.nav,
            sector: w.sector || "",
            memo: w.memo || "",
            dividendYield: dividendMap.get(w.etfCode) ?? null,
          };
        })
        .filter(Boolean);

      res.json({ items, updatedAt: new Date().toLocaleString("ko-KR") });
    } catch (error: any) {
      console.error("[ETF] Failed to get watchlist realtime:", error.message);
      res.status(500).json({ message: "관심 ETF 실시간 시세 조회 실패" });
    }
  });

  // ===== 관심(Satellite) 실시간 시세 (공통 + 개인 합산) =====
  app.get("/api/satellite-etfs/realtime", async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const commonList = await storage.getSatelliteEtfs("common");
      const personalList = userId ? await storage.getSatelliteEtfs("personal", userId) : [];
      const satList = [...commonList, ...personalList];
      if (satList.length === 0) return res.json({ items: [], updatedAt: new Date().toLocaleString("ko-KR") });

      const allEtfs = await getEtfFullList();
      const etfMap = new Map<string, EtfListItem>();
      allEtfs.forEach((e) => etfMap.set(e.code, e));

      // 중복 제거 (같은 ETF 코드가 공통과 개인에 모두 있을 수 있음)
      const seen = new Set<string>();
      const items = satList
        .map((w) => {
          if (seen.has(w.etfCode)) return null;
          seen.add(w.etfCode);
          const naver = etfMap.get(w.etfCode);
          if (!naver) return null;
          return {
            code: naver.code,
            name: naver.name,
            nowVal: naver.nowVal,
            changeVal: naver.changeVal,
            changeRate: naver.changeRate,
            risefall: naver.risefall,
            quant: naver.quant,
            amount: naver.amount,
            marketCap: naver.marketCap,
            nav: naver.nav,
            sector: w.sector || "",
            memo: w.memo || "",
            listType: w.listType || "common",
          };
        })
        .filter(Boolean);

      res.json({ items, updatedAt: new Date().toLocaleString("ko-KR") });
    } catch (error: any) {
      console.error("[ETF] Failed to get satellite realtime:", error.message);
      res.status(500).json({ message: "Satellite ETF 실시간 시세 조회 실패" });
    }
  });

  // ========== 국내증시 대시보드 API ==========

  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

  // --- 1) 시장 지수 (KOSPI, KOSDAQ, KOSPI200) ---
  app.get("/api/markets/domestic/indices", async (_req, res) => {
    try {
      const indices = [
        { code: "KOSPI", name: "코스피" },
        { code: "KOSDAQ", name: "코스닥" },
        { code: "KPI200", name: "코스피200" },
      ];

      // 네이버 금융 시세 페이지에서 지수 정보 가져오기
      const marketRes = await axios.get("https://finance.naver.com/sise/", {
        headers: { "User-Agent": UA },
        timeout: 8000,
        responseType: "arraybuffer",
      });
      const iconv = await import("iconv-lite");
      const html = iconv.default.decode(Buffer.from(marketRes.data), "euc-kr");
      const $ = cheerio.load(html);

      const result: any[] = [];

      // KOSPI
      const kospiNow = parseFloat($("#KOSPI_now").text().replace(/,/g, "")) || 0;
      const kospiChange = parseFloat($("#KOSPI_change").text().replace(/,/g, "")) || 0;
      const kospiQuant = $("#KOSPI_quant").text().trim();
      const kospiAmount = $("#KOSPI_amount").text().trim();
      const kospiUp = $("#KOSPI_up").length > 0 || $(".kospi_area .n_ch em").hasClass("red");
      result.push({
        code: "KOSPI", name: "코스피",
        nowVal: kospiNow,
        changeVal: kospiUp ? Math.abs(kospiChange) : -Math.abs(kospiChange),
        changeRate: kospiNow > 0 ? parseFloat(((kospiChange / (kospiNow - kospiChange)) * 100).toFixed(2)) : 0,
        quant: kospiQuant,
        amount: kospiAmount,
      });

      // KOSDAQ
      const kosdaqNow = parseFloat($("#KOSDAQ_now").text().replace(/,/g, "")) || 0;
      const kosdaqChange = parseFloat($("#KOSDAQ_change").text().replace(/,/g, "")) || 0;
      const kosdaqQuant = $("#KOSDAQ_quant").text().trim();
      const kosdaqAmount = $("#KOSDAQ_amount").text().trim();
      const kosdaqUp = $("#KOSDAQ_up").length > 0 || $(".kosdaq_area .n_ch em").hasClass("red");
      result.push({
        code: "KOSDAQ", name: "코스닥",
        nowVal: kosdaqNow,
        changeVal: kosdaqUp ? Math.abs(kosdaqChange) : -Math.abs(kosdaqChange),
        changeRate: kosdaqNow > 0 ? parseFloat(((kosdaqChange / (kosdaqNow - kosdaqChange)) * 100).toFixed(2)) : 0,
        quant: kosdaqQuant,
        amount: kosdaqAmount,
      });

      // KOSPI200 (별도 API)
      try {
        const k200Res = await axios.get("https://polling.finance.naver.com/api/realtime/domestic/index/KPI200", {
          headers: { "User-Agent": UA }, timeout: 5000,
        });
        const k200 = k200Res.data?.datas?.[0] || {};
        result.push({
          code: "KPI200", name: "코스피200",
          nowVal: parseFloat(k200.nv) || 0,
          changeVal: parseFloat(k200.cv) || 0,
          changeRate: parseFloat(k200.cr) || 0,
          quant: k200.aq || "0",
          amount: k200.aa || "0",
        });
      } catch {
        result.push({ code: "KPI200", name: "코스피200", nowVal: 0, changeVal: 0, changeRate: 0, quant: "0", amount: "0" });
      }

      // 미니 차트 데이터 (최근 60일)
      const chartData: Record<string, any[]> = {};
      await Promise.all(["KOSPI", "KOSDAQ", "KPI200"].map(async (indexCode) => {
        try {
          const chartRes = await axios.get("https://fchart.stock.naver.com/sise.nhn", {
            params: { symbol: indexCode, timeframe: "day", count: 60, requestType: 0 },
            headers: { "User-Agent": UA }, timeout: 5000, responseType: "text",
          });
          const matches = [...(chartRes.data as string).matchAll(/<item data="([^"]+)"/g)];
          chartData[indexCode] = matches.map((m) => {
            const [date, open, high, low, close, vol] = m[1].split("|");
            return { date, open: +open, high: +high, low: +low, close: +close, vol: +vol };
          }).slice(-30); // 최근 30일
        } catch {
          chartData[indexCode] = [];
        }
      }));

      res.json({ indices: result, charts: chartData, updatedAt: new Date().toLocaleString("ko-KR") });
    } catch (error: any) {
      console.error("[Markets] Indices error:", error.message);
      res.status(500).json({ message: "시장 지수 조회 실패" });
    }
  });

  // --- 2) 업종별 등락 현황 ---
  app.get("/api/markets/domestic/sectors", async (_req, res) => {
    try {
      const sectorRes = await axios.get("https://finance.naver.com/sise/sise_group.naver", {
        params: { type: "upjong" },
        headers: { "User-Agent": UA },
        timeout: 8000,
        responseType: "arraybuffer",
      });
      const iconv = await import("iconv-lite");
      const html = iconv.default.decode(Buffer.from(sectorRes.data), "euc-kr");
      const $ = cheerio.load(html);

      const sectors: any[] = [];
      $("table.type_1 tr").each((_i, row) => {
        const tds = $(row).find("td");
        if (tds.length < 5) return;
        const anchor = $(tds[0]).find("a");
        const name = anchor.text().trim();
        if (!name) return;
        // 업종 코드 추출 (예: /sise/sise_group_detail.naver?type=upjong&no=261)
        const href = anchor.attr("href") || "";
        const noMatch = href.match(/no=(\d+)/);
        const sectorCode = noMatch ? noMatch[1] : "";
        const changeRate = $(tds[1]).text().trim().replace("%", "");
        const isDown = $(row).find(".tah.p11.nv01").length > 0 || $(tds[1]).find(".rate_down").length > 0;
        const upCount = parseInt($(tds[2]).text().trim()) || 0;
        const flatCount = parseInt($(tds[3]).text().trim()) || 0;
        const downCount = parseInt($(tds[4]).text().trim()) || 0;

        let rate = parseFloat(changeRate) || 0;
        // 등락부호 확인
        const signImg = $(tds[1]).find("img").attr("alt") || "";
        if (signImg.includes("하락") || isDown) rate = -Math.abs(rate);

        sectors.push({ name, code: sectorCode, changeRate: rate, upCount, flatCount, downCount });
      });

      // 등락률 내림차순 정렬
      sectors.sort((a, b) => b.changeRate - a.changeRate);

      res.json({ sectors, updatedAt: new Date().toLocaleString("ko-KR") });
    } catch (error: any) {
      console.error("[Markets] Sectors error:", error.message);
      res.status(500).json({ message: "업종별 등락 조회 실패" });
    }
  });

  // --- 2-b) 업종별 구성종목 ---
  app.get("/api/markets/domestic/sector-stocks/:sectorCode", async (req, res) => {
    try {
      const { sectorCode } = req.params;
      if (!sectorCode) return res.status(400).json({ message: "업종 코드가 필요합니다." });

      const detailRes = await axios.get("https://finance.naver.com/sise/sise_group_detail.naver", {
        params: { type: "upjong", no: sectorCode },
        headers: { "User-Agent": UA },
        timeout: 8000,
        responseType: "arraybuffer",
      });
      const iconv = await import("iconv-lite");
      const html = iconv.default.decode(Buffer.from(detailRes.data), "euc-kr");
      const $ = cheerio.load(html);

      // 업종명
      const sectorName = $(".group_name strong, h4.sub_tit").first().text().trim() || `업종 ${sectorCode}`;

      const stocks: any[] = [];
      $("table.type_5 tr").each((_i, row) => {
        const tds = $(row).find("td");
        if (tds.length < 7) return;
        const anchor = $(tds[0]).find("a");
        const name = anchor.text().trim();
        if (!name) return;
        const code = (anchor.attr("href") || "").match(/code=(\w+)/)?.[1] || "";
        const nowVal = $(tds[1]).text().trim().replace(/,/g, "");
        const changeVal = $(tds[2]).text().trim().replace(/,/g, "");
        const changeRate = $(tds[3]).text().trim().replace(/%/g, "");

        // 등락 부호 감지
        const signImg = $(tds[2]).find("img").attr("alt") || "";
        let change = parseInt(changeVal) || 0;
        let rate = parseFloat(changeRate) || 0;
        if (signImg.includes("하락")) {
          change = -Math.abs(change);
          rate = -Math.abs(rate);
        }

        const volume = $(tds[4]).text().trim().replace(/,/g, "");
        const prevVol = $(tds[5]).text().trim().replace(/,/g, "");
        const marketCap = $(tds[6]).text().trim().replace(/,/g, "");

        stocks.push({
          code,
          name,
          nowVal: parseInt(nowVal) || 0,
          changeVal: change,
          changeRate: rate,
          volume: parseInt(volume) || 0,
          prevVolume: parseInt(prevVol) || 0,
          marketCap: parseInt(marketCap) || 0,
        });
      });

      res.json({ sectorName, sectorCode, stocks, updatedAt: new Date().toLocaleString("ko-KR") });
    } catch (error: any) {
      console.error("[Markets] Sector stocks error:", error.message);
      res.status(500).json({ message: "업종 구성종목 조회 실패" });
    }
  });

  // --- 3) 투자자별 매매동향 ---
  app.get("/api/markets/domestic/investors", async (_req, res) => {
    try {
      const investorRes = await axios.get("https://finance.naver.com/sise/investorDealTrendDay.naver", {
        headers: { "User-Agent": UA },
        timeout: 8000,
        responseType: "arraybuffer",
      });
      const iconv = await import("iconv-lite");
      const html = iconv.default.decode(Buffer.from(investorRes.data), "euc-kr");
      const $ = cheerio.load(html);

      // KOSPI 투자자별
      const investors: any[] = [];
      $("table.type_1 tr").each((_i, row) => {
        const tds = $(row).find("td");
        if (tds.length < 4) return;
        const date = $(tds[0]).text().trim();
        if (!date || date.length < 5) return;

        const individual = $(tds[1]).text().trim().replace(/,/g, "");
        const foreign = $(tds[2]).text().trim().replace(/,/g, "");
        const institution = $(tds[3]).text().trim().replace(/,/g, "");
        
        investors.push({
          date,
          individual: parseInt(individual) || 0,
          foreign: parseInt(foreign) || 0,
          institution: parseInt(institution) || 0,
        });
      });

      // 별도로 투자자별 요약 가져오기 (sise_deal)
      let summary: any = { kospi: {}, kosdaq: {} };
      try {
        const dealRes = await axios.get("https://finance.naver.com/sise/sise_deal.naver", {
          headers: { "User-Agent": UA },
          timeout: 8000,
          responseType: "arraybuffer",
        });
        const dealHtml = iconv.default.decode(Buffer.from(dealRes.data), "euc-kr");
        const $d = cheerio.load(dealHtml);

        // 테이블에서 데이터 추출
        const tables = $d("table.type_1");
        
        // 투자자별 순매수 파싱 함수
        const parseInvestorTable = (table: any) => {
          const result: any[] = [];
          $d(table).find("tr").each((_i: number, row: any) => {
            const tds = $d(row).find("td");
            if (tds.length < 2) return;
            const name = $d(row).find("th").text().trim();
            if (!name) return;
            const val = $d(tds[0]).text().trim().replace(/,/g, "");
            result.push({ name, value: parseInt(val) || 0 });
          });
          return result;
        };

        if (tables.length > 0) {
          summary.kospi = parseInvestorTable(tables[0]);
        }
      } catch (e) {
        console.error("[Markets] Investor deal detail fetch failed:", (e as Error).message);
      }

      res.json({ investors: investors.slice(0, 10), summary, updatedAt: new Date().toLocaleString("ko-KR") });
    } catch (error: any) {
      console.error("[Markets] Investors error:", error.message);
      res.status(500).json({ message: "투자자별 매매동향 조회 실패" });
    }
  });

  // --- 4) 거래량·상승률·하락률 상위 종목 ---
  app.get("/api/markets/domestic/top-stocks", async (req, res) => {
    try {
      const category = (req.query.category as string) || "quant"; // quant, rise, fall
      const market = (req.query.market as string) || "kospi"; // kospi, kosdaq

      const sosok = market === "kosdaq" ? "1" : "0"; // 0=코스피, 1=코스닥

      let url = "";
      if (category === "quant") {
        url = "https://finance.naver.com/sise/sise_quant.naver";
      } else if (category === "rise") {
        url = "https://finance.naver.com/sise/sise_rise.naver";
      } else {
        url = "https://finance.naver.com/sise/sise_fall.naver";
      }

      const stockRes = await axios.get(url, {
        params: { sosok },
        headers: { "User-Agent": UA },
        timeout: 8000,
        responseType: "arraybuffer",
      });
      const iconv = await import("iconv-lite");
      const html = iconv.default.decode(Buffer.from(stockRes.data), "euc-kr");
      const $ = cheerio.load(html);

      const stocks: any[] = [];
      $("table.type_2 tr").each((_i, row) => {
        const tds = $(row).find("td");
        if (tds.length < 10) return;
        const name = $(tds[1]).find("a").text().trim();
        if (!name) return;
        const code = $(tds[1]).find("a").attr("href")?.match(/code=(\d+)/)?.[1] || "";
        const nowVal = $(tds[2]).text().trim().replace(/,/g, "");
        const changeVal = $(tds[3]).text().trim().replace(/,/g, "");
        const changeRate = $(tds[4]).text().trim().replace(/%/g, "");
        const volume = $(tds[5]).text().trim().replace(/,/g, "");
        const prevVol = $(tds[6]).text().trim().replace(/,/g, "");
        const amount = $(tds[7]).text().trim().replace(/,/g, "");
        const marketCap = $(tds[8]).text().trim().replace(/,/g, "");

        // 등락 부호 감지
        const signImg = $(tds[3]).find("img").attr("alt") || "";
        const signSrc = $(tds[3]).find("img").attr("src") || "";
        let change = parseInt(changeVal) || 0;
        let rate = parseFloat(changeRate) || 0;
        // 하락 감지: img alt, img src, 또는 카테고리가 fall인 경우
        if (signImg.includes("하락") || signSrc.includes("down") || signSrc.includes("fall")) {
          change = -Math.abs(change);
          rate = -Math.abs(rate);
        } else if (category === "fall" && change > 0) {
          // 하락 카테고리인데 부호 감지에 실패한 경우 강제 음수 처리
          change = -Math.abs(change);
          rate = -Math.abs(rate);
        }

        stocks.push({
          code,
          name,
          nowVal: parseInt(nowVal) || 0,
          changeVal: change,
          changeRate: rate,
          volume: parseInt(volume) || 0,
          prevVolume: parseInt(prevVol) || 0,
          amount: parseInt(amount) || 0,
          marketCap: parseInt(marketCap) || 0,
        });
      });

      res.json({ stocks: stocks.slice(0, 30), category, market, updatedAt: new Date().toLocaleString("ko-KR") });
    } catch (error: any) {
      console.error("[Markets] Top stocks error:", error.message);
      res.status(500).json({ message: "상위 종목 조회 실패" });
    }
  });

  // --- 5) 시장 종합 요약 (상한/하한, 상승/하락 종목수, 거래대금) ---
  app.get("/api/markets/domestic/market-summary", async (_req, res) => {
    try {
      const marketRes = await axios.get("https://finance.naver.com/sise/", {
        headers: { "User-Agent": UA },
        timeout: 8000,
        responseType: "arraybuffer",
      });
      const iconv = await import("iconv-lite");
      const html = iconv.default.decode(Buffer.from(marketRes.data), "euc-kr");
      const $ = cheerio.load(html);

      // 거래 정보 추출
      const kospiInfo = {
        index: parseFloat($("#KOSPI_now").text().replace(/,/g, "")) || 0,
        change: parseFloat($("#KOSPI_change").text().replace(/,/g, "")) || 0,
        volume: $("#KOSPI_quant").text().trim(),
        amount: $("#KOSPI_amount").text().trim(),
      };

      const kosdaqInfo = {
        index: parseFloat($("#KOSDAQ_now").text().replace(/,/g, "")) || 0,
        change: parseFloat($("#KOSDAQ_change").text().replace(/,/g, "")) || 0,
        volume: $("#KOSDAQ_quant").text().trim(),
        amount: $("#KOSDAQ_amount").text().trim(),
      };

      // 상한/하한/상승/하락/보합 종목 수
      const marketStats: any = {};
      $(".market_rise_fall .market_data").each((_i, el) => {
        const label = $(el).find("dt").text().trim();
        const value = parseInt($(el).find("dd").text().trim().replace(/,/g, "")) || 0;
        marketStats[label] = value;
      });

      res.json({
        kospi: kospiInfo,
        kosdaq: kosdaqInfo,
        stats: marketStats,
        updatedAt: new Date().toLocaleString("ko-KR"),
      });
    } catch (error: any) {
      console.error("[Markets] Summary error:", error.message);
      res.status(500).json({ message: "시장 종합 조회 실패" });
    }
  });

  // ========== 해외증시 대시보드 API ==========

  // --- 1) 해외 주요 지수 ---
  app.get("/api/markets/global/indices", async (_req, res) => {
    try {
      const worldIndices = [
        { symbol: "DJI@DJI", name: "다우존스", market: "us" },
        { symbol: "NAS@IXIC", name: "나스닥 종합", market: "us" },
        { symbol: "SPI@SPX", name: "S&P 500", market: "us" },
        { symbol: "SPI@NDX", name: "나스닥 100", market: "us" },
        { symbol: "NII@NI225", name: "닛케이 225", market: "jp" },
        { symbol: "HSI@HSI", name: "항셍", market: "cn" },
        { symbol: "SHS@000001", name: "상해종합", market: "cn" },
        { symbol: "STI@STI", name: "FTSE 100", market: "eu" },
        { symbol: "DAX@DAX", name: "DAX", market: "eu" },
      ];

      const result: any[] = [];
      const chartData: Record<string, any[]> = {};

      // 네이버 금융 해외지수 polling API 사용
      await Promise.all(worldIndices.map(async (idx) => {
        try {
          const apiRes = await axios.get(`https://polling.finance.naver.com/api/realtime/worldstock/index/${idx.symbol}`, {
            headers: { "User-Agent": UA },
            timeout: 5000,
          });
          const data = apiRes.data?.datas?.[0] || {};
          const nv = parseFloat(data.nv) || 0;
          const cv = parseFloat(data.cv) || 0;
          const cr = parseFloat(data.cr) || 0;
          const aq = data.aq || "0";
          const aa = data.aa || "0";
          const ms = data.ms || ""; // market status

          result.push({
            code: idx.symbol,
            name: idx.name,
            market: idx.market,
            nowVal: nv,
            changeVal: cv,
            changeRate: cr,
            quant: aq,
            amount: aa,
            marketStatus: ms,
          });
        } catch {
          result.push({
            code: idx.symbol,
            name: idx.name,
            market: idx.market,
            nowVal: 0, changeVal: 0, changeRate: 0,
            quant: "0", amount: "0", marketStatus: "",
          });
        }
      }));

      // 미니 차트 데이터 (주요 지수 3개만)
      const chartSymbols = ["DJI@DJI", "NAS@IXIC", "SPI@SPX"];
      await Promise.all(chartSymbols.map(async (sym) => {
        try {
          const chartRes = await axios.get("https://fchart.stock.naver.com/sise.nhn", {
            params: { symbol: sym, timeframe: "day", count: 60, requestType: 0 },
            headers: { "User-Agent": UA }, timeout: 5000, responseType: "text",
          });
          const matches = [...(chartRes.data as string).matchAll(/<item data="([^"]+)"/g)];
          chartData[sym] = matches.map((m) => {
            const [date, open, high, low, close, vol] = m[1].split("|");
            return { date, open: +open, high: +high, low: +low, close: +close, vol: +vol };
          }).slice(-30);
        } catch {
          chartData[sym] = [];
        }
      }));

      res.json({ indices: result, charts: chartData, updatedAt: new Date().toLocaleString("ko-KR") });
    } catch (error: any) {
      console.error("[GlobalMarket] Indices error:", error.message);
      res.status(500).json({ message: "해외 지수 조회 실패" });
    }
  });

  // --- 2) 미국 종목 순위 (거래량 상위/상승/하락/시가총액) ---
  app.get("/api/markets/global/top-stocks", async (req, res) => {
    try {
      const category = (req.query.category as string) || "rise";
      const market = (req.query.market as string) || "NYSE";

      // 네이버 해외증시 종목순위 페이지
      let sortType = "";
      switch (category) {
        case "volume": sortType = "quant"; break;
        case "rise": sortType = "rise"; break;
        case "fall": sortType = "fall"; break;
        case "marketCap": sortType = "mktcap"; break;
        default: sortType = "rise";
      }

      // stock.naver.com의 내부 API 사용
      const apiRes = await axios.get("https://api.stock.naver.com/stock/exchange/NASDAQ/marketValue", {
        params: { page: 1, pageSize: 20 },
        headers: { "User-Agent": UA },
        timeout: 8000,
      }).catch(() => null);

      const stocks: any[] = [];

      if (apiRes?.data?.stocks) {
        for (const s of apiRes.data.stocks) {
          stocks.push({
            code: s.symbolCode || s.stockCode || "",
            name: s.stockName || "",
            nameEn: s.stockNameEng || "",
            nowVal: parseFloat(s.closePrice) || 0,
            changeVal: parseFloat(s.compareToPreviousClosePrice) || 0,
            changeRate: parseFloat(s.fluctuationsRatio) || 0,
            volume: parseInt(s.accumulatedTradingVolume) || 0,
            marketCap: s.marketValue || "",
          });
        }
      } else {
        // 폴백: 네이버 금융 worldstock ranking
        try {
          const fallbackRes = await axios.get(`https://finance.naver.com/world/sise.naver`, {
            params: { symbol: "NAS@IXIC" },
            headers: { "User-Agent": UA },
            timeout: 8000,
            responseType: "arraybuffer",
          });
          const iconv = await import("iconv-lite");
          const html = iconv.default.decode(Buffer.from(fallbackRes.data), "euc-kr");
          const $ = cheerio.load(html);
          $("table.tbl_type1 tbody tr").each((_i, row) => {
            const tds = $(row).find("td");
            if (tds.length < 4) return;
            const name = $(tds[0]).find("a").text().trim();
            const price = parseFloat($(tds[1]).text().replace(/,/g, "")) || 0;
            const change = parseFloat($(tds[2]).text().replace(/,/g, "")) || 0;
            const rate = parseFloat($(tds[3]).text().replace(/[%,]/g, "")) || 0;
            if (name) {
              stocks.push({
                code: "",
                name,
                nameEn: "",
                nowVal: price,
                changeVal: change,
                changeRate: rate,
                volume: 0,
                marketCap: "",
              });
            }
          });
        } catch { /* fallback failed */ }
      }

      res.json({ stocks, category, updatedAt: new Date().toLocaleString("ko-KR") });
    } catch (error: any) {
      console.error("[GlobalMarket] Top stocks error:", error.message);
      res.status(500).json({ message: "해외 종목순위 조회 실패" });
    }
  });

  // --- 3) 오늘의 환율 현황 ---
  app.get("/api/markets/global/exchange-rates", async (_req, res) => {
    try {
      const rates: any[] = [];
      // 네이버 금융 환율 페이지
      const exRes = await axios.get("https://finance.naver.com/marketindex/", {
        headers: { "User-Agent": UA },
        timeout: 8000,
        responseType: "arraybuffer",
      });
      const iconv = await import("iconv-lite");
      const html = iconv.default.decode(Buffer.from(exRes.data), "euc-kr");
      const $ = cheerio.load(html);

      // 주요 환율
      $(".market_data .data_lst li").each((_i, el) => {
        const name = $(el).find("h3 .blind, h3").text().trim().replace("전일대비", "").trim();
        const value = parseFloat($(el).find(".value").text().replace(/,/g, "")) || 0;
        const change = parseFloat($(el).find(".change").text().replace(/,/g, "")) || 0;
        const isDown = $(el).find(".ico.down").length > 0 || $(el).hasClass("dn");
        if (name && value > 0) {
          rates.push({
            name,
            value,
            change: isDown ? -Math.abs(change) : Math.abs(change),
            changeRate: value > 0 ? parseFloat(((change / (value - change)) * 100).toFixed(2)) : 0,
          });
        }
      });

      res.json({ rates, updatedAt: new Date().toLocaleString("ko-KR") });
    } catch (error: any) {
      console.error("[GlobalMarket] Exchange rates error:", error.message);
      res.status(500).json({ message: "환율 조회 실패" });
    }
  });

  // --- 4) 글로벌 뉴스 (네이버 금융 해외증시 뉴스) ---
  app.get("/api/markets/global/news", async (_req, res) => {
    try {
      // 네이버 금융 해외증시 뉴스 목록 (해외증시 카테고리: section_id3=403)
      const newsRes = await axios.get("https://finance.naver.com/news/news_list.naver", {
        params: {
          mode: "LSS3D",
          section_id: 101,
          section_id2: 258,
          section_id3: 403,
          page: 1,
        },
        headers: { "User-Agent": UA },
        timeout: 8000,
        responseType: "arraybuffer",
      });
      const iconv = await import("iconv-lite");
      const html = iconv.default.decode(Buffer.from(newsRes.data), "euc-kr");
      const $ = cheerio.load(html);

      const news: any[] = [];

      // 방법 1: 뉴스 리스트의 articleSubject에서 추출
      $("dd.articleSubject").each((_i, el) => {
        const a = $(el).find("a");
        const title = (a.attr("title") || a.text()).trim();
        const href = a.attr("href") || "";
        // 같은 dl 내의 wdate 가져오기
        const dateEl = $(el).closest("dl").find("span.wdate");
        const date = dateEl.text().trim();
        if (title && title.length > 5 && news.length < 15) {
          news.push({
            title,
            url: href.startsWith("http") ? href : `https://finance.naver.com${href}`,
            date,
          });
        }
      });

      // 방법 1에서 결과가 없으면 방법 2: section_news에서 추출 (해외증시 메인)
      if (news.length === 0) {
        const worldRes = await axios.get("https://finance.naver.com/world/", {
          headers: { "User-Agent": UA },
          timeout: 8000,
          responseType: "arraybuffer",
        });
        const worldHtml = iconv.default.decode(Buffer.from(worldRes.data), "euc-kr");
        const $w = cheerio.load(worldHtml);

        $w(".section_news p").each((_i, el) => {
          const a = $w(el).find("a");
          const title = a.text().trim();
          const href = a.attr("href") || "";
          if (title && title.length > 5 && news.length < 15) {
            news.push({
              title,
              url: href.startsWith("http") ? href : `https://finance.naver.com${href}`,
              date: "",
            });
          }
        });
      }

      res.json({ news, updatedAt: new Date().toLocaleString("ko-KR") });
    } catch (error: any) {
      console.error("[GlobalMarket] News error:", error.message);
      res.status(500).json({ message: "글로벌 뉴스 조회 실패" });
    }
  });

  // ========== 경제 캘린더 (Investing.com 기반) ==========
  app.get("/api/markets/economic-calendar", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 14;
      const now = new Date();
      const dateFrom = now.toISOString().split("T")[0]; // YYYY-MM-DD
      const dateTo = new Date(now.getTime() + days * 86400000).toISOString().split("T")[0];

      // 국가 코드: 11=한국, 72=미국, 5=일본, 35=중국, 4=영국, 34=독일, 22=EU, 17=프랑스
      const calRes = await axios.post(
        "https://kr.investing.com/economic-calendar/Service/getCalendarFilteredData",
        `country%5B%5D=11&country%5B%5D=72&country%5B%5D=5&country%5B%5D=35&country%5B%5D=4&country%5B%5D=34&country%5B%5D=22&dateFrom=${dateFrom}&dateTo=${dateTo}&timeZone=88&timeFilter=timeRemain&currentTab=custom&limit_from=0`,
        {
          headers: {
            "User-Agent": UA,
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: 10000,
        }
      );

      const html = calRes.data?.data || "";
      const events: any[] = [];
      let currentDate = "";

      // HTML 파싱
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
      let match;
      while ((match = rowRegex.exec(html)) !== null) {
        const row = match[1];

        // 날짜 헤더
        const dayMatch = row.match(/theDay[^>]*>(.*?)</);
        if (dayMatch) {
          currentDate = dayMatch[1].trim();
          continue;
        }

        // 이벤트 행
        const timeMatch = row.match(/first left[^>]*>(.*?)</);
        const countryMatch = row.match(/title="(.*?)"/);
        const eventMatch = row.match(/event"[^>]*>(.*?)</);

        const time = timeMatch ? timeMatch[1].trim() : "";
        const country = countryMatch ? countryMatch[1].trim() : "";
        let eventName = eventMatch ? eventMatch[1].trim() : "";

        // HTML entities 디코딩
        eventName = eventName.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&middot;/g, "·");

        // 중요도 (★ 개수)
        const importance = (row.match(/grayFullBullishIcon/g) || []).length;

        // 실제값, 예상값, 이전값
        const tdValues = [...row.matchAll(/<td[^>]*class="[^"]*bold[^"]*"[^>]*>(.*?)<\/td>/g)].map(m => m[1].replace(/<[^>]+>/g, "").trim());

        if (eventName && eventName.length > 2 && !eventName.includes("클릭하세요")) {
          events.push({
            date: currentDate,
            time,
            country,
            event: eventName,
            importance, // 0~3
            actual: tdValues[0] || "",
            forecast: tdValues[1] || "",
            previous: tdValues[2] || "",
          });
        }
      }

      // 날짜별 그룹화
      const grouped: Record<string, any[]> = {};
      for (const ev of events) {
        if (!grouped[ev.date]) grouped[ev.date] = [];
        grouped[ev.date].push(ev);
      }

      res.json({
        events: grouped,
        totalEvents: events.length,
        dateRange: { from: dateFrom, to: dateTo },
        updatedAt: new Date().toLocaleString("ko-KR"),
      });
    } catch (error: any) {
      console.error("[EconomicCalendar] Error:", error.message);
      res.status(500).json({ message: "경제 캘린더 조회 실패" });
    }
  });

  // ========== IPO 일정 (38.co.kr 기반) ==========
  app.get("/api/markets/ipo-schedule", async (req, res) => {
    try {
      const ipoRes = await axios.get("https://www.38.co.kr/html/fund/index.htm?o=k", {
        headers: { "User-Agent": UA },
        timeout: 8000,
        responseType: "arraybuffer", // EUC-KR 인코딩 처리를 위해 바이너리로 받기
      });
      const iconv = await import("iconv-lite");
      const html = iconv.default.decode(Buffer.from(ipoRes.data), "euc-kr");
      const $ = cheerio.load(html);

      const ipos: any[] = [];
      // 38.co.kr 테이블 구조: 종목명, 공모주일정, 확정공모가, 희망공모가, 청약경쟁률, 주간사, 분석
      $("table tr").each((_i, row) => {
        const tds = $(row).find("td");
        if (tds.length < 6) return; // 7열 테이블 (6 이상)

        const name = $(tds[0]).text().trim();
        const schedule = $(tds[1]).text().trim();
        const confirmedPrice = $(tds[2]).text().trim();
        const hopePrice = $(tds[3]).text().trim();
        const competition = $(tds[4]).text().trim();
        const underwriter = $(tds[5]).text().trim();
        const link = $(tds[0]).find("a").attr("href") || "";

        // 헤더 행이나 빈 행 건너뛰기
        if (!name || name.length < 2 || name === "종목명") return;
        if (ipos.length >= 20) return;

        ipos.push({
          name,
          schedule,
          price: confirmedPrice && confirmedPrice !== "-" ? confirmedPrice : hopePrice,
          exchange: underwriter,
          competition: competition || "-",
          url: link.startsWith("http") ? link : (link ? `https://www.38.co.kr${link}` : "#"),
        });
      });

      res.json({ ipos, updatedAt: new Date().toLocaleString("ko-KR") });
    } catch (error: any) {
      console.error("[IPO Schedule] Error:", error.message);
      res.status(500).json({ message: "IPO 일정 조회 실패" });
    }
  });

  // ========== 배당 일정 (네이버 증권 기반) ==========
  app.get("/api/markets/dividend-calendar", async (req, res) => {
    try {
      // 대표 고배당 종목 리스트 (KOSPI/KOSDAQ 대표 배당주)
      const dividendCodes = [
        // 고배당 대표주
        "005930", "000660", "005380", "012330", "066570", "035420", "051910",
        "006400", "003550", "105560", "096770", "086280", "032830",
        "034020", "003490", "090430", "009150", "017670", "029780",
        "071050", "069960", "024110", "078930", "316140", "030200",
        "036570", "028260", "011170", "000270", "010130", "008770",
        "010140", "004990", "000810", "001040", "003410", "039490",
        "161390", "009540", "002790", "055550", "088350", "100220",
        "950130", "329180", "267250", "138930", "006360", "003240", "004370",
      ];

      const dividendStocks: any[] = [];
      const batchSize = 10;

      for (let i = 0; i < dividendCodes.length; i += batchSize) {
        const batch = dividendCodes.slice(i, i + batchSize);
        await Promise.all(batch.map(async (code) => {
          try {
            const intRes = await axios.get(`https://m.stock.naver.com/api/stock/${code}/integration`, {
              headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36" },
              timeout: 5000,
            });
            const data = intRes.data;
            const infos = data?.totalInfos || [];

            const getVal = (key: string) => {
              const item = infos.find((i: any) => i.key === key);
              return item?.value || "";
            };

            const dividendYieldStr = getVal("배당수익률");
            const dividendYield = parseFloat(dividendYieldStr.replace(/[^0-9.]/g, "")) || 0;

            // 배당수익률이 0 이상인 종목만
            if (dividendYield > 0) {
              const priceStr = getVal("전일");
              const closePrice = priceStr.replace(/,/g, "");

              dividendStocks.push({
                code,
                name: data?.stockName || code,
                market: data?.stockEndType === "kosdaq" ? "KOSDAQ" : "KOSPI",
                closePrice: closePrice || "0",
                change: "0",
                changeRate: "0",
                eps: getVal("EPS").replace(/원|,/g, "") || "-",
                per: getVal("PER").replace(/배/g, "") || "-",
                bps: getVal("BPS").replace(/원|,/g, "") || "-",
                pbr: getVal("PBR").replace(/배/g, "") || "-",
                dps: getVal("주당배당금").replace(/원|,/g, "") || "0",
                dividendYield: dividendYield.toFixed(2),
              });
            }
          } catch (e: any) {
            // 개별 종목 실패 무시
          }
        }));
      }

      // 배당수익률 내림차순 정렬
      dividendStocks.sort((a, b) => parseFloat(b.dividendYield) - parseFloat(a.dividendYield));

      res.json({
        stocks: dividendStocks,
        tradingDate: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
        totalCount: dividendStocks.length,
        updatedAt: new Date().toLocaleString("ko-KR"),
      });
    } catch (error: any) {
      console.error("[DividendCalendar] Error:", error.message);
      res.status(500).json({ message: "배당 일정 조회 실패" });
    }
  });

  // ========== ETC Markets (채권·환율·크립토·원자재) ==========

  // --- 1) 채권/금리 ---
  app.get("/api/markets/etc/bonds", async (_req, res) => {
    try {
      const bonds: any[] = [];
      const domestic: any[] = [];

      // 1) 해외 금리: Yahoo Finance API (가장 안정적)
      const yahooBonds = [
        { name: "미국 국채 10년", symbol: "^TNX", category: "us" },
        { name: "미국 국채 5년", symbol: "^FVX", category: "us" },
        { name: "미국 국채 30년", symbol: "^TYX", category: "us" },
        { name: "미국 T-Bill 13주", symbol: "^IRX", category: "us" },
      ];

      await Promise.all(yahooBonds.map(async (b) => {
        try {
          const apiRes = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(b.symbol)}`, {
            params: { range: "5d", interval: "1d" },
            headers: { "User-Agent": UA }, timeout: 8000,
          });
          const meta = apiRes.data?.chart?.result?.[0]?.meta || {};
          const price = meta.regularMarketPrice || 0;
          const prev = meta.chartPreviousClose || meta.previousClose || 0;
          const change = prev ? parseFloat((price - prev).toFixed(3)) : 0;
          const changeRate = prev ? parseFloat(((change / prev) * 100).toFixed(2)) : 0;
          bonds.push({
            name: b.name,
            symbol: b.symbol,
            category: b.category,
            value: price,
            change,
            changeRate,
            high: meta.regularMarketDayHigh || 0,
            low: meta.regularMarketDayLow || 0,
          });
        } catch {
          bonds.push({ name: b.name, symbol: b.symbol, category: b.category, value: 0, change: 0, changeRate: 0, high: 0, low: 0 });
        }
      }));

      // 2) 국내 금리: Naver 금융 marketindex 페이지 스크래핑
      try {
        const exRes = await axios.get("https://finance.naver.com/marketindex/", {
          headers: { "User-Agent": UA }, timeout: 8000, responseType: "arraybuffer",
        });
        const iconv = await import("iconv-lite");
        const html = iconv.default.decode(Buffer.from(exRes.data), "euc-kr");
        const $ = cheerio.load(html);

        // 국내시장금리 테이블
        const bondTable = $("h3:contains('국내시장금리')").closest(".section_bond, .section, div").find("table");
        if (bondTable.length === 0) {
          // 대안: 텍스트 기반 검색
          $("table").each((_i, tbl) => {
            const text = $(tbl).text();
            if (text.includes("CD금리") || text.includes("국고채") || text.includes("콜 금리")) {
              $(tbl).find("tr").each((_j, row) => {
                const tds = $(row).find("td, th");
                if (tds.length >= 2) {
                  const name = $(tds[0]).text().trim();
                  const value = parseFloat($(tds[1]).text().replace(/,/g, "")) || 0;
                  const change = tds.length >= 3 ? parseFloat($(tds[2]).text().replace(/,/g, "")) || 0 : 0;
                  // 채권/금리와 관련 없는 항목 제외 (주의: "금"은 "금리"에 포함되므로 정확 매칭 필요)
                  const nonBondPatterns = [/달러\s*인덱스/, /환율/, /USD\//, /유가/, /^금\s/, /국제\s*금/];
                  if (name && value > 0 && !name.includes("구분") && !nonBondPatterns.some(p => p.test(name))) {
                    domestic.push({
                      name,
                      symbol: name,
                      category: "kr",
                      value,
                      change,
                      changeRate: value > 0 ? parseFloat(((change / (value - change)) * 100).toFixed(2)) : 0,
                      high: 0, low: 0,
                    });
                  }
                }
              });
            }
          });
        } else {
          bondTable.find("tr").each((_j, row) => {
            const tds = $(row).find("td, th");
            if (tds.length >= 2) {
              const name = $(tds[0]).text().trim();
              const value = parseFloat($(tds[1]).text().replace(/,/g, "")) || 0;
              const change = tds.length >= 3 ? parseFloat($(tds[2]).text().replace(/,/g, "")) || 0 : 0;
              const nonBondPatterns = [/달러\s*인덱스/, /환율/, /USD\//, /유가/, /^금\s/, /국제\s*금/];
              if (name && value > 0 && !name.includes("구분") && !nonBondPatterns.some(p => p.test(name))) {
                domestic.push({
                  name,
                  symbol: name,
                  category: "kr",
                  value,
                  change,
                  changeRate: value > 0 ? parseFloat(((change / (value - change)) * 100).toFixed(2)) : 0,
                  high: 0, low: 0,
                });
              }
            }
          });
        }
      } catch (err: any) {
        console.log("[ETC] Naver domestic bonds error:", err.message);
      }

      res.json({
        bonds: [...bonds, ...domestic],
        updatedAt: new Date().toLocaleString("ko-KR"),
      });
    } catch (error: any) {
      console.error("[ETC] Bonds error:", error.message);
      res.status(500).json({ message: "채권/금리 조회 실패" });
    }
  });

  // --- 2) 환율 ---
  app.get("/api/markets/etc/forex", async (_req, res) => {
    try {
      const rates: any[] = [];
      const forexSymbols = [
        { name: "USD/KRW (달러)", symbol: "FX_USDKRW" },
        { name: "EUR/KRW (유로)", symbol: "FX_EURKRW" },
        { name: "JPY/KRW (엔화, 100엔)", symbol: "FX_JPYKRW" },
        { name: "CNY/KRW (위안)", symbol: "FX_CNYKRW" },
        { name: "GBP/KRW (파운드)", symbol: "FX_GBPKRW" },
        { name: "EUR/USD", symbol: "FX_EURUSD" },
        { name: "USD/JPY", symbol: "FX_USDJPY" },
        { name: "GBP/USD", symbol: "FX_GBPUSD" },
      ];

      // Naver marketindex API
      try {
        const exRes = await axios.get("https://finance.naver.com/marketindex/", {
          headers: { "User-Agent": UA }, timeout: 8000, responseType: "arraybuffer",
        });
        const iconv = await import("iconv-lite");
        const html = iconv.default.decode(Buffer.from(exRes.data), "euc-kr");
        const $ = cheerio.load(html);

        // 환율 관련 키워드 (비환율 항목 필터링용)
        const nonForexKeywords = ["WTI", "휘발유", "국내 금", "국제 금", "금 선물"];

        // 주요 환율 리스트
        $(".market_data .data_lst li").each((_i, el) => {
          // .blind 텍스트만 사용해서 중복 방지
          let name = $(el).find("h3 .blind").first().text().trim().replace("전일대비", "").trim();
          if (!name) name = $(el).find("h3").first().text().trim().replace("전일대비", "").trim();
          const value = parseFloat($(el).find(".value").text().replace(/,/g, "")) || 0;
          const change = parseFloat($(el).find(".change").text().replace(/,/g, "")) || 0;
          const isDown = $(el).find(".ico.down").length > 0 || $(el).hasClass("dn");
          // 비환율 항목 제외
          if (name && value > 0 && !nonForexKeywords.some(kw => name.includes(kw))) {
            rates.push({
              name,
              value,
              change: isDown ? -Math.abs(change) : Math.abs(change),
              changeRate: value > 0 ? parseFloat(((change / (value - (isDown ? -change : change))) * 100).toFixed(2)) : 0,
            });
          }
        });

        // 추가 환율 (exchange rate table)
        $(".tbl_exchange tbody tr").each((_i, row) => {
          const tds = $(row).find("td");
          if (tds.length < 4) return;
          const currency = $(tds[0]).text().trim();
          const ttb = parseFloat($(tds[1]).text().replace(/,/g, "")) || 0;
          const tts = parseFloat($(tds[2]).text().replace(/,/g, "")) || 0;
          const baseRate = parseFloat($(tds[3]).text().replace(/,/g, "")) || 0;
          if (currency && baseRate > 0 && rates.length < 20) {
            rates.push({ name: currency, value: baseRate, change: 0, changeRate: 0, ttb, tts });
          }
        });
      } catch {}

      // 폴백: polling API
      if (rates.length === 0) {
        await Promise.all(forexSymbols.map(async (f) => {
          try {
            const apiRes = await axios.get(`https://polling.finance.naver.com/api/realtime?query=${f.symbol}`, {
              headers: { "User-Agent": UA }, timeout: 5000,
            });
            const data = apiRes.data?.result?.areas?.[0]?.datas?.[0] || {};
            rates.push({
              name: f.name,
              value: parseFloat(data.nv) || 0,
              change: parseFloat(data.cv) || 0,
              changeRate: parseFloat(data.cr) || 0,
            });
          } catch {
            rates.push({ name: f.name, value: 0, change: 0, changeRate: 0 });
          }
        }));
      }

      res.json({ rates, updatedAt: new Date().toLocaleString("ko-KR") });
    } catch (error: any) {
      console.error("[ETC] Forex error:", error.message);
      res.status(500).json({ message: "환율 조회 실패" });
    }
  });

  // --- 3) 크립토 ---
  app.get("/api/markets/etc/crypto", async (_req, res) => {
    try {
      const cryptos: any[] = [];
      let usdKrw = 1440; // 기본 환율 (fallback)

      // USD/KRW 환율 조회
      try {
        const fxRes = await axios.get("https://finance.naver.com/marketindex/", {
          headers: { "User-Agent": UA }, timeout: 5000, responseType: "arraybuffer",
        });
        const iconv = await import("iconv-lite");
        const fxHtml = iconv.default.decode(Buffer.from(fxRes.data), "euc-kr");
        const $fx = cheerio.load(fxHtml);
        $fx(".market_data .data_lst li").each((_i, el) => {
          const name = $fx(el).find("h3 .blind").first().text().trim();
          if (name.includes("미국") || name.includes("USD")) {
            const val = parseFloat($fx(el).find(".value").text().replace(/,/g, "")) || 0;
            if (val > 0) usdKrw = val;
          }
        });
      } catch {}
      
      // CoinGecko Public API - USD 기준으로 조회
      try {
        const cgRes = await axios.get("https://api.coingecko.com/api/v3/coins/markets", {
          params: {
            vs_currency: "usd",
            order: "market_cap_desc",
            per_page: 20,
            page: 1,
            sparkline: true,
            price_change_percentage: "1h,24h,7d",
          },
          headers: { "User-Agent": UA },
          timeout: 10000,
        });
        
        for (const coin of cgRes.data || []) {
          const priceUsd = coin.current_price || 0;
          cryptos.push({
            rank: coin.market_cap_rank,
            name: coin.name,
            symbol: (coin.symbol || "").toUpperCase(),
            image: coin.image,
            priceUsd,
            priceKrw: Math.round(priceUsd * usdKrw),
            change24h: coin.price_change_percentage_24h || 0,
            change7d: coin.price_change_percentage_7d_in_currency || 0,
            change1h: coin.price_change_percentage_1h_in_currency || 0,
            marketCapUsd: coin.market_cap,
            volume24hUsd: coin.total_volume,
            high24hUsd: coin.high_24h,
            low24hUsd: coin.low_24h,
            sparkline: coin.sparkline_in_7d?.price?.filter((_: any, i: number) => i % 8 === 0) || [],
          });
        }
      } catch (cgErr: any) {
        console.log("[ETC] CoinGecko fallback to Upbit:", cgErr.message);
        // 폴백: Upbit (KRW 기준)
        const cryptoSymbols = [
          { name: "비트코인", symbol: "BTC" },
          { name: "이더리움", symbol: "ETH" },
          { name: "리플", symbol: "XRP" },
          { name: "솔라나", symbol: "SOL" },
          { name: "에이다", symbol: "ADA" },
          { name: "도지코인", symbol: "DOGE" },
        ];
        for (const c of cryptoSymbols) {
          try {
            const apiRes = await axios.get(`https://api.upbit.com/v1/ticker?markets=KRW-${c.symbol}`, {
              headers: { "User-Agent": UA }, timeout: 5000,
            });
            const data = apiRes.data?.[0] || {};
            const priceKrw = data.trade_price || 0;
            cryptos.push({
              rank: cryptos.length + 1,
              name: c.name,
              symbol: c.symbol,
              image: "",
              priceUsd: usdKrw > 0 ? parseFloat((priceKrw / usdKrw).toFixed(2)) : 0,
              priceKrw,
              change24h: (data.signed_change_rate || 0) * 100,
              change7d: 0,
              change1h: 0,
              marketCapUsd: 0,
              volume24hUsd: usdKrw > 0 ? Math.round((data.acc_trade_price_24h || 0) / usdKrw) : 0,
              high24hUsd: usdKrw > 0 ? parseFloat(((data.high_price || 0) / usdKrw).toFixed(2)) : 0,
              low24hUsd: usdKrw > 0 ? parseFloat(((data.low_price || 0) / usdKrw).toFixed(2)) : 0,
              sparkline: [],
            });
          } catch {}
        }
      }

      // 김치프리미엄 계산 (BTC, ETH, XRP) - Upbit 국내가격 vs CoinGecko 글로벌가격
      const kimchiTargets = ["BTC", "ETH", "XRP", "USDT", "USDC"];
      const kimchiPremiums: Record<string, { upbitKrw: number; premium: number }> = {};
      try {
        const upbitMarkets = kimchiTargets.map(s => `KRW-${s}`).join(",");
        const upbitRes = await axios.get(`https://api.upbit.com/v1/ticker?markets=${upbitMarkets}`, {
          headers: { "User-Agent": UA }, timeout: 5000,
        });
        for (const tick of upbitRes.data || []) {
          const sym = (tick.market || "").replace("KRW-", "");
          const upbitKrw = tick.trade_price || 0;
          const globalCoin = cryptos.find((c: any) => c.symbol === sym);
          if (globalCoin && globalCoin.priceUsd > 0 && usdKrw > 0 && upbitKrw > 0) {
            const globalKrw = globalCoin.priceUsd * usdKrw;
            const premium = parseFloat((((upbitKrw - globalKrw) / globalKrw) * 100).toFixed(2));
            kimchiPremiums[sym] = { upbitKrw, premium };
            // crypto 항목에 김치프리미엄 정보 추가
            globalCoin.upbitKrw = upbitKrw;
            globalCoin.kimchiPremium = premium;
          }
        }
      } catch (kpErr: any) {
        console.log("[ETC] Kimchi premium fetch error:", kpErr.message);
      }

      res.json({ cryptos, usdKrw, kimchiPremiums, updatedAt: new Date().toLocaleString("ko-KR") });
    } catch (error: any) {
      console.error("[ETC] Crypto error:", error.message);
      res.status(500).json({ message: "크립토 조회 실패" });
    }
  });

  // --- 4) 원자재/실물자산 ---
  app.get("/api/markets/etc/commodities", async (_req, res) => {
    try {
      const commodities: any[] = [];
      
      // Yahoo Finance API로 원자재 데이터 (가장 안정적)
      const yahooCommodities = [
        { name: "금 (Gold)", symbol: "GC=F", category: "metals", unit: "USD/oz" },
        { name: "은 (Silver)", symbol: "SI=F", category: "metals", unit: "USD/oz" },
        { name: "구리 (Copper)", symbol: "HG=F", category: "metals", unit: "USD/lb" },
        { name: "WTI 원유", symbol: "CL=F", category: "energy", unit: "USD/bbl" },
        { name: "브렌트 원유", symbol: "BZ=F", category: "energy", unit: "USD/bbl" },
        { name: "천연가스", symbol: "NG=F", category: "energy", unit: "USD/MMBtu" },
        { name: "옥수수 (Corn)", symbol: "ZC=F", category: "agriculture", unit: "USd/bu" },
        { name: "대두 (Soybean)", symbol: "ZS=F", category: "agriculture", unit: "USd/bu" },
        { name: "밀 (Wheat)", symbol: "ZW=F", category: "agriculture", unit: "USd/bu" },
        { name: "팔라듐", symbol: "PA=F", category: "metals", unit: "USD/oz" },
        { name: "백금 (Platinum)", symbol: "PL=F", category: "metals", unit: "USD/oz" },
      ];

      await Promise.all(yahooCommodities.map(async (c) => {
        try {
          const apiRes = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(c.symbol)}`, {
            params: { range: "5d", interval: "1d" },
            headers: { "User-Agent": UA }, timeout: 8000,
          });
          const meta = apiRes.data?.chart?.result?.[0]?.meta || {};
          const price = meta.regularMarketPrice || 0;
          const prev = meta.chartPreviousClose || meta.previousClose || 0;
          const change = prev ? parseFloat((price - prev).toFixed(3)) : 0;
          const changeRate = prev ? parseFloat(((change / prev) * 100).toFixed(2)) : 0;
          commodities.push({
            name: c.name,
            symbol: c.symbol,
            category: c.category,
            value: price,
            change,
            changeRate,
            high: meta.regularMarketDayHigh || 0,
            low: meta.regularMarketDayLow || 0,
            unit: c.unit,
          });
        } catch {
          commodities.push({ name: c.name, symbol: c.symbol, category: c.category, value: 0, change: 0, changeRate: 0, high: 0, low: 0, unit: c.unit });
        }
      }));

      // Naver에서 국내 금가격, WTI, 휘발유 추가 (원화 기준)
      try {
        const exRes = await axios.get("https://finance.naver.com/marketindex/", {
          headers: { "User-Agent": UA }, timeout: 8000, responseType: "arraybuffer",
        });
        const iconv = await import("iconv-lite");
        const html = iconv.default.decode(Buffer.from(exRes.data), "euc-kr");
        const $ = cheerio.load(html);

        $(".market_data .data_lst li").each((_i, el) => {
          let name = $(el).find("h3 .blind").first().text().trim().replace("전일대비", "").trim();
          if (!name) name = $(el).find("h3").first().text().trim().replace("전일대비", "").trim();
          const value = parseFloat($(el).find(".value").text().replace(/,/g, "")) || 0;
          const change = parseFloat($(el).find(".change").text().replace(/,/g, "")) || 0;
          const isDown = $(el).find(".ico.down").length > 0 || $(el).hasClass("dn");
          if (name && value > 0 && (name.includes("국내 금") || name.includes("휘발유"))) {
            commodities.push({
              name: name + " (KRW)",
              symbol: name,
              category: name.includes("금") ? "metals" : "energy",
              value,
              change: isDown ? -Math.abs(change) : Math.abs(change),
              changeRate: value > 0 ? parseFloat(((change / (value - (isDown ? -change : change))) * 100).toFixed(2)) : 0,
              high: 0, low: 0,
              unit: "원",
            });
          }
        });
      } catch {}

      res.json({ commodities, updatedAt: new Date().toLocaleString("ko-KR") });
    } catch (error: any) {
      console.error("[ETC] Commodities error:", error.message);
      res.status(500).json({ message: "원자재 조회 실패" });
    }
  });

  // --- 5) ETC 마켓 차트 (캔들차트 데이터) ---
  app.get("/api/markets/etc/chart", async (req, res) => {
    try {
      const symbol = req.query.symbol as string;
      const type = req.query.type as string; // bond, forex, crypto, commodity
      const period = (req.query.period as string) || "day";

      if (!symbol) return res.status(400).json({ message: "symbol 파라미터가 필요합니다" });

      // Yahoo Finance 심볼 매핑
      let yahooSymbol = symbol;

      // 환율: 내부 심볼 → Yahoo Finance 변환
      const forexMap: Record<string, string> = {
        "FX_USDKRW": "USDKRW=X",
        "FX_EURKRW": "EURKRW=X",
        "FX_JPYKRW": "JPYKRW=X",
        "FX_CNYKRW": "CNYKRW=X",
        "FX_GBPKRW": "GBPKRW=X",
        "FX_EURUSD": "EURUSD=X",
        "FX_USDJPY": "USDJPY=X",
        "FX_GBPUSD": "GBPUSD=X",
        // 네이버에서 가져온 이름 기반 매핑
        "미국 USD": "USDKRW=X",
        "유럽연합 EUR": "EURKRW=X",
        "일본 JPY(100엔)": "JPYKRW=X",
        "일본 JPY": "JPYKRW=X",
        "중국 CNY": "CNYKRW=X",
        "영국 GBP": "GBPKRW=X",
        "EUR/USD": "EURUSD=X",
        "USD/JPY": "USDJPY=X",
        "GBP/USD": "GBPUSD=X",
      };
      if (type === "forex") {
        yahooSymbol = forexMap[symbol] || symbol;
        // 여전히 FX_ prefix면 변환 시도
        if (yahooSymbol === symbol && !symbol.includes("=")) {
          // 일반 텍스트 이름에서 매칭 시도
          for (const [key, val] of Object.entries(forexMap)) {
            if (symbol.includes(key) || key.includes(symbol)) {
              yahooSymbol = val;
              break;
            }
          }
        }
      }

      // 크립토: 심볼 → Yahoo Finance (BTC → BTC-USD)
      if (type === "crypto") {
        yahooSymbol = symbol.includes("-") ? symbol : `${symbol}-USD`;
      }

      // 국내 금리 (^으로 시작하지 않는 채권)는 차트 데이터 없음
      if (type === "bond" && !symbol.startsWith("^")) {
        return res.json({ chartData: [], message: "국내 금리 데이터는 차트를 지원하지 않습니다" });
      }

      // 국내 원자재 (원화 기준)는 차트 데이터 없음
      if (type === "commodity" && !symbol.includes("=") && !symbol.includes("-") && !symbol.match(/^[A-Z]/)) {
        return res.json({ chartData: [], message: "국내 원자재 데이터는 차트를 지원하지 않습니다" });
      }

      const periodConfig: Record<string, { interval: string; range: string }> = {
        day: { interval: "1d", range: "6mo" },
        week: { interval: "1wk", range: "2y" },
        month: { interval: "1mo", range: "5y" },
      };
      const pConf = periodConfig[period] || periodConfig.day;

      const chartRes = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`,
        {
          params: { range: pConf.range, interval: pConf.interval },
          headers: { "User-Agent": UA },
          timeout: 10000,
        }
      ).catch(() => null);

      const result = chartRes?.data?.chart?.result?.[0];
      if (!result) return res.json({ chartData: [] });

      const timestamps = result.timestamp || [];
      const quote = result.indicators?.quote?.[0] || {};
      const opens = quote.open || [];
      const highs = quote.high || [];
      const lows = quote.low || [];
      const closes = quote.close || [];
      const volumes = quote.volume || [];

      const items: any[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (opens[i] == null || closes[i] == null) continue;
        const dt = new Date(timestamps[i] * 1000);
        const decimals = type === "bond" ? 4 : type === "forex" ? 4 : type === "crypto" ? 2 : 2;
        items.push({
          date: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`,
          open: parseFloat(opens[i]?.toFixed(decimals)) || 0,
          high: parseFloat(highs[i]?.toFixed(decimals)) || 0,
          low: parseFloat(lows[i]?.toFixed(decimals)) || 0,
          close: parseFloat(closes[i]?.toFixed(decimals)) || 0,
          volume: volumes[i] || 0,
        });
      }

      // 이동평균선 계산
      const calcMA = (data: any[], maPeriod: number) => {
        return data.map((item, idx) => {
          if (idx < maPeriod - 1) return { ...item, [`ma${maPeriod}`]: null };
          const slice = data.slice(idx - maPeriod + 1, idx + 1);
          const avg = slice.reduce((s: number, d: any) => s + d.close, 0) / maPeriod;
          return { ...item, [`ma${maPeriod}`]: parseFloat(avg.toFixed(4)) };
        });
      };

      let enriched = items;
      enriched = calcMA(enriched, 5);
      enriched = calcMA(enriched, 20);
      enriched = calcMA(enriched, 60);

      const meta = result.meta || {};
      res.json({
        chartData: enriched,
        meta: {
          symbol: meta.symbol,
          currency: meta.currency,
          exchangeName: meta.exchangeName,
          regularMarketPrice: meta.regularMarketPrice,
        },
      });
    } catch (error: any) {
      console.error("[ETC] Chart error:", error.message);
      res.status(500).json({ message: "차트 데이터 조회 실패" });
    }
  });

  // ========== 종목코드 검색 ==========
  app.get("/api/stock/search", async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) return res.status(400).json({ message: "종목코드를 입력해주세요." });

      // 네이버 자동완성 API (UTF-8 JSON, 인코딩 문제 없음)
      const acRes = await axios.get(`https://ac.stock.naver.com/ac`, {
        params: { q: code, target: "stock" },
        headers: { "User-Agent": UA },
        timeout: 5000,
      }).catch(() => null);

      if (acRes?.data?.items && acRes.data.items.length > 0) {
        // 국내 종목만 필터 (nationCode === "KOR")
        const korItems = acRes.data.items.filter((item: any) => item.nationCode === "KOR");
        const results = korItems.slice(0, 15).map((item: any) => ({
          code: item.code,
          name: item.name,
          exchange: (item.typeCode || "").toUpperCase().includes("KOSDAQ") ? "KOSDAQ" : "KOSPI",
          typeName: item.typeName || "",
        }));
        if (results.length > 0) return res.json({ items: results });
      }

      res.status(404).json({ message: "종목을 찾을 수 없습니다." });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "종목 검색 실패" });
    }
  });

  // ========== 해외 종목 검색 ==========
  app.get("/api/stock/search-overseas", async (req, res) => {
    try {
      const symbol = (req.query.symbol as string || "").toUpperCase();
      if (!symbol) return res.status(400).json({ message: "티커를 입력해주세요." });

      // 네이버 자동완성 API (UTF-8 JSON)
      const acRes = await axios.get(`https://ac.stock.naver.com/ac`, {
        params: { q: symbol, target: "stock" },
        headers: { "User-Agent": UA },
        timeout: 5000,
      }).catch(() => null);

      if (acRes?.data?.items && acRes.data.items.length > 0) {
        // 해외 종목만 필터 (nationCode !== "KOR")
        const overseasItems = acRes.data.items.filter((item: any) => item.nationCode !== "KOR");
        const results = overseasItems.slice(0, 15).map((item: any) => {
          let exchange = "NASDAQ";
          const typeCode = (item.typeCode || "").toUpperCase();
          if (typeCode.includes("NYSE")) exchange = "NYSE";
          else if (typeCode.includes("NASDAQ")) exchange = "NASDAQ";
          else if (typeCode.includes("AMEX")) exchange = "AMEX";
          else if (typeCode.includes("TSE") || typeCode.includes("TOKYO")) exchange = "TSE";
          else if (typeCode.includes("HKEX") || typeCode.includes("HK")) exchange = "HKEX";
          else if (typeCode.includes("SSE") || typeCode.includes("SHANGHAI")) exchange = "SSE";
          return {
            code: item.code,
            name: item.name,
            exchange,
            typeName: item.typeName || "",
            nationName: item.nationName || "",
          };
        });
        if (results.length > 0) return res.json({ items: results });
      }

      res.status(404).json({ message: "종목을 찾을 수 없습니다." });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "해외 종목 검색 실패" });
    }
  });

  // ========== 종목 통합 검색 (국내+해외) ==========
  app.get("/api/stock/search-autocomplete", async (req, res) => {
    try {
      const query = (req.query.query as string || "").trim();
      if (!query) return res.status(400).json({ items: [] });

      const acRes = await axios.get(`https://ac.stock.naver.com/ac`, {
        params: { q: query, target: "stock" },
        headers: { "User-Agent": UA },
        timeout: 5000,
      }).catch(() => null);

      if (!acRes?.data?.items || acRes.data.items.length === 0) {
        return res.json({ items: [] });
      }

      const results = acRes.data.items.slice(0, 20).map((item: any) => {
        const isKOR = item.nationCode === "KOR";
        let exchange = "KOSPI";
        const typeCode = (item.typeCode || "").toUpperCase();
        if (isKOR) {
          exchange = typeCode.includes("KOSDAQ") ? "KOSDAQ" : "KOSPI";
        } else {
          if (typeCode.includes("NYSE")) exchange = "NYSE";
          else if (typeCode.includes("NASDAQ")) exchange = "NASDAQ";
          else if (typeCode.includes("AMEX")) exchange = "AMEX";
          else if (typeCode.includes("TSE") || typeCode.includes("TOKYO")) exchange = "TSE";
          else if (typeCode.includes("HKEX") || typeCode.includes("HK")) exchange = "HKEX";
          else if (typeCode.includes("SSE") || typeCode.includes("SHANGHAI")) exchange = "SSE";
          else exchange = "NASDAQ";
        }
        return {
          code: item.code,
          name: item.name,
          exchange,
          typeName: item.typeName || "",
          nationName: item.nationName || "",
          nationCode: item.nationCode || "",
        };
      });

      res.json({ items: results });
    } catch (error: any) {
      res.status(500).json({ items: [], message: error.message || "검색 실패" });
    }
  });

  // ========== 관심종목 (주식정보) ==========

  // 관심종목 목록 조회 (공통)
  app.get("/api/watchlist-stocks", async (req, res) => {
    try {
      const market = req.query.market as string | undefined;
      const listType = (req.query.listType as string) || "common";
      const userId = req.session?.userId;
      
      // "shared" 타입 조회: 개인관심이지만 isShared=true인 종목 (모든 계정에 표시)
      if (listType === "shared") {
        const stocks = await storage.getWatchlistStocksShared(market);
        return res.json(stocks);
      }

      if (listType === "personal" && !userId && !req.session?.isAdmin) {
        return res.json([]);
      }
      const stocks = await storage.getWatchlistStocks(market, listType, userId || undefined);
      res.json(stocks);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "관심종목 조회 실패" });
    }
  });

  // 공통관심 종목 등록 (admin만)
  app.post("/api/watchlist-stocks/common", requireAdmin, async (req, res) => {
    try {
      const stock = await storage.createWatchlistStock({
        ...req.body,
        listType: "common",
        userId: null,
      });
      res.json(stock);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "공통관심 등록 실패" });
    }
  });

  // 개인관심 종목 등록 (로그인 사용자)
  app.post("/api/watchlist-stocks/personal", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(400).json({ message: "사용자 ID가 필요합니다." });
      const { isShared, ...restBody } = req.body;
      const userName = req.session?.userName || req.session?.userEmail || "사용자";
      const stock = await storage.createWatchlistStock({
        ...restBody,
        listType: "personal",
        userId,
        isShared: isShared === true,
        sharedBy: isShared === true ? userName : null,
      });
      res.json(stock);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "개인관심 등록 실패" });
    }
  });

  // 관심종목 수정 (admin: 공통, user: 본인 개인)
  app.patch("/api/watchlist-stocks/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getWatchlistStock(id);
      if (!existing) return res.status(404).json({ message: "종목을 찾을 수 없습니다." });
      
      // 공통관심은 admin만 수정, 개인관심은 본인만 수정
      if (existing.listType === "common" && !req.session?.isAdmin) {
        return res.status(403).json({ message: "공통관심 수정은 관리자만 가능합니다." });
      }
      if (existing.listType === "personal" && existing.userId !== req.session?.userId) {
        return res.status(403).json({ message: "본인의 개인관심만 수정 가능합니다." });
      }
      
      const stock = await storage.updateWatchlistStock(id, req.body);
      res.json(stock);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "관심종목 수정 실패" });
    }
  });

  // 관심종목 삭제 (admin: 공통, user: 본인 개인)
  app.delete("/api/watchlist-stocks/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getWatchlistStock(id);
      if (!existing) return res.status(404).json({ message: "종목을 찾을 수 없습니다." });
      
      if (existing.listType === "common" && !req.session?.isAdmin) {
        return res.status(403).json({ message: "공통관심 삭제는 관리자만 가능합니다." });
      }
      if (existing.listType === "personal" && existing.userId !== req.session?.userId) {
        return res.status(403).json({ message: "본인의 개인관심만 삭제 가능합니다." });
      }
      
      await storage.deleteWatchlistStock(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "관심종목 삭제 실패" });
    }
  });

  // 관심종목 실시간 시세 조회 (네이버)
  app.get("/api/watchlist-stocks/realtime", async (req, res) => {
    try {
      const market = (req.query.market as string) || "domestic";
      const listType = (req.query.listType as string) || "common";
      const userId = req.session?.userId;
      const stocks = await storage.getWatchlistStocks(market, listType, userId || undefined);
      if (stocks.length === 0) return res.json([]);

      const results = await Promise.allSettled(
        stocks.map(async (stock) => {
          try {
            // m.stock.naver.com API로 기본 시세 + 시가총액/PER/PBR 조회
            const [basicRes, integrationRes] = await Promise.all([
              axios.get(`https://m.stock.naver.com/api/stock/${stock.stockCode}/basic`, {
                headers: { "User-Agent": UA }, timeout: 5000,
              }).catch(() => null),
              axios.get(`https://m.stock.naver.com/api/stock/${stock.stockCode}/integration`, {
                headers: { "User-Agent": UA }, timeout: 5000,
              }).catch(() => null),
            ]);

            const b = basicRes?.data;
            const currentPrice = parseInt((b?.closePrice || "0").replace(/,/g, "")) || 0;
            const changeVal = parseInt((b?.compareToPreviousClosePrice || "0").replace(/,/g, "")) || 0;
            const changeRate = parseFloat(b?.fluctuationsRatio || "0") || 0;
            const isRising = b?.compareToPreviousPrice?.name === "RISING";
            const isFalling = b?.compareToPreviousPrice?.name === "FALLING";

            // totalInfos에서 시가총액, PER, PBR, 거래량 추출
            const infos = integrationRes?.data?.totalInfos || [];
            const getInfo = (code: string) => {
              const item = infos.find((i: any) => i.code === code);
              return item?.value || "-";
            };

            return {
              ...stock,
              currentPrice,
              changeVal: isFalling ? -Math.abs(changeVal) : isRising ? Math.abs(changeVal) : changeVal,
              changeRate: isFalling ? -Math.abs(changeRate) : isRising ? Math.abs(changeRate) : changeRate,
              marketCap: getInfo("marketValue"),
              volume: getInfo("accumulatedTradingVolume"),
              per: getInfo("per"),
              pbr: getInfo("pbr"),
            };
          } catch (e) {
            return { ...stock, currentPrice: 0, changeVal: 0, changeRate: 0, marketCap: "-", volume: "-", per: "-", pbr: "-" };
          }
        })
      );

      const data = results.map(r => r.status === "fulfilled" ? r.value : null).filter(Boolean);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "실시간 시세 조회 실패" });
    }
  });

  // 해외 관심종목 실시간 시세 조회
  app.get("/api/watchlist-stocks/overseas/realtime", async (req, res) => {
    try {
      const listType = (req.query.listType as string) || "common";
      const userId = req.session?.userId;
      const stocks = await storage.getWatchlistStocks("overseas", listType, userId || undefined);
      if (stocks.length === 0) return res.json([]);

      const results = await Promise.allSettled(
        stocks.map(async (stock) => {
          try {
            // 거래소 suffix 매핑 (네이버 해외주식 API: 코드.접미사 형식)
            let suffix = ".O"; // 기본 NASDAQ
            switch (stock.exchange?.toUpperCase()) {
              case "NYSE": suffix = ".N"; break;
              case "NASDAQ": suffix = ".O"; break;
              case "AMEX": suffix = ".A"; break;
              case "TSE": case "TYO": suffix = ".T"; break;
              case "HKEX": case "HKS": suffix = ".HK"; break;
              case "SSE": case "SHG": suffix = ".SS"; break;
              case "SHE": case "SZE": suffix = ".SZ"; break;
            }

            const apiRes = await axios.get(`https://api.stock.naver.com/stock/${stock.stockCode}${suffix}/basic`, {
              headers: { "User-Agent": UA },
              timeout: 5000,
            });

            const d = apiRes.data;
            const currentPrice = parseFloat(d.closePrice) || 0;
            const changeVal = parseFloat(d.compareToPreviousClosePrice) || 0;
            const changeRate = parseFloat(d.fluctuationsRatio) || 0;
            const infosArr = d.stockItemTotalInfos || [];
            const getInfoVal = (c: string) => {
              const item = infosArr.find((i: any) => i.code === c);
              return item?.value || "-";
            };
            const volume = getInfoVal("accumulatedTradingVolume");
            const marketCap = getInfoVal("marketValue");

            return {
              ...stock,
              currentPrice,
              changeVal,
              changeRate,
              marketCap,
              volume,
            };
          } catch {
            return { ...stock, currentPrice: 0, changeVal: 0, changeRate: 0, marketCap: "-", volume: "-" };
          }
        })
      );

      const data = results.map(r => r.status === "fulfilled" ? r.value : null).filter(Boolean);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "해외 실시간 시세 조회 실패" });
    }
  });

  // ========== 종목 상세정보 API ==========

  // 국내 종목 기본정보
  app.get("/api/stock/detail/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const integrationRes = await axios.get(`https://m.stock.naver.com/api/stock/${code}/integration`, {
        headers: { "User-Agent": UA }, timeout: 8000,
      }).catch(() => null);

      const basicRes = await axios.get(`https://m.stock.naver.com/api/stock/${code}/basic`, {
        headers: { "User-Agent": UA }, timeout: 8000,
      }).catch(() => null);

      const integration = integrationRes?.data || {};
      const basic = basicRes?.data || {};
      const infos = integration.totalInfos || [];
      const getInfo = (c: string) => {
        const item = infos.find((i: any) => i.code === c);
        return item?.value || "-";
      };

      res.json({
        stockCode: code,
        stockName: basic.stockName || integration.stockName || code,
        stockNameEng: basic.stockNameEng || "",
        market: basic.stockExchangeType?.name || getInfo("exchangeName"),
        sector: getInfo("indutyCodeName"),
        currentPrice: basic.closePrice || getInfo("nowVal"),
        changeVal: basic.compareToPreviousClosePrice || "0",
        changeRate: basic.fluctuationsRatio || "0",
        highPrice52w: getInfo("high52wPrice"),
        lowPrice52w: getInfo("low52wPrice"),
        marketCap: getInfo("marketValue"),
        per: getInfo("per"),
        pbr: getInfo("pbr"),
        eps: getInfo("eps"),
        bps: getInfo("bps"),
        dividendYield: getInfo("dividendYield"),
        foreignOwnership: getInfo("foreignRatio"),
        volume: getInfo("accumulatedTradingVolume"),
        tradingValue: getInfo("accumulatedTradingValue"),
        listedShares: getInfo("listedSharesCount"),
        description: integration.corporationSummary || "",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "종목 상세정보 조회 실패" });
    }
  });

  // 해외 종목 기본정보
  app.get("/api/stock/detail/overseas/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const exchange = (req.query.exchange as string) || "NASDAQ";

      // 네이버 해외주식 API는 "코드.접미사" 형식 사용 (AAPL.O, MSFT.O, TSLA.O 등)
      let suffix = ".O"; // 기본 NASDAQ
      switch (exchange.toUpperCase()) {
        case "NYSE": suffix = ".N"; break;
        case "NASDAQ": suffix = ".O"; break;
        case "AMEX": suffix = ".A"; break;
        case "TSE": case "TYO": suffix = ".T"; break;
        case "HKEX": case "HKS": suffix = ".HK"; break;
        case "SSE": case "SHG": suffix = ".SS"; break;
        case "SHE": case "SZE": suffix = ".SZ"; break;
      }
      const naverCode = `${code}${suffix}`;

      const basicRes = await axios.get(`https://api.stock.naver.com/stock/${naverCode}/basic`, {
        headers: { "User-Agent": UA }, timeout: 8000,
      }).catch(() => null);

      const basic = basicRes?.data || {};
      // stockItemTotalInfos에서 상세 정보 추출
      const infos = basic.stockItemTotalInfos || [];
      const getInfo = (c: string) => {
        const item = infos.find((i: any) => i.code === c);
        return item?.value || "-";
      };

      res.json({
        stockCode: code,
        stockName: basic.stockName || code,
        stockNameEng: basic.stockNameEng || basic.stockName || "",
        market: exchange,
        sector: getInfo("industryGroupKor"),
        currentPrice: basic.closePrice || "0",
        changeVal: basic.compareToPreviousClosePrice || "0",
        changeRate: basic.fluctuationsRatio || "0",
        highPrice52w: getInfo("highPriceOf52Weeks"),
        lowPrice52w: getInfo("lowPriceOf52Weeks"),
        marketCap: getInfo("marketValue"),
        per: getInfo("per"),
        pbr: getInfo("pbr"),
        eps: getInfo("eps"),
        bps: getInfo("bps"),
        dividendYield: getInfo("dividendYieldRatio"),
        foreignOwnership: "-",
        volume: getInfo("accumulatedTradingVolume") || "-",
        tradingValue: getInfo("accumulatedTradingValue") || "-",
        listedShares: basic.countOfListedStock ? basic.countOfListedStock.toLocaleString() : "-",
        description: "",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "해외 종목 상세정보 조회 실패" });
    }
  });

  // 국내 종목 차트 데이터 (봉차트용 OHLCV)
  app.get("/api/stock/chart/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const period = (req.query.period as string) || "day"; // day | week | month
      const validPeriods: Record<string, { timeframe: string; defaultCount: number }> = {
        day: { timeframe: "day", defaultCount: 120 },
        week: { timeframe: "week", defaultCount: 104 },
        month: { timeframe: "month", defaultCount: 60 },
      };
      const pConfig = validPeriods[period] || validPeriods.day;
      const count = parseInt(req.query.count as string) || pConfig.defaultCount;

      // fchart API에서 OHLCV 데이터 가져오기
      const chartRes = await axios.get(`https://fchart.stock.naver.com/sise.nhn`, {
        params: { symbol: code, timeframe: pConfig.timeframe, count, requestType: 0 },
        headers: { "User-Agent": UA },
        timeout: 8000,
        responseType: "text",
      }).catch(() => null);

      if (!chartRes?.data) return res.json({ chartData: [] });

      // XML 파싱
      const data = chartRes.data as string;
      const items: any[] = [];
      const itemRegex = /<item\s+data="([^"]+)"/g;
      let match;
      while ((match = itemRegex.exec(data)) !== null) {
        const parts = match[1].split("|");
        if (parts.length >= 6) {
          const dateStr = parts[0];
          items.push({
            date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
            open: parseFloat(parts[1]) || 0,
            high: parseFloat(parts[2]) || 0,
            low: parseFloat(parts[3]) || 0,
            close: parseFloat(parts[4]) || 0,
            volume: parseInt(parts[5]) || 0,
          });
        }
      }

      // 이동평균선 계산
      const calcMA = (data: any[], period: number) => {
        return data.map((item, idx) => {
          if (idx < period - 1) return { ...item, [`ma${period}`]: null };
          const slice = data.slice(idx - period + 1, idx + 1);
          const avg = slice.reduce((s, d) => s + d.close, 0) / period;
          return { ...item, [`ma${period}`]: Math.round(avg) };
        });
      };

      let enriched = items;
      enriched = calcMA(enriched, 5);
      enriched = calcMA(enriched, 20);
      enriched = calcMA(enriched, 60);

      // 매물대 (가격대별 거래량)
      const priceVolumeMap: Record<number, number> = {};
      const priceStep = Math.max(1, Math.round((Math.max(...items.map(d => d.high)) - Math.min(...items.map(d => d.low))) / 20));
      items.forEach(d => {
        const bucket = Math.round(((d.high + d.low) / 2) / priceStep) * priceStep;
        priceVolumeMap[bucket] = (priceVolumeMap[bucket] || 0) + d.volume;
      });
      const volumeProfile = Object.entries(priceVolumeMap)
        .map(([price, vol]) => ({ price: parseInt(price), volume: vol as number }))
        .sort((a, b) => a.price - b.price);

      res.json({ chartData: enriched, volumeProfile });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "차트 데이터 조회 실패" });
    }
  });

  // 해외 종목 차트 데이터
  app.get("/api/stock/chart/overseas/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const period = (req.query.period as string) || "day"; // day | week | month
      const periodConfig: Record<string, { interval: string; range: string }> = {
        day: { interval: "1d", range: "1y" },
        week: { interval: "1wk", range: "5y" },
        month: { interval: "1mo", range: "10y" },
      };
      const pConf = periodConfig[period] || periodConfig.day;

      // Yahoo Finance API 사용 (해외주식 차트 데이터)
      const chartRes = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${code}`, {
        params: { range: pConf.range, interval: pConf.interval },
        headers: { "User-Agent": UA },
        timeout: 10000,
      }).catch(() => null);

      const result = chartRes?.data?.chart?.result?.[0];
      if (!result) return res.json({ chartData: [], volumeProfile: [] });

      const timestamps = result.timestamp || [];
      const quote = result.indicators?.quote?.[0] || {};
      const opens = quote.open || [];
      const highs = quote.high || [];
      const lows = quote.low || [];
      const closes = quote.close || [];
      const volumes = quote.volume || [];

      const items: any[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (opens[i] == null || closes[i] == null) continue;
        const dt = new Date(timestamps[i] * 1000);
        items.push({
          date: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`,
          open: parseFloat(opens[i]?.toFixed(2)) || 0,
          high: parseFloat(highs[i]?.toFixed(2)) || 0,
          low: parseFloat(lows[i]?.toFixed(2)) || 0,
          close: parseFloat(closes[i]?.toFixed(2)) || 0,
          volume: volumes[i] || 0,
        });
      }

      // 이동평균선 계산
      const calcMA = (data: any[], period: number) => {
        return data.map((item: any, idx: number) => {
          if (idx < period - 1) return { ...item, [`ma${period}`]: null };
          const slice = data.slice(idx - period + 1, idx + 1);
          const avg = slice.reduce((s: number, d: any) => s + d.close, 0) / period;
          return { ...item, [`ma${period}`]: parseFloat(avg.toFixed(2)) };
        });
      };

      let enriched = items;
      enriched = calcMA(enriched, 5);
      enriched = calcMA(enriched, 20);
      enriched = calcMA(enriched, 60);

      // 매물대
      const priceVolumeMap: Record<number, number> = {};
      if (items.length > 0) {
        const maxP = Math.max(...items.map((d: any) => d.high));
        const minP = Math.min(...items.map((d: any) => d.low));
        const priceStep = Math.max(0.01, (maxP - minP) / 20);
        items.forEach((d: any) => {
          const bucket = parseFloat((Math.round(((d.high + d.low) / 2) / priceStep) * priceStep).toFixed(2));
          priceVolumeMap[bucket] = (priceVolumeMap[bucket] || 0) + d.volume;
        });
      }
      const volumeProfile = Object.entries(priceVolumeMap)
        .map(([price, vol]) => ({ price: parseFloat(price), volume: vol as number }))
        .sort((a, b) => a.price - b.price);

      res.json({ chartData: enriched, volumeProfile });
    } catch (error: any) {
      console.error("[Overseas Chart] Error:", error.message);
      res.status(500).json({ message: error.message || "해외 차트 데이터 조회 실패" });
    }
  });

  // 국내 종목 실적 데이터
  app.get("/api/stock/financials/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const annualData: any[] = [];
      const quarterData: any[] = [];

      // 네이버 모바일 API (UTF-8 JSON) - 연간 실적
      const annualRes = await axios.get(`https://m.stock.naver.com/api/stock/${code}/finance/annual`, {
        headers: { "User-Agent": UA }, timeout: 10000,
      }).catch(() => null);

      if (annualRes?.data?.financeInfo) {
        const fi = annualRes.data.financeInfo;
        const titles = (fi.trTitleList || []).sort((a: any, b: any) => a.key.localeCompare(b.key));
        const rowMap: Record<string, Record<string, string>> = {};
        for (const row of fi.rowList || []) {
          rowMap[row.title] = {};
          for (const [k, v] of Object.entries(row.columns || {})) {
            rowMap[row.title][k] = (v as any)?.value || "-";
          }
        }
        for (const t of titles) {
          annualData.push({
            period: t.title + (t.isConsensus === "Y" ? "(E)" : ""),
            revenue: rowMap["매출액"]?.[t.key] || "-",
            operatingProfit: rowMap["영업이익"]?.[t.key] || "-",
            netIncome: rowMap["당기순이익"]?.[t.key] || "-",
            roe: rowMap["ROE"]?.[t.key] || "-",
            eps: rowMap["EPS"]?.[t.key] || "-",
            per: rowMap["PER"]?.[t.key] || "-",
          });
        }
      }

      // 네이버 모바일 API - 분기 실적
      const quarterRes = await axios.get(`https://m.stock.naver.com/api/stock/${code}/finance/quarter`, {
        headers: { "User-Agent": UA }, timeout: 10000,
      }).catch(() => null);

      if (quarterRes?.data?.financeInfo) {
        const fi = quarterRes.data.financeInfo;
        const titles = (fi.trTitleList || []).sort((a: any, b: any) => a.key.localeCompare(b.key));
        const rowMap: Record<string, Record<string, string>> = {};
        for (const row of fi.rowList || []) {
          rowMap[row.title] = {};
          for (const [k, v] of Object.entries(row.columns || {})) {
            rowMap[row.title][k] = (v as any)?.value || "-";
          }
        }
        for (const t of titles) {
          quarterData.push({
            period: t.title + (t.isConsensus === "Y" ? "(E)" : ""),
            revenue: rowMap["매출액"]?.[t.key] || "-",
            operatingProfit: rowMap["영업이익"]?.[t.key] || "-",
            netIncome: rowMap["당기순이익"]?.[t.key] || "-",
            roe: rowMap["ROE"]?.[t.key] || "-",
            eps: rowMap["EPS"]?.[t.key] || "-",
            per: rowMap["PER"]?.[t.key] || "-",
          });
        }
      }

      // Forward EPS/PER
      let forwardEps = "-";
      let forwardPer = "-";
      // 연간 데이터에서 컨센서스(E) 항목의 EPS/PER 추출
      const consensusItem = annualData.find(d => d.period.includes("(E)"));
      if (consensusItem) {
        forwardEps = consensusItem.eps;
        forwardPer = consensusItem.per;
      }

      res.json({ annualData, quarterData, forwardEps, forwardPer });
    } catch (error: any) {
      console.error("[Financials] Error:", error.message);
      res.status(500).json({ message: error.message || "실적 데이터 조회 실패" });
    }
  });

  // 해외 종목 실적 데이터
  app.get("/api/stock/financials/overseas/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const exchange = (req.query.exchange as string) || "NASDAQ";
      let suffix = ".O";
      switch (exchange.toUpperCase()) {
        case "NYSE": suffix = ".N"; break;
        case "NASDAQ": suffix = ".O"; break;
        case "AMEX": suffix = ".A"; break;
      }

      // 네이버 해외주식 재무 API (코드.접미사 형식)
      const finRes = await axios.get(`https://api.stock.naver.com/stock/${code}${suffix}/finance/annual`, {
        headers: { "User-Agent": UA }, timeout: 8000,
      }).catch(() => null);

      const annualData: any[] = [];
      if (finRes?.data?.financeInfo) {
        const finInfo = finRes.data.financeInfo;
        (finInfo || []).forEach((item: any) => {
          annualData.push({
            period: item.period || item.fiscalYear || "",
            revenue: item.revenue || item.salesAmount || "-",
            operatingProfit: item.operatingProfit || item.operatingIncome || "-",
            netIncome: item.netIncome || item.netProfit || "-",
            eps: item.eps || "-",
            per: item.per || "-",
            roe: item.roe || "-",
          });
        });
      }

      res.json({ annualData, quarterData: [], forwardEps: "-", forwardPer: "-" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "해외 실적 데이터 조회 실패" });
    }
  });

  // 국내 종목 공시자료
  app.get("/api/stock/disclosures/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const page = parseInt(req.query.page as string) || 1;
      const disclosures: any[] = [];

      // 네이버 모바일 API - 공시 (UTF-8 JSON, 인코딩 깨짐 없음)
      const disclosureRes = await axios.get(`https://m.stock.naver.com/api/stock/${code}/disclosure`, {
        params: { page, size: 20 },
        headers: { "User-Agent": UA },
        timeout: 10000,
      }).catch(() => null);

      if (Array.isArray(disclosureRes?.data)) {
        for (const item of disclosureRes.data) {
          disclosures.push({
            title: item.title || "",
            url: item.disclosureId
              ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.disclosureId}`
              : `https://finance.naver.com/item/board.naver?code=${code}`,
            source: item.author || "DART",
            date: item.datetime ? item.datetime.split("T")[0] : "",
          });
        }
      }

      // 공시가 비어있으면 뉴스로 폴백 (네이버 모바일 뉴스 API)
      if (disclosures.length === 0) {
        const newsRes = await axios.get(`https://m.stock.naver.com/api/stock/${code}/news`, {
          params: { page: 1, size: 20 },
          headers: { "User-Agent": UA },
          timeout: 8000,
        }).catch(() => null);

        if (Array.isArray(newsRes?.data)) {
          for (const item of newsRes.data) {
            disclosures.push({
              title: item.title || "",
              url: item.link || item.url || "",
              source: item.officeName || item.office || "",
              date: item.datetime ? item.datetime.split("T")[0] : "",
            });
          }
        }
      }

      res.json({ disclosures: disclosures.slice(0, 20) });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "공시자료 조회 실패" });
    }
  });

  // 국내 종목 리서치 리포트
  app.get("/api/stock/research-reports/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const reports: any[] = [];

      // finance.naver.com 리서치 스크래핑 (가장 안정적)
      const researchRes = await axios.get(`https://finance.naver.com/research/company_list.naver`, {
        params: { keyword: "", searchType: "itemCode", itemCode: code, page: 1 },
        headers: { "User-Agent": UA },
        timeout: 8000,
        responseType: "arraybuffer",
      }).catch(() => null);

      if (researchRes?.data) {
        const iconv = await import("iconv-lite");
        const html = iconv.decode(Buffer.from(researchRes.data), "EUC-KR");
        const $ = cheerio.load(html);

        // table.type_1 내 리서치 목록 파싱
        $("table.type_1 tr").each((_, tr) => {
          const tds = $(tr).find("td");
          if (tds.length < 5) return;

          const $titleA = tds.eq(1).find("a");
          const title = $titleA.text().trim();
          let href = $titleA.attr("href") || "";
          const source = tds.eq(2).text().trim();
          // td[3]은 PDF 다운로드 등
          const date = tds.eq(4).text().trim();
          const viewCount = tds.eq(5)?.text()?.trim() || "";

          if (title && title.length > 2) {
            // company_read.naver?nid=90210 형식에서 nid 추출
            const nidMatch = href.match(/nid=(\d+)/);
            const nid = nidMatch ? nidMatch[1] : "";
            const url = nid
              ? `https://stock.naver.com/research/company/${nid}`
              : (href.startsWith("http") ? href : `https://finance.naver.com${href}`);

            reports.push({
              title,
              url,
              source,
              targetPrice: "-",
              date,
            });
          }
        });
      }

      res.json({ reports: reports.slice(0, 15) });
    } catch (error: any) {
      console.error("[Research Reports] Error:", error.message);
      res.status(500).json({ message: error.message || "리서치 조회 실패" });
    }
  });

  // 해외 종목 공시자료 (SEC EDGAR 8-K filings)
  app.get("/api/stock/disclosures/overseas/:code", async (req, res) => {
    try {
      const ticker = req.params.code.toUpperCase();
      const disclosures: any[] = [];

      // Step 1: SEC EDGAR EFTS 검색으로 해당 티커의 CIK 및 8-K 공시 조회
      const secHeaders = { "User-Agent": "Sheet-Manager admin@sheetmanager.com", "Accept": "application/json" };

      // 티커로 CIK 찾기 (SEC company tickers JSON)
      let cik = "";
      try {
        const tickerRes = await axios.get("https://www.sec.gov/files/company_tickers.json", {
          headers: secHeaders, timeout: 10000,
        });
        const tickers = tickerRes.data;
        for (const key of Object.keys(tickers)) {
          if (tickers[key].ticker === ticker) {
            cik = String(tickers[key].cik_str).padStart(10, "0");
            break;
          }
        }
      } catch (e) {
        console.error("[SEC] Ticker lookup error:", (e as any).message);
      }

      if (cik) {
        // Step 2: CIK로 SEC EDGAR submissions 조회 (8-K 필터)
        try {
          const submRes = await axios.get(`https://data.sec.gov/submissions/CIK${cik}.json`, {
            headers: secHeaders, timeout: 15000,
          });
          const recent = submRes.data?.filings?.recent || {};
          const forms = recent.form || [];
          const dates = recent.filingDate || [];
          const accessions = recent.accessionNumber || [];
          const primaryDocs = recent.primaryDocument || [];
          const descriptions = recent.primaryDocDescription || [];

          for (let i = 0; i < forms.length && disclosures.length < 20; i++) {
            if (forms[i] === "8-K" || forms[i] === "8-K/A" || forms[i] === "10-K" || forms[i] === "10-Q" || forms[i] === "6-K") {
              const acc = accessions[i]?.replace(/-/g, "") || "";
              const doc = primaryDocs[i] || "";
              const url = acc && doc
                ? `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${acc}/${doc}`
                : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${forms[i]}&dateb=&owner=include&count=10`;

              disclosures.push({
                title: `[${forms[i]}] ${descriptions[i] || forms[i]}`,
                url,
                source: "SEC EDGAR",
                date: dates[i] || "",
                formType: forms[i],
              });
            }
          }
        } catch (e) {
          console.error("[SEC] Submissions fetch error:", (e as any).message);
        }
      }

      // 결과가 없으면 EFTS 검색 API 폴백
      if (disclosures.length === 0) {
        try {
          const searchRes = await axios.get("https://efts.sec.gov/LATEST/search-index", {
            params: {
              q: `"${ticker}"`,
              forms: "8-K,10-K,10-Q",
              dateRange: "custom",
              startdt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              enddt: new Date().toISOString().split("T")[0],
            },
            headers: secHeaders,
            timeout: 15000,
          });

          const hits = searchRes.data?.hits?.hits || [];
          for (const hit of hits.slice(0, 15)) {
            const s = hit._source || {};
            const ciks = s.ciks || [];
            const acc = (s.adsh || "").replace(/-/g, "");
            const docName = hit._id?.split(":")?.[1] || "";
            const url = ciks[0] && acc && docName
              ? `https://www.sec.gov/Archives/edgar/data/${parseInt(ciks[0])}/${acc}/${docName}`
              : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=8-K`;

            disclosures.push({
              title: `[${s.form || "8-K"}] ${(s.display_names || [])[0] || ticker} - ${s.file_description || ""}`,
              url,
              source: "SEC EDGAR",
              date: s.file_date || "",
              formType: s.form || "8-K",
            });
          }
        } catch (e) {
          console.error("[SEC] EFTS search error:", (e as any).message);
        }
      }

      res.json({ disclosures });
    } catch (error: any) {
      console.error("[SEC Disclosures] Error:", error.message);
      res.status(500).json({ message: error.message || "SEC 공시자료 조회 실패" });
    }
  });

  // SEC 공시자료 AI 분석
  app.post("/api/stock/disclosures/ai-analyze", async (req, res) => {
    try {
      const { items, stockName, stockCode, market } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "분석할 공시자료를 선택해주세요." });
      }

      const isOverseas = market === "overseas";

      // 사용자별 AI API 키 조회
      const discUserId = (req as any).session?.userId;
      let discUserAiKey: UserAiKeyOption | undefined;
      if (discUserId) {
        const discConfig = await storage.getUserAiConfig(discUserId);
        if (discConfig?.useOwnKey && (discConfig.geminiApiKey || discConfig.openaiApiKey)) {
          discUserAiKey = {
            provider: discConfig.aiProvider || "gemini",
            geminiApiKey: discConfig.geminiApiKey || undefined,
            openaiApiKey: discConfig.openaiApiKey || undefined,
          };
        }
      }
      let fetchedContents: string[] = [];

      if (isOverseas) {
        // SEC EDGAR 원문 내용 가져오기
        const secHeaders = { "User-Agent": "Sheet-Manager admin@sheetmanager.com", "Accept": "text/html,application/xhtml+xml" };
        for (const item of items.slice(0, 5)) {
          if (item.url && item.url.includes("sec.gov")) {
            try {
              const docRes = await axios.get(item.url, {
                headers: secHeaders,
                timeout: 15000,
                maxRedirects: 5,
              });
              const html = docRes.data;
              const cheerio = await import("cheerio");
              const $ = cheerio.load(html);
              $("script, style, nav, header, footer").remove();
              let text = $("body").text().replace(/\s+/g, " ").trim();
              if (text.length > 3000) text = text.substring(0, 3000) + "...";
              if (text.length > 100) {
                fetchedContents.push(`=== [${item.formType || "Filing"}] ${item.title} (${item.date}) ===\n${text}`);
              }
            } catch (e) {
              console.error(`[SEC AI] Failed to fetch ${item.url}:`, (e as any).message);
            }
          }
        }
      } else {
        // DART 공시 원문 내용 가져오기
        for (const item of items.slice(0, 5)) {
          if (item.url && item.url.includes("dart.fss.or.kr")) {
            try {
              const docRes = await axios.get(item.url, {
                headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
                timeout: 15000,
                maxRedirects: 5,
              });
              const html = docRes.data;
              const cheerio = await import("cheerio");
              const $ = cheerio.load(html);
              $("script, style, nav, header, footer, .aside, .header, .footer").remove();
              // DART 페이지에서 주요 내용 추출
              let text = $(".report_content, .xforms, #ifrm, body").first().text().replace(/\s+/g, " ").trim();
              if (text.length > 3000) text = text.substring(0, 3000) + "...";
              if (text.length > 100) {
                fetchedContents.push(`=== [DART] ${item.title} (${item.date}) ===\n${text}`);
              }
            } catch (e) {
              console.error(`[DART AI] Failed to fetch ${item.url}:`, (e as any).message);
              // DART URL에서 rcpNo 추출하여 API로 시도
              const rcpNoMatch = item.url.match(/rcpNo=(\d+)/);
              if (rcpNoMatch) {
                try {
                  const apiRes = await axios.get(`https://opendart.fss.or.kr/api/document.xml`, {
                    params: { crtfc_key: process.env.DART_API_KEY || "", rcept_no: rcpNoMatch[1] },
                    timeout: 10000,
                  }).catch(() => null);
                  if (apiRes?.data) {
                    let apiText = typeof apiRes.data === "string" ? apiRes.data.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
                    if (apiText.length > 3000) apiText = apiText.substring(0, 3000) + "...";
                    if (apiText.length > 100) {
                      fetchedContents.push(`=== [DART] ${item.title} (${item.date}) ===\n${apiText}`);
                    }
                  }
                } catch {}
              }
            }
          }
          // 네이버 뉴스 형태의 공시
          if (item.url && (item.url.includes("naver.com") || item.url.includes("finance.naver"))) {
            try {
              const docRes = await axios.get(item.url, {
                headers: { "User-Agent": UA },
                timeout: 10000,
              });
              const cheerio = await import("cheerio");
              const $ = cheerio.load(docRes.data);
              $("script, style, nav, header, footer").remove();
              let text = $("article, .article_body, #content, body").first().text().replace(/\s+/g, " ").trim();
              if (text.length > 3000) text = text.substring(0, 3000) + "...";
              if (text.length > 100) {
                fetchedContents.push(`=== ${item.title} (${item.date}) ===\n${text}`);
              }
            } catch (e) {
              console.error(`[DART AI] Failed to fetch news ${item.url}:`, (e as any).message);
            }
          }
        }
      }

      // 프롬프트 구성
      const disclosureList = items.map((item: any, i: number) =>
        `${i + 1}. ${item.formType ? `[${item.formType}] ` : ""}${item.title} (${item.date || ""})\n   출처: ${item.source || "-"}\n   URL: ${item.url || ""}`
      ).join("\n");

      const contentSection = fetchedContents.length > 0
        ? `\n\n=== 공시 원문 내용 (일부) ===\n${fetchedContents.join("\n\n")}`
        : "";

      let prompt: string;

      if (isOverseas) {
        prompt = `당신은 미국 주식 시장 전문 애널리스트입니다. 
아래는 ${stockName || "해당 종목"}(${stockCode || ""})의 SEC(미국 증권거래위원회) 공시자료 목록${fetchedContents.length > 0 ? "과 원문 내용 일부" : ""}입니다.

이 공시자료들을 종합적으로 분석하여 한국어로 요약해주세요.

=== SEC 공시 목록 ===
${disclosureList}
${contentSection}

다음 형식으로 답변해주세요:

## 📄 SEC 공시자료 AI 분석 요약

### 1. 공시 유형 분류
- 8-K(중요사항 보고), 10-K(연간보고서), 10-Q(분기보고서) 등 공시 유형별 분류 및 의미

### 2. 주요 공시 내용 요약
- 각 공시의 핵심 내용을 요약 (실적 발표, 경영진 변동, 계약 체결, 소송 등)

### 3. 투자자 관점 분석
- 해당 공시들이 주가에 미칠 수 있는 영향
- 긍정적/부정적 시그널 분석

### 4. 종합 의견
- 투자자가 주목해야 할 핵심 포인트
- 리스크 요인 및 기회 요인

간결하되 핵심 내용을 놓치지 않도록 정리해주세요.`;
      } else {
        prompt = `당신은 한국 주식 시장 전문 애널리스트입니다.
아래는 ${stockName || "해당 종목"}(${stockCode || ""})의 DART(전자공시시스템) 공시자료 목록${fetchedContents.length > 0 ? "과 원문 내용 일부" : ""}입니다.

이 공시자료들을 종합적으로 분석하여 투자자 관점에서 핵심 내용을 요약해주세요.

=== DART 공시 목록 ===
${disclosureList}
${contentSection}

다음 형식으로 답변해주세요:

## 📋 DART 공시자료 AI 분석 요약

### 1. 공시 유형 분류
- 사업보고서, 분/반기보고서, 주요사항보고서, 주주총회 관련, 임원/주요주주 변동 등 공시 유형별 분류 및 의미

### 2. 주요 공시 내용 요약
- 각 공시의 핵심 내용을 요약 (실적 공시, 유상증자, 전환사채 발행, 자사주 매입/처분, 합병/분할, 배당, 소송 등)

### 3. 투자자 관점 분석
- 해당 공시들이 주가에 미칠 수 있는 영향
- 긍정적 시그널 (실적 개선, 배당 증가, 자사주 매입 등)
- 부정적 시그널 (유상증자, CB 발행, 소송, 감사의견 변경 등)

### 4. 종합 의견
- 투자자가 주목해야 할 핵심 포인트
- 리스크 요인 및 기회 요인
- 단기/중장기 주가 영향 전망

간결하되 핵심 내용을 놓치지 않도록 정리해주세요.`;
      }

      const result = await callAI(prompt, discUserAiKey);
      res.json({ analysis: result, analyzedAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) });
    } catch (error: any) {
      console.error("[Disclosure AI Analyze] Error:", error.message);
      res.status(500).json({ message: error.message || "공시 AI 분석 실패" });
    }
  });

  // 해외 종목 리서치 리포트
  app.get("/api/stock/research-reports/overseas/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const exchange = (req.query.exchange as string) || "NASDAQ";
      let suffix = ".O";
      switch (exchange.toUpperCase()) {
        case "NYSE": suffix = ".N"; break;
        case "NASDAQ": suffix = ".O"; break;
        case "AMEX": suffix = ".A"; break;
      }

      // Naver api.stock 해외주식 Morningstar 리서치 API
      const apiRes = await axios.get(`https://api.stock.naver.com/stock/${code}${suffix}/research`, {
        headers: { "User-Agent": UA },
        timeout: 10000,
      }).catch(() => null);

      const reports: any[] = [];
      if (Array.isArray(apiRes?.data)) {
        apiRes.data.forEach((item: any) => {
          // rating: 1(매우과대평가) ~ 5(매우과소평가), 3(적정)
          const ratingLabels: Record<number, string> = { 1: "★", 2: "★★", 3: "★★★", 4: "★★★★", 5: "★★★★★" };
          const valuationLabel = item.valuationRatingType?.name || "";
          reports.push({
            title: item.title || "",
            url: item.originalPDF || "",
            source: "Morningstar",
            targetPrice: item.fairValue ? `$${item.fairValue}` : "-",
            date: item.analystNotePublishDate || "",
            rating: item.morningstarRating ? ratingLabels[item.morningstarRating] || String(item.morningstarRating) : "-",
            moat: item.economicMoatType?.name || "-",
            uncertainty: item.uncertaintyType?.name || "-",
            valuation: valuationLabel,
          });
        });
      }

      res.json({ reports });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "해외 리서치 조회 실패" });
    }
  });

  // 국내 종목 뉴스
  app.get("/api/stock/news/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const apiRes = await axios.get(`https://m.stock.naver.com/api/news/stock/${code}`, {
        params: { pageSize },
        headers: { "User-Agent": UA },
        timeout: 8000,
      });
      const news: any[] = [];
      if (Array.isArray(apiRes.data)) {
        apiRes.data.forEach((group: any) => {
          const items = group.items || [];
          items.forEach((item: any) => {
            news.push({
              title: item.titleFull || item.title || "",
              summary: item.body || "",
              source: item.officeName || "",
              datetime: item.datetime || "",
              url: `https://n.news.naver.com/mnews/article/${item.officeId}/${item.articleId}`,
              imageUrl: item.imageOriginLink || "",
            });
          });
        });
      }
      res.json({ news });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "뉴스 조회 실패" });
    }
  });

  // 해외 종목 뉴스
  app.get("/api/stock/news/overseas/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const exchange = (req.query.exchange as string) || "NASDAQ";
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      let suffix = ".O";
      switch (exchange.toUpperCase()) {
        case "NYSE": suffix = ".N"; break;
        case "NASDAQ": suffix = ".O"; break;
        case "AMEX": suffix = ".A"; break;
      }
      const apiRes = await axios.get(`https://m.stock.naver.com/api/news/stock/${code}${suffix}`, {
        params: { pageSize },
        headers: { "User-Agent": UA },
        timeout: 8000,
      });
      const news: any[] = [];
      if (Array.isArray(apiRes.data)) {
        apiRes.data.forEach((group: any) => {
          const items = group.items || [];
          items.forEach((item: any) => {
            news.push({
              title: item.titleFull || item.title || "",
              summary: item.body || "",
              source: item.officeName || "",
              datetime: item.datetime || "",
              url: `https://n.news.naver.com/mnews/article/${item.officeId}/${item.articleId}`,
              imageUrl: item.imageOriginLink || "",
            });
          });
        });
      }
      res.json({ news });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "해외 뉴스 조회 실패" });
    }
  });

  // ========== 종목 AI 종합분석 ==========

  // 종합분석 실행
  app.post("/api/stock/ai-comprehensive-analysis", async (req, res) => {
    try {
      const { stockCode, stockName, market, exchange } = req.body;
      if (!stockCode || !stockName) {
        return res.status(400).json({ message: "stockCode, stockName 필수" });
      }
      const isOverseas = market === "overseas";

      // 사용자별 AI API 키 조회
      const userId = (req as any).session?.userId;
      let userAiKey: UserAiKeyOption | undefined;
      if (userId) {
        const config = await storage.getUserAiConfig(userId);
        if (config?.useOwnKey && (config.geminiApiKey || config.openaiApiKey)) {
          userAiKey = {
            provider: config.aiProvider || "gemini",
            geminiApiKey: config.geminiApiKey || undefined,
            openaiApiKey: config.openaiApiKey || undefined,
          };
        }
      }

      // 1) 기본정보 가져오기
      let basicInfo = "";
      try {
        let detailUrl = "";
        if (isOverseas) {
          let suffix = ".O";
          switch ((exchange || "NASDAQ").toUpperCase()) {
            case "NYSE": suffix = ".N"; break;
            case "NASDAQ": suffix = ".O"; break;
            case "AMEX": suffix = ".A"; break;
          }
          detailUrl = `https://m.stock.naver.com/api/stock/${stockCode}${suffix}/basic`;
        } else {
          detailUrl = `https://m.stock.naver.com/api/stock/${stockCode}/basic`;
        }
        const detailRes = await axios.get(detailUrl, { headers: { "User-Agent": UA }, timeout: 8000 }).catch(() => null);
        if (detailRes?.data) {
          const d = detailRes.data;
          basicInfo = `현재가: ${d.closePrice || d.stockEndPrice || "?"}, 전일대비: ${d.compareToPreviousClosePrice || "?"}, 등락률: ${d.fluctuationsRatio || d.compareToPreviousPrice?.ratio || "?"}%, 시가총액: ${d.marketValue || d.stockItemTotalInfos?.find((i:any) => i.code === "marketValue")?.value || "?"}, PER: ${d.per || d.stockItemTotalInfos?.find((i:any) => i.code === "per")?.value || "?"}, PBR: ${d.pbr || "?"}, 52주최고: ${d.high52wPrice || "?"}, 52주최저: ${d.low52wPrice || "?"}`;
        }
      } catch (e) { /* ignore */ }

      // 2) 실적 데이터 가져오기
      let financialInfo = "";
      try {
        let finUrl = "";
        if (isOverseas) {
          let suffix = ".O";
          switch ((exchange || "NASDAQ").toUpperCase()) {
            case "NYSE": suffix = ".N"; break;
            case "NASDAQ": suffix = ".O"; break;
            case "AMEX": suffix = ".A"; break;
          }
          finUrl = `https://m.stock.naver.com/api/stock/${stockCode}${suffix}/finance/annual`;
        } else {
          finUrl = `https://m.stock.naver.com/api/stock/${stockCode}/finance/annual`;
        }
        const finRes = await axios.get(finUrl, { headers: { "User-Agent": UA }, timeout: 8000 }).catch(() => null);
        if (finRes?.data) {
          const items = finRes.data?.financeInfo?.rowList || finRes.data || [];
          if (Array.isArray(items)) {
            financialInfo = items.slice(0, 10).map((row: any) => {
              const title = row.title || row.label || "";
              const values = (row.columns || row.values || []).map((c: any) => c.value || c).join(" / ");
              return `${title}: ${values}`;
            }).join("\n");
          }
        }
      } catch (e) { /* ignore */ }

      // 3) 뉴스 가져오기
      let newsInfo = "";
      try {
        let newsUrl = "";
        if (isOverseas) {
          let suffix = ".O";
          switch ((exchange || "NASDAQ").toUpperCase()) {
            case "NYSE": suffix = ".N"; break;
            case "NASDAQ": suffix = ".O"; break;
            case "AMEX": suffix = ".A"; break;
          }
          newsUrl = `https://m.stock.naver.com/api/news/stock/${stockCode}${suffix}?pageSize=8`;
        } else {
          newsUrl = `https://m.stock.naver.com/api/news/stock/${stockCode}?pageSize=8`;
        }
        const newsRes = await axios.get(newsUrl, { headers: { "User-Agent": UA }, timeout: 8000 }).catch(() => null);
        if (newsRes?.data && Array.isArray(newsRes.data)) {
          const newsList: string[] = [];
          newsRes.data.forEach((group: any) => {
            (group.items || []).forEach((item: any) => {
              newsList.push(`[${item.officeName || ""}] ${item.titleFull || item.title || ""}`);
            });
          });
          newsInfo = newsList.slice(0, 8).join("\n");
        }
      } catch (e) { /* ignore */ }

      // 4) AI 프롬프트 구성
      const prompt = `당신은 숙련된 주식 애널리스트입니다. 다음 종목에 대한 종합 투자분석 리포트를 작성해주세요.

## 분석 대상
- 종목명: ${stockName} (${stockCode})
- 시장: ${isOverseas ? "해외(" + (exchange || "NASDAQ") + ")" : "국내"}

## 기본 시세 정보
${basicInfo || "(조회 불가)"}

## 재무 실적
${financialInfo || "(조회 불가)"}

## 최근 주요 뉴스
${newsInfo || "(조회 불가)"}

## 리포트 작성 요구사항
다음 항목을 포함하여 **한국어**로 종합 분석 리포트를 작성해주세요:

1. **종목 개요** (사업 모델, 주요 매출원, 경쟁 우위)
2. **재무 분석** (매출 성장성, 수익성, 밸류에이션 평가)
3. **기술적 분석** (현재 주가 위치, 지지/저항 구간, 추세)
4. **뉴스/이벤트 분석** (최근 주요 이슈가 주가에 미치는 영향)
5. **리스크 요인** (주요 위험 요소 3가지)
6. **투자 의견** (강력매수/매수/중립/매도/강력매도 중 택1)
7. **한줄 요약** (마지막에 "[한줄요약] ..." 형태로)
8. **투자의견 라벨** (마지막 줄에 "[투자의견] 강력매수/매수/중립/매도/강력매도" 형태로)

분석은 객관적이고 데이터 기반으로 작성해주세요.`;

      const result = await callAI(prompt, userAiKey);

      // 한줄요약 및 투자의견 추출
      let summary = "";
      let rating = "";
      const summaryMatch = result.match(/\[한줄요약\]\s*(.+)/);
      if (summaryMatch) summary = summaryMatch[1].trim();
      const ratingMatch = result.match(/\[투자의견\]\s*(강력매수|매수|중립|매도|강력매도)/);
      if (ratingMatch) rating = ratingMatch[1].trim();

      // DB 저장
      const userName = (req as any).session?.userName || null;
      const isPublic = req.body.isPublic !== false; // 기본값 true (공개)
      const saved = await storage.createStockAiAnalysis({
        stockCode, stockName, market: market || "domestic", exchange: exchange || null,
        analysisResult: result, summary, rating,
        userId: userId || null, userName, isPublic,
      });

      res.json({ analysis: saved });
    } catch (error: any) {
      console.error("AI 종합분석 에러:", error);
      res.status(500).json({ message: error.message || "AI 종합분석 실패" });
    }
  });

  // 분석 리스트 조회 (공개 + 본인 비공개만)
  app.get("/api/stock/ai-analyses", async (req, res) => {
    try {
      const stockCode = req.query.stockCode as string | undefined;
      const market = req.query.market as string | undefined;
      const currentUserId = (req as any).session?.userId || null;
      const analyses = await storage.getStockAiAnalyses(stockCode, market, currentUserId);
      res.json({ analyses, currentUserId });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "분석 목록 조회 실패" });
    }
  });

  // 분석 상세 조회
  app.get("/api/stock/ai-analyses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const analysis = await storage.getStockAiAnalysis(id);
      if (!analysis) return res.status(404).json({ message: "분석 결과를 찾을 수 없습니다" });
      res.json({ analysis });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "분석 조회 실패" });
    }
  });

  // 분석 삭제 (본인 작성 또는 admin만 삭제 가능)
  app.delete("/api/stock/ai-analyses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const analysis = await storage.getStockAiAnalysis(id);
      if (!analysis) return res.status(404).json({ message: "분석 결과를 찾을 수 없습니다" });
      const currentUserId = (req as any).session?.userId;
      const isAdminUser = !!(req as any).session?.isAdmin;
      if (!isAdminUser && analysis.userId !== currentUserId) {
        return res.status(403).json({ message: "본인이 작성한 분석만 삭제할 수 있습니다" });
      }
      await storage.deleteStockAiAnalysis(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "분석 삭제 실패" });
    }
  });

  // ========== 사용자별 AI API 설정 ==========

  // AI 설정 조회
  app.get("/api/user/ai-config", async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) return res.json({ config: null });
      const config = await storage.getUserAiConfig(userId);
      if (!config) return res.json({ config: null });
      // API 키는 마스킹해서 반환 (앞 8자리만 표시)
      res.json({
        config: {
          ...config,
          geminiApiKey: config.geminiApiKey ? config.geminiApiKey.slice(0, 8) + "••••••••" : null,
          openaiApiKey: config.openaiApiKey ? config.openaiApiKey.slice(0, 8) + "••••••••" : null,
          hasGeminiKey: !!config.geminiApiKey,
          hasOpenaiKey: !!config.openaiApiKey,
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "AI 설정 조회 실패" });
    }
  });

  // AI 설정 저장
  app.post("/api/user/ai-config", async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) return res.status(401).json({ message: "로그인이 필요합니다" });
      const { aiProvider, geminiApiKey, openaiApiKey } = req.body;
      const config = await storage.upsertUserAiConfig({
        userId,
        aiProvider: aiProvider || "gemini",
        geminiApiKey: geminiApiKey || null,
        openaiApiKey: openaiApiKey || null,
        useOwnKey: true,
      });
      res.json({
        success: true,
        config: {
          ...config,
          geminiApiKey: config.geminiApiKey ? config.geminiApiKey.slice(0, 8) + "••••••••" : null,
          openaiApiKey: config.openaiApiKey ? config.openaiApiKey.slice(0, 8) + "••••••••" : null,
          hasGeminiKey: !!config.geminiApiKey,
          hasOpenaiKey: !!config.openaiApiKey,
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "AI 설정 저장 실패" });
    }
  });

  // AI API 키 테스트
  app.post("/api/user/ai-config/test", async (req, res) => {
    try {
      const { aiProvider, geminiApiKey, openaiApiKey } = req.body;
      const testPrompt = "안녕하세요. 이것은 API 키 테스트입니다. '키 테스트 성공'이라고 한 줄만 응답해주세요.";
      const userKey: UserAiKeyOption = {
        provider: aiProvider,
        geminiApiKey,
        openaiApiKey,
      };
      const result = await callAI(testPrompt, userKey);
      res.json({ success: true, message: "API 키가 정상적으로 작동합니다.", response: result.slice(0, 100) });
    } catch (error: any) {
      res.status(400).json({ success: false, message: `API 키 테스트 실패: ${error.message}` });
    }
  });

  // AI 설정 삭제
  app.delete("/api/user/ai-config", async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) return res.status(401).json({ message: "로그인이 필요합니다" });
      await storage.deleteUserAiConfig(userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "AI 설정 삭제 실패" });
    }
  });

  // 종목 코멘트 목록 조회
  app.get("/api/stock-comments/:stockCode", async (req, res) => {
    try {
      const { stockCode } = req.params;
      const market = req.query.market as string | undefined;
      const comments = await storage.getStockComments(stockCode, market);
      res.json(comments);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "코멘트 조회 실패" });
    }
  });

  // 종목 코멘트 등록
  app.post("/api/stock-comments", async (req, res) => {
    try {
      const userId = req.session?.userId;
      const userName = req.session?.userName || req.session?.userEmail || "사용자";
      const { stockCode, stockName, market, content } = req.body;
      if (!stockCode || !content) {
        return res.status(400).json({ message: "종목코드와 내용을 입력해주세요." });
      }
      const comment = await storage.createStockComment({
        stockCode,
        stockName: stockName || "",
        market: market || "domestic",
        userId,
        userName: String(userName),
        content,
      });
      res.json(comment);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "코멘트 등록 실패" });
    }
  });

  // 종목 코멘트 삭제
  app.delete("/api/stock-comments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteStockComment(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "코멘트 삭제 실패" });
    }
  });

  // ===== QnA 게시판 =====
  // 게시글 목록 조회
  app.get("/api/qna/posts", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const posts = await storage.getQnaPosts(limit);
      res.json(posts);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "게시글 목록 조회 실패" });
    }
  });

  // 게시글 상세 조회 (댓글 포함)
  app.get("/api/qna/posts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const post = await storage.getQnaPost(id);
      if (!post) return res.status(404).json({ message: "게시글을 찾을 수 없습니다" });
      const replies = await storage.getQnaReplies(id);
      res.json({ ...post, replies });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "게시글 조회 실패" });
    }
  });

  // 게시글 작성
  app.post("/api/qna/posts", requireUser, async (req, res) => {
    try {
      const { title, content, category } = req.body;
      if (!title || !content) return res.status(400).json({ message: "제목과 내용을 입력해주세요" });
      const post = await storage.createQnaPost({
        title,
        content,
        category: category || "general",
        userId: req.session.userId || null,
        userName: req.session.userName || req.session.userEmail || "익명",
        userEmail: req.session.userEmail || null,
      });
      res.json(post);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "게시글 작성 실패" });
    }
  });

  // 게시글 수정
  app.patch("/api/qna/posts/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const post = await storage.getQnaPost(id);
      if (!post) return res.status(404).json({ message: "게시글을 찾을 수 없습니다" });
      // 본인 글이거나 admin만 수정 가능
      if (post.userId !== req.session.userId && !req.session.isAdmin) {
        return res.status(403).json({ message: "수정 권한이 없습니다" });
      }
      const { title, content, category } = req.body;
      const updated = await storage.updateQnaPost(id, { title, content, category });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "게시글 수정 실패" });
    }
  });

  // 게시글 삭제
  app.delete("/api/qna/posts/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const post = await storage.getQnaPost(id);
      if (!post) return res.status(404).json({ message: "게시글을 찾을 수 없습니다" });
      if (post.userId !== req.session.userId && !req.session.isAdmin) {
        return res.status(403).json({ message: "삭제 권한이 없습니다" });
      }
      await storage.deleteQnaPost(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "게시글 삭제 실패" });
    }
  });

  // 댓글 작성
  app.post("/api/qna/posts/:postId/replies", requireUser, async (req, res) => {
    try {
      const postId = parseInt(req.params.postId);
      const { content } = req.body;
      if (!content) return res.status(400).json({ message: "댓글 내용을 입력해주세요" });
      const reply = await storage.createQnaReply({
        postId,
        content,
        userId: req.session.userId || null,
        userName: req.session.userName || req.session.userEmail || "익명",
        userEmail: req.session.userEmail || null,
      });
      res.json(reply);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "댓글 작성 실패" });
    }
  });

  // 댓글 삭제
  app.delete("/api/qna/replies/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteQnaReply(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "댓글 삭제 실패" });
    }
  });

  // ===== 10X (Ten Bagger) 종목 관리 =====
  // 10X 종목 조회 (listType=common|personal)
  app.get("/api/tenbagger-stocks", async (req, res) => {
    try {
      const listType = (req.query.listType as string) || "common";
      const userId = req.session?.userId;

      if (listType === "personal" && !userId && !req.session?.isAdmin) {
        return res.json([]);
      }

      // "shared" 타입 조회: 개인관심이지만 isShared=true인 종목 (모든 계정에 표시)
      if (listType === "shared") {
        const stocks = await storage.getTenbaggerStocksShared();
        return res.json(stocks);
      }

      const stocks = await storage.getTenbaggerStocks(listType, userId || undefined);
      res.json(stocks);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "10X 종목 조회 실패" });
    }
  });

  // 10X 공통관심 등록 (admin만)
  app.post("/api/tenbagger-stocks/common", requireAdmin, async (req, res) => {
    try {
      const stock = await storage.createTenbaggerStock({
        ...req.body,
        listType: "common",
        userId: null,
      });
      res.json(stock);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "10X 공통 종목 등록 실패" });
    }
  });

  // 10X 개인관심 등록 (로그인 사용자)
  app.post("/api/tenbagger-stocks/personal", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(400).json({ message: "사용자 ID가 필요합니다." });
      const { isShared, ...restBody } = req.body;
      const userName = req.session?.userName || req.session?.userEmail || "사용자";
      const stock = await storage.createTenbaggerStock({
        ...restBody,
        listType: "personal",
        userId,
        isShared: isShared === true,
        sharedBy: isShared === true ? userName : null,
      });
      res.json(stock);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "10X 개인 종목 등록 실패" });
    }
  });

  // 10X 종목 수정 (admin: 공통, user: 본인 개인)
  app.patch("/api/tenbagger-stocks/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getTenbaggerStock(id);
      if (!existing) return res.status(404).json({ message: "종목을 찾을 수 없습니다." });

      if (existing.listType === "common" && !req.session?.isAdmin) {
        return res.status(403).json({ message: "공통관심 수정은 관리자만 가능합니다." });
      }
      if (existing.listType === "personal" && existing.userId !== req.session?.userId) {
        return res.status(403).json({ message: "본인의 개인관심만 수정 가능합니다." });
      }

      const updated = await storage.updateTenbaggerStock(id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "10X 종목 수정 실패" });
    }
  });

  // 10X 종목 삭제 (admin: 공통, user: 본인 개인)
  app.delete("/api/tenbagger-stocks/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getTenbaggerStock(id);
      if (!existing) return res.status(404).json({ message: "종목을 찾을 수 없습니다." });

      if (existing.listType === "common" && !req.session?.isAdmin) {
        return res.status(403).json({ message: "공통관심 삭제는 관리자만 가능합니다." });
      }
      if (existing.listType === "personal" && existing.userId !== req.session?.userId) {
        return res.status(403).json({ message: "본인의 개인관심만 삭제 가능합니다." });
      }

      await storage.deleteTenbaggerStock(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "10X 종목 삭제 실패" });
    }
  });

  // 10X 종목 AI 분석
  app.post("/api/tenbagger-stocks/:id/ai-analyze", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const stock = await storage.getTenbaggerStock(id);
      if (!stock) return res.status(404).json({ message: "종목을 찾을 수 없습니다" });

      // 종목 정보 수집 (네이버 금융 데이터)
      let stockInfo = "";
      try {
        const naverUrl = stock.market === "overseas"
          ? `https://m.stock.naver.com/worldstock/stock/${stock.stockCode}/total`
          : `https://m.stock.naver.com/domestic/stock/${stock.stockCode}/total`;
        const infoRes = await axios.get(`https://m.stock.naver.com/api/stock/${stock.stockCode}/integration`, {
          headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000,
        });
        const d = infoRes.data;
        const totalInfos = d?.totalInfos || [];
        const items = totalInfos.flatMap((g: any) => g.items || []);
        stockInfo = items.map((item: any) => `${item.key}: ${item.value}`).join("\n");
      } catch (e) {
        stockInfo = "종목 상세 정보 조회 실패";
      }

      // 최근 뉴스 수집
      let newsInfo = "";
      try {
        const searchUrl = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(stock.stockName)}&sm=tab_opt&sort=1&photo=0&field=0&pd=4&ds=&de=&docid=&related=0&mynews=0&office_type=0&office_section_code=0&news_office_checked=&nso=so%3Add%2Cp%3A1w&is_sug_officeid=0`;
        const newsRes = await axios.get(searchUrl, {
          headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000,
        });
        const $ = cheerio.load(newsRes.data);
        const newsList: string[] = [];
        $(".news_tit").each((i, el) => {
          if (i < 5) newsList.push($(el).text());
        });
        newsInfo = newsList.length > 0 ? newsList.join("\n") : "최근 뉴스 없음";
      } catch (e) {
        newsInfo = "뉴스 조회 실패";
      }

      const prompt = `당신은 전문 투자 분석가입니다. 아래 종목이 "10 Bagger(텐배거)" 후보로서 적합한지 종합적으로 분석해주세요.

종목명: ${stock.stockName} (${stock.stockCode})
시장: ${stock.market === "overseas" ? "해외" : "국내"} / ${stock.exchange || ""}
선정사유: ${stock.reason || "없음"}
메모: ${stock.memo || "없음"}
매수가: ${stock.buyPrice || "미정"}
목표가: ${stock.targetPrice || "미정"}

=== 종목 기본 정보 ===
${stockInfo}

=== 최근 뉴스 ===
${newsInfo}

다음 항목을 포함하여 분석해주세요:
1. **종목 개요**: 사업 모델, 시장 포지션
2. **성장 잠재력**: 매출/이익 성장률, TAM(Total Addressable Market)
3. **경쟁 우위**: 해자(moat), 기술력, 브랜드 파워
4. **리스크 요인**: 주요 리스크와 불확실성
5. **10X 가능성 평가**: 현재 시가총액 대비 10배 성장 가능성 (상/중/하)
6. **투자 의견**: 매수/관망/주의 추천과 근거
7. **핵심 모니터링 지표**: 추적해야 할 핵심 지표 3-5개

한국어로 작성해주세요. 마크다운 형식으로 정리해주세요.`;

      const analysis = await callAI(prompt);

      // DB에 분석 결과 저장
      const updated = await storage.updateTenbaggerStock(id, {
        aiAnalysis: analysis,
        aiAnalyzedAt: new Date(),
      });

      res.json({ analysis, stock: updated });
    } catch (error: any) {
      console.error("10X AI 분석 오류:", error);
      res.status(500).json({ message: error.message || "AI 분석 실패" });
    }
  });

  // 10X 전체 종목 AI 종합 분석
  app.post("/api/tenbagger-stocks/ai-analyze-all", requireAdmin, async (req, res) => {
    try {
      const stocks = await storage.getTenbaggerStocks();
      if (stocks.length === 0) return res.status(400).json({ message: "등록된 10X 종목이 없습니다" });

      const stockSummary = stocks.map(s =>
        `- ${s.stockName}(${s.stockCode}): 매수가 ${s.buyPrice || "미정"}, 목표가 ${s.targetPrice || "미정"}, 사유: ${s.reason || "없음"}`
      ).join("\n");

      const prompt = `당신은 전문 투자 포트폴리오 매니저입니다. 아래는 "10 Bagger(텐배거)" 후보 종목 리스트입니다.
이 포트폴리오를 종합적으로 분석해주세요.

=== 10X 후보 종목 리스트 ===
${stockSummary}

다음 항목을 포함하여 분석해주세요:
1. **포트폴리오 개요**: 섹터 분포, 시장별 분포
2. **섹터 시너지**: 종목간 시너지 효과 분석
3. **리스크 분산**: 포트폴리오 리스크 분산 정도 평가
4. **Top Pick**: 가장 유망한 상위 3개 종목과 근거
5. **추가 편입 추천**: 포트폴리오에 추가로 편입하면 좋을 섹터/종목 추천
6. **투자 타이밍**: 현재 시장 상황에서의 투자 타이밍 의견
7. **종합 의견**: 전체 포트폴리오에 대한 종합 평가

한국어로 작성해주세요. 마크다운 형식으로 정리해주세요.`;

      const analysis = await callAI(prompt);
      res.json({ analysis });
    } catch (error: any) {
      console.error("10X 종합 AI 분석 오류:", error);
      res.status(500).json({ message: error.message || "종합 AI 분석 실패" });
    }
  });

  // ===== ETF 상승 트렌드 AI 분석 =====
  app.post("/api/etf/analyze-trend", async (req, res) => {
    try {
      const userPrompt = (req.body.prompt as string) || "";

      // 1) ETF 상승/하락 데이터 수집
      const allEtfs = await getEtfFullList();
      const EXCLUDE_KEYWORDS = ["레버리지", "인버스", "2X", "bear", "BEAR", "곱버스", "숏", "SHORT", "울트라"];
      const filtered = allEtfs.filter((etf) => !EXCLUDE_KEYWORDS.some((kw) => etf.name.includes(kw)));
      const risingEtfs = filtered.filter((etf) => etf.changeRate > 0).sort((a, b) => b.changeRate - a.changeRate).slice(0, 20);
      const fallingEtfs = filtered.filter((etf) => etf.changeRate < 0).sort((a, b) => a.changeRate - b.changeRate).slice(0, 10);

      // 2) 뉴스 데이터 수집
      let newsData: string[] = [];
      try {
        const newsRes = await axios.get("https://finance.naver.com/news/news_list.naver?mode=RANK&page=1", {
          headers: { "User-Agent": "Mozilla/5.0" }, timeout: 5000,
        });
        const $ = cheerio.load(newsRes.data);
        $(".block1 li a, .block2 li a").each((_, el) => {
          const title = $(el).text().trim();
          if (title && title.length > 5) newsData.push(title);
        });
        newsData = newsData.slice(0, 20);
      } catch (e) {
        console.error("[Analyze] News fetch failed:", (e as Error).message);
      }

      // 3) 시장 지표 수집
      let marketInfo = "";
      try {
        const marketRes = await axios.get("https://finance.naver.com/sise/", {
          headers: { "User-Agent": "Mozilla/5.0" }, timeout: 5000,
        });
        const $ = cheerio.load(marketRes.data);
        const kospi = $("#KOSPI_now").text().trim();
        const kosdaq = $("#KOSDAQ_now").text().trim();
        if (kospi) marketInfo += `코스피: ${kospi} `;
        if (kosdaq) marketInfo += `코스닥: ${kosdaq} `;
      } catch (e) {
        console.error("[Analyze] Market data fetch failed:", (e as Error).message);
      }

      // 4) 수집 데이터를 컨텍스트로 구성
      const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
      const etfSummary = risingEtfs.map((e, i) => 
        `${i+1}. ${e.name}(${e.code}) 현재가:${e.nowVal.toLocaleString()} 등락률:+${e.changeRate}% 시총:${e.marketCap}억 거래량:${e.quant.toLocaleString()}`
      ).join("\n");
      const fallingSummary = fallingEtfs.map((e, i) => 
        `${i+1}. ${e.name}(${e.code}) 등락률:${e.changeRate}%`
      ).join("\n");
      const newsSummary = newsData.length > 0 ? newsData.map((n, i) => `${i+1}. ${n}`).join("\n") : "뉴스 데이터 없음";

      const dataContext = `[실시간 수집 데이터]
📅 날짜: ${today}
📊 시장 현황: ${marketInfo || "데이터 없음"}

📈 실시간 상승 ETF TOP 20 (레버리지·인버스 제외):
${etfSummary}

📉 하락 ETF TOP 10:
${fallingSummary}

📰 네이버 실시간 주요 뉴스 (https://stock.naver.com/news):
${newsSummary}`;

      // 5) 최종 프롬프트 = 시스템 역할 + 데이터 + 사용자 요청
      const systemRole = `당신은 한국 금융시장 전문 애널리스트입니다. 아래 실시간 데이터를 기반으로 분석해주세요. 반드시 30줄 이상, 한국어로 작성하세요. 구체적인 ETF명과 수치를 인용하세요.`;

      const defaultInstruction = `위 데이터를 참고하여 다음을 포함한 분석 보고서를 작성하세요:
1. **📊 오늘의 시장 개요** (3-4줄): 전반적인 시장 분위기와 주요 지수 동향
2. **🔥 주요 상승 섹터/테마 분석** (8-10줄): 상승 ETF들의 공통 테마, 섹터별 분류, 상승 원인 분석
3. **📰 뉴스·매크로 연관 분석** (5-6줄): 뉴스와 ETF 상승의 연관성
4. **📉 하락 섹터 동향** (3-4줄): 하락하는 섹터와 원인
5. **💡 투자 시사점 및 주의사항** (5-6줄): 단기 투자 전략 제안 및 리스크 요인`;

      const finalPrompt = `${systemRole}\n\n${dataContext}\n\n[분석 요청]\n${userPrompt || defaultInstruction}`;

      // 6) AI API 호출
      console.log("[Analyze] Calling AI API with prompt length:", finalPrompt.length);
      const analysis = await callAI(finalPrompt);
      console.log("[Analyze] Analysis generated successfully");

      res.json({ 
        analysis, 
        analyzedAt: new Date().toLocaleString("ko-KR"),
        dataPoints: {
          risingCount: risingEtfs.length,
          fallingCount: fallingEtfs.length,
          newsCount: newsData.length,
          market: marketInfo,
        }
      });
    } catch (error: any) {
      console.error("[Analyze] Failed:", error.message);
      res.status(500).json({ message: `분석 실패: ${error.message}` });
    }
  });

  // ===== 네이버 카페 API (관리자 전용) =====
  const CAFE_ID = "31316681";
  const CAFE_URL_ID = "lifefit"; // 카페 Open API 글쓰기용 URL 식별자
  const CAFE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://cafe.naver.com/lifefit",
  };

  // 카페 게시판(메뉴) 목록 조회
  app.get("/api/cafe/menus", requireAdmin, async (req, res) => {
    try {
      const response = await axios.get(
        "https://apis.naver.com/cafe-web/cafe2/SideMenuList.json",
        {
          params: { cafeId: CAFE_ID },
          headers: CAFE_HEADERS,
          timeout: 10000,
        }
      );

      const menus = (response.data?.message?.result?.menus || [])
        .filter((m: any) => m.menuType === "B") // 일반 게시판만
        .map((m: any) => ({
          menuId: m.menuId,
          menuName: m.menuName,
          menuType: m.menuType,
        }));

      return res.json({ menus });
    } catch (error: any) {
      console.error("[Cafe] Failed to fetch menus:", error.message);
      return res.status(500).json({ message: "게시판 목록을 불러올 수 없습니다." });
    }
  });

  // 카페 글 목록 조회 (게시판 필터 지원)
  app.get("/api/cafe/articles", requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 20, 50);
      const menuId = req.query.menuId as string;

      const params: Record<string, string | number> = {
        "search.clubid": CAFE_ID,
        "search.boardtype": "L",
        "search.page": page,
        "search.perPage": perPage,
      };
      if (menuId && menuId !== "0") {
        params["search.menuid"] = menuId;
      }

      const response = await axios.get(
        "https://apis.naver.com/cafe-web/cafe2/ArticleListV2.json",
        {
          params,
          headers: CAFE_HEADERS,
          timeout: 10000,
        }
      );

      const result = response.data?.message?.result;
      const articles = (result?.articleList || []).map((a: any) => ({
        articleId: a.articleId,
        subject: a.subject,
        writerNickname: a.writerNickname,
        menuId: a.menuId,
        menuName: a.menuName,
        readCount: a.readCount,
        commentCount: a.commentCount,
        likeItCount: a.likeItCount,
        representImage: a.representImage || null,
        writeDateTimestamp: a.writeDateTimestamp,
        newArticle: a.newArticle,
        attachImage: a.attachImage,
        attachMovie: a.attachMovie,
        attachFile: a.attachFile,
        openArticle: a.openArticle,
      }));

      return res.json({
        articles,
        page,
        perPage,
        totalArticles: result?.totalArticleCount || articles.length,
      });
    } catch (error: any) {
      console.error("[Cafe] Failed to fetch articles:", error.message);
      return res.status(500).json({ message: "카페 글 목록을 불러올 수 없습니다." });
    }
  });

  // ===== 공개 카페 글 목록 (인증 불필요 - 일반 유저용) =====
  // 전체공지(noticeType=N) 캐시 (5분)
  let publicNoticeCache: { data: any[]; timestamp: number } = { data: [], timestamp: 0 };
  const NOTICE_CACHE_TTL = 5 * 60 * 1000; // 5분

  app.get("/api/cafe/public-articles", async (req, res) => {
    try {
      const mapArticle = (a: any) => ({
        articleId: a.articleId,
        subject: a.subject,
        writerNickname: a.writerNickname,
        menuId: a.menuId,
        menuName: a.menuName,
        readCount: a.readCount,
        commentCount: a.commentCount,
        likeItCount: a.likeItCount,
        writeDateTimestamp: a.writeDateTimestamp,
        newArticle: a.newArticle,
      });

      // 1) 최신 10개 글 가져오기
      const latestRes = await axios.get(
        "https://apis.naver.com/cafe-web/cafe2/ArticleListV2.json",
        {
          params: {
            "search.clubid": CAFE_ID,
            "search.boardtype": "L",
            "search.page": 1,
            "search.perPage": 10,
          },
          headers: CAFE_HEADERS,
          timeout: 10000,
        }
      );
      const latestResult = latestRes.data?.message?.result;
      const latestArticles = (latestResult?.articleList || []).map(mapArticle);

      // 2) 전체공지글 가져오기 (noticeType === "N" 필터링)
      //    - 전체공지는 일반 글 목록 중 noticeType 필드가 있는 글을 스캔하여 추출
      //    - 캐시 사용 (5분)
      let noticeArticles: any[] = [];
      const now = Date.now();
      if (publicNoticeCache.data.length > 0 && (now - publicNoticeCache.timestamp) < NOTICE_CACHE_TTL) {
        noticeArticles = publicNoticeCache.data;
      } else {
        try {
          const noticeSet = new Map<number, any>();
          // 여러 페이지를 순회하며 noticeType === "N" (전체공지) 글 수집
          for (let page = 1; page <= 8; page++) {
            const pageRes = await axios.get(
              "https://apis.naver.com/cafe-web/cafe2/ArticleListV2.json",
              {
                params: {
                  "search.clubid": CAFE_ID,
                  "search.boardtype": "L",
                  "search.page": page,
                  "search.perPage": 50,
                },
                headers: CAFE_HEADERS,
                timeout: 10000,
              }
            );
            const pageArticles = pageRes.data?.message?.result?.articleList || [];
            for (const a of pageArticles) {
              if (a.noticeType === "N") {
                noticeSet.set(a.articleId, mapArticle(a));
              }
            }
            if (pageArticles.length < 50) break; // 마지막 페이지
          }
          noticeArticles = Array.from(noticeSet.values());
          // 최신순 정렬
          noticeArticles.sort((a: any, b: any) => b.writeDateTimestamp - a.writeDateTimestamp);
          // 캐시 저장
          publicNoticeCache = { data: noticeArticles, timestamp: now };
          console.log(`[Cafe] Public notice cache updated: ${noticeArticles.length} articles`);
        } catch (noticeErr: any) {
          console.warn("[Cafe] Failed to fetch notice articles:", noticeErr.message);
          // 캐시가 있으면 만료되어도 사용
          if (publicNoticeCache.data.length > 0) {
            noticeArticles = publicNoticeCache.data;
          }
        }
      }

      return res.json({
        latestArticles,
        noticeArticles,
      });
    } catch (error: any) {
      console.error("[Cafe] Failed to fetch public articles:", error.message);
      return res.status(500).json({ message: "카페 글 목록을 불러올 수 없습니다." });
    }
  });

  // 카페 글 본문 상세 조회 (HTML 스크래핑)
  app.get("/api/cafe/article/:articleId", requireAdmin, async (req, res) => {
    try {
      const articleId = req.params.articleId;

      // cafe.naver.com의 내부 iframe URL로 글 본문 HTML 가져오기
      const response = await axios.get(
        `https://cafe.naver.com/ca-fe/cafes/${CAFE_ID}/articles/${articleId}`,
        {
          params: { fromList: true, page: 1 },
          headers: {
            ...CAFE_HEADERS,
            "Accept": "text/html",
          },
          timeout: 15000,
        }
      );

      const html = typeof response.data === "string" ? response.data : "";

      // 본문 영역 추출 (se-main-container 또는 article_viewer)
      let contentHtml = "";
      const seMatch = html.match(/<div[^>]*class="[^"]*se-main-container[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
      if (seMatch) {
        contentHtml = seMatch[0];
      } else {
        // 구버전 에디터
        const viewerMatch = html.match(/<div[^>]*class="[^"]*article_viewer[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (viewerMatch) {
          contentHtml = viewerMatch[0];
        }
      }

      // 제목 추출
      let subject = "";
      const titleMatch = html.match(/<h3[^>]*class="[^"]*title_text[^"]*"[^>]*>([\s\S]*?)<\/h3>/);
      if (titleMatch) {
        subject = titleMatch[1].replace(/<[^>]+>/g, "").trim();
      }

      // 작성자 추출
      let writerNickname = "";
      const writerMatch = html.match(/<button[^>]*class="[^"]*nick[^"]*"[^>]*>([\s\S]*?)<\/button>/);
      if (writerMatch) {
        writerNickname = writerMatch[1].replace(/<[^>]+>/g, "").trim();
      }

      // 작성일 추출
      let writeDate = "";
      const dateMatch = html.match(/<span[^>]*class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\/span>/);
      if (dateMatch) {
        writeDate = dateMatch[1].replace(/<[^>]+>/g, "").trim();
      }

      if (!contentHtml) {
        // HTML 파싱이 안 되면 기본 링크로 폴백
        return res.json({
          articleId: parseInt(articleId),
          subject: subject || `게시글 #${articleId}`,
          writerNickname,
          writeDate,
          contentHtml: "",
          fallbackUrl: `https://cafe.naver.com/lifefit/${articleId}`,
        });
      }

      return res.json({
        articleId: parseInt(articleId),
        subject,
        writerNickname,
        writeDate,
        contentHtml,
        fallbackUrl: `https://cafe.naver.com/lifefit/${articleId}`,
      });
    } catch (error: any) {
      console.error("[Cafe] Failed to fetch article detail:", error.message);
      return res.status(500).json({ message: "글 본문을 불러올 수 없습니다." });
    }
  });

  // 카페 내 검색 (여러 페이지를 스캔하여 키워드 매칭)
  // 카페 전체 글 인덱스 캐시 (검색용)
  let cafeArticleIndex: {
    articles: Array<{
      articleId: number;
      subject: string;
      writerNickname: string;
      menuId?: number;
      menuName: string;
      readCount: number;
      commentCount: number;
      likeItCount: number;
      representImage: string | null;
      writeDateTimestamp: number;
      newArticle: boolean;
      openArticle: boolean;
    }>;
    totalArticleCount: number;
    lastUpdated: number;
    isBuilding: boolean;
  } = { articles: [], totalArticleCount: 0, lastUpdated: 0, isBuilding: false };

  const ARTICLE_INDEX_TTL = 10 * 60 * 1000; // 10분

  // 전체 글 인덱스 구축 (순차 + hasNext 기반)
  async function buildArticleIndex() {
    if (cafeArticleIndex.isBuilding) return;
    cafeArticleIndex.isBuilding = true;

    try {
      const allArticles: any[] = [];
      let currentPage = 1;
      let hasNext = true;
      const PER_PAGE = 50;
      const MAX_PAGES = 200; // 최대 10,000글

      console.log(`[Cafe Index] Building article index...`);

      while (hasNext && currentPage <= MAX_PAGES) {
        // 5페이지씩 병렬 요청
        const batchSize = Math.min(5, MAX_PAGES - currentPage + 1);
        const promises = [];
        for (let i = 0; i < batchSize; i++) {
          promises.push(
            axios.get("https://apis.naver.com/cafe-web/cafe2/ArticleListV2.json", {
              params: {
                "search.clubid": CAFE_ID,
                "search.boardtype": "L",
                "search.page": currentPage + i,
                "search.perPage": PER_PAGE,
              },
              headers: CAFE_HEADERS,
              timeout: 15000,
            }).catch(() => null)
          );
        }

        const results = await Promise.all(promises);
        let gotData = false;

        for (const response of results) {
          if (!response) continue;
          const result = response.data?.message?.result;
          const articleList = result?.articleList || [];

          if (articleList.length > 0) gotData = true;

          // hasNext가 false면 더이상 페이지 없음
          if (result?.hasNext === false) {
            hasNext = false;
          }

          for (const a of articleList) {
            allArticles.push({
              articleId: a.articleId,
              subject: a.subject,
              writerNickname: a.writerNickname,
              menuId: a.menuId,
              menuName: a.menuName || "",
              readCount: a.readCount || 0,
              commentCount: a.commentCount || 0,
              likeItCount: a.likeItCount || 0,
              representImage: a.representImage || null,
              writeDateTimestamp: a.writeDateTimestamp,
              newArticle: a.newArticle || false,
              openArticle: a.openArticle ?? true,
            });
          }
        }

        if (!gotData) break; // 데이터가 전혀 없으면 중단

        currentPage += batchSize;
      }

      // 중복 제거 (articleId 기준)
      const uniqueMap = new Map<number, any>();
      for (const a of allArticles) {
        uniqueMap.set(a.articleId, a);
      }

      const uniqueArticles = Array.from(uniqueMap.values());

      cafeArticleIndex = {
        articles: uniqueArticles,
        totalArticleCount: uniqueArticles.length,
        lastUpdated: Date.now(),
        isBuilding: false,
      };

      console.log(`[Cafe Index] Built index: ${uniqueArticles.length} articles (${currentPage - 1} pages scanned)`);
    } catch (error: any) {
      console.error("[Cafe Index] Failed to build:", error.message);
      cafeArticleIndex.isBuilding = false;
    }
  }

  app.get("/api/cafe/search", requireAdmin, async (req, res) => {
    try {
      const query = (req.query.q as string || "").trim();
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 20, 50);

      if (!query) {
        return res.json({ articles: [], page: 1, perPage, totalArticles: 0, query: "" });
      }

      // 인덱스가 없거나 만료되었으면 구축
      const now = Date.now();
      if (cafeArticleIndex.articles.length === 0 || now - cafeArticleIndex.lastUpdated > ARTICLE_INDEX_TTL) {
        await buildArticleIndex();
      }

      // 키워드 검색 (제목, 작성자, 게시판명)
      const lowerQuery = query.toLowerCase();
      const keywords = lowerQuery.split(/\s+/).filter(Boolean);

      const matched = cafeArticleIndex.articles.filter((a) => {
        const searchTarget = `${a.subject} ${a.writerNickname} ${a.menuName}`.toLowerCase();
        // 모든 키워드가 포함되어야 매칭 (AND 검색)
        return keywords.every((kw) => searchTarget.includes(kw));
      });

      // 최신순 정렬
      matched.sort((a, b) => (b.writeDateTimestamp || 0) - (a.writeDateTimestamp || 0));

      // 페이지네이션
      const startIdx = (page - 1) * perPage;
      const pagedArticles = matched.slice(startIdx, startIdx + perPage);

      console.log(`[Cafe Search] query="${query}" matched=${matched.length}/${cafeArticleIndex.articles.length} indexed`);

      return res.json({
        articles: pagedArticles,
        page,
        perPage,
        totalArticles: matched.length,
        query: req.query.q,
        indexSize: cafeArticleIndex.articles.length,
        indexAge: Math.round((now - cafeArticleIndex.lastUpdated) / 1000),
      });
    } catch (error: any) {
      console.error("[Cafe] Failed to search articles:", error.message);
      return res.status(500).json({ message: "카페 검색에 실패했습니다." });
    }
  });

  // ===== 카페 공개 검색 (로그인 불필요) =====
  app.get("/api/cafe/public-search", async (req, res) => {
    try {
      const query = (req.query.q as string || "").trim();
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 20, 50);

      if (!query) {
        return res.json({ articles: [], page: 1, perPage, totalArticles: 0, query: "" });
      }

      // 인덱스가 없거나 만료되었으면 구축
      const now = Date.now();
      if (cafeArticleIndex.articles.length === 0 || now - cafeArticleIndex.lastUpdated > ARTICLE_INDEX_TTL) {
        await buildArticleIndex();
      }

      const lowerQuery = query.toLowerCase();
      const keywords = lowerQuery.split(/\s+/).filter(Boolean);

      const matched = cafeArticleIndex.articles.filter((a) => {
        const searchTarget = `${a.subject} ${a.writerNickname} ${a.menuName}`.toLowerCase();
        return keywords.every((kw) => searchTarget.includes(kw));
      });

      matched.sort((a, b) => (b.writeDateTimestamp || 0) - (a.writeDateTimestamp || 0));

      const startIdx = (page - 1) * perPage;
      const pagedArticles = matched.slice(startIdx, startIdx + perPage);

      console.log(`[Cafe Public Search] query="${query}" matched=${matched.length}/${cafeArticleIndex.articles.length} indexed`);

      return res.json({
        articles: pagedArticles,
        page,
        perPage,
        totalArticles: matched.length,
        query: req.query.q,
      });
    } catch (error: any) {
      console.error("[Cafe] Failed to public search articles:", error.message);
      return res.status(500).json({ message: "카페 검색에 실패했습니다." });
    }
  });

  // ===== 카페 이벤트 알림 (관리자 전용) =====
  interface CafeNotification {
    id: string;
    type: "new_article" | "new_comment" | "new_like" | "member_change";
    message: string;
    detail?: string;
    articleId?: number;
    timestamp: number;
  }

  // 이전 상태를 캐싱 (서버 메모리)
  let prevArticleSnapshot: Map<number, { commentCount: number; likeItCount: number; subject: string }> = new Map();
  let prevMemberCount: number | null = null;
  let cafeNotifications: CafeNotification[] = [];
  let lastNotificationCheck = 0;
  const NOTIFICATION_COOLDOWN = 60 * 1000; // 최소 1분 간격

  app.get("/api/cafe/notifications", requireAdmin, async (req, res) => {
    try {
      const now = Date.now();
      const forceRefresh = req.query.refresh === "true";

      // 쿨다운 내이면 캐시 반환
      if (!forceRefresh && now - lastNotificationCheck < NOTIFICATION_COOLDOWN && cafeNotifications.length > 0) {
        return res.json({
          notifications: cafeNotifications.slice(0, 50),
          lastChecked: lastNotificationCheck,
          memberCount: prevMemberCount,
        });
      }

      const newNotifications: CafeNotification[] = [];

      // 1) 카페 기본정보 (멤버 수) 조회
      let currentMemberCount: number | null = null;
      try {
        const cafeInfoRes = await axios.get(
          "https://apis.naver.com/cafe-web/cafe2/CafeGateInfo.json",
          {
            params: { cluburl: "lifefit" },
            headers: CAFE_HEADERS,
            timeout: 8000,
          }
        );
        currentMemberCount = cafeInfoRes.data?.message?.result?.cafeInfoView?.memberCount || null;
      } catch (e) {
        // 멤버 수 조회 실패시 무시
      }

      // 멤버 수 변화 감지
      if (currentMemberCount !== null && prevMemberCount !== null && currentMemberCount !== prevMemberCount) {
        const diff = currentMemberCount - prevMemberCount;
        if (diff > 0) {
          newNotifications.push({
            id: `member_${now}`,
            type: "member_change",
            message: `새 멤버 ${diff}명 가입!`,
            detail: `총 멤버: ${currentMemberCount.toLocaleString()}명`,
            timestamp: now,
          });
        } else if (diff < 0) {
          newNotifications.push({
            id: `member_${now}`,
            type: "member_change",
            message: `멤버 ${Math.abs(diff)}명 탈퇴`,
            detail: `총 멤버: ${currentMemberCount.toLocaleString()}명`,
            timestamp: now,
          });
        }
      }
      if (currentMemberCount !== null) prevMemberCount = currentMemberCount;

      // 2) 최신 글 목록 조회 (최근 50개)
      const articlesRes = await axios.get(
        "https://apis.naver.com/cafe-web/cafe2/ArticleListV2.json",
        {
          params: {
            "search.clubid": CAFE_ID,
            "search.boardtype": "L",
            "search.page": 1,
            "search.perPage": 50,
          },
          headers: CAFE_HEADERS,
          timeout: 10000,
        }
      );

      const currentArticles = (articlesRes.data?.message?.result?.articleList || []).map((a: any) => ({
        articleId: a.articleId as number,
        subject: a.subject as string,
        writerNickname: a.writerNickname as string,
        menuName: a.menuName as string,
        commentCount: (a.commentCount || 0) as number,
        likeItCount: (a.likeItCount || 0) as number,
        writeDateTimestamp: a.writeDateTimestamp as number,
        newArticle: a.newArticle as boolean,
      }));

      if (prevArticleSnapshot.size > 0) {
        for (const article of currentArticles) {
          const prev = prevArticleSnapshot.get(article.articleId);

          if (!prev) {
            // 새 글 감지
            newNotifications.push({
              id: `new_${article.articleId}`,
              type: "new_article",
              message: `새 글: ${article.subject}`,
              detail: `${article.writerNickname} · ${article.menuName}`,
              articleId: article.articleId,
              timestamp: article.writeDateTimestamp || now,
            });
          } else {
            // 댓글 수 변화
            const commentDiff = article.commentCount - prev.commentCount;
            if (commentDiff > 0) {
              newNotifications.push({
                id: `comment_${article.articleId}_${now}`,
                type: "new_comment",
                message: `"${article.subject}" 에 댓글 ${commentDiff}개`,
                detail: `총 ${article.commentCount}개`,
                articleId: article.articleId,
                timestamp: now,
              });
            }

            // 좋아요 수 변화
            const likeDiff = article.likeItCount - prev.likeItCount;
            if (likeDiff > 0) {
              newNotifications.push({
                id: `like_${article.articleId}_${now}`,
                type: "new_like",
                message: `"${article.subject}" 에 좋아요 ${likeDiff}개`,
                detail: `총 ${article.likeItCount}개`,
                articleId: article.articleId,
                timestamp: now,
              });
            }
          }
        }
      }

      // 현재 상태를 스냅샷으로 저장
      prevArticleSnapshot = new Map();
      for (const article of currentArticles) {
        prevArticleSnapshot.set(article.articleId, {
          commentCount: article.commentCount,
          likeItCount: article.likeItCount,
          subject: article.subject,
        });
      }

      // 새 알림을 기존 알림 앞에 추가 (최대 100개 유지)
      if (newNotifications.length > 0) {
        cafeNotifications = [...newNotifications, ...cafeNotifications].slice(0, 100);
      }

      lastNotificationCheck = now;

      return res.json({
        notifications: cafeNotifications.slice(0, 50),
        lastChecked: lastNotificationCheck,
        memberCount: prevMemberCount,
        newCount: newNotifications.length,
      });
    } catch (error: any) {
      console.error("[Cafe Notifications] Error:", error.message);
      return res.status(500).json({ message: "알림 조회에 실패했습니다." });
    }
  });

  // 알림 개별 삭제
  app.delete("/api/cafe/notifications/:id", requireAdmin, (req, res) => {
    const id = req.params.id;
    cafeNotifications = cafeNotifications.filter(n => n.id !== id);
    return res.json({ message: "알림이 삭제되었습니다." });
  });

  // 알림 전체 삭제
  app.delete("/api/cafe/notifications", requireAdmin, (req, res) => {
    cafeNotifications = [];
    return res.json({ message: "모든 알림이 삭제되었습니다." });
  });

  // ===== 네이버 OAuth + 카페 글쓰기 (관리자 전용) =====
  const NAVER_REDIRECT_URI = `${process.env.VERCEL ? "https://" + process.env.VERCEL_URL : "http://localhost:" + (process.env.PORT || 3000)}/api/auth/naver/callback`;

  // 네이버 OAuth 로그인 시작
  app.get("/api/auth/naver", requireAdmin, (req, res) => {
    if (!NAVER_CLIENT_ID) {
      return res.status(500).json({ message: "네이버 OAuth가 설정되지 않았습니다." });
    }
    const state = Math.random().toString(36).substring(2, 15);
    (req.session as any).naverOAuthState = state;
    const authUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(NAVER_REDIRECT_URI)}&state=${state}&scope=cafe_article_write`;
    return res.json({ authUrl });
  });

  // 네이버 OAuth 콜백
  app.get("/api/auth/naver/callback", async (req, res) => {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        return res.redirect("/?naverAuth=error&message=missing_params");
      }

      // Access Token 발급
      const tokenResponse = await axios.get("https://nid.naver.com/oauth2.0/token", {
        params: {
          grant_type: "authorization_code",
          client_id: NAVER_CLIENT_ID,
          client_secret: NAVER_CLIENT_SECRET,
          code,
          state,
        },
        timeout: 10000,
      });

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      if (!access_token) {
        console.error("[Naver OAuth] Token error:", tokenResponse.data);
        return res.redirect("/?naverAuth=error&message=token_failed");
      }

      // 사용자 프로필 조회 (닉네임 등)
      const profileResponse = await axios.get("https://openapi.naver.com/v1/nid/me", {
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 10000,
      });

      const profile = profileResponse.data?.response || {};

      // 세션에 네이버 토큰 저장
      (req.session as any).naverAccessToken = access_token;
      (req.session as any).naverRefreshToken = refresh_token;
      (req.session as any).naverTokenExpiry = Date.now() + (expires_in * 1000);
      (req.session as any).naverNickname = profile.nickname || profile.name || "네이버 사용자";
      (req.session as any).naverProfileImage = profile.profile_image || null;

      console.log(`[Naver OAuth] Login success: ${profile.nickname || profile.name}`);

      // 프론트엔드로 리다이렉트
      return res.redirect("/?naverAuth=success");
    } catch (error: any) {
      console.error("[Naver OAuth] Callback error:", error.message);
      return res.redirect("/?naverAuth=error&message=callback_failed");
    }
  });

  // 네이버 Access Token 갱신 헬퍼
  async function refreshNaverToken(req: Request): Promise<string | null> {
    const refreshToken = (req.session as any).naverRefreshToken;
    if (!refreshToken) return null;

    try {
      const response = await axios.get("https://nid.naver.com/oauth2.0/token", {
        params: {
          grant_type: "refresh_token",
          client_id: NAVER_CLIENT_ID,
          client_secret: NAVER_CLIENT_SECRET,
          refresh_token: refreshToken,
        },
        timeout: 10000,
      });

      const { access_token, expires_in } = response.data;
      if (access_token) {
        (req.session as any).naverAccessToken = access_token;
        (req.session as any).naverTokenExpiry = Date.now() + (expires_in * 1000);
        return access_token;
      }
    } catch (err: any) {
      console.error("[Naver OAuth] Token refresh failed:", err.message);
    }
    return null;
  }

  // 유효한 네이버 토큰 가져오기
  async function getValidNaverToken(req: Request): Promise<string | null> {
    const token = (req.session as any).naverAccessToken;
    const expiry = (req.session as any).naverTokenExpiry;

    if (!token) return null;

    // 토큰 만료 5분 전이면 갱신
    if (expiry && Date.now() > expiry - 5 * 60 * 1000) {
      return await refreshNaverToken(req);
    }

    return token;
  }

  // 네이버 로그인 상태 확인
  app.get("/api/auth/naver/status", requireAdmin, (req, res) => {
    const token = (req.session as any).naverAccessToken;
    const nickname = (req.session as any).naverNickname;
    const profileImage = (req.session as any).naverProfileImage;

    return res.json({
      isNaverLoggedIn: !!token,
      naverNickname: nickname || null,
      naverProfileImage: profileImage || null,
    });
  });

  // 네이버 로그아웃
  app.post("/api/auth/naver/logout", requireAdmin, async (req, res) => {
    const token = (req.session as any).naverAccessToken;

    if (token) {
      // 네이버 토큰 삭제 요청
      try {
        await axios.get("https://nid.naver.com/oauth2.0/token", {
          params: {
            grant_type: "delete",
            client_id: NAVER_CLIENT_ID,
            client_secret: NAVER_CLIENT_SECRET,
            access_token: token,
            service_provider: "NAVER",
          },
          timeout: 10000,
        });
      } catch (err) {
        // 토큰 삭제 실패해도 로컬 세션은 정리
      }
    }

    delete (req.session as any).naverAccessToken;
    delete (req.session as any).naverRefreshToken;
    delete (req.session as any).naverTokenExpiry;
    delete (req.session as any).naverNickname;
    delete (req.session as any).naverProfileImage;

    return res.json({ message: "네이버 로그아웃 완료" });
  });

  // 카페 글쓰기 API
  app.post("/api/cafe/write", requireAdmin, async (req, res) => {
    try {
      const { subject, content, menuId } = req.body;

      if (!subject || !content || !menuId) {
        return res.status(400).json({ message: "제목, 내용, 게시판을 모두 입력해주세요." });
      }

      const naverToken = await getValidNaverToken(req);
      if (!naverToken) {
        return res.status(401).json({ message: "네이버 로그인이 필요합니다.", requireNaverLogin: true });
      }

      // 네이버 카페 API용 컨텐츠 정제: HTML 태그 완전 제거 → 순수 텍스트만
      let cleanContent = content
        .replace(/[^\u0000-\uFFFF]/g, '')           // 이모지 제거
        .replace(/<br\s*\/?>/gi, '\n')               // <br>, <br/> → 줄바꿈
        .replace(/<\/p>/gi, '\n')                    // </p> → 줄바꿈
        .replace(/<[^>]+>/g, '')                     // 모든 HTML 태그 제거
        .replace(/&lt;/g, '<')                       // HTML 엔티티 복원
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\n{3,}/g, '\n\n')                  // 3줄 이상 빈줄 → 2줄로
        .trim();

      // 컨텐츠 길이 제한
      const contentBytes = Buffer.byteLength(cleanContent, 'utf8');
      if (contentBytes > 60000) {
        cleanContent = cleanContent.substring(0, Math.floor(cleanContent.length * (60000 / contentBytes)));
      }

      const apiUrl = `https://openapi.naver.com/v1/cafe/${CAFE_ID}/menu/${menuId}/articles`;

      // 헬퍼: multipart/form-data로 전송
      const tryPostMultipart = async (subj: string, cont: string, label: string) => {
        const FormData = (await import("form-data")).default;
        const fd = new FormData();
        fd.append("subject", subj);
        fd.append("content", cont);
        console.log(`[Cafe Write] ${label}: subject="${subj.substring(0,30)}..." content(${Buffer.byteLength(cont)}b)="${cont.substring(0,80)}..."`);
        const resp = await axios.post(apiUrl, fd, {
          headers: {
            Authorization: `Bearer ${naverToken}`,
            ...fd.getHeaders(),
          },
          timeout: 30000,
        });
        console.log(`[Cafe Write] SUCCESS (${label})`);
        return resp;
      };

      // 단계별 시도 (multipart/form-data 사용)
      const contentVariants = [
        { label: "full-multipart", text: cleanContent },
        { label: "2000chars-multipart", text: cleanContent.substring(0, 2000) },
        { label: "500chars-multipart", text: cleanContent.substring(0, 500) },
        { label: "korean-only-200", text: cleanContent.replace(/[^가-힣a-zA-Z0-9\s.,]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200) },
        { label: "minimal", text: "ETF 실시간 상승 분석 보고서" },
      ];

      for (const variant of contentVariants) {
        try {
          const response = await tryPostMultipart(subject, variant.text, variant.label);
          const wasTruncated = variant.label !== "full-multipart";
          return res.json({
            message: wasTruncated
              ? `카페에 글이 등록되었습니다. (${variant.label} 모드)`
              : "카페에 글이 등록되었습니다.",
            result: response.data,
            articleUrl: response.data?.message?.result?.articleUrl || null,
            truncated: wasTruncated,
            usedMode: variant.label,
          });
        } catch (err: any) {
          const errStatus = err.response?.status;
          const errCode = err.response?.data?.message?.error?.code;
          const errMsg = err.response?.data?.message?.error?.msg || err.message;
          console.warn(`[Cafe Write] ${variant.label} FAILED (HTTP ${errStatus}, code=${errCode}): ${errMsg}`);

          if (errStatus === 401) {
            const newToken = await refreshNaverToken(req);
            if (newToken) {
              return res.status(500).json({ message: "토큰을 갱신했습니다. 다시 시도해주세요." });
            }
            return res.status(401).json({ message: "네이버 토큰이 만료되었습니다. 다시 로그인해주세요.", requireNaverLogin: true });
          }
          continue;
        }
      }

      // 모두 실패 → 스팸 필터 또는 API 제한일 가능성
      return res.status(500).json({
        message: "카페 글쓰기 실패. 짧은 시간 내 여러 번 시도하면 일시적으로 차단될 수 있습니다. 몇 분 후 다시 시도하거나, 홈 화면에서 네이버 로그아웃 후 다시 로그인해주세요.",
      });
    } catch (error: any) {
      console.error(`[Cafe Write] Unexpected error:`, error.message);
      return res.status(500).json({
        message: `글 등록 실패: ${error.message}`,
      });
    }
  });

  // ETF 검색 (네이버 금융 전체 ETF 목록에서 검색) - 풍부한 데이터 포함
  app.get("/api/etf/search", async (req, res) => {
    try {
      const query = (req.query.q as string || "").trim();
      if (!query || query.length < 2) {
        return res.status(400).json({ message: "검색어는 2자 이상 입력해주세요." });
      }

      const allEtfs = await getEtfFullList();
      const lowerQuery = query.toLowerCase();

      const results = allEtfs
        .filter((etf: any) =>
          etf.code.includes(query) ||
          etf.name.toLowerCase().includes(lowerQuery)
        )
        .slice(0, 30)
        .map((etf: any) => ({
          code: etf.code,
          name: etf.name,
          nowVal: etf.nowVal,
          changeVal: etf.changeVal,
          changeRate: etf.changeRate,
          risefall: etf.risefall,
          nav: etf.nav,
          quant: etf.quant,
          amount: etf.amount,
          marketCap: etf.marketCap,
          threeMonthEarnRate: etf.threeMonthEarnRate,
        }));

      res.json({ results, total: results.length });
    } catch (error: any) {
      console.error("Failed to search ETFs:", error);
      res.status(500).json({ message: error.message || "ETF 검색 실패" });
    }
  });

  // ========== ETF 스크리너 (조건 필터 검색) ==========
  app.get("/api/etf/screener", async (req, res) => {
    try {
      const allEtfs = await getEtfFullList();
      
      // 필터 파라미터
      const minChangeRate = parseFloat(req.query.minChangeRate as string) || -Infinity;
      const maxChangeRate = parseFloat(req.query.maxChangeRate as string) || Infinity;
      const minMarketCap = parseFloat(req.query.minMarketCap as string) || 0;
      const minVolume = parseFloat(req.query.minVolume as string) || 0;
      const min3mReturn = parseFloat(req.query.min3mReturn as string) || -Infinity;
      const max3mReturn = parseFloat(req.query.max3mReturn as string) || Infinity;
      const excludeLeverage = req.query.excludeLeverage === "true";
      const excludeInverse = req.query.excludeInverse === "true";
      const keyword = (req.query.keyword as string || "").trim().toLowerCase();
      const sortBy = (req.query.sortBy as string) || "changeRate";
      const sortOrder = (req.query.sortOrder as string) || "desc";
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const LEVERAGE_KEYWORDS = ["레버리지", "2X", "울트라"];
      const INVERSE_KEYWORDS = ["인버스", "bear", "BEAR", "곱버스", "숏", "SHORT"];

      let filtered = allEtfs.filter((etf) => {
        if (etf.changeRate < minChangeRate || etf.changeRate > maxChangeRate) return false;
        if (etf.marketCap < minMarketCap) return false;
        if (etf.quant < minVolume) return false;
        if (etf.threeMonthEarnRate < min3mReturn || etf.threeMonthEarnRate > max3mReturn) return false;
        if (excludeLeverage && LEVERAGE_KEYWORDS.some(kw => etf.name.includes(kw))) return false;
        if (excludeInverse && INVERSE_KEYWORDS.some(kw => etf.name.includes(kw))) return false;
        if (keyword && !etf.name.toLowerCase().includes(keyword) && !etf.code.includes(keyword)) return false;
        return true;
      });

      // 정렬
      const sortField = sortBy as keyof EtfListItem;
      filtered.sort((a: any, b: any) => {
        const aVal = a[sortField] || 0;
        const bVal = b[sortField] || 0;
        return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
      });

      const results = filtered.slice(0, limit).map((etf) => ({
        code: etf.code,
        name: etf.name,
        nowVal: etf.nowVal,
        changeVal: etf.changeVal,
        changeRate: etf.changeRate,
        risefall: etf.risefall,
        nav: etf.nav,
        quant: etf.quant,
        amount: etf.amount,
        marketCap: etf.marketCap,
        threeMonthEarnRate: etf.threeMonthEarnRate,
      }));

      res.json({ results, total: filtered.length, filtered: results.length });
    } catch (error: any) {
      console.error("Failed to screen ETFs:", error);
      res.status(500).json({ message: error.message || "ETF 스크리너 실패" });
    }
  });

  // ========== ETF 상세 정보 (네이버 모바일 API) ==========
  app.get("/api/etf/detail/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const [basicRes, indicatorRes] = await Promise.all([
        axios.get(`https://m.stock.naver.com/api/stock/${code}/basic`, {
          timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" }
        }).catch(() => null),
        axios.get(`https://m.stock.naver.com/api/stock/${code}/integration`, {
          timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" }
        }).catch(() => null),
      ]);
      
      const basic = basicRes?.data || {};
      const integration = indicatorRes?.data || {};
      const etfIndicator = integration?.etfKeyIndicator || {};

      res.json({
        code,
        name: basic.stockName || code,
        currentPrice: basic.closePrice,
        changePrice: basic.compareToPreviousClosePrice,
        changeRate: basic.fluctuationsRatio,
        highPrice: basic.highPrice,
        lowPrice: basic.lowPrice,
        volume: basic.accumulatedTradingVolume,
        marketCap: basic.marketCap,
        nav: etfIndicator.nav,
        trackingError: etfIndicator.trackingError,
        dividendYield: etfIndicator.dividendYieldTtm,
        totalExpenseRatio: etfIndicator.totalExpenseRatio,
        listingDate: etfIndicator.listingDate,
        indexName: etfIndicator.indexName,
        managementCompany: etfIndicator.managementCompany,
        totalAssets: etfIndicator.totalAssets,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "ETF 상세 조회 실패" });
    }
  });

  // ========== ETF 차트 데이터 ==========
  app.get("/api/etf/chart/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const period = (req.query.period as string) || "3m"; // 1m, 3m, 6m, 1y, 3y
      const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
      
      // 기간 -> requestCount 맵핑
      const countMap: Record<string, number> = { "1m": 21, "3m": 63, "6m": 126, "1y": 252, "3y": 756 };
      const count = countMap[period] || 63;

      // Naver 차트 API
      const chartRes = await axios.get(
        `https://api.stock.naver.com/chart/domestic/item/${code}/day?startDateTime=20200101&endDateTime=20990101&requestCount=${count}`,
        { headers: { "User-Agent": UA }, timeout: 8000 }
      ).catch(() => null);

      if (!chartRes?.data) {
        return res.json({ chartData: [] });
      }

      const items = Array.isArray(chartRes.data) ? chartRes.data : (chartRes.data?.priceInfos || []);
      const chartData = items.map((item: any) => ({
        date: item.localDate || item.dt,
        open: Number(item.openPrice || item.open || 0),
        high: Number(item.highPrice || item.high || 0),
        low: Number(item.lowPrice || item.low || 0),
        close: Number(item.closePrice || item.close || 0),
        volume: Number(item.accumulatedTradingVolume || item.volume || 0),
      }));

      res.json({ chartData });
    } catch (error: any) {
      console.error("[ETF Chart] Error:", error.message);
      res.json({ chartData: [] });
    }
  });

  // ========== ETF 구성종목 ==========
  app.get("/api/etf/holdings/:code", async (req, res) => {
    try {
      const code = req.params.code;

      // KIS API (WiseReport 스크래핑 포함)로 구성종목 가져오기
      try {
        const kisResult = await kisApi.getEtfComponents(code).catch(() => null);
        if (kisResult?.components?.length) {
          const holdings = kisResult.components.slice(0, 30).map((s: any) => ({
            stockCode: s.stockCode || "",
            name: s.stockName || "",
            weight: typeof s.weight === "number" ? s.weight : (parseFloat(s.weight || "0") || 0),
            quantity: s.quantity || 0,
            price: Number(s.price) || 0,
            changeRate: Number(s.changePercent) || 0,
          }));
          return res.json({ holdings });
        }
      } catch {
        // KIS API 실패시 아래로 진행
      }

      // fallback: Naver mobile API 시도
      const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
      const holdingsRes = await axios.get(
        `https://m.stock.naver.com/api/stock/${code}/etfHoldings`,
        { headers: { "User-Agent": UA }, timeout: 8000 }
      ).catch(() => null);

      if (!holdingsRes?.data || (typeof holdingsRes.data === 'string' && holdingsRes.data.includes('<!doctype'))) {
        return res.json({ holdings: [] });
      }

      const raw = holdingsRes.data;
      const list = Array.isArray(raw) ? raw : (raw?.etfHoldings || raw?.stocks || []);
      const holdings = list.map((item: any) => ({
        stockCode: item.itemCode || item.stockCode || "",
        name: item.itemName || item.stockName || item.name || "",
        weight: Number(item.weight || item.weightPercent || 0),
        quantity: Number(item.quantity || item.stockCount || 0),
        price: Number(item.closePrice || item.price || 0),
        changeRate: Number(item.fluctuationsRatio || item.changeRate || 0),
      })).slice(0, 30);

      res.json({ holdings });
    } catch (error: any) {
      console.error("[ETF Holdings] Error:", error.message);
      res.json({ holdings: [] });
    }
  });

  // ========== ETF 수익률 정보 ==========
  app.get("/api/etf/performance/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

      // 네이버 모바일 API에서 ETF 수익률 정보
      const [perfRes, integrationRes] = await Promise.all([
        axios.get(`https://m.stock.naver.com/api/stock/${code}/basic`, {
          headers: { "User-Agent": UA }, timeout: 5000
        }).catch(() => null),
        axios.get(`https://m.stock.naver.com/api/stock/${code}/integration`, {
          headers: { "User-Agent": UA }, timeout: 5000
        }).catch(() => null),
      ]);

      const basic = perfRes?.data || {};
      const integration = integrationRes?.data || {};
      const etfIndicator = integration?.etfKeyIndicator || {};
      const returnRates = integration?.etfReturnRate || {};

      res.json({
        // 기간별 수익률
        return1w: returnRates?.["1주"] || returnRates?.oneWeek || null,
        return1m: returnRates?.["1개월"] || returnRates?.oneMonth || null,
        return3m: returnRates?.["3개월"] || returnRates?.threeMonths || null,
        return6m: returnRates?.["6개월"] || returnRates?.sixMonths || null,
        return1y: returnRates?.["1년"] || returnRates?.oneYear || null,
        returnYtd: returnRates?.["연초이후"] || returnRates?.ytd || null,
        // 지표
        nav: etfIndicator?.nav,
        trackingError: etfIndicator?.trackingError,
        premiumDiscount: etfIndicator?.premiumDiscount || etfIndicator?.premium,
        dividendYield: etfIndicator?.dividendYieldTtm,
        totalExpenseRatio: etfIndicator?.totalExpenseRatio,
        // 52주 고저
        highPrice52w: basic?.highPrice52w || basic?.yearHighPrice,
        lowPrice52w: basic?.lowPrice52w || basic?.yearLowPrice,
      });
    } catch (error: any) {
      console.error("[ETF Performance] Error:", error.message);
      res.json({});
    }
  });

  // ========== ETF 비교 ==========
  app.get("/api/etf/compare", async (req, res) => {
    try {
      const codesStr = req.query.codes as string;
      if (!codesStr) return res.status(400).json({ message: "비교할 ETF 코드를 입력하세요." });
      
      const codes = codesStr.split(",").map(c => c.trim()).filter(Boolean).slice(0, 5);
      if (codes.length < 2) return res.status(400).json({ message: "2개 이상의 ETF를 선택해주세요." });

      const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

      // 전체 목록에서 기본 데이터
      const allEtfs = await getEtfFullList();
      
      const results = await Promise.all(codes.map(async (code) => {
        const listData = allEtfs.find((e: any) => e.code === code);
        
        // 상세 데이터 + 수익률 + 구성종목 병렬 조회
        let detail: any = {};
        let performance: any = {};
        let holdings: any[] = [];
        let costDetail: any = {};

        try {
          // integration API에서 etfKeyIndicator + totalInfos 가져오기
          const integRes = await axios.get(`https://m.stock.naver.com/api/stock/${code}/integration`, {
            timeout: 8000, headers: { "User-Agent": UA }
          }).catch(() => null);

          const integration = integRes?.data || {};
          const indic = integration?.etfKeyIndicator || {};
          const totalInfos: any[] = integration?.totalInfos || [];

          // totalInfos에서 key-value 매핑 헬퍼
          const getInfoVal = (key: string): string | null => {
            const item = totalInfos.find((t: any) => t.key === key);
            return item?.value || null;
          };
          // 수익률 문자열에서 숫자 추출 ("+21.38%" → 21.38)
          const parseRate = (str: string | null): number | null => {
            if (!str) return null;
            const m = str.match(/([+-]?\d+\.?\d*)/);
            return m ? parseFloat(m[1]) * (str.includes('-') ? -1 : 1) : null;
          };

          // 숫자 문자열 파싱 헬퍼 ("83,120" → 83120)
          const parseNumStr = (s: string | null): number | null => {
            if (!s) return null;
            const n = parseFloat(s.replace(/,/g, ''));
            return isNaN(n) ? null : n;
          };

          // 실제 API 필드명에 맞게 매핑
          detail = {
            dividendYield: indic.dividendYieldTtm ?? null,
            totalExpenseRatio: indic.totalFee ?? null,
            indexName: getInfoVal("기초지수"),
            managementCompany: indic.issuerName || getInfoVal("운용사") || null,
            totalAssets: indic.marketValue || null, // "16조 691억" 형태 문자열
            totalNav: indic.totalNav || null,
            nav: indic.nav || null,
            trackingError: indic.deviationRate != null ? `${indic.deviationSign || ""}${indic.deviationRate}%` : null,
            highPrice52w: parseNumStr(getInfoVal("52주 최고")),
            lowPrice52w: parseNumStr(getInfoVal("52주 최저")),
            listingDate: null,
            riskGrade: null,
            stockType: null,
          };

          // 수익률 정보 (etfKeyIndicator + totalInfos에서 추출)
          performance = {
            week1: null,
            month1: indic.returnRate1m ?? parseRate(getInfoVal("최근 1개월 수익률")),
            month3: indic.returnRate3m ?? parseRate(getInfoVal("최근 3개월 수익률")),
            month6: parseRate(getInfoVal("최근 6개월 수익률")),
            year1: indic.returnRate1y ?? parseRate(getInfoVal("최근 1년 수익률")),
            year3: null,
            year5: null,
            ytd: null,
          };

          // 비용 상세
          const feeStr = getInfoVal("펀드보수");
          const totalFeeVal = indic.totalFee ?? (feeStr ? parseFloat(feeStr.replace('%', '')) : null);
          costDetail = {
            managementFee: null,
            sellingFee: null,
            trustFee: null,
            officeFee: null,
            totalFee: totalFeeVal,
            syntheticTotalFee: null,
            realExpenseRatio: null,
            monthlyDividend: indic.monthlyDividend ? "O" : "X",
            annualDividendRate: indic.dividendYieldTtm ?? null,
            annualDividendCount: null,
          };

          // 구성종목 TOP10 - KIS API (WiseReport 스크래핑 포함) 사용
          try {
            const kisResult = await kisApi.getEtfComponents(code).catch(() => null);
            if (kisResult?.components?.length) {
              holdings = kisResult.components
                .filter((s: any) => {
                  // 설정현금액 등 비종목 항목 제외
                  const name = s.stockName || s.name || "";
                  return !name.includes("설정현금") && !name.includes("현금및기타");
                })
                .slice(0, 10)
                .map((s: any) => ({
                  name: s.stockName || s.name || "",
                  code: s.stockCode || s.code || "",
                  weight: typeof s.weight === "number" ? s.weight : (parseFloat(s.weight || "0") || 0),
                  price: s.price || "",
                  changePercent: s.changePercent || "",
                }));
            }
          } catch {
            // 구성종목 실패해도 계속 진행
          }
        } catch (e) {
          console.error(`[ETF Compare] Error fetching details for ${code}:`, e);
        }

        return {
          code,
          name: listData?.name || code,
          nowVal: listData?.nowVal || 0,
          changeVal: listData?.changeVal || 0,
          changeRate: listData?.changeRate || 0,
          nav: listData?.nav || detail.nav || 0,
          quant: listData?.quant || 0,
          amount: listData?.amount || 0,
          marketCap: listData?.marketCap || 0,
          threeMonthEarnRate: listData?.threeMonthEarnRate || 0,
          ...detail,
          performance,
          costDetail,
          holdings,
        };
      }));

      // 하단 요약 문구 생성
      let summary: string[] = [];
      
      // 1년 수익률 최고
      const validYear1 = results.filter(r => r.performance?.year1 != null && !isNaN(parseFloat(String(r.performance.year1))));
      if (validYear1.length > 0) {
        const best1Y = validYear1.reduce((a, b) => (parseFloat(String(a.performance.year1)) > parseFloat(String(b.performance.year1)) ? a : b));
        summary.push(`비교하신 상품 중, 1년 수익률이 가장 높은 상품은 ${best1Y.name} 이며`);
      }
      
      // 구성종목 TOP3
      const firstWithHoldings = results.find(r => r.holdings?.length >= 3);
      if (firstWithHoldings) {
        const top3 = firstWithHoldings.holdings.slice(0, 3).map((h: any) => h.name).join(", ");
        summary.push(`해당 상품의 구성 종목 TOP3는 ${top3} 입니다.`);
      }
      
      // 총보수 최저
      const validFee = results.filter(r => r.totalExpenseRatio != null && parseFloat(String(r.totalExpenseRatio)) > 0);
      if (validFee.length > 0) {
        const lowestFee = validFee.reduce((a, b) => (parseFloat(String(a.totalExpenseRatio)) < parseFloat(String(b.totalExpenseRatio)) ? a : b));
        const biggestSize = results.reduce((a, b) => ((a.marketCap || 0) > (b.marketCap || 0) ? a : b));
        summary.push(`총보수가 가장 저렴한 상품은 ${lowestFee.name}(${lowestFee.totalExpenseRatio}%) 이며 기준 규모가 가장 큰 상품은 ${biggestSize.name} 입니다.`);
      }
      
      // 3개월 수익률 비교
      const validMonth3 = results.filter(r => r.performance?.month3 != null);
      if (validMonth3.length > 0) {
        const best3M = validMonth3.reduce((a, b) => ((a.performance.month3 || 0) > (b.performance.month3 || 0) ? a : b));
        summary.push(`3개월 수익률이 가장 높은 상품은 ${best3M.name}(${best3M.performance.month3}%) 입니다.`);
      }

      res.json({ etfs: results, summary });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "ETF 비교 실패" });
    }
  });

  // ========== ETF 테마 분류 ==========
  app.get("/api/etf/themes", async (req, res) => {
    try {
      const allEtfs = await getEtfFullList();
      
      // 테마 키워드 분류
      const themeMap: Record<string, { keywords: string[]; icon: string }> = {
        "반도체/AI": { keywords: ["반도체", "AI", "인공지능", "GPU", "HBM"], icon: "🤖" },
        "2차전지/배터리": { keywords: ["2차전지", "배터리", "리튬", "전기차", "EV"], icon: "🔋" },
        "바이오/헬스케어": { keywords: ["바이오", "헬스케어", "제약", "의약", "의료"], icon: "💊" },
        "금융": { keywords: ["금융", "은행", "보험", "증권", "리츠"], icon: "🏦" },
        "에너지/원자재": { keywords: ["에너지", "원유", "천연가스", "금", "은", "원자재", "구리"], icon: "⛽" },
        "미국주식": { keywords: ["미국", "나스닥", "S&P", "다우", "필라델피아"], icon: "🇺🇸" },
        "중국/신흥국": { keywords: ["중국", "CSI", "항셍", "신흥국", "인도", "베트남", "일본"], icon: "🌏" },
        "채권": { keywords: ["채권", "국채", "회사채", "하이일드", "국고채"], icon: "📜" },
        "배당": { keywords: ["배당", "고배당", "월배당", "커버드콜"], icon: "💰" },
        "레버리지/인버스": { keywords: ["레버리지", "인버스", "2X", "곱버스", "숏", "bear", "BEAR", "울트라"], icon: "⚡" },
        "코스피/코스닥": { keywords: ["코스피200", "코스닥150", "KRX", "KOSPI", "KOSDAQ", "TOP10"], icon: "📊" },
        "IT/소프트웨어": { keywords: ["IT", "소프트웨어", "클라우드", "사이버", "디지털", "플랫폼", "메타버스"], icon: "💻" },
        "ESG/친환경": { keywords: ["ESG", "친환경", "그린", "탄소", "신재생", "수소", "태양광"], icon: "🌱" },
        "부동산/인프라": { keywords: ["부동산", "리츠", "인프라", "건설"], icon: "🏗️" },
      };

      const themes: Record<string, any[]> = {};
      const themeStats: any[] = [];

      for (const [themeName, config] of Object.entries(themeMap)) {
        const themeEtfs = allEtfs.filter(etf => 
          config.keywords.some(kw => etf.name.includes(kw))
        );
        
        if (themeEtfs.length > 0) {
          // 등락률 기준 상위 5개만
          const topEtfs = [...themeEtfs]
            .sort((a, b) => b.changeRate - a.changeRate)
            .slice(0, 5)
            .map(etf => ({
              code: etf.code,
              name: etf.name,
              nowVal: etf.nowVal,
              changeRate: etf.changeRate,
              marketCap: etf.marketCap,
              threeMonthEarnRate: etf.threeMonthEarnRate,
            }));

          const avgChangeRate = themeEtfs.reduce((s, e) => s + e.changeRate, 0) / themeEtfs.length;
          const avg3mReturn = themeEtfs.reduce((s, e) => s + e.threeMonthEarnRate, 0) / themeEtfs.length;
          
          themes[themeName] = topEtfs;
          themeStats.push({
            name: themeName,
            icon: config.icon,
            count: themeEtfs.length,
            avgChangeRate: Math.round(avgChangeRate * 100) / 100,
            avg3mReturn: Math.round(avg3mReturn * 100) / 100,
            topEtfs,
          });
        }
      }

      // 평균 등락률 기준 정렬
      themeStats.sort((a, b) => b.avgChangeRate - a.avgChangeRate);

      res.json({ themes: themeStats, totalEtfs: allEtfs.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "ETF 테마 조회 실패" });
    }
  });

  // ========== ETF AI 추천 ==========
  app.post("/api/etf/ai-recommend", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId;
      const { purpose, riskLevel, keywords } = req.body;
      
      // 사용자 AI 키 가져오기
      let userKey: UserAiKeyOption | undefined;
      if (userId) {
        const userAiConfig = await storage.getUserAiConfig(userId);
        if (userAiConfig && userAiConfig.useOwnKey) {
          userKey = {
            provider: userAiConfig.aiProvider || "gemini",
            geminiApiKey: userAiConfig.geminiApiKey || undefined,
            openaiApiKey: userAiConfig.openaiApiKey || undefined,
          };
        }
      }

      // 현재 ETF 데이터 수집
      const allEtfs = await getEtfFullList();
      
      // 키워드로 관련 ETF 필터
      const relevantEtfs = keywords 
        ? allEtfs.filter(etf => {
            const name = etf.name.toLowerCase();
            return keywords.split(",").some((kw: string) => name.includes(kw.trim().toLowerCase()));
          }).slice(0, 30)
        : allEtfs.sort((a, b) => b.changeRate - a.changeRate).slice(0, 30);
      
      const etfListStr = relevantEtfs.map(e => 
        `${e.name}(${e.code}): 현재가 ${e.nowVal.toLocaleString()}원, 등락률 ${e.changeRate}%, 3개월수익률 ${e.threeMonthEarnRate}%, 시총 ${Math.round(e.marketCap/100000000).toLocaleString()}억`
      ).join("\n");

      const prompt = `당신은 ETF 투자 전문가입니다. 아래 조건에 맞는 ETF를 추천해주세요.

투자 목적: ${purpose || "수익률 극대화"}
위험 성향: ${riskLevel || "중간"}
관심 키워드: ${keywords || "전체"}

현재 시장에서 관련 ETF 목록:
${etfListStr}

위 데이터를 기반으로:
1. TOP 3~5개 ETF를 추천하고 각각 추천 이유를 설명
2. 각 ETF의 장점과 리스크를 간단히 분석
3. 포트폴리오 배분 비율 제안
4. 투자 시 주의사항

전문적이면서도 이해하기 쉽게 답변해주세요.`;

      const analysis = await callAI(prompt, userKey);
      res.json({ recommendation: analysis });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "ETF 추천 실패" });
    }
  });

  // ========== 관심(Core) ETF 관리 ==========

  // 관심 ETF 목록 조회 (모든 로그인 유저)
  app.get("/api/watchlist-etfs", requireUser, async (req, res) => {
    try {
      const etfs = await storage.getWatchlistEtfs();
      res.json(etfs);
    } catch (error: any) {
      console.error("Failed to get watchlist ETFs:", error);
      res.status(500).json({ message: error.message || "관심 ETF 조회 실패" });
    }
  });

  // 관심 ETF 추가 (Admin 전용)
  app.post("/api/watchlist-etfs", requireAdmin, async (req, res) => {
    try {
      const { etfCode, etfName, sector, memo } = req.body;
      if (!etfCode || !etfName) {
        return res.status(400).json({ message: "ETF 코드와 이름은 필수입니다." });
      }
      const etf = await storage.createWatchlistEtf({ etfCode, etfName, sector: sector || "기본", memo: memo || null });
      console.log(`[Watchlist] Added: ${etf.etfName} (${etf.etfCode}) - sector: ${etf.sector}`);
      res.json(etf);
    } catch (error: any) {
      console.error("Failed to add watchlist ETF:", error);
      res.status(500).json({ message: error.message || "관심 ETF 추가 실패" });
    }
  });

  // 관심 ETF 수정 (Admin 전용)
  app.put("/api/watchlist-etfs/:id", requireAdmin, async (req, res) => {
    try {
      const etf = await storage.updateWatchlistEtf(Number(req.params.id), req.body);
      res.json(etf);
    } catch (error: any) {
      console.error("Failed to update watchlist ETF:", error);
      res.status(500).json({ message: error.message || "관심 ETF 수정 실패" });
    }
  });

  // 관심 ETF 삭제 (Admin 전용)
  app.delete("/api/watchlist-etfs/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteWatchlistEtf(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete watchlist ETF:", error);
      res.status(500).json({ message: error.message || "관심 ETF 삭제 실패" });
    }
  });

  // 관심 ETF 실시간 시세 정보 조회 (시가총액, 현재가, 등락률 + 상장일, 총보수)
  app.get("/api/watchlist-etfs/market-data", requireUser, async (req, res) => {
    try {
      const watchlist = await storage.getWatchlistEtfs();
      if (watchlist.length === 0) return res.json({});

      // 1) 네이버 ETF 전체 리스트에서 시가총액, 현재가, 등락률 가져오기
      const allEtfs = await getEtfFullList();
      const etfMap = new Map<string, EtfListItem>();
      allEtfs.forEach((e) => etfMap.set(e.code, e));

      // 2) m.stock.naver.com API에서 상장일/총보수/배당수익률 가져오기 (병렬)
      const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
      const extraDataMap = new Map<string, { listingDate: string; expense: string; dividendYield: number | null }>();

      const batchSize = 10;
      for (let i = 0; i < watchlist.length; i += batchSize) {
        const batch = watchlist.slice(i, i + batchSize);
        await Promise.all(batch.map(async (w) => {
          let listingDate = "", expense = "";
          let dividendYield: number | null = null;

          // a) etfKeyIndicator 에서 배당수익률, 총보수 가져오기
          try {
            const intRes = await axios.get(
              `https://m.stock.naver.com/api/stock/${w.etfCode}/integration`,
              { headers: { "User-Agent": UA }, timeout: 8000 }
            );
            const eki = intRes.data?.etfKeyIndicator;
            if (eki) {
              if (eki.dividendYieldTtm != null) dividendYield = eki.dividendYieldTtm;
              if (eki.totalFee != null) expense = `${eki.totalFee}%`;
            }
          } catch {}

          // b) WiseReport에서 상장일 가져오기
          try {
            const wrRes = await axios.get(
              "https://navercomp.wisereport.co.kr/v2/ETF/Index.aspx",
              { params: { cn: "", cmp_cd: w.etfCode, menuType: "block" }, headers: { "User-Agent": UA }, timeout: 8000 }
            );
            const html = typeof wrRes.data === "string" ? wrRes.data : "";

            const summaryMatch = html.match(/var\s+summary_data\s*=\s*(\{[\s\S]*?\});/);
            if (summaryMatch) {
              try {
                const sd = JSON.parse(summaryMatch[1].replace(/'/g, '"'));
                if (sd.LIST_DT) listingDate = sd.LIST_DT;
                if (!expense && sd.TOT_REPORT) expense = sd.TOT_REPORT;
              } catch {}
            }

            const productMatch = html.match(/var\s+product_summary_data\s*=\s*(\{[\s\S]*?\});/);
            if (productMatch) {
              try {
                const pd = JSON.parse(productMatch[1].replace(/'/g, '"'));
                if (!listingDate && pd.LIST_DT) listingDate = pd.LIST_DT;
                if (!expense && pd.TOT_REPORT) expense = pd.TOT_REPORT;
              } catch {}
            }
          } catch {}

          extraDataMap.set(w.etfCode, { listingDate, expense, dividendYield });
        }));
      }

      // 3) 결과 조합
      const result: Record<string, any> = {};
      watchlist.forEach((w) => {
        const naver = etfMap.get(w.etfCode);
        const extra = extraDataMap.get(w.etfCode);
        result[w.etfCode] = {
          currentPrice: naver ? naver.nowVal : 0,
          changeVal: naver ? naver.changeVal : 0,
          changeRate: naver ? naver.changeRate : 0,
          marketCap: naver ? naver.marketCap : 0,
          nav: naver ? naver.nav : 0,
          listingDate: extra?.listingDate || "",
          expense: extra?.expense || "",
          dividendYield: extra?.dividendYield ?? null,
        };
      });

      res.json(result);
    } catch (error: any) {
      console.error("Failed to get watchlist market data:", error);
      res.status(500).json({ message: error.message || "관심 ETF 시세 조회 실패" });
    }
  });

  // ========== 관심(Satellite) 관리 ==========

  // Satellite ETF 목록 조회 (공통 + 개인)
  app.get("/api/satellite-etfs", requireUser, async (req, res) => {
    try {
      const { listType } = req.query;
      const userId = (req as any).session?.userId;
      if (listType === "common") {
        const etfs = await storage.getSatelliteEtfs("common");
        return res.json(etfs);
      } else if (listType === "personal") {
        if (!userId) return res.json([]);
        const etfs = await storage.getSatelliteEtfs("personal", userId);
        return res.json(etfs);
      }
      // 기본: 모든 ETF 반환 (하위 호환)
      const etfs = await storage.getSatelliteEtfs();
      res.json(etfs);
    } catch (error: any) {
      console.error("Failed to get satellite ETFs:", error);
      res.status(500).json({ message: error.message || "Satellite ETF 조회 실패" });
    }
  });

  // Satellite ETF 공통관심 추가 (Admin 전용)
  app.post("/api/satellite-etfs/common", requireAdmin, async (req, res) => {
    try {
      const { etfCode, etfName, sector, memo } = req.body;
      if (!etfCode || !etfName) {
        return res.status(400).json({ message: "ETF 코드와 이름은 필수입니다." });
      }
      const etf = await storage.createSatelliteEtf({ etfCode, etfName, sector: sector || "기본", memo: memo || null, listType: "common", userId: null });
      console.log(`[Satellite/Common] Added: ${etf.etfName} (${etf.etfCode}) - sector: ${etf.sector}`);
      res.json(etf);
    } catch (error: any) {
      console.error("Failed to add common satellite ETF:", error);
      res.status(500).json({ message: error.message || "공통관심 Satellite ETF 추가 실패" });
    }
  });

  // Satellite ETF 개인관심 추가 (로그인 사용자)
  app.post("/api/satellite-etfs/personal", requireUser, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) return res.status(401).json({ message: "로그인이 필요합니다." });
      const { etfCode, etfName, sector, memo } = req.body;
      if (!etfCode || !etfName) {
        return res.status(400).json({ message: "ETF 코드와 이름은 필수입니다." });
      }
      const etf = await storage.createSatelliteEtf({ etfCode, etfName, sector: sector || "기본", memo: memo || null, listType: "personal", userId });
      console.log(`[Satellite/Personal] Added: ${etf.etfName} (${etf.etfCode}) for user ${userId}`);
      res.json(etf);
    } catch (error: any) {
      console.error("Failed to add personal satellite ETF:", error);
      res.status(500).json({ message: error.message || "개인관심 Satellite ETF 추가 실패" });
    }
  });

  // Satellite ETF 추가 (하위호환 - Admin 전용 → common으로 등록)
  app.post("/api/satellite-etfs", requireAdmin, async (req, res) => {
    try {
      const { etfCode, etfName, sector, memo } = req.body;
      if (!etfCode || !etfName) {
        return res.status(400).json({ message: "ETF 코드와 이름은 필수입니다." });
      }
      const etf = await storage.createSatelliteEtf({ etfCode, etfName, sector: sector || "기본", memo: memo || null, listType: "common", userId: null });
      console.log(`[Satellite] Added: ${etf.etfName} (${etf.etfCode}) - sector: ${etf.sector}`);
      res.json(etf);
    } catch (error: any) {
      console.error("Failed to add satellite ETF:", error);
      res.status(500).json({ message: error.message || "Satellite ETF 추가 실패" });
    }
  });

  // Satellite ETF 수정
  app.put("/api/satellite-etfs/:id", requireUser, async (req, res) => {
    try {
      const etf = await storage.updateSatelliteEtf(Number(req.params.id), req.body);
      res.json(etf);
    } catch (error: any) {
      console.error("Failed to update satellite ETF:", error);
      res.status(500).json({ message: error.message || "Satellite ETF 수정 실패" });
    }
  });

  // Satellite ETF 삭제
  app.delete("/api/satellite-etfs/:id", requireUser, async (req, res) => {
    try {
      await storage.deleteSatelliteEtf(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete satellite ETF:", error);
      res.status(500).json({ message: error.message || "Satellite ETF 삭제 실패" });
    }
  });

  // Satellite ETF 실시간 시세 정보 조회 (공통 + 개인 합산)
  app.get("/api/satellite-etfs/market-data", requireUser, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const commonList = await storage.getSatelliteEtfs("common");
      const personalList = userId ? await storage.getSatelliteEtfs("personal", userId) : [];
      const satList = [...commonList, ...personalList];
      if (satList.length === 0) return res.json({});

      const allEtfs = await getEtfFullList();
      const etfMap = new Map<string, EtfListItem>();
      allEtfs.forEach((e) => etfMap.set(e.code, e));

      const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
      const wiseDataMap = new Map<string, { listingDate: string; expense: string }>();

      const batchSize = 10;
      for (let i = 0; i < satList.length; i += batchSize) {
        const batch = satList.slice(i, i + batchSize);
        await Promise.all(batch.map(async (w) => {
          try {
            const wrRes = await axios.get(
              "https://navercomp.wisereport.co.kr/v2/ETF/Index.aspx",
              { params: { cn: "", cmp_cd: w.etfCode, menuType: "block" }, headers: { "User-Agent": UA }, timeout: 8000 }
            );
            const html = typeof wrRes.data === "string" ? wrRes.data : "";
            let listingDate = "", expense = "";

            const summaryMatch = html.match(/var\s+summary_data\s*=\s*(\{[\s\S]*?\});/);
            if (summaryMatch) {
              try {
                const sd = JSON.parse(summaryMatch[1].replace(/'/g, '"'));
                if (sd.LIST_DT) listingDate = sd.LIST_DT;
                if (sd.TOT_REPORT) expense = sd.TOT_REPORT;
              } catch {}
            }

            const productMatch = html.match(/var\s+product_summary_data\s*=\s*(\{[\s\S]*?\});/);
            if (productMatch) {
              try {
                const pd = JSON.parse(productMatch[1].replace(/'/g, '"'));
                if (!listingDate && pd.LIST_DT) listingDate = pd.LIST_DT;
                if (!expense && pd.TOT_REPORT) expense = pd.TOT_REPORT;
              } catch {}
            }

            wiseDataMap.set(w.etfCode, { listingDate, expense });
          } catch {
            wiseDataMap.set(w.etfCode, { listingDate: "", expense: "" });
          }
        }));
      }

      const result: Record<string, any> = {};
      satList.forEach((w) => {
        const naver = etfMap.get(w.etfCode);
        const wise = wiseDataMap.get(w.etfCode);
        result[w.etfCode] = {
          currentPrice: naver ? naver.nowVal : 0,
          changeVal: naver ? naver.changeVal : 0,
          changeRate: naver ? naver.changeRate : 0,
          marketCap: naver ? naver.marketCap : 0,
          nav: naver ? naver.nav : 0,
          listingDate: wise?.listingDate || "",
          expense: wise?.expense || "",
        };
      });

      res.json(result);
    } catch (error: any) {
      console.error("Failed to get satellite market data:", error);
      res.status(500).json({ message: error.message || "Satellite ETF 시세 조회 실패" });
    }
  });

  // ========== 공지사항 ==========

  // 활성 공지 목록 (누구나 조회 가능)
  app.get("/api/notices", async (_req, res) => {
    try {
      const items = await storage.getActiveNotices();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "공지사항 조회 실패" });
    }
  });

  // 전체 공지 목록 (관리자 전용 - 비활성 포함)
  app.get("/api/notices/all", requireAdmin, async (_req, res) => {
    try {
      const items = await storage.getNotices();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "공지사항 조회 실패" });
    }
  });

  // 공지 추가 (관리자 전용)
  app.post("/api/notices", requireAdmin, async (req, res) => {
    try {
      const { content, sortOrder, isActive } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "공지 내용을 입력해주세요" });
      const notice = await storage.createNotice({ content: content.trim(), sortOrder: sortOrder || 0, isActive: isActive !== false });
      res.json(notice);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "공지 추가 실패" });
    }
  });

  // 공지 수정 (관리자 전용)
  app.put("/api/notices/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { content, sortOrder, isActive } = req.body;
      const updates: any = {};
      if (content !== undefined) updates.content = content.trim();
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;
      if (isActive !== undefined) updates.isActive = isActive;
      const notice = await storage.updateNotice(id, updates);
      res.json(notice);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "공지 수정 실패" });
    }
  });

  // 공지 삭제 (관리자 전용)
  app.delete("/api/notices/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteNotice(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "공지 삭제 실패" });
    }
  });

  // ========== 스팀 포스팅 ==========

  // 스팀 포스팅 이력 조회
  app.get("/api/steem-posts", requireAdmin, async (_req, res) => {
    try {
      const posts = await storage.getSteemPosts(50);
      res.json(posts);
    } catch (error: any) {
      console.error("[Steem] Failed to get posts:", error.message);
      res.status(500).json({ message: "스팀 포스팅 이력 조회 실패" });
    }
  });

  // 스팀 포스팅 단건 조회
  app.get("/api/steem-posts/:id", requireAdmin, async (req, res) => {
    try {
      const post = await storage.getSteemPost(parseInt(req.params.id));
      if (!post) return res.status(404).json({ message: "포스팅을 찾을 수 없습니다" });
      res.json(post);
    } catch (error: any) {
      console.error("[Steem] Failed to get post:", error.message);
      res.status(500).json({ message: "스팀 포스팅 조회 실패" });
    }
  });

  // 스팀 포스팅 저장 (draft 또는 published)
  app.post("/api/steem-posts", requireAdmin, async (req, res) => {
    try {
      const { author, permlink, title, body, tags, category, status, steemUrl, txId } = req.body;
      if (!author || !title || !body) {
        return res.status(400).json({ message: "author, title, body는 필수입니다" });
      }
      const newPost = await storage.createSteemPost({
        author,
        permlink: permlink || "",
        title,
        body,
        tags: typeof tags === "string" ? tags : JSON.stringify(tags || []),
        category: category || "kr",
        status: status || "draft",
        steemUrl: steemUrl || null,
        txId: txId || null,
        errorMessage: null,
      });
      res.status(201).json(newPost);
    } catch (error: any) {
      console.error("[Steem] Failed to create post:", error.message);
      res.status(500).json({ message: "스팀 포스팅 저장 실패" });
    }
  });

  // 스팀 포스팅 수정
  app.put("/api/steem-posts/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      if (updates.tags && typeof updates.tags !== "string") {
        updates.tags = JSON.stringify(updates.tags);
      }
      const updated = await storage.updateSteemPost(id, updates);
      if (!updated) return res.status(404).json({ message: "포스팅을 찾을 수 없습니다" });
      res.json(updated);
    } catch (error: any) {
      console.error("[Steem] Failed to update post:", error.message);
      res.status(500).json({ message: "스팀 포스팅 수정 실패" });
    }
  });

  // 스팀 포스팅 삭제
  app.delete("/api/steem-posts/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSteemPost(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Steem] Failed to delete post:", error.message);
      res.status(500).json({ message: "스팀 포스팅 삭제 실패" });
    }
  });

  // ========== 신규ETF 관리 (저장된 ETF) ==========

  // 저장된 ETF 목록 조회
  app.get("/api/saved-etfs", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId || undefined;
      const etfs = await storage.getSavedEtfs(userId);
      res.json(etfs);
    } catch (error: any) {
      console.error("Failed to get saved ETFs:", error);
      res.status(500).json({ message: error.message || "저장된 ETF 조회 실패" });
    }
  });

  // 저장된 ETF 상세 조회
  app.get("/api/saved-etfs/:id", requireUser, async (req, res) => {
    try {
      const etf = await storage.getSavedEtf(Number(req.params.id));
      if (!etf) return res.status(404).json({ message: "ETF를 찾을 수 없습니다" });
      res.json(etf);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "ETF 조회 실패" });
    }
  });

  // ETF 신규 등록 (Admin 전용)
  app.post("/api/saved-etfs", requireAdmin, async (req, res) => {
    try {
      const userId = req.session?.userId || null;
      const etf = await storage.createSavedEtf({ ...req.body, userId });
      console.log(`[SavedETF] Created: ${etf.etfName} (${etf.etfCode})`);
      res.status(201).json(etf);
    } catch (error: any) {
      console.error("Failed to create saved ETF:", error);
      res.status(500).json({ message: error.message || "ETF 등록 실패" });
    }
  });

  // ETF 수정 (Admin 전용)
  app.put("/api/saved-etfs/:id", requireAdmin, async (req, res) => {
    try {
      const etf = await storage.updateSavedEtf(Number(req.params.id), req.body);
      console.log(`[SavedETF] Updated: ${etf.etfName} (${etf.etfCode})`);
      res.json(etf);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "ETF 수정 실패" });
    }
  });

  // ETF 삭제 (Admin 전용)
  app.delete("/api/saved-etfs/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteSavedEtf(Number(req.params.id));
      console.log(`[SavedETF] Deleted: id=${req.params.id}`);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message || "ETF 삭제 실패" });
    }
  });

  // ETF 상세 정보 수집 (네이버 + WiseReport에서 개요 정보 추출)
  app.get("/api/etf/detail-info/:code", async (req, res) => {
    try {
      const etfCode = req.params.code;
      if (!etfCode || !/^[0-9A-Za-z]{6}$/.test(etfCode)) {
        return res.status(400).json({ message: "유효한 6자리 ETF 코드를 입력해주세요." });
      }

      const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      let etfName = "", category = "", assetManager = "", listingDate = "";
      let totalAsset = "", expense = "", benchmark = "";
      let recentPrice = "", recentChange = "";

      // 1. 네이버 금융에서 기본 시세 정보 + 2. WiseReport 개요 정보 (병렬 요청)
      const [, , componentResult] = await Promise.all([
        // 1-a. 네이버 시세
        (async () => {
          try {
            const naverRes = await axios.get(
              `https://polling.finance.naver.com/api/realtime/domestic/stock/${etfCode}`,
              { headers: { "User-Agent": UA }, timeout: 8000 }
            );
            const datas = naverRes.data?.datas;
            if (datas && datas.length > 0) {
              const d = datas[0];
              etfName = d.stockName || "";
              recentPrice = d.closePrice?.toString().replace(/,/g, "") || "";
              recentChange = d.fluctuationsRatio || "";
            }
          } catch (err: any) {
            console.log(`[ETF Detail] Naver price failed: ${err.message}`);
          }
        })(),
        // 1-b. WiseReport 개요
        (async () => {
          try {
            const wrRes = await axios.get(
              `https://navercomp.wisereport.co.kr/v2/ETF/Index.aspx`,
              { params: { cn: "", cmp_cd: etfCode, menuType: "block" }, headers: { "User-Agent": UA }, timeout: 15000 }
            );
            const html = typeof wrRes.data === "string" ? wrRes.data : "";

            // summary_data에서 개요 추출
            const summaryMatch = html.match(/var\s+summary_data\s*=\s*(\{[^}]+\});/);
            if (summaryMatch) {
              try {
                const summary = JSON.parse(summaryMatch[1]);
                if (!etfName) etfName = summary.CMP_KOR || "";
                assetManager = summary.ISSUE_NM_KOR || "";
                category = summary.ETF_TYP_SVC_NM || "";
                expense = summary.TOT_PAY ? summary.TOT_PAY + "%" : "";
                benchmark = summary.BASE_IDX_NM_KOR || "";
              } catch { /* ignore */ }
            }

            // product_summary_data에서 상장일 등 추가 정보 추출
            const productMatch = html.match(/var\s+product_summary_data\s*=\s*(\{[^}]+\});/);
            if (productMatch) {
              try {
                const product = JSON.parse(productMatch[1]);
                if (!listingDate) listingDate = product.LIST_DT || product.FIRST_SETTLE_DT || "";
                if (!assetManager) assetManager = product.ISSUE_NM_KOR || "";
                if (!benchmark) benchmark = product.BASE_IDX_NM_KOR || "";
              } catch { /* ignore */ }
            }

            // status_data에서 시가총액 추출
            const statusMatch = html.match(/var\s+status_data\s*=\s*(\{[^}]+\});/);
            if (statusMatch) {
              try {
                const status = JSON.parse(statusMatch[1]);
                if (!totalAsset && status.MKT_VAL) totalAsset = status.MKT_VAL + "억원";
              } catch { /* ignore */ }
            }

            // HTML 파싱으로 추가 정보 추출
            const $ = cheerio.load(html);
            if (!totalAsset) {
              $("th:contains('순자산')").each((_, el) => {
                const val = $(el).next("td").text().trim();
                if (val) totalAsset = val;
              });
            }
            if (!expense) {
              $("th:contains('보수')").each((_, el) => {
                const val = $(el).next("td").text().trim();
                if (val) expense = val;
              });
            }
          } catch (err: any) {
            console.log(`[ETF Detail] WiseReport overview failed: ${err.message}`);
          }

          // Naver ETF 상세 페이지에서 추가 정보
          try {
            const naverDetailRes = await axios.get(
              `https://finance.naver.com/item/main.naver?code=${etfCode}`,
              { headers: { "User-Agent": UA }, timeout: 8000 }
            );
            const $ = cheerio.load(naverDetailRes.data);
            if (!assetManager) {
              $(".table_kwd_info th:contains('운용')").each((_, el) => {
                const val = $(el).next("td").text().trim();
                if (val) assetManager = val;
              });
            }
            if (!totalAsset) {
              $(".table_kwd_info th:contains('순자산')").each((_, el) => {
                const val = $(el).next("td").text().trim();
                if (val) totalAsset = val;
              });
            }
            if (!benchmark) {
              $(".table_kwd_info th:contains('기초지수'), .table_kwd_info th:contains('추적지수')").each((_, el) => {
                const val = $(el).next("td").text().trim();
                if (val) benchmark = val;
              });
            }
          } catch { /* ignore */ }
        })(),
        // 2. getEtfComponents로 포트폴리오 구성 + 실시간 시세 (ETF실시간과 동일 로직)
        (async () => {
          try {
            return await kisApi.getEtfComponents(etfCode);
          } catch (err: any) {
            console.log(`[ETF Detail] getEtfComponents failed: ${err.message}`);
            return null;
          }
        })(),
      ]);

      // 포트폴리오 데이터를 EtfComponentStock 형태로 변환
      const portfolioData = componentResult?.components?.map(c => ({
        stockCode: c.stockCode || "",
        name: c.stockName,
        weight: c.weight,
        quantity: c.quantity || 0,
        price: c.price || "",
        change: c.change || "",
        changePercent: c.changePercent || "",
        changeSign: c.changeSign || "",
        volume: c.volume || "",
      })) || [];

      // getEtfComponents에서 ETF 이름을 가져온 경우 보완
      if (!etfName && componentResult?.etfName) {
        etfName = componentResult.etfName;
      }

      res.json({
        etfCode,
        etfName: etfName || `ETF ${etfCode}`,
        category,
        assetManager,
        listingDate,
        totalAsset,
        expense,
        benchmark,
        recentPrice,
        recentChange,
        portfolioData,
      });
    } catch (error: any) {
      console.error("Failed to get ETF detail info:", error);
      res.status(500).json({ message: error.message || "ETF 상세 정보 조회 실패" });
    }
  });

  // ========== AI 보고서 분석 (URL + 파일 첨부 지원) ==========
  const multer = (await import("multer")).default;
  const uploadStorage = multer.memoryStorage();
  const upload = multer({ storage: uploadStorage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB 제한

  app.post("/api/report/ai-analyze", requireUser, upload.array("files", 5), async (req, res) => {
    try {
      const { prompt, urls } = req.body;
      const files = (req as any).files as Express.Multer.File[] || [];
      const parsedUrls: string[] = urls ? (typeof urls === "string" ? JSON.parse(urls) : urls) : [];

      if (!prompt?.trim()) {
        return res.status(400).json({ message: "프롬프트를 입력해주세요." });
      }

      // 1) URL 내용 크롤링
      const urlContents: string[] = [];
      for (const url of parsedUrls) {
        if (!url.trim()) continue;
        try {
          console.log(`[AI Report] Fetching URL: ${url}`);
          const urlRes = await axios.get(url.trim(), {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
            timeout: 10000,
            responseType: "text",
          });
          const $ = cheerio.load(urlRes.data);
          // 불필요한 태그 제거
          $("script, style, nav, footer, header, .ad, .advertisement, iframe, noscript").remove();
          // 핵심 텍스트 추출
          const bodyText = $("article, main, .content, .article-body, #content, body")
            .first()
            .text()
            .replace(/\s+/g, " ")
            .trim();
          const truncated = bodyText.substring(0, 5000); // URL당 최대 5000자
          if (truncated) {
            urlContents.push(`\n--- [URL: ${url}] ---\n${truncated}\n`);
            console.log(`[AI Report] URL fetched: ${url} (${truncated.length} chars)`);
          }
        } catch (err: any) {
          console.warn(`[AI Report] Failed to fetch URL ${url}: ${err.message}`);
          urlContents.push(`\n--- [URL: ${url}] ---\n(불러오기 실패: ${err.message})\n`);
        }
      }

      // 2) 첨부 파일 내용 읽기
      const fileContents: string[] = [];
      for (const file of files) {
        try {
          let content = "";
          const ext = file.originalname.split(".").pop()?.toLowerCase();
          
          if (["txt", "csv", "json", "md", "log"].includes(ext || "")) {
            content = file.buffer.toString("utf-8");
          } else if (ext === "html" || ext === "htm") {
            const $ = cheerio.load(file.buffer.toString("utf-8"));
            $("script, style").remove();
            content = $.text().replace(/\s+/g, " ").trim();
          } else {
            // 바이너리 파일은 이름만 기록
            content = `(바이너리 파일 - 텍스트 추출 불가: ${file.originalname}, ${file.size} bytes)`;
          }
          
          const truncated = content.substring(0, 5000); // 파일당 최대 5000자
          fileContents.push(`\n--- [파일: ${file.originalname} (${(file.size / 1024).toFixed(1)}KB)] ---\n${truncated}\n`);
          console.log(`[AI Report] File processed: ${file.originalname} (${truncated.length} chars)`);
        } catch (err: any) {
          console.warn(`[AI Report] Failed to process file ${file.originalname}: ${err.message}`);
          fileContents.push(`\n--- [파일: ${file.originalname}] ---\n(처리 실패: ${err.message})\n`);
        }
      }

      // 3) 시장 데이터 수집 (주식 + 채권 + 환율 + 크립토 + 원자재)
      const [indices, volumeRanking, news, bondsRaw, forexRaw, cryptoRaw, commoditiesRaw] = await Promise.all([
        kisApi.getMarketIndices().catch(() => []),
        kisApi.getVolumeRanking().catch(() => []),
        (async () => {
          try {
            const newsRes = await axios.get("https://finance.naver.com/news/mainnews.naver", {
              headers: { "User-Agent": "Mozilla/5.0" }, timeout: 5000,
            });
            const $ = cheerio.load(newsRes.data);
            const items: string[] = [];
            $(".mainNewsList li, .news_list li").each((i, el) => {
              if (i >= 10) return false;
              const title = $(el).find("a").first().text().trim();
              if (title) items.push(title);
            });
            return items;
          } catch { return []; }
        })(),
        // === 채권/금리 ===
        (async () => {
          try {
            const bonds: any[] = [];
            // 국제 금리 (Yahoo Finance)
            const ySymbols = [
              { symbol: "^TNX", name: "미국 국채 10년" },
              { symbol: "^FVX", name: "미국 국채 5년" },
              { symbol: "^TYX", name: "미국 국채 30년" },
              { symbol: "^IRX", name: "미국 T-Bill 13주" },
            ];
            for (const s of ySymbols) {
              try {
                const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${s.symbol}`, {
                  params: { range: "5d", interval: "1d" }, headers: { "User-Agent": UA }, timeout: 8000,
                });
                const meta = r.data?.chart?.result?.[0]?.meta;
                const closes = r.data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
                const last = meta?.regularMarketPrice || closes[closes.length - 1] || 0;
                const prev = closes.length >= 2 ? closes[closes.length - 2] : last;
                bonds.push({ name: s.name, value: last, change: +(last - prev).toFixed(3), changeRate: prev ? +((last - prev) / prev * 100).toFixed(2) : 0 });
              } catch {}
            }
            return bonds;
          } catch { return []; }
        })(),
        // === 환율 ===
        (async () => {
          try {
            const iconv = await import("iconv-lite");
            const fxRes = await axios.get("https://finance.naver.com/marketindex/", {
              headers: { "User-Agent": UA }, timeout: 5000, responseType: "arraybuffer",
            });
            const fxHtml = iconv.default.decode(Buffer.from(fxRes.data), "euc-kr");
            const $fx = cheerio.load(fxHtml);
            const rates: any[] = [];
            $fx(".market_data .data_lst li").each((_i, el) => {
              const name = $fx(el).find("h3 .blind").first().text().trim();
              if (!name || name.includes("금") || name.includes("WTI") || name.includes("휘발유")) return;
              const value = parseFloat($fx(el).find(".value").text().replace(/,/g, "")) || 0;
              const change = parseFloat($fx(el).find(".change").text().replace(/,/g, "")) || 0;
              const isDown = $fx(el).find(".down, .fall").length > 0;
              if (value > 0) rates.push({ name, value, change: isDown ? -change : change });
            });
            return rates;
          } catch { return []; }
        })(),
        // === 크립토 ===
        (async () => {
          try {
            const cgRes = await axios.get("https://api.coingecko.com/api/v3/coins/markets", {
              params: { vs_currency: "usd", order: "market_cap_desc", per_page: 10, page: 1, sparkline: false },
              headers: { "User-Agent": UA }, timeout: 10000,
            });
            // 업비트 김치프리미엄 조회
            let upbitPrices: Record<string, number> = {};
            let usdKrw = 1440;
            try {
              const iconv = await import("iconv-lite");
              const fxRes = await axios.get("https://finance.naver.com/marketindex/", {
                headers: { "User-Agent": UA }, timeout: 5000, responseType: "arraybuffer",
              });
              const fxHtml = iconv.default.decode(Buffer.from(fxRes.data), "euc-kr");
              const $fx = cheerio.load(fxHtml);
              $fx(".market_data .data_lst li").each((_i, el) => {
                const nm = $fx(el).find("h3 .blind").first().text().trim();
                if (nm.includes("미국") || nm.includes("USD")) {
                  const val = parseFloat($fx(el).find(".value").text().replace(/,/g, "")) || 0;
                  if (val > 0) usdKrw = val;
                }
              });
            } catch {}
            try {
              const upbitRes = await axios.get("https://api.upbit.com/v1/ticker", {
                params: { markets: "KRW-BTC,KRW-ETH,KRW-XRP,KRW-USDT,KRW-USDC" },
                timeout: 5000,
              });
              for (const t of upbitRes.data) {
                const sym = t.market.replace("KRW-", "");
                upbitPrices[sym] = t.trade_price;
              }
            } catch {}
            return (cgRes.data || []).map((c: any) => {
              const sym = c.symbol?.toUpperCase();
              const globalKrw = c.current_price * usdKrw;
              const kimchi = upbitPrices[sym] && globalKrw > 0 ? ((upbitPrices[sym] - globalKrw) / globalKrw * 100) : null;
              return {
                symbol: sym, name: c.name,
                priceUsd: c.current_price,
                change24h: c.price_change_percentage_24h,
                change7d: c.price_change_percentage_7d_in_currency,
                kimchiPremium: kimchi ? +kimchi.toFixed(2) : null,
              };
            });
          } catch { return []; }
        })(),
        // === 원자재 ===
        (async () => {
          try {
            const ySymbols = [
              { symbol: "GC=F", name: "금(Gold)" },
              { symbol: "SI=F", name: "은(Silver)" },
              { symbol: "CL=F", name: "WTI 원유" },
              { symbol: "NG=F", name: "천연가스" },
              { symbol: "HG=F", name: "구리" },
            ];
            const items: any[] = [];
            for (const s of ySymbols) {
              try {
                const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${s.symbol}`, {
                  params: { range: "5d", interval: "1d" }, headers: { "User-Agent": UA }, timeout: 8000,
                });
                const meta = r.data?.chart?.result?.[0]?.meta;
                const closes = r.data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
                const last = meta?.regularMarketPrice || closes[closes.length - 1] || 0;
                const prev = closes.length >= 2 ? closes[closes.length - 2] : last;
                items.push({
                  name: s.name, value: last,
                  change: +(last - prev).toFixed(2),
                  changeRate: prev ? +((last - prev) / prev * 100).toFixed(2) : 0,
                  currency: meta?.currency || "USD",
                });
              } catch {}
            }
            return items;
          } catch { return []; }
        })(),
      ]);

      const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
      const marketContext = indices.length > 0
        ? indices.map((idx: any) => `${idx.name}: ${parseFloat(idx.price).toLocaleString()} (${["1","2"].includes(idx.changeSign) ? "+" : idx.changeSign === "3" ? "" : "-"}${Math.abs(parseFloat(idx.changePercent)).toFixed(2)}%)`).join(", ")
        : "시장 데이터 미수집";
      
      const volumeContext = volumeRanking.length > 0
        ? volumeRanking.slice(0, 5).map((v: any, i: number) => `${i+1}. ${v.stockName}(${v.stockCode}) ${parseInt(v.price).toLocaleString()}원 ${["1","2"].includes(v.changeSign) ? "+" : v.changeSign === "3" ? "" : "-"}${Math.abs(parseFloat(v.changePercent)).toFixed(2)}%`).join("\n")
        : "데이터 없음";

      const newsContext = news.length > 0
        ? news.map((n: string, i: number) => `${i+1}. ${n}`).join("\n")
        : "뉴스 없음";

      // ETC 마켓 컨텍스트 생성
      const bondsContext = (bondsRaw as any[]).length > 0
        ? (bondsRaw as any[]).map((b: any) => `${b.name}: ${b.value?.toFixed(3)}% (${b.change > 0 ? "+" : ""}${b.change}%p, ${b.changeRate > 0 ? "+" : ""}${b.changeRate}%)`).join(", ")
        : "데이터 없음";

      const forexContext = (forexRaw as any[]).length > 0
        ? (forexRaw as any[]).map((r: any) => `${r.name}: ${r.value?.toLocaleString()} (${r.change > 0 ? "+" : ""}${r.change})`).join(", ")
        : "데이터 없음";

      const cryptoContext = (cryptoRaw as any[]).length > 0
        ? (cryptoRaw as any[]).map((c: any) => `${c.symbol}: $${c.priceUsd?.toLocaleString()} (24h: ${c.change24h > 0 ? "+" : ""}${c.change24h?.toFixed(1)}%, 7d: ${c.change7d != null ? (c.change7d > 0 ? "+" : "") + c.change7d?.toFixed(1) + "%" : "N/A"}${c.kimchiPremium != null ? `, 김프: ${c.kimchiPremium > 0 ? "+" : ""}${c.kimchiPremium}%` : ""})`).join("\n")
        : "데이터 없음";

      const commoditiesContext = (commoditiesRaw as any[]).length > 0
        ? (commoditiesRaw as any[]).map((c: any) => `${c.name}: $${c.value?.toLocaleString()} (${c.changeRate > 0 ? "+" : ""}${c.changeRate}%)`).join(", ")
        : "데이터 없음";

      // 4) 최종 프롬프트 구성
      const systemRole = `당신은 글로벌 금융시장 전문 애널리스트입니다. 제공된 모든 데이터(주식 시장, 채권/금리, 환율, 크립토, 원자재, 첨부 URL, 첨부 파일)를 종합적으로 분석하여 상세한 한국어 보고서를 작성해주세요. 반드시 50줄 이상으로 작성하세요.`;

      let dataSection = `[자동 수집 데이터]\n📅 날짜: ${today}\n📊 주식 시장 현황: ${marketContext}\n\n🔥 거래량 상위 종목:\n${volumeContext}\n\n📰 주요 뉴스:\n${newsContext}\n\n🏛️ 채권/금리: ${bondsContext}\n\n💱 환율: ${forexContext}\n\n₿ 크립토 (TOP 10):\n${cryptoContext}\n\n🪙 원자재: ${commoditiesContext}`;

      if (urlContents.length > 0) {
        dataSection += `\n\n[참고 URL 내용]\n${urlContents.join("")}`;
      }
      if (fileContents.length > 0) {
        dataSection += `\n\n[첨부 파일 내용]\n${fileContents.join("")}`;
      }

      const finalPrompt = `${systemRole}\n\n${dataSection}\n\n[분석 요청]\n${prompt}`;

      console.log(`[AI Report] Final prompt length: ${finalPrompt.length} chars (${urlContents.length} URLs, ${fileContents.length} files)`);

      // 5) AI 호출
      const analysis = await callAI(finalPrompt);

      res.json({
        analysis,
        analyzedAt: new Date().toLocaleString("ko-KR"),
        dataPoints: {
          indicesCount: indices.length,
          volumeCount: volumeRanking.length,
          newsCount: news.length,
          urlCount: parsedUrls.length,
          fileCount: files.length,
          market: marketContext,
        },
      });
    } catch (error: any) {
      console.error("[AI Report] Failed:", error.message);
      res.status(500).json({ message: `AI 분석 실패: ${error.message}` });
    }
  });

  // ========== 전략 보고서 저장/조회 API (DB 기반, 모든 유저 공유) ==========

  // 전략 시장 보고서 조회 (모든 로그인 유저)
  app.get("/api/strategy-reports/:period", requireUser, async (req, res) => {
    try {
      const { period } = req.params;
      const reports = await storage.getStrategyReports(period, 10);
      const parsed = reports.map(r => ({
        id: r.id.toString(),
        title: r.title,
        periodLabel: r.periodLabel,
        createdAt: r.createdAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        report: JSON.parse(r.reportData),
      }));
      res.json({ reports: parsed });
    } catch (error: any) {
      console.error("[StrategyReports] GET error:", error.message);
      res.json({ reports: [] });
    }
  });

  // 전략 시장 보고서 저장 (admin 전용)
  app.post("/api/strategy-reports", requireAdmin, async (req, res) => {
    try {
      const { period, title, periodLabel, report } = req.body;
      if (!period || !report) {
        return res.status(400).json({ message: "period와 report가 필요합니다." });
      }
      const saved = await storage.createStrategyReport({
        period,
        title: title || `${periodLabel} 시장 전략 보고서`,
        periodLabel: periodLabel || period,
        reportData: JSON.stringify(report),
      });
      res.json({
        id: saved.id.toString(),
        title: saved.title,
        periodLabel: saved.periodLabel,
        createdAt: saved.createdAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        report: JSON.parse(saved.reportData),
      });
    } catch (error: any) {
      console.error("[StrategyReports] POST error:", error.message);
      res.status(500).json({ message: error.message || "보고서 저장 실패" });
    }
  });

  // 전략 시장 보고서 삭제 (admin 전용)
  app.delete("/api/strategy-reports/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteStrategyReport(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[StrategyReports] DELETE error:", error.message);
      res.status(500).json({ message: error.message || "보고서 삭제 실패" });
    }
  });

  // 전략 AI 분석 조회 (모든 로그인 유저)
  app.get("/api/strategy-analyses/:period", requireUser, async (req, res) => {
    try {
      const { period } = req.params;
      const analyses = await storage.getStrategyAnalyses(period, 10);
      const parsed = analyses.map(a => ({
        id: a.id.toString(),
        createdAt: a.createdAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        prompt: a.prompt,
        urls: JSON.parse(a.urls),
        fileNames: JSON.parse(a.fileNames),
        source: a.source || "strategy",
        result: JSON.parse(a.analysisResult),
      }));
      res.json({ analyses: parsed });
    } catch (error: any) {
      console.error("[StrategyAnalyses] GET error:", error.message);
      res.json({ analyses: [] });
    }
  });

  // 전략 AI 분석 저장 (admin 전용)
  app.post("/api/strategy-analyses", requireAdmin, async (req, res) => {
    try {
      const { period, prompt, urls, fileNames, source, result } = req.body;
      if (!period || !result) {
        return res.status(400).json({ message: "period와 result가 필요합니다." });
      }
      const saved = await storage.createStrategyAnalysis({
        period,
        prompt: prompt || "",
        urls: JSON.stringify(urls || []),
        fileNames: JSON.stringify(fileNames || []),
        source: source || "strategy",
        analysisResult: JSON.stringify(result),
      });
      res.json({
        id: saved.id.toString(),
        createdAt: saved.createdAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        prompt: saved.prompt,
        urls: JSON.parse(saved.urls),
        fileNames: JSON.parse(saved.fileNames),
        source: saved.source,
        result: JSON.parse(saved.analysisResult),
      });
    } catch (error: any) {
      console.error("[StrategyAnalyses] POST error:", error.message);
      res.status(500).json({ message: error.message || "AI 분석 저장 실패" });
    }
  });

  // 전략 AI 분석 삭제 (admin 전용)
  app.delete("/api/strategy-analyses/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteStrategyAnalysis(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[StrategyAnalyses] DELETE error:", error.message);
      res.status(500).json({ message: error.message || "AI 분석 삭제 실패" });
    }
  });

  // ========== 시장 보고서 (일일/주간/월간/연간) ==========
  app.get("/api/report/:period", async (req, res) => {
    try {
      const period = req.params.period as string;
      const validPeriods = ["daily", "weekly", "monthly", "yearly"];
      if (!validPeriods.includes(period)) {
        return res.status(400).json({ message: "유효하지 않은 기간입니다. (daily, weekly, monthly, yearly)" });
      }

      const periodLabels: Record<string, string> = {
        daily: "일일",
        weekly: "주간",
        monthly: "월간",
        yearly: "연간",
      };

      // 병렬로 데이터 수집
      const [indices, volumeRanking, investorTrends, topEtfs, news] = await Promise.all([
        kisApi.getMarketIndices().catch(() => []),
        kisApi.getVolumeRanking().catch(() => []),
        kisApi.getInvestorTrends().catch(() => []),
        // ETF 추천 데이터 (Tracked ETFs 삭제로 빈 배열 반환)
        Promise.resolve([]),
        // 네이버 금융 뉴스 스크래핑
        (async () => {
          try {
            const newsRes = await axios.get("https://finance.naver.com/news/mainnews.naver", {
              headers: { "User-Agent": "Mozilla/5.0" },
              timeout: 5000,
            });
            const $ = cheerio.load(newsRes.data);
            const newsItems: { title: string; link: string; source: string; time: string }[] = [];
            $(".mainNewsList li, .news_list li").each((i, el) => {
              if (i >= 10) return false;
              const $el = $(el);
              const $a = $el.find("a").first();
              const title = $a.text().trim();
              let link = $a.attr("href") || "";
              if (link && !link.startsWith("http")) {
                link = "https://finance.naver.com" + link;
              }
              const source = $el.find(".press, .info_press").text().trim();
              const time = $el.find(".wdate, .date").text().trim();
              if (title) {
                newsItems.push({ title, link, source, time });
              }
            });
            return newsItems;
          } catch {
            return [];
          }
        })(),
      ]);

      // 보고서 생성 시간
      const now = new Date();
      const reportTime = now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

      // 기간별 날짜 범위 계산
      let periodRange = "";
      if (period === "daily") {
        periodRange = now.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "long" });
      } else if (period === "weekly") {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1); // 월요일
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 4); // 금요일
        periodRange = `${weekStart.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" })} ~ ${weekEnd.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" })}`;
      } else if (period === "monthly") {
        periodRange = now.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long" });
      } else if (period === "yearly") {
        periodRange = `${now.getFullYear()}년`;
      }

      // 시장 요약 텍스트 생성
      const kospi = indices.find((i: any) => i.code === "0001");
      const kosdaq = indices.find((i: any) => i.code === "1001");

      let marketSummary = "";
      if (kospi) {
        const sign = ["1", "2"].includes(kospi.changeSign) ? "▲" : kospi.changeSign === "3" ? "-" : "▼";
        marketSummary += `코스피 ${parseFloat(kospi.price).toFixed(2)} (${sign}${Math.abs(parseFloat(kospi.change)).toFixed(2)}, ${kospi.changePercent}%)`;
      }
      if (kosdaq) {
        const sign = ["1", "2"].includes(kosdaq.changeSign) ? "▲" : kosdaq.changeSign === "3" ? "-" : "▼";
        marketSummary += ` / 코스닥 ${parseFloat(kosdaq.price).toFixed(2)} (${sign}${Math.abs(parseFloat(kosdaq.change)).toFixed(2)}, ${kosdaq.changePercent}%)`;
      }

      res.json({
        period,
        periodLabel: periodLabels[period],
        periodRange,
        reportTime,
        marketSummary,
        indices,
        volumeRanking,
        investorTrends,
        topEtfs: (topEtfs as any[]).slice(0, 10).map((e: any) => ({
          id: e.id,
          name: e.name,
          code: e.code,
          mainCategory: e.mainCategory,
          trendScore: e.trendScore,
          yield: e.yield,
          fee: e.fee,
        })),
        news,
      });
    } catch (error: any) {
      console.error("Failed to generate report:", error);
      res.status(500).json({ message: error.message || "보고서 생성 실패" });
    }
  });

  // 404 핸들러는 registerRoutes 함수에서 제거
  // Vite/serveStatic 미들웨어가 먼저 처리한 후에 등록되어야 함
  // server/index.ts에서 별도로 처리됨

  // ========== 손절 감시 백그라운드 루프 (개선판) ==========
  // 개선 사항:
  //  1. 네이버 bulk API로 일괄 시세 조회 (1회 요청으로 전종목 확인, KIS rate limit 회피)
  //  2. 장중 10초 간격, 장외 시간 자동 비활성화
  //  3. 트레일링 스탑 최고가 실시간 업데이트
  //  4. 마지막 체크 시각/현재가 캐시 (프론트엔드에서 조회 가능)
  const STOP_LOSS_CHECK_INTERVAL_MARKET = 10 * 1000;   // 장중 10초
  const STOP_LOSS_CHECK_INTERVAL_IDLE = 60 * 1000;     // 장외 60초 (활성 주문 유무 확인용)
  let stopLossLoopRunning = false;
  // 마지막 체크 시각 & 현재가 캐시 (프론트엔드용)
  const stopLossLatestPrices = new Map<string, { price: number; changePercent: string; checkedAt: Date }>();
  let stopLossLastCheckedAt: Date | null = null;

  function isMarketOpen(): boolean {
    const now = new Date();
    const kstHour = (now.getUTCHours() + 9) % 24;
    const kstMinute = now.getUTCMinutes();
    const kstTime = kstHour * 100 + kstMinute;
    // 장 운영: 09:00 ~ 15:30 (15:30 정규장 종료)
    return kstTime >= 900 && kstTime <= 1530;
  }

  async function stopLossMonitorLoop() {
    if (stopLossLoopRunning) return;
    stopLossLoopRunning = true;

    try {
      const activeOrders = await storage.getActiveStopLossOrders();
      if (activeOrders.length === 0) return;

      // 장 시간 외에는 가격 확인 스킵
      if (!isMarketOpen()) return;

      // 1. 네이버 bulk API로 모든 종목의 현재가를 한번에 조회
      const stockCodes = Array.from(new Set(activeOrders.map(o => o.stockCode)));
      const priceMap = await kisApi.fetchNaverBulkPrices(stockCodes);

      if (priceMap.size === 0) {
        console.log("[StopLoss] Bulk price fetch returned 0 results, skipping cycle");
        return;
      }

      stopLossLastCheckedAt = new Date();
      // 가격 캐시 업데이트
      for (const [code, data] of Array.from(priceMap)) {
        stopLossLatestPrices.set(code, {
          price: Number(data.price),
          changePercent: data.changePercent,
          checkedAt: stopLossLastCheckedAt,
        });
      }

      let triggeredCount = 0;
      let trailingUpdated = 0;

      // 2. 각 감시 주문에 대해 조건 확인
      for (const sl of activeOrders) {
        const priceData = priceMap.get(sl.stockCode);
        if (!priceData) continue;

        const currentPrice = Number(priceData.price);
        if (currentPrice <= 0) continue;

        let currentStopPrice = Number(sl.stopPrice);

        // 트레일링 스탑: 최고가 갱신 시 손절가도 상향 조정
        if (sl.stopType === "trailing") {
          const prevHighest = Number(sl.highestPrice || sl.buyPrice);
          if (currentPrice > prevHighest) {
            const newStopPrice = Math.floor(currentPrice * (1 - Number(sl.stopLossPercent) / 100));
            await storage.updateStopLossOrder(sl.id, {
              highestPrice: String(currentPrice),
              stopPrice: String(newStopPrice),
            });
            currentStopPrice = newStopPrice;
            trailingUpdated++;
          }
        }

        // 손절 조건 확인: 현재가 <= 손절가
        if (currentPrice <= currentStopPrice) {
          console.log(`[StopLoss] ⚡ TRIGGER: ${sl.stockName}(${sl.stockCode}) 현재가=${currentPrice} <= 손절가=${currentStopPrice}`);

          const userCreds = sl.userId ? await getUserCredentialsById(sl.userId) : null;
          let orderResult;
          if (userCreds) {
            orderResult = await kisApi.userPlaceOrder(userCreds.userId, userCreds.creds, {
              stockCode: sl.stockCode,
              orderType: "sell",
              quantity: sl.quantity,
              orderMethod: "market",
            });
          } else {
            orderResult = await kisApi.placeOrder({
              stockCode: sl.stockCode,
              orderType: "sell",
              quantity: sl.quantity,
              orderMethod: "market",
            });
          }

          // 주문 기록 저장
          await storage.createTradingOrder({
            stockCode: sl.stockCode,
            stockName: sl.stockName || sl.stockCode,
            orderType: "sell",
            orderMethod: "market",
            quantity: sl.quantity,
            price: String(currentPrice),
            totalAmount: String(currentPrice * sl.quantity),
            status: orderResult.success ? "filled" : "failed",
            kisOrderNo: orderResult.orderNo || null,
            errorMessage: orderResult.success ? null : orderResult.message,
            executedAt: orderResult.success ? new Date() : null,
            userId: sl.userId,
          });

          // 감시 상태 업데이트
          await storage.updateStopLossOrder(sl.id, {
            status: orderResult.success ? "triggered" : "error",
            kisOrderNo: orderResult.orderNo || null,
            triggerPrice: String(currentPrice),
            triggeredAt: new Date(),
            errorMessage: orderResult.success ? null : orderResult.message,
          });

          triggeredCount++;
          console.log(`[StopLoss] ${orderResult.success ? "✅ 매도 성공" : "❌ 매도 실패"}: ${sl.stockName} ${sl.quantity}주 @ 시장가 (발동가: ${currentPrice}원)`);
        }
      }

      // 간결한 로그 (매 10초마다 모든 종목 상세는 불필요)
      if (triggeredCount > 0 || trailingUpdated > 0) {
        console.log(`[StopLoss] 감시 ${activeOrders.length}건 | 발동 ${triggeredCount}건 | 트레일링갱신 ${trailingUpdated}건`);
      }
    } catch (err: any) {
      console.error("[StopLoss] Monitor error:", err.message);
    } finally {
      stopLossLoopRunning = false;
    }
  }

  // 스마트 인터벌: 장중이면 10초, 장외면 60초
  let stopLossTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleNextStopLossCheck() {
    const interval = isMarketOpen() ? STOP_LOSS_CHECK_INTERVAL_MARKET : STOP_LOSS_CHECK_INTERVAL_IDLE;
    stopLossTimer = setTimeout(async () => {
      await stopLossMonitorLoop();
      scheduleNextStopLossCheck();
    }, interval);
  }
  scheduleNextStopLossCheck();
  console.log("[StopLoss Monitor] Background monitoring started (10s market / 60s idle)");

  // 손절 감시 실시간 현재가 조회 API (프론트엔드용)
  app.get("/api/trading/stop-loss/prices", requireUser, async (_req, res) => {
    try {
      const prices: Record<string, { price: number; changePercent: string; checkedAt: string }> = {};
      for (const [code, data] of Array.from(stopLossLatestPrices)) {
        prices[code] = {
          price: data.price,
          changePercent: data.changePercent,
          checkedAt: data.checkedAt.toISOString(),
        };
      }
      res.json({
        prices,
        lastCheckedAt: stopLossLastCheckedAt?.toISOString() || null,
        isMarketOpen: isMarketOpen(),
        interval: isMarketOpen() ? "10s" : "60s",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== Steem 블록체인 글 읽기 API ==========
  const STEEM_API_URL = "https://api.steemit.com";

  // 특정 사용자의 블로그 글 가져오기
  app.get("/api/steem/blog/:author", requireAdmin, async (req, res) => {
    try {
      const { author } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const startPermlink = (req.query.start_permlink as string) || "";
      const startAuthor = (req.query.start_author as string) || "";

      const query: any = {
        tag: author,
        limit,
      };
      if (startPermlink && startAuthor) {
        query.start_permlink = startPermlink;
        query.start_author = startAuthor;
      }

      const response = await axios.post(STEEM_API_URL, {
        jsonrpc: "2.0",
        method: "condenser_api.get_discussions_by_blog",
        params: [query],
        id: 1,
      }, { timeout: 15000 });

      const posts = (response.data?.result || []).map((post: any) => ({
        author: post.author,
        permlink: post.permlink,
        title: post.title,
        body: post.body?.slice(0, 500) + (post.body?.length > 500 ? "..." : ""),
        created: post.created,
        category: post.category,
        tags: (() => {
          try {
            const meta = JSON.parse(post.json_metadata || "{}");
            return meta.tags || [];
          } catch { return []; }
        })(),
        net_votes: post.net_votes,
        children: post.children,
        pending_payout_value: post.pending_payout_value,
        total_payout_value: post.total_payout_value,
        curator_payout_value: post.curator_payout_value,
        url: `https://steemit.com${post.url}`,
        // 리블로그 여부 확인
        isReblog: post.author !== author,
      }));

      res.json({ posts, author });
    } catch (error: any) {
      console.error(`[Steem] Failed to fetch blog for @${req.params.author}:`, error.message);
      res.status(500).json({ message: `스팀 글 조회 실패: ${error.message}` });
    }
  });

  // 특정 글 전문 가져오기
  app.get("/api/steem/post/:author/:permlink", requireAdmin, async (req, res) => {
    try {
      const { author, permlink } = req.params;

      const response = await axios.post(STEEM_API_URL, {
        jsonrpc: "2.0",
        method: "condenser_api.get_content",
        params: [author, permlink],
        id: 1,
      }, { timeout: 10000 });

      const post = response.data?.result;
      if (!post || !post.author) {
        return res.status(404).json({ message: "글을 찾을 수 없습니다" });
      }

      res.json({
        author: post.author,
        permlink: post.permlink,
        title: post.title,
        body: post.body,
        created: post.created,
        category: post.category,
        tags: (() => {
          try {
            const meta = JSON.parse(post.json_metadata || "{}");
            return meta.tags || [];
          } catch { return []; }
        })(),
        net_votes: post.net_votes,
        children: post.children,
        pending_payout_value: post.pending_payout_value,
        total_payout_value: post.total_payout_value,
        curator_payout_value: post.curator_payout_value,
        url: `https://steemit.com${post.url}`,
      });
    } catch (error: any) {
      console.error(`[Steem] Failed to fetch post:`, error.message);
      res.status(500).json({ message: `스팀 글 조회 실패: ${error.message}` });
    }
  });

  // 여러 사용자의 최신 글 통합 조회
  app.post("/api/steem/feed", requireAdmin, async (req, res) => {
    try {
      const { authors, limit = 10 } = req.body;
      if (!authors || !Array.isArray(authors) || authors.length === 0) {
        return res.status(400).json({ message: "authors 배열이 필요합니다" });
      }

      // 3일치를 충분히 커버하기 위해 유저당 최대 30개씩 가져옴
      const perAuthor = 30;
      const allPosts: any[] = [];

      // author ID 정리 (공백, @ 제거)
      const cleanAuthors = authors.map((a: string) => a.trim().replace("@", "").toLowerCase()).filter((a: string) => a.length > 0);

      await Promise.all(
        cleanAuthors.map(async (author: string) => {
          try {
            const response = await axios.post(STEEM_API_URL, {
              jsonrpc: "2.0",
              method: "condenser_api.get_discussions_by_blog",
              params: [{ tag: author, limit: perAuthor }],
              id: 1,
            }, { timeout: 15000 });

            const rawResults = response.data?.result || [];
            // 디버그: active_votes 확인
            if (rawResults.length > 0) {
              const sample = rawResults[0];
              console.log(`[Steem] @${author}: ${rawResults.length} posts, active_votes sample: ${sample.active_votes?.length ?? 'undefined'} votes`);
            }
            const posts = rawResults.map((post: any) => ({
              author: post.author,
              permlink: post.permlink,
              title: post.title,
              body: post.body?.slice(0, 300) + (post.body?.length > 300 ? "..." : ""),
              created: post.created,
              category: post.category,
              tags: (() => {
                try {
                  const meta = JSON.parse(post.json_metadata || "{}");
                  return meta.tags || [];
                } catch { return []; }
              })(),
              net_votes: post.net_votes,
              children: post.children,
              pending_payout_value: post.pending_payout_value,
              total_payout_value: post.total_payout_value,
              curator_payout_value: post.curator_payout_value,
              url: `https://steemit.com${post.url}`,
              isReblog: post.author !== author,
              // 보팅한 사용자 목록 (voter name만 전달)
              voters: (post.active_votes || []).map((v: any) => v.voter),
            }));
            allPosts.push(...posts);
          } catch (err: any) {
            console.error(`[Steem] Failed to fetch @${author}:`, err.message);
          }
        })
      );

      // 최근 3일치만 필터링
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const recentPosts = allPosts.filter((post) => {
        const postDate = new Date(post.created + "Z"); // Steem은 UTC
        return postDate >= threeDaysAgo;
      });

      // 시간순 정렬 (최신글 먼저)
      recentPosts.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

      res.json({ posts: recentPosts, authors });
    } catch (error: any) {
      console.error("[Steem] Feed fetch failed:", error.message);
      res.status(500).json({ message: `스팀 피드 조회 실패: ${error.message}` });
    }
  });

  // ===== 스팀 Replies (내 글에 달린 댓글) 조회 =====
  app.get("/api/steem/replies/:author", requireAdmin, async (req, res) => {
    try {
      const author = req.params.author.trim().replace("@", "").toLowerCase();
      const limit = Math.min(parseInt(req.query.limit as string) || 7, 20);

      const response = await axios.post(STEEM_API_URL, {
        jsonrpc: "2.0",
        method: "bridge.get_account_posts",
        params: { sort: "replies", account: author, limit },
        id: 1,
      }, { timeout: 15000 });

      const rawPosts = response.data?.result || [];
      const replies = rawPosts.map((post: any) => ({
        author: post.author,
        permlink: post.permlink,
        body: post.body?.slice(0, 500) + (post.body?.length > 500 ? "..." : ""),
        created: post.created,
        parent_author: post.parent_author,
        parent_permlink: post.parent_permlink,
        net_votes: post.stats?.total_votes || post.net_votes || 0,
        children: post.children || 0,
        url: `https://steemit.com${post.url}`,
      }));

      res.json({ replies, account: author });
    } catch (error: any) {
      console.error("[Steem] Replies fetch failed:", error.message);
      res.status(500).json({ message: `Replies 조회 실패: ${error.message}` });
    }
  });

  // ========== AI 프롬프트 CRUD ==========

  // 프롬프트 목록 조회 (기본 + 공유 + 본인)
  app.get("/api/ai-prompts", async (req, res) => {
    try {
      const userId = req.session?.userId;
      const prompts = await storage.getAiPrompts(userId || undefined);
      res.json(prompts);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "프롬프트 조회 실패" });
    }
  });

  // 프롬프트 생성
  app.post("/api/ai-prompts", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId;
      const userName = req.session?.userName || req.session?.userEmail || "사용자";
      const { title, content, category, isShared, isDefault } = req.body;
      if (!title || !content) {
        return res.status(400).json({ message: "제목과 내용을 입력해주세요." });
      }
      const prompt = await storage.createAiPrompt({
        title,
        content,
        category: category || "일반",
        isDefault: req.session?.isAdmin ? (isDefault === true) : false,
        isShared: isShared === true,
        sharedBy: isShared === true ? userName : null,
        userId: userId || null,
      });
      res.json(prompt);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "프롬프트 생성 실패" });
    }
  });

  // 프롬프트 수정
  app.patch("/api/ai-prompts/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getAiPrompt(id);
      if (!existing) return res.status(404).json({ message: "프롬프트를 찾을 수 없습니다." });
      // 기본 프롬프트는 admin만 수정
      if (existing.isDefault && !req.session?.isAdmin) {
        return res.status(403).json({ message: "기본 프롬프트는 관리자만 수정할 수 있습니다." });
      }
      // 본인 프롬프트만 수정 (admin은 모두 가능)
      if (!req.session?.isAdmin && existing.userId !== req.session?.userId) {
        return res.status(403).json({ message: "본인의 프롬프트만 수정 가능합니다." });
      }
      const prompt = await storage.updateAiPrompt(id, req.body);
      res.json(prompt);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "프롬프트 수정 실패" });
    }
  });

  // 프롬프트 삭제
  app.delete("/api/ai-prompts/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getAiPrompt(id);
      if (!existing) return res.status(404).json({ message: "프롬프트를 찾을 수 없습니다." });
      if (existing.isDefault && !req.session?.isAdmin) {
        return res.status(403).json({ message: "기본 프롬프트는 관리자만 삭제할 수 있습니다." });
      }
      if (!req.session?.isAdmin && existing.userId !== req.session?.userId) {
        return res.status(403).json({ message: "본인의 프롬프트만 삭제 가능합니다." });
      }
      await storage.deleteAiPrompt(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "프롬프트 삭제 실패" });
    }
  });

  // 기본 프롬프트 초기화 (서버 시작 시)
  (async () => {
    try {
      const existingPrompts = await storage.getAiPrompts();
      const hasDefault = existingPrompts.some((p: any) => p.isDefault);
      if (!hasDefault) {
        await storage.createAiPrompt({
          title: "투자 마이스터",
          content: `너는 경제 전문가이자 투자의 마이스터야~
이 대화는 주식 및 ETF거래를 통해 투자 수익률을 극대화함과 동시에 장기적으로 안정적인 복리 수익률을 추구하고자 하는 안정적,적극적 투자성향을 모두 가지고 있는 투자스타일의 투자자를 위한 대화창이야.
최근의 매크로 동향, 최신뉴스 및 테마동향, ETF 정보, 지수동향 등을 종합 참고하여 투자자의 질문에 대답을 해주길 바래~
그리고 본 페이지에 구현된 기능을 가능하면 에이전트 방식으로 실행할 수 있도록 해줘(메뉴이동,내용입력,정보검색 등)`,
          category: "투자전략",
          isDefault: true,
          isShared: false,
          sharedBy: null,
          userId: null,
        });
        console.log("[AI Agent] 기본 프롬프트 생성 완료");
      }
    } catch (e: any) {
      console.log("[AI Agent] 기본 프롬프트 초기화 실패:", e.message);
    }
  })();

  // ========== Admin Dashboard - 방문자 통계 ==========

  // 방문 기록 (프론트에서 페이지 전환 시 호출)
  app.post("/api/visit/track", async (req, res) => {
    try {
      const { page } = req.body;
      const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      
      await storage.createVisitLog({
        userId: req.session?.userId || null,
        userEmail: req.session?.userEmail || null,
        userName: req.session?.userName || null,
        ipAddress: typeof ip === "string" ? ip.split(",")[0].trim() : "unknown",
        userAgent: typeof userAgent === "string" ? userAgent.substring(0, 300) : "unknown",
        page: page || "/",
        sessionId: req.sessionID || null,
      });
      
      res.json({ success: true });
    } catch (error: any) {
      // 방문 기록 실패는 무시 (사용자 경험에 영향 주지 않음)
      console.error("[Visit] Track failed:", error.message);
      res.json({ success: false });
    }
  });

  // 방문 통계 조회 (admin only)
  app.get("/api/admin/dashboard/stats", requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const stats = await storage.getVisitStats(days);
      res.json(stats);
    } catch (error: any) {
      console.error("[Dashboard] Stats failed:", error.message);
      res.status(500).json({ message: error.message || "통계 조회 실패" });
    }
  });

  // 최근 방문 로그 조회 (admin only)
  app.get("/api/admin/dashboard/logs", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const logs = await storage.getVisitLogs(limit);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "로그 조회 실패" });
    }
  });

  // 등록된 사용자 목록 (admin only)
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getUsers();
      const safeUsers = allUsers.map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt,
      }));
      res.json(safeUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "사용자 목록 조회 실패" });
    }
  });

  // ========== AI Agent 시스템 ==========

  // Agent에서 사용 가능한 Action 정의
  const AGENT_ACTIONS_DESCRIPTION = `
당신은 투자 전문 AI Agent입니다. 사용자의 요청을 분석하여 필요한 경우 아래 사용 가능한 액션을 JSON으로 반환합니다.

## 응답 규칙
1. 실행할 액션이 있는 경우: 먼저 자연어 답변을 한 뒤, 마지막에 [ACTIONS]...[/ACTIONS] 블록으로 JSON 배열을 반환합니다.
2. 액션 없이 대화만 하는 경우: 자연어로 답변합니다.
3. 여러 액션을 순차적으로 실행해야 하면 배열에 여러 개를 넣을 수 있습니다.
4. 주문(place_order) 같은 위험 액션은 반드시 confirm_required로 감싸서 사용자 확인을 받도록 합니다.

## 사용 가능한 액션 목록

### 메뉴 이동 (navigate)
- 화면을 특정 탭/메뉴로 전환합니다
- target 값: "home", "etf-components", "new-etf", "watchlist-etf", "satellite-etf", "etf-search", "markets-domestic", "markets-global", "markets-research", "daily-strategy", "domestic-stocks", "overseas-stocks", "tenbagger", "steem-report", "steem-reader", "ai-agent", "bookmarks"
- trading 페이지: target을 "/trading"으로 지정
예시: {"action":"navigate","params":{"target":"etf-components"}}
예시: {"action":"navigate","params":{"target":"/trading"}}

### 종목 검색 (search_stock)
- 키워드로 국내/해외 종목을 검색합니다
예시: {"action":"search_stock","params":{"keyword":"삼성전자"}}

### 종목 현재가 조회 (fetch_stock_price)
- 특정 종목의 현재가를 조회합니다
예시: {"action":"fetch_stock_price","params":{"stockCode":"005930"}}

### 계좌 잔고 조회 (fetch_balance)
- 사용자의 보유 종목 및 잔고를 조회합니다
예시: {"action":"fetch_balance","params":{}}

### 시장 지수 조회 (fetch_market_indices)
- 코스피, 코스닥 등 주요 시장 지수를 조회합니다
예시: {"action":"fetch_market_indices","params":{}}

### 해외 시장 지수 조회 (fetch_global_indices)
- S&P500, 나스닥, 다우 등 해외 주요 지수를 조회합니다
예시: {"action":"fetch_global_indices","params":{}}

### 실시간 상승 ETF TOP 15 조회 (fetch_etf_top_gainers)
- 실시간 상승 ETF 상위 종목을 조회합니다
예시: {"action":"fetch_etf_top_gainers","params":{}}

### 업종별 등락현황 조회 (fetch_sectors)
- 업종별 등락현황을 조회합니다
예시: {"action":"fetch_sectors","params":{}}

### 종목 순위 조회 (fetch_top_stocks)
- 거래량/상승률/하락률 상위 종목을 조회합니다
- category: "volume"(거래량), "rising"(상승), "falling"(하락)
예시: {"action":"fetch_top_stocks","params":{"category":"rising"}}

### 환율 조회 (fetch_exchange_rates)
- 주요 환율 정보를 조회합니다
예시: {"action":"fetch_exchange_rates","params":{}}

### 종목 상세정보 열기 (open_stock_detail)
- 특정 종목의 상세 정보 페이지를 새 창으로 엽니다
- market: "domestic" 또는 "overseas"
예시: {"action":"open_stock_detail","params":{"stockCode":"005930","stockName":"삼성전자","market":"domestic"}}

### 종목 뉴스 조회 (fetch_stock_news)
- 특정 종목의 최신 뉴스를 조회합니다
- market: "domestic" 또는 "overseas"
예시: {"action":"fetch_stock_news","params":{"stockCode":"005930","market":"domestic"}}

### 시장 뉴스 조회 (fetch_market_news)
- 최신 시장 뉴스를 조회합니다
예시: {"action":"fetch_market_news","params":{}}

### 관심 종목 목록 조회 (fetch_watchlist)
- 등록된 관심 종목 목록을 조회합니다
- market: "domestic" 또는 "overseas" (선택)
예시: {"action":"fetch_watchlist","params":{"market":"domestic"}}

### 종목 매수 주문 (place_order)
⚠️ 위험 액션 - 반드시 confirm_required를 true로 설정
- stockCode: 종목코드
- orderType: "buy" 또는 "sell"
- quantity: 수량
- price: 가격 (지정가)
- orderMethod: "limit"(지정가) 또는 "market"(시장가)
예시: {"action":"place_order","params":{"stockCode":"005930","orderType":"buy","quantity":10,"price":58000,"orderMethod":"limit"},"confirm_required":true,"confirm_message":"삼성전자 10주를 58,000원에 매수합니다. 실행하시겠습니까?"}

### AI 종합분석 (ai_stock_analysis)
- 특정 종목에 대한 AI 종합분석을 수행합니다
예시: {"action":"ai_stock_analysis","params":{"stockCode":"005930","stockName":"삼성전자","market":"domestic"}}

### ETF 구성종목 조회 (fetch_etf_components)
- 특정 ETF의 구성종목을 조회합니다
예시: {"action":"fetch_etf_components","params":{"code":"069500"}}

### 주문 내역 조회 (fetch_orders)
- 최근 주문 내역을 조회합니다
예시: {"action":"fetch_orders","params":{}}

### 관심 ETF 시세 조회 (fetch_watchlist_etf_realtime)
- 관심 ETF 목록의 실시간 시세를 조회합니다
- type: "core" 또는 "satellite"
예시: {"action":"fetch_watchlist_etf_realtime","params":{"type":"core"}}

### 리서치 보고서 조회 (fetch_research)
- 최신 증권사 리서치 보고서를 조회합니다
예시: {"action":"fetch_research","params":{}}

### ETF 키워드 검색 (search_etf)
- 키워드로 ETF를 검색합니다 (이름/코드)
예시: {"action":"search_etf","params":{"keyword":"반도체"}}

### ETF 스크리너 (screen_etf)
- 조건으로 ETF를 필터링합니다
- 가능한 필터: keyword, minChangeRate, maxChangeRate, minMarketCap(억원), min3mReturn, excludeLeverage(true/false), excludeInverse(true/false), sortBy(changeRate/threeMonthEarnRate/marketCap/quant), sortOrder(desc/asc), limit
예시: {"action":"screen_etf","params":{"minChangeRate":"2","excludeLeverage":true,"excludeInverse":true,"sortBy":"changeRate","limit":"10"}}

### ETF 테마 분석 (fetch_etf_themes)
- 테마별 ETF 분류와 평균 등락률을 조회합니다
예시: {"action":"fetch_etf_themes","params":{}}

### ETF 비교 (compare_etf)
- 2~4개 ETF를 비교합니다 (코드를 쉼표로 구분)
예시: {"action":"compare_etf","params":{"codes":"069500,229200,360750"}}

### ETF 상세 정보 조회 (fetch_etf_detail)
- 특정 ETF의 상세 정보(배당수익률, 총보수, 추적지수 등)를 조회합니다
예시: {"action":"fetch_etf_detail","params":{"code":"069500"}}

### ETF 검색/비교/AI추천 화면 이동 (navigate_etf_search)
- ETF 통합 검색 화면으로 이동합니다
예시: {"action":"navigate_etf_search","params":{}}
`;

  // Agent Action 실행 함수
  async function executeAgentAction(action: any, req: Request): Promise<any> {
    const params = action.params || {};
    
    try {
      switch (action.action) {
        case "navigate": {
          return { type: "navigate", target: params.target, success: true };
        }
        
        case "search_stock": {
          const keyword = params.keyword;
          if (!keyword) return { type: "error", message: "검색 키워드가 필요합니다." };
          const url = `https://ac.stock.naver.com/ac?q=${encodeURIComponent(keyword)}&target=stock%2Cindex`;
          const response = await axios.get(url, { timeout: 5000 });
          const items = response.data?.items || [];
          const results: any[] = [];
          for (const group of items) {
            for (const item of (group.items || [])) {
              results.push({
                code: item.code,
                name: item.name,
                market: item.typeCode === "stock" ? (item.nationCode === "KR" ? "domestic" : "overseas") : "index",
                exchange: item.exchange || "",
              });
            }
          }
          return { type: "data", dataType: "search_results", data: results.slice(0, 10), success: true };
        }
        
        case "fetch_stock_price": {
          const code = params.stockCode;
          if (!code) return { type: "error", message: "종목코드가 필요합니다." };
          const market = params.market || "domestic";
          try {
            let priceData;
            if (market === "overseas") {
              const suffix = params.exchange === "NASDAQ" || params.exchange === "NAS" ? ".O" : 
                            params.exchange === "NYSE" || params.exchange === "NYS" ? ".N" : ".O";
              const url = `https://m.stock.naver.com/api/stock/${code}${suffix}/basic`;
              const response = await axios.get(url, { timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" } });
              priceData = response.data;
            } else {
              const url = `https://m.stock.naver.com/api/stock/${code}/basic`;
              const response = await axios.get(url, { timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" } });
              priceData = response.data;
            }
            return { 
              type: "data", dataType: "stock_price", 
              data: {
                stockCode: code,
                name: priceData?.stockName || priceData?.stockNameEng || code,
                currentPrice: priceData?.closePrice || priceData?.lastPrice,
                changePrice: priceData?.compareToPreviousClosePrice,
                changeRate: priceData?.fluctuationsRatio,
                high: priceData?.highPrice,
                low: priceData?.lowPrice,
                volume: priceData?.accumulatedTradingVolume,
                marketCap: priceData?.marketCap,
              },
              success: true 
            };
          } catch (e: any) {
            return { type: "error", message: `현재가 조회 실패: ${e.message}` };
          }
        }

        case "fetch_balance": {
          try {
            const userCreds = await getUserCredentials(req);
            let result;
            if (userCreds) {
              result = await kisApi.getUserAccountBalance(userCreds.userId, userCreds.creds);
            } else {
              result = await kisApi.getAccountBalance();
            }
            return { type: "data", dataType: "balance", data: result, success: true };
          } catch (e: any) {
            return { type: "error", message: `잔고 조회 실패: ${e.message}` };
          }
        }

        case "fetch_market_indices": {
          try {
            const url = "https://m.stock.naver.com/api/index/KOSPI/basic";
            const url2 = "https://m.stock.naver.com/api/index/KOSDAQ/basic";
            const [kospi, kosdaq] = await Promise.all([
              axios.get(url, { timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" } }),
              axios.get(url2, { timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" } }),
            ]);
            return { 
              type: "data", dataType: "market_indices", 
              data: {
                kospi: { value: kospi.data?.closePrice, change: kospi.data?.compareToPreviousClosePrice, changeRate: kospi.data?.fluctuationsRatio },
                kosdaq: { value: kosdaq.data?.closePrice, change: kosdaq.data?.compareToPreviousClosePrice, changeRate: kosdaq.data?.fluctuationsRatio },
              },
              success: true 
            };
          } catch (e: any) {
            return { type: "error", message: `시장 지수 조회 실패: ${e.message}` };
          }
        }

        case "fetch_global_indices": {
          try {
            const indices = ["SPI@SPX", "NAS@IXIC", "DJI@DJI"];
            const results = await Promise.all(
              indices.map(idx => 
                axios.get(`https://m.stock.naver.com/api/index/${idx}/basic`, {
                  timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" }
                }).catch(() => null)
              )
            );
            const data: any = {};
            const names = ["S&P 500", "NASDAQ", "Dow Jones"];
            results.forEach((r, i) => {
              if (r?.data) {
                data[names[i]] = {
                  value: r.data.closePrice,
                  change: r.data.compareToPreviousClosePrice,
                  changeRate: r.data.fluctuationsRatio,
                };
              }
            });
            return { type: "data", dataType: "global_indices", data, success: true };
          } catch (e: any) {
            return { type: "error", message: `해외 지수 조회 실패: ${e.message}` };
          }
        }

        case "fetch_etf_top_gainers": {
          try {
            const url = "https://m.stock.naver.com/api/stocks/etf/rising?page=1&pageSize=15";
            const response = await axios.get(url, { timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" } });
            const stocks = (response.data?.stocks || []).slice(0, 15).map((s: any) => ({
              code: s.itemCode,
              name: s.stockName,
              price: s.closePrice,
              changeRate: s.fluctuationsRatio,
              change: s.compareToPreviousClosePrice,
            }));
            return { type: "data", dataType: "etf_top_gainers", data: stocks, success: true };
          } catch (e: any) {
            return { type: "error", message: `ETF 상승 종목 조회 실패: ${e.message}` };
          }
        }

        case "fetch_sectors": {
          try {
            const url = "https://m.stock.naver.com/api/stocks/up/KOSPI?page=1&pageSize=10";
            const response = await axios.get(url, { timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" } });
            return { type: "data", dataType: "sectors", data: response.data, success: true };
          } catch (e: any) {
            return { type: "error", message: `업종 조회 실패: ${e.message}` };
          }
        }

        case "fetch_top_stocks": {
          try {
            const category = params.category || "rising";
            const typeMap: any = { rising: "up", falling: "down", volume: "volume" };
            const url = `https://m.stock.naver.com/api/stocks/${typeMap[category] || "up"}/KOSPI?page=1&pageSize=10`;
            const response = await axios.get(url, { timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" } });
            const stocks = (response.data?.stocks || []).map((s: any) => ({
              code: s.itemCode,
              name: s.stockName,
              price: s.closePrice,
              changeRate: s.fluctuationsRatio,
              change: s.compareToPreviousClosePrice,
              volume: s.accumulatedTradingVolume,
            }));
            return { type: "data", dataType: "top_stocks", category, data: stocks, success: true };
          } catch (e: any) {
            return { type: "error", message: `종목 순위 조회 실패: ${e.message}` };
          }
        }

        case "fetch_exchange_rates": {
          try {
            const url = "https://m.stock.naver.com/api/exchange/FX_USDKRW/basic";
            const url2 = "https://m.stock.naver.com/api/exchange/FX_JPYKRW/basic";
            const url3 = "https://m.stock.naver.com/api/exchange/FX_EURKRW/basic";
            const [usd, jpy, eur] = await Promise.all([
              axios.get(url, { timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null),
              axios.get(url2, { timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null),
              axios.get(url3, { timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null),
            ]);
            const data: any = {};
            if (usd?.data) data["USD/KRW"] = { value: usd.data.closePrice, change: usd.data.compareToPreviousClosePrice, changeRate: usd.data.fluctuationsRatio };
            if (jpy?.data) data["JPY/KRW"] = { value: jpy.data.closePrice, change: jpy.data.compareToPreviousClosePrice, changeRate: jpy.data.fluctuationsRatio };
            if (eur?.data) data["EUR/KRW"] = { value: eur.data.closePrice, change: eur.data.compareToPreviousClosePrice, changeRate: eur.data.fluctuationsRatio };
            return { type: "data", dataType: "exchange_rates", data, success: true };
          } catch (e: any) {
            return { type: "error", message: `환율 조회 실패: ${e.message}` };
          }
        }

        case "open_stock_detail": {
          const { stockCode, stockName, market } = params;
          if (!stockCode) return { type: "error", message: "종목코드가 필요합니다." };
          return { 
            type: "open_window", 
            url: `/stock-detail?code=${stockCode}&name=${encodeURIComponent(stockName || stockCode)}&market=${market || "domestic"}`,
            success: true 
          };
        }

        case "fetch_stock_news": {
          try {
            const { stockCode, market } = params;
            if (!stockCode) return { type: "error", message: "종목코드가 필요합니다." };
            const isOverseas = market === "overseas";
            let url;
            if (isOverseas) {
              const suffix = params.exchange === "NASDAQ" || params.exchange === "NAS" ? ".O" : ".N";
              url = `https://m.stock.naver.com/api/stock/${stockCode}${suffix}/news?page=1&pageSize=10`;
            } else {
              url = `https://m.stock.naver.com/api/stock/${stockCode}/news?page=1&pageSize=10`;
            }
            const response = await axios.get(url, { timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" } });
            const news = (response.data?.news || response.data || []).slice(0, 10).map((n: any) => ({
              title: n.title,
              source: n.officeName || n.source,
              date: n.datetime || n.date,
              link: n.link || n.url,
            }));
            return { type: "data", dataType: "stock_news", data: news, success: true };
          } catch (e: any) {
            return { type: "error", message: `뉴스 조회 실패: ${e.message}` };
          }
        }

        case "fetch_market_news": {
          try {
            const url = "https://m.stock.naver.com/api/news/list?category=market&page=1&pageSize=10";
            const response = await axios.get(url, { timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" } });
            const news = (response.data?.news || response.data || []).slice(0, 10).map((n: any) => ({
              title: n.title,
              source: n.officeName || n.source,
              date: n.datetime || n.date,
            }));
            return { type: "data", dataType: "market_news", data: news, success: true };
          } catch (e: any) {
            return { type: "error", message: `시장 뉴스 조회 실패: ${e.message}` };
          }
        }

        case "fetch_watchlist": {
          try {
            const market = params.market || "domestic";
            const stocks = await storage.getWatchlistStocks(market);
            const data = stocks.map((s: any) => ({
              code: s.stockCode,
              name: s.stockName,
              market: s.market,
              sector: s.sector,
              memo: s.memo,
            }));
            return { type: "data", dataType: "watchlist", data, success: true };
          } catch (e: any) {
            return { type: "error", message: `관심종목 조회 실패: ${e.message}` };
          }
        }

        case "place_order": {
          // 주문 실행 - confirm이 필요하므로 여기서는 실행하지 않고 confirm 요청 반환
          if (action.confirm_required) {
            return { 
              type: "confirm_required", 
              action: action,
              message: action.confirm_message || `${params.orderType === "buy" ? "매수" : "매도"} 주문을 실행하시겠습니까?`,
              success: true 
            };
          }
          // confirm된 주문 실행
          try {
            const userCreds = await getUserCredentials(req);
            let result;
            if (userCreds) {
              result = await kisApi.userPlaceOrder(userCreds.userId, userCreds.creds, {
                stockCode: params.stockCode,
                orderType: params.orderType,
                quantity: Number(params.quantity),
                price: params.price ? Number(params.price) : undefined,
                orderMethod: params.orderMethod || "limit",
              });
            } else {
              result = await kisApi.placeOrder({
                stockCode: params.stockCode,
                orderType: params.orderType,
                quantity: Number(params.quantity),
                price: params.price ? Number(params.price) : undefined,
                orderMethod: params.orderMethod || "limit",
              });
            }
            
            // 주문 기록
            const agentUserId = req.session?.userId || null;
            await storage.createTradingOrder({
              stockCode: params.stockCode,
              stockName: params.stockName || params.stockCode,
              orderType: params.orderType,
              orderMethod: params.orderMethod || "limit",
              quantity: Number(params.quantity),
              price: params.price ? String(params.price) : null,
              totalAmount: result.success && params.price ? String(Number(params.price) * Number(params.quantity)) : null,
              status: result.success ? "filled" : "failed",
              kisOrderNo: result.orderNo || null,
              userId: agentUserId,
              errorMessage: result.message || null,
            });
            
            return { 
              type: "data", dataType: "order_result", 
              data: { success: result.success, message: result.message, orderNo: result.orderNo },
              success: result.success 
            };
          } catch (e: any) {
            return { type: "error", message: `주문 실행 실패: ${e.message}` };
          }
        }

        case "ai_stock_analysis": {
          return { 
            type: "navigate_with_action",
            target: params.market === "overseas" ? "overseas-stocks" : "domestic-stocks",
            action: "open_stock_detail_and_analyze",
            params: { stockCode: params.stockCode, stockName: params.stockName, market: params.market },
            message: `${params.stockName || params.stockCode} 종목 상세 화면을 열고 AI 분석을 시작합니다.`,
            success: true 
          };
        }

        case "fetch_etf_components": {
          try {
            const code = params.code;
            if (!code) return { type: "error", message: "ETF 코드가 필요합니다." };
            // ISIN 변환
            const isinBase = `KR7${code.padStart(6, "0")}00`;
            let sum = 0;
            for (let i = 0; i < isinBase.length; i++) {
              const c = isinBase.charCodeAt(i);
              let val = c >= 65 ? c - 55 : c - 48;
              const digits = val.toString();
              for (let j = 0; j < digits.length; j++) {
                let d = parseInt(digits[j]);
                if ((i * 2 + j) % 2 === 1) d *= 2;
                sum += d > 9 ? d - 9 : d;
              }
            }
            const checkDigit = (10 - (sum % 10)) % 10;
            const isin = isinBase + checkDigit;

            const url = `https://www.funetf.co.kr/api/etf/components?isin=${isin}`;
            const response = await axios.get(url, { timeout: 5000 }).catch(() => null);
            if (response?.data) {
              return { type: "data", dataType: "etf_components", data: response.data, success: true };
            }
            return { type: "error", message: "ETF 구성종목 데이터를 가져올 수 없습니다." };
          } catch (e: any) {
            return { type: "error", message: `ETF 구성종목 조회 실패: ${e.message}` };
          }
        }

        case "fetch_orders": {
          try {
            const userId = req.session?.userId || null;
            const orders = await storage.getTradingOrders(20, userId || undefined);
            const recent = orders.slice(0, 20).map((o: any) => ({
              stockCode: o.stockCode,
              stockName: o.stockName,
              orderType: o.orderType,
              quantity: o.quantity,
              price: o.price,
              status: o.status,
              createdAt: o.createdAt,
            }));
            return { type: "data", dataType: "orders", data: recent, success: true };
          } catch (e: any) {
            return { type: "error", message: `주문 내역 조회 실패: ${e.message}` };
          }
        }

        case "fetch_watchlist_etf_realtime": {
          try {
            const etfType = params.type || "core";
            const etfs = etfType === "satellite" 
              ? await storage.getSatelliteEtfs()
              : await storage.getWatchlistEtfs();
            const data = etfs.map((e: any) => ({
              code: e.code,
              name: e.name,
              sector: e.sector,
            }));
            return { type: "data", dataType: "watchlist_etf", data, success: true };
          } catch (e: any) {
            return { type: "error", message: `관심 ETF 조회 실패: ${e.message}` };
          }
        }

        case "fetch_research": {
          try {
            const url = "https://stock.naver.com/api/research?category=invest&page=1&pageSize=10";
            const response = await axios.get(url, { timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null);
            if (response?.data) {
              return { type: "data", dataType: "research", data: response.data, success: true };
            }
            return { type: "error", message: "리서치 데이터를 가져올 수 없습니다." };
          } catch (e: any) {
            return { type: "error", message: `리서치 조회 실패: ${e.message}` };
          }
        }

        case "search_etf": {
          try {
            const keyword = params.keyword;
            if (!keyword) return { type: "error", message: "ETF 검색 키워드가 필요합니다." };
            const allEtfs = await getEtfFullList();
            const lw = keyword.toLowerCase();
            const results = allEtfs
              .filter((etf: any) => etf.code.includes(keyword) || etf.name.toLowerCase().includes(lw))
              .slice(0, 15)
              .map((etf: any) => ({
                code: etf.code, name: etf.name, nowVal: etf.nowVal,
                changeRate: etf.changeRate, threeMonthEarnRate: etf.threeMonthEarnRate,
                marketCap: Math.round(etf.marketCap / 100000000),
              }));
            return { type: "data", dataType: "etf_search", data: results, total: results.length, success: true };
          } catch (e: any) {
            return { type: "error", message: `ETF 검색 실패: ${e.message}` };
          }
        }

        case "screen_etf": {
          try {
            const allEtfs = await getEtfFullList();
            const minCR = parseFloat(params.minChangeRate) || -Infinity;
            const maxCR = parseFloat(params.maxChangeRate) || Infinity;
            const minMC = (parseFloat(params.minMarketCap) || 0) * 100000000;
            const min3m = parseFloat(params.min3mReturn) || -Infinity;
            const exLev = params.excludeLeverage === true || params.excludeLeverage === "true";
            const exInv = params.excludeInverse === true || params.excludeInverse === "true";
            const kw = (params.keyword || "").toLowerCase();
            const sBy = params.sortBy || "changeRate";
            const sOrd = params.sortOrder || "desc";
            const lmt = parseInt(params.limit) || 15;
            const LEV = ["레버리지", "2X", "울트라"];
            const INV = ["인버스", "bear", "BEAR", "곱버스", "숏", "SHORT"];
            let filtered = allEtfs.filter((etf: any) => {
              if (etf.changeRate < minCR || etf.changeRate > maxCR) return false;
              if (etf.marketCap < minMC) return false;
              if (etf.threeMonthEarnRate < min3m) return false;
              if (exLev && LEV.some(k => etf.name.includes(k))) return false;
              if (exInv && INV.some(k => etf.name.includes(k))) return false;
              if (kw && !etf.name.toLowerCase().includes(kw) && !etf.code.includes(kw)) return false;
              return true;
            });
            filtered.sort((a: any, b: any) => {
              const aV = a[sBy] || 0; const bV = b[sBy] || 0;
              return sOrd === "desc" ? bV - aV : aV - bV;
            });
            const results = filtered.slice(0, lmt).map((etf: any) => ({
              code: etf.code, name: etf.name, nowVal: etf.nowVal,
              changeRate: etf.changeRate, threeMonthEarnRate: etf.threeMonthEarnRate,
              marketCap: Math.round(etf.marketCap / 100000000), quant: etf.quant,
            }));
            return { type: "data", dataType: "etf_screener", data: results, total: filtered.length, success: true };
          } catch (e: any) {
            return { type: "error", message: `ETF 스크리너 실패: ${e.message}` };
          }
        }

        case "fetch_etf_themes": {
          try {
            const allEtfs = await getEtfFullList();
            const themeMapAgent: Record<string, { keywords: string[]; icon: string }> = {
              "반도체/AI": { keywords: ["반도체", "AI", "인공지능", "GPU", "HBM"], icon: "🤖" },
              "2차전지": { keywords: ["2차전지", "배터리", "리튬", "전기차"], icon: "🔋" },
              "바이오": { keywords: ["바이오", "헬스케어", "제약"], icon: "💊" },
              "에너지": { keywords: ["에너지", "원유", "금", "원자재"], icon: "⛽" },
              "미국주식": { keywords: ["미국", "나스닥", "S&P"], icon: "🇺🇸" },
              "채권": { keywords: ["채권", "국채", "회사채"], icon: "📜" },
              "배당": { keywords: ["배당", "고배당", "커버드콜"], icon: "💰" },
              "ESG/친환경": { keywords: ["ESG", "친환경", "그린", "수소"], icon: "🌱" },
            };
            const summary: any[] = [];
            for (const [name, cfg] of Object.entries(themeMapAgent)) {
              const themeEtfs = allEtfs.filter(e => cfg.keywords.some(k => e.name.includes(k)));
              if (themeEtfs.length > 0) {
                const avg = themeEtfs.reduce((s, e) => s + e.changeRate, 0) / themeEtfs.length;
                const avg3m = themeEtfs.reduce((s, e) => s + e.threeMonthEarnRate, 0) / themeEtfs.length;
                summary.push({ name, icon: cfg.icon, count: themeEtfs.length,
                  avgChangeRate: Math.round(avg * 100) / 100,
                  avg3mReturn: Math.round(avg3m * 100) / 100,
                  topEtf: themeEtfs.sort((a, b) => b.changeRate - a.changeRate)[0]?.name || "-" });
              }
            }
            summary.sort((a, b) => b.avgChangeRate - a.avgChangeRate);
            return { type: "data", dataType: "etf_themes", data: summary, success: true };
          } catch (e: any) {
            return { type: "error", message: `ETF 테마 조회 실패: ${e.message}` };
          }
        }

        case "compare_etf": {
          try {
            const codes = params.codes;
            if (!codes) return { type: "error", message: "비교할 ETF 코드를 입력하세요 (쉼표 구분)." };
            const codeList = codes.split(",").map((c: string) => c.trim()).filter(Boolean).slice(0, 4);
            const allEtfs = await getEtfFullList();
            const results = await Promise.all(codeList.map(async (code: string) => {
              const listData = allEtfs.find(e => e.code === code);
              let detail: any = {};
              try {
                const integRes = await axios.get(`https://m.stock.naver.com/api/stock/${code}/integration`, {
                  timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" }
                }).catch(() => null);
                const indic = integRes?.data?.etfKeyIndicator || {};
                detail = { dividendYield: indic.dividendYieldTtm, totalExpenseRatio: indic.totalExpenseRatio, indexName: indic.indexName, managementCompany: indic.managementCompany };
              } catch {}
              return {
                code, name: listData?.name || code, nowVal: listData?.nowVal || 0,
                changeRate: listData?.changeRate || 0, threeMonthEarnRate: listData?.threeMonthEarnRate || 0,
                marketCap: Math.round((listData?.marketCap || 0) / 100000000), ...detail,
              };
            }));
            return { type: "data", dataType: "etf_compare", data: results, success: true };
          } catch (e: any) {
            return { type: "error", message: `ETF 비교 실패: ${e.message}` };
          }
        }

        case "fetch_etf_detail": {
          try {
            const code = params.code;
            if (!code) return { type: "error", message: "ETF 코드가 필요합니다." };
            const [basicRes, integRes] = await Promise.all([
              axios.get(`https://m.stock.naver.com/api/stock/${code}/basic`, { timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null),
              axios.get(`https://m.stock.naver.com/api/stock/${code}/integration`, { timeout: 5000, headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null),
            ]);
            const basic = basicRes?.data || {};
            const indic = integRes?.data?.etfKeyIndicator || {};
            return { type: "data", dataType: "etf_detail", data: {
              code, name: basic.stockName || code, currentPrice: basic.closePrice,
              changeRate: basic.fluctuationsRatio, dividendYield: indic.dividendYieldTtm,
              totalExpenseRatio: indic.totalExpenseRatio, indexName: indic.indexName,
              managementCompany: indic.managementCompany, nav: indic.nav,
            }, success: true };
          } catch (e: any) {
            return { type: "error", message: `ETF 상세 조회 실패: ${e.message}` };
          }
        }

        case "navigate_etf_search": {
          return { type: "navigate", target: "etf-search", success: true };
        }

        default:
          return { type: "error", message: `알 수 없는 액션: ${action.action}` };
      }
    } catch (err: any) {
      return { type: "error", message: `액션 실행 오류: ${err.message}` };
    }
  }

  // AI Agent 대화 (2단계 프로세스)
  app.post("/api/ai-agent/chat", requireUser, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ message: "로그인이 필요합니다." });

      const { messages, systemPrompt } = req.body;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: "메시지를 입력해주세요." });
      }

      // 사용자 AI 키 가져오기
      const userAiConfig = await storage.getUserAiConfig(userId);
      let userKey: UserAiKeyOption | undefined;
      if (userAiConfig && userAiConfig.useOwnKey) {
        userKey = {
          provider: userAiConfig.aiProvider || "gemini",
          geminiApiKey: userAiConfig.geminiApiKey || undefined,
          openaiApiKey: userAiConfig.openaiApiKey || undefined,
        };
      }

      // Step 1: AI에게 액션 추출을 포함한 프롬프트 전달
      let fullPrompt = `[시스템 지시사항]\n`;
      if (systemPrompt) {
        fullPrompt += `${systemPrompt}\n\n`;
      }
      fullPrompt += AGENT_ACTIONS_DESCRIPTION;
      fullPrompt += `\n\n[대화 기록]\n`;
      for (const msg of messages) {
        const role = msg.role === "user" ? "사용자" : "AI";
        fullPrompt += `${role}: ${msg.content}\n`;
      }
      fullPrompt += "\nAI:";

      const aiResponse = await callAI(fullPrompt, userKey);

      // Step 2: 응답에서 [ACTIONS] 블록 파싱
      const actionsMatch = aiResponse.match(/\[ACTIONS\]([\s\S]*?)\[\/ACTIONS\]/);
      let actions: any[] = [];
      let textResponse = aiResponse;

      if (actionsMatch) {
        textResponse = aiResponse.replace(/\[ACTIONS\][\s\S]*?\[\/ACTIONS\]/, "").trim();
        try {
          actions = JSON.parse(actionsMatch[1].trim());
          if (!Array.isArray(actions)) actions = [actions];
        } catch (e) {
          console.error("[Agent] Action JSON 파싱 실패:", actionsMatch[1]);
          actions = [];
        }
      }

      // Step 3: 각 Action 실행
      const actionResults: any[] = [];
      for (const action of actions) {
        const result = await executeAgentAction(action, req);
        actionResults.push(result);
      }

      // Step 4: Action 결과가 있으면 AI에게 결과를 전달하여 최종 답변 생성
      let finalResponse = textResponse;
      if (actionResults.length > 0) {
        const hasDataResults = actionResults.some(r => r.type === "data" || r.type === "error");
        
        if (hasDataResults) {
          // 데이터 조회 결과가 있으면 AI에게 다시 한번 정리 요청
          const dataStr = JSON.stringify(actionResults.filter(r => r.type === "data" || r.type === "error"), null, 2);
          const summaryPrompt = `아래는 사용자의 요청에 따라 실행된 액션의 결과 데이터입니다. 이 데이터를 보기 좋게 정리하여 사용자에게 답변해주세요. 핵심 수치는 빠짐없이 포함하고, 간결하면서도 전문적으로 답변해주세요. 가격 등 숫자는 천 단위 구분 쉼표를 사용해주세요.

사용자 질문: ${messages[messages.length - 1]?.content || ""}

실행 결과 데이터:
${dataStr}

위 데이터를 기반으로 답변해주세요:`;
          
          try {
            finalResponse = await callAI(summaryPrompt, userKey);
          } catch (e) {
            // 요약 실패 시 원래 텍스트 응답 사용
            finalResponse = textResponse || "데이터를 조회했으나 정리에 실패했습니다.";
          }
        }
      }

      res.json({ 
        response: finalResponse,
        actions: actionResults,
      });
    } catch (error: any) {
      console.error("[AI Agent Chat Error]:", error.message);
      res.status(500).json({ message: error.message || "AI 응답 실패" });
    }
  });

  // Agent Action 확인(Confirm) 후 실행 엔드포인트
  app.post("/api/ai-agent/execute-action", requireUser, async (req, res) => {
    try {
      const { action } = req.body;
      if (!action) return res.status(400).json({ message: "액션 정보가 필요합니다." });
      
      // confirm_required를 제거하고 실행
      const execAction = { ...action, confirm_required: false };
      const result = await executeAgentAction(execAction, req);
      res.json(result);
    } catch (error: any) {
      console.error("[Agent Execute Error]:", error.message);
      res.status(500).json({ message: error.message || "액션 실행 실패" });
    }
  });

  return httpServer;
}

