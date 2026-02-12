import { pgTable, text, serial, numeric, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export * from "./models/chat.js";

export const etfTrends = pgTable("etf_trends", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title"),
  comment: text("comment"),
  thumbnail: text("thumbnail"),
  sourceType: text("source_type"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertEtfTrendSchema = createInsertSchema(etfTrends).omit({ id: true, createdAt: true });

export type EtfTrend = typeof etfTrends.$inferSelect;
export type InsertEtfTrend = z.infer<typeof insertEtfTrendSchema>;

// ========== KIS 자동매매 관련 테이블 ==========

// 자동매매 규칙
export const autoTradeRules = pgTable("auto_trade_rules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  name: text("name").notNull(),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  ruleType: text("rule_type").notNull(), // 'buy_below' | 'sell_above' | 'trailing_stop'
  targetPrice: numeric("target_price").notNull(),
  quantity: integer("quantity").notNull(),
  orderMethod: text("order_method").default("limit"), // 'market' | 'limit'
  isActive: boolean("is_active").default(true),
  status: text("status").default("active"), // 'active' | 'executed' | 'cancelled' | 'failed'
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAutoTradeRuleSchema = createInsertSchema(autoTradeRules).omit({ id: true, createdAt: true });

export type AutoTradeRule = typeof autoTradeRules.$inferSelect;
export type InsertAutoTradeRule = z.infer<typeof insertAutoTradeRuleSchema>;

// 매매 주문 기록
export const tradingOrders = pgTable("trading_orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name"),
  orderType: text("order_type").notNull(), // 'buy' | 'sell'
  orderMethod: text("order_method").default("limit"), // 'market' | 'limit'
  quantity: integer("quantity").notNull(),
  price: numeric("price"),
  totalAmount: numeric("total_amount"),
  status: text("status").default("pending"), // 'pending' | 'filled' | 'cancelled' | 'failed'
  kisOrderNo: text("kis_order_no"),
  autoTradeRuleId: integer("auto_trade_rule_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  executedAt: timestamp("executed_at"),
});

export const insertTradingOrderSchema = createInsertSchema(tradingOrders).omit({ id: true, createdAt: true });

export type TradingOrder = typeof tradingOrders.$inferSelect;
export type InsertTradingOrder = z.infer<typeof insertTradingOrderSchema>;

// ========== 사용자 (Google OAuth) ==========
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  picture: text("picture"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ========== 사용자별 KIS 매매 설정 ==========
export const userTradingConfigs = pgTable("user_trading_configs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(), // 유저당 1개
  appKey: text("app_key").notNull(),
  appSecret: text("app_secret").notNull(),
  accountNo: text("account_no").notNull(),        // 계좌번호 앞 8자리
  accountProductCd: text("account_product_cd").default("01"), // 뒤 2자리
  mockTrading: boolean("mock_trading").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserTradingConfigSchema = createInsertSchema(userTradingConfigs).omit({ id: true, createdAt: true, updatedAt: true });

export type UserTradingConfig = typeof userTradingConfigs.$inferSelect;
export type InsertUserTradingConfig = z.infer<typeof insertUserTradingConfigSchema>;

// ========== 손절/트레일링 스탑 감시 ==========
export const stopLossOrders = pgTable("stop_loss_orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name"),
  buyPrice: numeric("buy_price").notNull(),         // 매수가 (기준가)
  quantity: integer("quantity").notNull(),            // 매도 수량
  stopLossPercent: numeric("stop_loss_percent").notNull(), // 손절 비율(%)
  stopType: text("stop_type").notNull().default("simple"), // 'simple' | 'trailing'
  stopPrice: numeric("stop_price").notNull(),         // 현재 손절 기준가 (트레일링 시 동적 갱신)
  highestPrice: numeric("highest_price"),             // 트레일링 스탑: 최고가 추적
  status: text("status").default("active"),           // 'active' | 'triggered' | 'cancelled' | 'error'
  kisOrderNo: text("kis_order_no"),                   // 감시 발동 시 KIS 주문번호
  triggerPrice: numeric("trigger_price"),             // 실제 발동 시점의 가격
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  triggeredAt: timestamp("triggered_at"),
});

export const insertStopLossOrderSchema = createInsertSchema(stopLossOrders).omit({ id: true, createdAt: true });

export type StopLossOrder = typeof stopLossOrders.$inferSelect;
export type InsertStopLossOrder = z.infer<typeof insertStopLossOrderSchema>;

// ========== 신규ETF 관리 (저장된 ETF 정보) ==========
export const savedEtfs = pgTable("saved_etfs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  etfCode: text("etf_code").notNull(),
  etfName: text("etf_name").notNull(),
  category: text("category"),              // ETF 카테고리 (국내주식, 해외주식 등)
  assetManager: text("asset_manager"),     // 운용사
  listingDate: text("listing_date"),       // 상장일
  totalAsset: text("total_asset"),         // 순자산총액
  expense: text("expense"),               // 총보수
  benchmark: text("benchmark"),           // 기초지수
  recentPrice: text("recent_price"),       // 최근 가격
  recentChange: text("recent_change"),     // 최근 등락률
  portfolioData: text("portfolio_data"),   // 포트폴리오 구성 JSON
  comment: text("comment"),               // 사용자 코멘트
  relatedLinks: text("related_links"),     // 관련문서 링크 JSON [{title, url}]
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSavedEtfSchema = createInsertSchema(savedEtfs).omit({ id: true, createdAt: true, updatedAt: true });

export type SavedEtf = typeof savedEtfs.$inferSelect;
export type InsertSavedEtf = z.infer<typeof insertSavedEtfSchema>;

// ========== 관심ETF(Core) ==========
export const watchlistEtfs = pgTable("watchlist_etfs", {
  id: serial("id").primaryKey(),
  etfCode: text("etf_code").notNull(),
  etfName: text("etf_name").notNull(),
  sector: text("sector").default("기본"),          // 섹터/카테고리 분류
  memo: text("memo"),                              // 간단 메모
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertWatchlistEtfSchema = createInsertSchema(watchlistEtfs).omit({ id: true, createdAt: true });

export type WatchlistEtf = typeof watchlistEtfs.$inferSelect;
export type InsertWatchlistEtf = z.infer<typeof insertWatchlistEtfSchema>;

// ========== 관심ETF(Satellite) ==========
export const satelliteEtfs = pgTable("satellite_etfs", {
  id: serial("id").primaryKey(),
  etfCode: text("etf_code").notNull(),
  etfName: text("etf_name").notNull(),
  sector: text("sector").default("기본"),
  memo: text("memo"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSatelliteEtfSchema = createInsertSchema(satelliteEtfs).omit({ id: true, createdAt: true });

export type SatelliteEtf = typeof satelliteEtfs.$inferSelect;
export type InsertSatelliteEtf = typeof satelliteEtfs.$inferInsert;

// ========== 공지사항 ==========
export const notices = pgTable("notices", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertNoticeSchema = createInsertSchema(notices).omit({ id: true, createdAt: true, updatedAt: true });

export type Notice = typeof notices.$inferSelect;
export type InsertNotice = z.infer<typeof insertNoticeSchema>;

// ========== 스팀 포스팅 이력 ==========
export const steemPosts = pgTable("steem_posts", {
  id: serial("id").primaryKey(),
  author: text("author").notNull(),              // 스팀 계정명
  permlink: text("permlink").notNull(),          // 포스트 URL slug
  title: text("title").notNull(),
  body: text("body").notNull(),                  // 마크다운 본문
  tags: text("tags").notNull(),                  // JSON array of tags
  category: text("category").default("kr"),      // 메인 카테고리/첫번째 태그
  status: text("status").default("published"),   // 'draft' | 'published' | 'failed'
  steemUrl: text("steem_url"),                   // steemit.com URL
  txId: text("tx_id"),                           // 블록체인 트랜잭션 ID
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSteemPostSchema = createInsertSchema(steemPosts).omit({ id: true, createdAt: true });

export type SteemPost = typeof steemPosts.$inferSelect;
export type InsertSteemPost = z.infer<typeof insertSteemPostSchema>;

// ========== AI 분석 보고서 ==========
export const aiReports = pgTable("ai_reports", {
  id: serial("id").primaryKey(),
  analysis: text("analysis").notNull(),           // AI 분석 내용
  analyzedAt: text("analyzed_at").notNull(),       // 분석 시점 (KST 문자열)
  savedAt: text("saved_at").notNull(),             // 저장 시점 (KST 문자열)
  items: text("items").notNull(),                  // 분석에 사용된 항목 JSON [{ title, source, date }]
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAiReportSchema = createInsertSchema(aiReports).omit({ id: true, createdAt: true });

export type AiReport = typeof aiReports.$inferSelect;
export type InsertAiReport = z.infer<typeof insertAiReportSchema>;

// ========== 즐겨찾기 (북마크) ==========
export const bookmarks = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  title: text("title").notNull(),
  url: text("url").notNull(),
  section: text("section").default("기본"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertBookmarkSchema = createInsertSchema(bookmarks).omit({ id: true, createdAt: true });

export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;
