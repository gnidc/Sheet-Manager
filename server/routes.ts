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

// AI API: Gemini 네이티브 REST API 또는 OpenAI
async function callAI(prompt: string): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    // Gemini 네이티브 REST API 사용
    const model = "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
    try {
      const res = await axios.post(url, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
      }, { timeout: 30000 });
      
      const content = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error("AI 응답이 비어있습니다.");
      return content;
    } catch (err: any) {
      if (err.response?.status === 429) {
        const retryDelay = err.response?.data?.error?.details?.find((d: any) => d.retryDelay)?.retryDelay || "";
        throw new Error(`Gemini API 할당량 초과 (429). ${retryDelay ? `${retryDelay} 후 재시도 가능합니다.` : "잠시 후 다시 시도하세요."} Google AI Studio(https://aistudio.google.com)에서 할당량을 확인하세요.`);
      }
      throw err;
    }
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

  throw new Error("AI API 키가 설정되지 않았습니다. GEMINI_API_KEY 또는 OPENAI_API_KEY를 .env에 추가하세요.");
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
      req.session = null;
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

      res.json({
        success: true,
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
      const { title, url, sortOrder } = req.body;
      if (!title || !url) {
        return res.status(400).json({ message: "제목과 URL은 필수입니다." });
      }
      const userId = req.session?.userId || null;
      const bookmark = await storage.createBookmark({ title, url, sortOrder: sortOrder || 0, userId });
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
      const { title, url, sortOrder } = req.body;
      const updated = await storage.updateBookmark(id, { title, url, sortOrder });
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

  // ========== 증권사 리서치 리포트 ==========
  app.get("/api/news/research", async (req, res) => {
    try {
      const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      const researchItems: { title: string; link: string; source: string; date: string; file: string }[] = [];

      const researchRes = await axios.get("https://finance.naver.com/research/invest_list.naver", {
        headers: { "User-Agent": UA },
        timeout: 8000,
        responseType: "arraybuffer",
      });
      const html = new TextDecoder("euc-kr").decode(researchRes.data);
      const $ = cheerio.load(html);

      // 리서치 테이블 파싱 - 셀 내용 패턴 기반 매핑
      $("table.type_1 tr").each((_i, el) => {
        const $row = $(el);
        const cells = $row.find("td");
        if (cells.length < 3) return;

        // 링크가 포함된 셀을 제목 셀로 인식
        let titleCell: ReturnType<typeof $> | null = null;
        let titleIdx = -1;
        cells.each((idx, cell) => {
          if (!titleCell && $(cell).find("a[href*='invest_read']").length > 0) {
            titleCell = $(cell);
            titleIdx = idx;
          }
        });
        // 링크 패턴이 없으면 첫 번째 a 태그가 있는 셀 사용
        if (!titleCell) {
          cells.each((idx, cell) => {
            if (!titleCell && $(cell).find("a").length > 0) {
              titleCell = $(cell);
              titleIdx = idx;
            }
          });
        }
        if (!titleCell) return;

        const $a = (titleCell as ReturnType<typeof $>).find("a").first();
        const title = $a.text().trim();
        let link = $a.attr("href") || "";
        if (link && !link.startsWith("http")) {
          link = "https://finance.naver.com/research/" + link;
        }

        // PDF 첨부파일 찾기
        const $pdfLink = (titleCell as ReturnType<typeof $>).find("a[href*='.pdf'], a[href*='download']");
        let file = "";
        if ($pdfLink.length > 0) {
          const fileLink = $pdfLink.attr("href") || "";
          if (fileLink) {
            file = fileLink.startsWith("http") ? fileLink : "https://finance.naver.com/research/" + fileLink;
          }
        }

        // 나머지 셀에서 증권사, 날짜, 조회수 식별
        let source = "";
        let date = "";
        const datePattern = /^\d{2}\.\d{2}\.\d{2}$/;
        const viewPattern = /^\d{1,6}$/;

        cells.each((idx, cell) => {
          if (idx === titleIdx) return;
          const text = $(cell).text().trim();
          if (!text) return;

          if (datePattern.test(text)) {
            date = text;
          } else if (viewPattern.test(text)) {
            // 조회수 - 스킵
          } else if (text.length > 1 && text.length <= 20) {
            // 증권사 이름 (보통 짧은 텍스트)
            source = text;
          }
        });

        if (title && title.length > 2) {
          researchItems.push({ title, link, source, date, file });
        }
      });

      res.json({
        research: researchItems.slice(0, 30),
        updatedAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        total: researchItems.length,
      });
    } catch (error: any) {
      console.error("Failed to fetch research:", error);
      res.status(500).json({ message: error.message || "리서치 데이터 가져오기 실패" });
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

  // ===== ETF 상승 트렌드 AI 분석 =====
  app.post("/api/etf/analyze-trend", async (req, res) => {
    try {

      // 1) ETF 상승 데이터 수집
      const allEtfs = await getEtfFullList();
      const EXCLUDE_KEYWORDS = ["레버리지", "인버스", "2X", "bear", "BEAR", "곱버스", "숏", "SHORT", "울트라"];
      const filtered = allEtfs.filter((etf) => {
        return !EXCLUDE_KEYWORDS.some((kw) => etf.name.includes(kw));
      });
      const risingEtfs = filtered
        .filter((etf) => etf.changeRate > 0)
        .sort((a, b) => b.changeRate - a.changeRate)
        .slice(0, 20);
      
      const fallingEtfs = filtered
        .filter((etf) => etf.changeRate < 0)
        .sort((a, b) => a.changeRate - b.changeRate)
        .slice(0, 10);

      // 2) 뉴스 데이터 수집
      let newsData: string[] = [];
      try {
        const newsRes = await axios.get("https://finance.naver.com/news/news_list.naver?mode=RANK&page=1", {
          headers: { "User-Agent": "Mozilla/5.0" },
          timeout: 5000,
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
          headers: { "User-Agent": "Mozilla/5.0" },
          timeout: 5000,
        });
        const $ = cheerio.load(marketRes.data);
        const kospi = $("#KOSPI_now").text().trim();
        const kosdaq = $("#KOSDAQ_now").text().trim();
        if (kospi) marketInfo += `코스피: ${kospi} `;
        if (kosdaq) marketInfo += `코스닥: ${kosdaq} `;
      } catch (e) {
        console.error("[Analyze] Market data fetch failed:", (e as Error).message);
      }

      // 4) AI 프롬프트 구성
      const etfSummary = risingEtfs.map((e, i) => 
        `${i+1}. ${e.name}(${e.code}) 현재가:${e.nowVal.toLocaleString()} 등락률:+${e.changeRate}% 시총:${e.marketCap}억 거래량:${e.quant.toLocaleString()}`
      ).join("\n");

      const fallingSummary = fallingEtfs.map((e, i) => 
        `${i+1}. ${e.name}(${e.code}) 등락률:${e.changeRate}%`
      ).join("\n");

      const newsSummary = newsData.length > 0 
        ? newsData.map((n, i) => `${i+1}. ${n}`).join("\n") 
        : "뉴스 데이터 없음";

      const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

      const prompt = `당신은 한국 금융시장 전문 애널리스트입니다. 아래 데이터를 기반으로 오늘의 ETF 상승 트렌드를 분석해주세요.

📅 날짜: ${today}
📊 시장 현황: ${marketInfo || "데이터 없음"}

📈 실시간 상승 ETF TOP 20:
${etfSummary}

📉 하락 ETF TOP 10:
${fallingSummary}

📰 주요 뉴스:
${newsSummary}

다음 형식으로 분석 보고서를 작성해주세요 (30줄 내외, 한국어):

1. **📊 오늘의 시장 개요** (3-4줄): 전반적인 시장 분위기와 주요 지수 동향
2. **🔥 주요 상승 섹터/테마 분석** (8-10줄): 상승 ETF들의 공통 테마, 섹터별 분류, 상승 원인 분석
3. **📰 뉴스·매크로 연관 분석** (5-6줄): 뉴스와 ETF 상승의 연관성
4. **📉 하락 섹터 동향** (3-4줄): 하락하는 섹터와 원인
5. **💡 투자 시사점 및 주의사항** (5-6줄): 단기 투자 전략 제안 및 리스크 요인

각 섹션은 제목을 포함하고, 구체적인 ETF명과 수치를 인용하여 작성해주세요.`;

      // 5) AI API 호출
      console.log("[Analyze] Calling AI API...");
      const analysis = await callAI(prompt);
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
    const authUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(NAVER_REDIRECT_URI)}&state=${state}`;
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

      // multipart/form-data 형식으로 전송
      const FormData = (await import("form-data")).default;
      const formData = new FormData();
      formData.append("subject", subject);
      formData.append("content", content);

      const response = await axios.post(
        `https://openapi.naver.com/v1/cafe/${CAFE_ID}/menu/${menuId}/articles`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${naverToken}`,
            ...formData.getHeaders(),
          },
          timeout: 15000,
        }
      );

      console.log(`[Cafe Write] Article posted: "${subject}" to menu ${menuId}`);
      return res.json({
        message: "카페에 글이 등록되었습니다.",
        result: response.data,
        articleUrl: response.data?.message?.result?.articleUrl || null,
      });
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error("[Cafe Write] Failed:", error.message, errorData);

      if (error.response?.status === 401) {
        // 토큰 만료 → 갱신 시도
        const newToken = await refreshNaverToken(req);
        if (!newToken) {
          return res.status(401).json({ message: "네이버 토큰이 만료되었습니다. 다시 로그인해주세요.", requireNaverLogin: true });
        }
        return res.status(500).json({ message: "토큰을 갱신했습니다. 다시 시도해주세요." });
      }

      return res.status(500).json({
        message: errorData?.message || error.message || "글 등록에 실패했습니다.",
      });
    }
  });

  // ETF 검색 (네이버 금융 전체 ETF 목록에서 검색)
  app.get("/api/etf/search", async (req, res) => {
    try {
      const query = (req.query.q as string || "").trim();
      if (!query || query.length < 2) {
        return res.status(400).json({ message: "검색어는 2자 이상 입력해주세요." });
      }

      const allEtfs = await getEtfFullList();
      const lowerQuery = query.toLowerCase();

      // 코드 또는 이름에 검색어가 포함된 ETF 필터링
      const results = allEtfs
        .filter((etf: any) =>
          etf.code.includes(query) ||
          etf.name.toLowerCase().includes(lowerQuery)
        )
        .slice(0, 30)
        .map((etf: any) => ({
          code: etf.code,
          name: etf.name,
        }));

      res.json({ results, total: results.length });
    } catch (error: any) {
      console.error("Failed to search ETFs:", error);
      res.status(500).json({ message: error.message || "ETF 검색 실패" });
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

  return httpServer;
}
