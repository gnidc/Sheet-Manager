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

// ========== Google 계정 연결 (멀티 계정) ==========
export const userLinkedAccounts = pgTable("user_linked_accounts", {
  id: serial("id").primaryKey(),
  primaryUserId: integer("primary_user_id").notNull(),  // 주 계정 ID
  linkedUserId: integer("linked_user_id").notNull(),     // 연결된 계정 ID
  isActive: boolean("is_active").default(false),          // 현재 활성 여부
  linkedAt: timestamp("linked_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type UserLinkedAccount = typeof userLinkedAccounts.$inferSelect;
export type InsertUserLinkedAccount = typeof userLinkedAccounts.$inferInsert;

// ========== 사용자별 자동매매 설정 (멀티 증권사 API 지원) ==========
export const userTradingConfigs = pgTable("user_trading_configs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),           // 유저당 복수 등록 가능
  broker: text("broker").default("kis"),           // 증권사: "kis" | "kiwoom"
  label: text("label").default("기본"),            // API 별칭
  appKey: text("app_key").notNull(),
  appSecret: text("app_secret").notNull(),
  accountNo: text("account_no").notNull(),        // 계좌번호
  accountProductCd: text("account_product_cd").default("01"), // KIS: 뒤 2자리
  mockTrading: boolean("mock_trading").default(true),
  isActive: boolean("is_active").default(false),   // 현재 활성 API 여부
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

// ========== 관심(Core) ==========
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

// ========== 관심(Satellite) ==========
export const satelliteEtfs = pgTable("satellite_etfs", {
  id: serial("id").primaryKey(),
  etfCode: text("etf_code").notNull(),
  etfName: text("etf_name").notNull(),
  sector: text("sector").default("기본"),
  memo: text("memo"),
  listType: text("list_type").default("common"), // 'common' (공통관심) | 'personal' (개인관심)
  userId: integer("user_id"),                     // 개인관심일 때 사용자 ID (null이면 공통)
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

// ========== 주요 리서치 (DB 영속 저장) ==========
export const keyResearch = pgTable("key_research", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  link: text("link").default(""),
  source: text("source").default(""),
  date: text("date").default(""),
  file: text("file").default(""),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type KeyResearchItem = typeof keyResearch.$inferSelect;
export type InsertKeyResearch = typeof keyResearch.$inferInsert;

// ========== Notion 연동 설정 (사용자별, 용도별) ==========
export const notionConfig = pgTable("notion_config", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(-1),
  apiKey: text("api_key").notNull(),
  databaseId: text("database_id").notNull(),
  purpose: text("purpose").notNull().default("research"),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type NotionConfig = typeof notionConfig.$inferSelect;

// ========== 전략 보고서 (일일/주간/월간/연간) ==========

// 시장 데이터 보고서 (모든 로그인 유저 생성 가능, 공유 가능)
export const strategyReports = pgTable("strategy_reports", {
  id: serial("id").primaryKey(),
  period: text("period").notNull(),               // "daily" | "weekly" | "monthly" | "yearly"
  title: text("title").notNull(),                  // 보고서 제목
  periodLabel: text("period_label").notNull(),     // "일일" | "주간" | "월간" | "연간"
  reportData: text("report_data").notNull(),       // MarketReport JSON
  userId: integer("user_id"),                      // 생성자 ID (null=admin 기존 데이터)
  createdBy: text("created_by"),                   // 생성자 이름
  isShared: boolean("is_shared").default(true),    // 공유 여부 (기본 공유)
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertStrategyReportSchema = createInsertSchema(strategyReports).omit({ id: true, createdAt: true });
export type StrategyReport = typeof strategyReports.$inferSelect;
export type InsertStrategyReport = z.infer<typeof insertStrategyReportSchema>;

// AI 분석 보고서 (모든 로그인 유저 생성 가능, 공유 가능)
export const strategyAnalyses = pgTable("strategy_analyses", {
  id: serial("id").primaryKey(),
  period: text("period").notNull(),               // "daily" | "weekly" | "monthly" | "yearly"
  prompt: text("prompt").notNull(),                // AI 프롬프트
  urls: text("urls").notNull(),                    // URL 목록 JSON
  fileNames: text("file_names").notNull(),         // 파일 이름 목록 JSON
  source: text("source"),                          // "strategy" | "etf-realtime"
  analysisResult: text("analysis_result").notNull(),// AiAnalysisResult JSON
  userId: integer("user_id"),                      // 생성자 ID (null=admin 기존 데이터)
  createdBy: text("created_by"),                   // 생성자 이름
  isShared: boolean("is_shared").default(true),    // 공유 여부 (기본 공유)
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertStrategyAnalysisSchema = createInsertSchema(strategyAnalyses).omit({ id: true, createdAt: true });
export type StrategyAnalysis = typeof strategyAnalyses.$inferSelect;
export type InsertStrategyAnalysis = z.infer<typeof insertStrategyAnalysisSchema>;

// ========== 시가급등 추세추종 전략 ==========

// 전략 설정
export const gapStrategy = pgTable("gap_strategy", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull().default("시가급등 추세추종"),
  isActive: boolean("is_active").default(false),
  // 매수 조건
  universeType: text("universe_type").default("both"),           // 'kospi200' | 'kosdaq150' | 'both'
  minGapPercent: numeric("min_gap_percent").default("3"),
  maxGapPercent: numeric("max_gap_percent").default("7"),
  maAligned: boolean("ma_aligned").default(true),
  priceAboveMa5: boolean("price_above_ma5").default(true),
  // 분할매수 설정
  firstBuyRatio: integer("first_buy_ratio").default(30),
  addBuyRatio: integer("add_buy_ratio").default(20),
  addBuyTriggerPercent: numeric("add_buy_trigger_percent").default("1"),
  // 매도 조건
  sellMaPeriod: integer("sell_ma_period").default(5),
  // 리스크 관리
  maxPositionRatio: integer("max_position_ratio").default(50),
  maxStocksCount: integer("max_stocks_count").default(5),
  // 스캔 후보 캐시
  candidates: text("candidates"),                                // JSON string of stock codes
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertGapStrategySchema = createInsertSchema(gapStrategy).omit({ id: true, createdAt: true, updatedAt: true });

export type GapStrategy = typeof gapStrategy.$inferSelect;
export type InsertGapStrategy = z.infer<typeof insertGapStrategySchema>;

// 전략 포지션 (종목별 매매 상태 추적)
export const gapStrategyPositions = pgTable("gap_strategy_positions", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id").notNull(),
  userId: integer("user_id").notNull(),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  status: text("status").default("scanning"),
  // 'scanning' | 'gap_detected' | 'buying' | 'holding' | 'selling' | 'closed'
  prevClose: numeric("prev_close"),
  openPrice: numeric("open_price"),
  gapPercent: numeric("gap_percent"),
  targetAmount: numeric("target_amount"),
  totalBuyQty: integer("total_buy_qty").default(0),
  totalBuyAmount: numeric("total_buy_amount").default("0"),
  avgBuyPrice: numeric("avg_buy_price"),
  buyPhase: integer("buy_phase").default(0),
  lastBuyPrice: numeric("last_buy_price"),
  sellPrice: numeric("sell_price"),
  sellQty: integer("sell_qty"),
  sellAmount: numeric("sell_amount"),
  profitLoss: numeric("profit_loss"),
  profitRate: numeric("profit_rate"),
  ma5: numeric("ma5"),
  ma10: numeric("ma10"),
  ma20: numeric("ma20"),
  ma60: numeric("ma60"),
  openedAt: timestamp("opened_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  closedAt: timestamp("closed_at"),
});

export const insertGapStrategyPositionSchema = createInsertSchema(gapStrategyPositions).omit({ id: true, openedAt: true });

export type GapStrategyPosition = typeof gapStrategyPositions.$inferSelect;
export type InsertGapStrategyPosition = z.infer<typeof insertGapStrategyPositionSchema>;

// 전략 실행 로그
export const gapStrategyLogs = pgTable("gap_strategy_logs", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id").notNull(),
  positionId: integer("position_id"),
  action: text("action").notNull(),
  stockCode: text("stock_code"),
  stockName: text("stock_name"),
  detail: text("detail"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertGapStrategyLogSchema = createInsertSchema(gapStrategyLogs).omit({ id: true, createdAt: true });

export type GapStrategyLog = typeof gapStrategyLogs.$inferSelect;
export type InsertGapStrategyLog = z.infer<typeof insertGapStrategyLogSchema>;

// ========== 관심종목 (주식정보) ==========
export const watchlistStocks = pgTable("watchlist_stocks", {
  id: serial("id").primaryKey(),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  market: text("market").default("domestic"), // 'domestic' | 'overseas'
  exchange: text("exchange"),                 // KOSPI, KOSDAQ, NYSE, NASDAQ 등
  sector: text("sector").default("기본"),
  memo: text("memo"),
  listType: text("list_type").default("common"), // 'common' (공통관심) | 'personal' (개인관심)
  userId: integer("user_id"),                     // 개인관심일 때 사용자 ID (null이면 공통)
  isShared: boolean("is_shared").default(false),  // 개인관심 종목 공유 여부 (true면 모든 계정에 공유 목록으로 표시)
  sharedBy: text("shared_by"),                    // 공유한 사용자 이름
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertWatchlistStockSchema = createInsertSchema(watchlistStocks).omit({ id: true, createdAt: true });

export type WatchlistStock = typeof watchlistStocks.$inferSelect;
export type InsertWatchlistStock = z.infer<typeof insertWatchlistStockSchema>;

// ========== 종목 코멘트 ==========
export const stockComments = pgTable("stock_comments", {
  id: serial("id").primaryKey(),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name"),
  market: text("market").default("domestic"), // 'domestic' | 'overseas'
  userId: integer("user_id"),
  userName: text("user_name"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type StockComment = typeof stockComments.$inferSelect;
export type InsertStockComment = typeof stockComments.$inferInsert;

// ========== 개선제안 및 QnA 게시판 ==========
export const qnaPosts = pgTable("qna_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  userName: text("user_name"),
  userEmail: text("user_email"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").default("general"), // 'improvement' | 'question' | 'general'
  replyCount: integer("reply_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type QnaPost = typeof qnaPosts.$inferSelect;
export type InsertQnaPost = typeof qnaPosts.$inferInsert;

export const qnaReplies = pgTable("qna_replies", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: integer("user_id"),
  userName: text("user_name"),
  userEmail: text("user_email"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type QnaReply = typeof qnaReplies.$inferSelect;
export type InsertQnaReply = typeof qnaReplies.$inferInsert;

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

// ========== 10X (Ten Bagger) 종목 ==========
export const tenbaggerStocks = pgTable("tenbagger_stocks", {
  id: serial("id").primaryKey(),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  market: text("market").default("domestic"), // 'domestic' | 'overseas'
  exchange: text("exchange"),                 // KOSPI, KOSDAQ, NYSE, NASDAQ 등
  sector: text("sector").default("기본"),
  memo: text("memo"),
  targetPrice: text("target_price"),           // 목표가
  buyPrice: text("buy_price"),                 // 매수가
  reason: text("reason"),                      // 선정 사유
  aiAnalysis: text("ai_analysis"),             // AI 분석 결과
  aiAnalyzedAt: timestamp("ai_analyzed_at"),   // AI 분석 일시
  listType: text("list_type").default("common"), // 'common' (공통관심) | 'personal' (개인관심)
  userId: integer("user_id"),                     // 개인관심일 때 사용자 ID (null이면 공통)
  isShared: boolean("is_shared").default(false),  // 개인관심 종목 공유 여부 (true면 모든 계정에 공유 목록으로 표시)
  sharedBy: text("shared_by"),                    // 공유한 사용자 이름
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTenbaggerStockSchema = createInsertSchema(tenbaggerStocks).omit({ id: true, createdAt: true });

export type TenbaggerStock = typeof tenbaggerStocks.$inferSelect;
export type InsertTenbaggerStock = z.infer<typeof insertTenbaggerStockSchema>;

// ========== 종목 AI 종합분석 ==========
export const stockAiAnalyses = pgTable("stock_ai_analyses", {
  id: serial("id").primaryKey(),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  market: text("market").default("domestic"), // 'domestic' | 'overseas'
  exchange: text("exchange"),
  analysisResult: text("analysis_result").notNull(),
  summary: text("summary"),                  // 한줄 요약
  rating: text("rating"),                    // '강력매수' | '매수' | '중립' | '매도' | '강력매도'
  userId: integer("user_id"),
  userName: text("user_name"),
  isPublic: boolean("is_public").default(true), // true: 공개(모두 볼 수 있음), false: 비공개(본인만)
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type StockAiAnalysis = typeof stockAiAnalyses.$inferSelect;
export type InsertStockAiAnalysis = typeof stockAiAnalyses.$inferInsert;

// ========== 사용자별 AI API 설정 (멀티 API 지원) ==========
export const userAiConfigs = pgTable("user_ai_configs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),             // 유저당 복수 등록 가능
  label: text("label").default("기본"),              // API 별칭
  aiProvider: text("ai_provider").default("gemini"),    // "gemini" | "openai" | "groq"
  geminiApiKey: text("gemini_api_key"),
  openaiApiKey: text("openai_api_key"),
  groqApiKey: text("groq_api_key"),
  useOwnKey: boolean("use_own_key").default(true),
  isActive: boolean("is_active").default(false),     // 현재 활성 API 여부
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type UserAiConfig = typeof userAiConfigs.$inferSelect;
export type InsertUserAiConfig = typeof userAiConfigs.$inferInsert;

// ========== AI 프롬프트 ==========
export const aiPrompts = pgTable("ai_prompts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").default("일반"),       // 프롬프트 카테고리
  isDefault: boolean("is_default").default(false),  // 기본(공통) 프롬프트 여부
  isShared: boolean("is_shared").default(false),    // 공유 프롬프트 여부
  sharedBy: text("shared_by"),                      // 공유한 사용자 이름
  userId: integer("user_id"),                       // 개인 프롬프트일 때 사용자 ID
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type AiPrompt = typeof aiPrompts.$inferSelect;
export type InsertAiPrompt = typeof aiPrompts.$inferInsert;

// ========== Admin Dashboard - 방문자 로그 ==========
export const visitLogs = pgTable("visit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  userEmail: text("user_email"),
  userName: text("user_name"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  page: text("page").default("/"),            // 접속 페이지
  sessionId: text("session_id"),              // 세션 식별자
  visitedAt: timestamp("visited_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type VisitLog = typeof visitLogs.$inferSelect;
export type InsertVisitLog = typeof visitLogs.$inferInsert;

// ========== 보안점검 로그 ==========
export const securityAuditLogs = pgTable("security_audit_logs", {
  id: serial("id").primaryKey(),
  auditType: text("audit_type").notNull(),          // 'scheduled' | 'manual'
  status: text("status").notNull(),                  // 'pass' | 'warning' | 'critical'
  summary: text("summary").notNull(),                // 점검 요약
  details: text("details").notNull(),                // 상세 결과 JSON
  totalChecks: integer("total_checks").default(0),
  passedChecks: integer("passed_checks").default(0),
  warningChecks: integer("warning_checks").default(0),
  criticalChecks: integer("critical_checks").default(0),
  executedAt: timestamp("executed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type SecurityAuditLog = typeof securityAuditLogs.$inferSelect;
export type InsertSecurityAuditLog = typeof securityAuditLogs.$inferInsert;

// ========== 보안 모의훈련 결과 ==========
export const securityDrillResults = pgTable("security_drill_results", {
  id: serial("id").primaryKey(),
  drillType: text("drill_type").notNull(),           // 'full' | 'auth' | 'injection' | 'api'
  status: text("status").notNull(),                  // 'pass' | 'warning' | 'fail'
  summary: text("summary").notNull(),
  details: text("details").notNull(),                // 상세 결과 JSON
  totalTests: integer("total_tests").default(0),
  passedTests: integer("passed_tests").default(0),
  failedTests: integer("failed_tests").default(0),
  duration: integer("duration").default(0),          // 실행시간(ms)
  executedBy: text("executed_by"),                   // 실행한 admin 이름
  executedAt: timestamp("executed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type SecurityDrillResult = typeof securityDrillResults.$inferSelect;
export type InsertSecurityDrillResult = typeof securityDrillResults.$inferInsert;

// ========== 차단 IP 목록 ==========
export const blockedIps = pgTable("blocked_ips", {
  id: serial("id").primaryKey(),
  ipAddress: text("ip_address").notNull(),
  reason: text("reason").notNull(),
  blockedBy: text("blocked_by"),                    // 차단한 admin 이름
  accessCount: integer("access_count").default(0),  // 차단 전 접속 횟수
  isActive: boolean("is_active").default(true),
  blockedAt: timestamp("blocked_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  expiresAt: timestamp("expires_at"),               // null이면 영구 차단
});

export type BlockedIp = typeof blockedIps.$inferSelect;
export type InsertBlockedIp = typeof blockedIps.$inferInsert;

// ========== 보안조치 이력 ==========
export const securityRemediations = pgTable("security_remediations", {
  id: serial("id").primaryKey(),
  actionType: text("action_type").notNull(),       // 'encrypt-keys' | 'block-ip' | 'cleanup-logs' | 'force-reencrypt'
  status: text("status").notNull(),                 // 'success' | 'partial' | 'failed'
  summary: text("summary").notNull(),
  details: text("details").notNull(),               // 상세 JSON
  affectedCount: integer("affected_count").default(0),
  executedBy: text("executed_by"),
  executedAt: timestamp("executed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type SecurityRemediation = typeof securityRemediations.$inferSelect;
export type InsertSecurityRemediation = typeof securityRemediations.$inferInsert;

// ========== 시스템 자동매매 설정 (관리자 - DB 기반, 양쪽 프로젝트 공유) ==========
export const systemTradingConfig = pgTable("system_trading_config", {
  id: serial("id").primaryKey(),
  broker: text("broker").default("kis"),
  appKey: text("app_key").notNull(),
  appSecret: text("app_secret").notNull(),
  accountNo: text("account_no").notNull(),
  accountProductCd: text("account_product_cd").default("01"),
  mockTrading: boolean("mock_trading").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type SystemTradingConfig = typeof systemTradingConfig.$inferSelect;
export type InsertSystemTradingConfig = typeof systemTradingConfig.$inferInsert;

// ========== 자동매매 스킬 레지스트리 ==========

// 스킬 템플릿 (시스템 빌트인 + 사용자 커스텀)
export const tradingSkills = pgTable("trading_skills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),                       // 스킬 이름 (예: "골든크로스 매수")
  skillCode: text("skill_code").notNull().unique(),   // 고유 코드 (예: "golden_cross")
  category: text("category").notNull(),               // "entry" | "exit" | "signal" | "risk"
  description: text("description"),                   // 스킬 설명
  icon: text("icon"),                                 // 이모지 아이콘
  paramsSchema: text("params_schema"),                // JSON: 파라미터 정의 스키마
  defaultParams: text("default_params"),              // JSON: 기본 파라미터 값
  isBuiltin: boolean("is_builtin").default(true),     // 시스템 기본 제공 여부
  isEnabled: boolean("is_enabled").default(true),     // 전역 활성화 여부
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type TradingSkill = typeof tradingSkills.$inferSelect;
export type InsertTradingSkill = typeof tradingSkills.$inferInsert;

// 사용자 스킬 인스턴스 (스킬을 종목에 적용한 설정)
export const userSkillInstances = pgTable("user_skill_instances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  skillId: integer("skill_id").notNull(),             // references trading_skills
  label: text("label"),                               // 사용자 별칭 (예: "삼성전자 골든크로스")
  stockCode: text("stock_code"),                      // 종목코드 (null이면 전체 대상)
  stockName: text("stock_name"),                      // 종목명
  params: text("params"),                             // JSON: 사용자 설정 파라미터
  quantity: integer("quantity").default(0),            // 주문 수량
  orderMethod: text("order_method").default("limit"), // "market" | "limit"
  isActive: boolean("is_active").default(true),       // 활성화 여부
  priority: integer("priority").default(0),           // 실행 우선순위 (낮을수록 우선)
  status: text("status").default("active"),           // "active" | "triggered" | "paused" | "completed" | "error"
  lastCheckedAt: timestamp("last_checked_at"),        // 마지막 조건 체크 시간
  triggeredAt: timestamp("triggered_at"),             // 발동 시간
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type UserSkillInstance = typeof userSkillInstances.$inferSelect;
export type InsertUserSkillInstance = typeof userSkillInstances.$inferInsert;

// 스킬 실행 로그
export const skillExecutionLogs = pgTable("skill_execution_logs", {
  id: serial("id").primaryKey(),
  instanceId: integer("instance_id").notNull(),       // references user_skill_instances
  userId: integer("user_id").notNull(),
  skillCode: text("skill_code").notNull(),
  stockCode: text("stock_code"),
  stockName: text("stock_name"),
  action: text("action").notNull(),                   // "check" | "trigger" | "order" | "error"
  detail: text("detail"),                             // 실행 상세 설명
  currentPrice: numeric("current_price"),             // 체크 시점 현재가
  indicatorValues: text("indicator_values"),          // JSON: 지표 값들 (rsi, ma, macd 등)
  orderResult: text("order_result"),                  // JSON: 주문 결과
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type SkillExecutionLog = typeof skillExecutionLogs.$inferSelect;
export type InsertSkillExecutionLog = typeof skillExecutionLogs.$inferInsert;

// ========== 멀티팩터 전략 ==========

export const multiFactorStrategy = pgTable("multi_factor_strategy", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull().default("멀티팩터 전략"),
  isActive: boolean("is_active").default(false),
  universeType: text("universe_type").default("both"),
  // 팩터 가중치 (합계 100)
  weightMa: integer("weight_ma").default(30),
  weightRsi: integer("weight_rsi").default(20),
  weightBollinger: integer("weight_bollinger").default(20),
  weightVolume: integer("weight_volume").default(15),
  weightGap: integer("weight_gap").default(15),
  // 팩터 파라미터
  rsiPeriod: integer("rsi_period").default(14),
  rsiBuyThreshold: integer("rsi_buy_threshold").default(30),
  rsiSellThreshold: integer("rsi_sell_threshold").default(70),
  bollingerPeriod: integer("bollinger_period").default(20),
  bollingerMult: numeric("bollinger_mult").default("2"),
  volumeTopN: integer("volume_top_n").default(50),
  minGapPercent: numeric("min_gap_percent").default("2"),
  maxGapPercent: numeric("max_gap_percent").default("8"),
  // 매수/매도 신호 임계값
  buyScoreThreshold: integer("buy_score_threshold").default(70),
  sellScoreThreshold: integer("sell_score_threshold").default(30),
  // 분할매수
  firstBuyRatio: integer("first_buy_ratio").default(40),
  addBuyRatio: integer("add_buy_ratio").default(30),
  addBuyTriggerPercent: numeric("add_buy_trigger_percent").default("2"),
  // 리스크 관리
  stopLossPercent: numeric("stop_loss_percent").default("5"),
  takeProfitPercent: numeric("take_profit_percent").default("10"),
  maxPositionRatio: integer("max_position_ratio").default(50),
  maxStocksCount: integer("max_stocks_count").default(5),
  // 캐시
  candidates: text("candidates"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertMultiFactorStrategySchema = createInsertSchema(multiFactorStrategy).omit({ id: true, createdAt: true, updatedAt: true });
export type MultiFactorStrategy = typeof multiFactorStrategy.$inferSelect;
export type InsertMultiFactorStrategy = z.infer<typeof insertMultiFactorStrategySchema>;

export const multiFactorPositions = pgTable("multi_factor_positions", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id").notNull(),
  userId: integer("user_id").notNull(),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  status: text("status").default("signal_detected"),
  signalScore: numeric("signal_score"),
  targetAmount: numeric("target_amount"),
  totalBuyQty: integer("total_buy_qty").default(0),
  totalBuyAmount: numeric("total_buy_amount").default("0"),
  avgBuyPrice: numeric("avg_buy_price"),
  buyPhase: integer("buy_phase").default(0),
  lastBuyPrice: numeric("last_buy_price"),
  sellPrice: numeric("sell_price"),
  sellQty: integer("sell_qty"),
  sellAmount: numeric("sell_amount"),
  profitLoss: numeric("profit_loss"),
  profitRate: numeric("profit_rate"),
  factorDetails: text("factor_details"),
  ma5: numeric("ma5"),
  ma20: numeric("ma20"),
  rsi: numeric("rsi"),
  bollingerUpper: numeric("bollinger_upper"),
  bollingerLower: numeric("bollinger_lower"),
  openedAt: timestamp("opened_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  closedAt: timestamp("closed_at"),
});

export const insertMultiFactorPositionSchema = createInsertSchema(multiFactorPositions).omit({ id: true, openedAt: true });
export type MultiFactorPosition = typeof multiFactorPositions.$inferSelect;
export type InsertMultiFactorPosition = z.infer<typeof insertMultiFactorPositionSchema>;

export const multiFactorLogs = pgTable("multi_factor_logs", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id").notNull(),
  positionId: integer("position_id"),
  action: text("action").notNull(),
  stockCode: text("stock_code"),
  stockName: text("stock_name"),
  detail: text("detail"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertMultiFactorLogSchema = createInsertSchema(multiFactorLogs).omit({ id: true, createdAt: true });
export type MultiFactorLog = typeof multiFactorLogs.$inferSelect;
export type InsertMultiFactorLog = z.infer<typeof insertMultiFactorLogSchema>;
