import { pgTable, text, serial, numeric, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
export * from "./models/chat.js";
const etfTrends = pgTable("etf_trends", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title"),
  comment: text("comment"),
  thumbnail: text("thumbnail"),
  sourceType: text("source_type"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const insertEtfTrendSchema = createInsertSchema(etfTrends).omit({ id: true, createdAt: true });
const autoTradeRules = pgTable("auto_trade_rules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  name: text("name").notNull(),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  ruleType: text("rule_type").notNull(),
  // 'buy_below' | 'sell_above' | 'trailing_stop'
  targetPrice: numeric("target_price").notNull(),
  quantity: integer("quantity").notNull(),
  orderMethod: text("order_method").default("limit"),
  // 'market' | 'limit'
  isActive: boolean("is_active").default(true),
  status: text("status").default("active"),
  // 'active' | 'executed' | 'cancelled' | 'failed'
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const insertAutoTradeRuleSchema = createInsertSchema(autoTradeRules).omit({ id: true, createdAt: true });
const tradingOrders = pgTable("trading_orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name"),
  orderType: text("order_type").notNull(),
  // 'buy' | 'sell'
  orderMethod: text("order_method").default("limit"),
  // 'market' | 'limit'
  quantity: integer("quantity").notNull(),
  price: numeric("price"),
  totalAmount: numeric("total_amount"),
  status: text("status").default("pending"),
  // 'pending' | 'filled' | 'cancelled' | 'failed'
  kisOrderNo: text("kis_order_no"),
  autoTradeRuleId: integer("auto_trade_rule_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  executedAt: timestamp("executed_at")
});
const insertTradingOrderSchema = createInsertSchema(tradingOrders).omit({ id: true, createdAt: true });
const users = pgTable("users", {
  id: serial("id").primaryKey(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  picture: text("picture"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const userTradingConfigs = pgTable("user_trading_configs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  // 유저당 1개
  appKey: text("app_key").notNull(),
  appSecret: text("app_secret").notNull(),
  accountNo: text("account_no").notNull(),
  // 계좌번호 앞 8자리
  accountProductCd: text("account_product_cd").default("01"),
  // 뒤 2자리
  mockTrading: boolean("mock_trading").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const insertUserTradingConfigSchema = createInsertSchema(userTradingConfigs).omit({ id: true, createdAt: true, updatedAt: true });
const stopLossOrders = pgTable("stop_loss_orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name"),
  buyPrice: numeric("buy_price").notNull(),
  // 매수가 (기준가)
  quantity: integer("quantity").notNull(),
  // 매도 수량
  stopLossPercent: numeric("stop_loss_percent").notNull(),
  // 손절 비율(%)
  stopType: text("stop_type").notNull().default("simple"),
  // 'simple' | 'trailing'
  stopPrice: numeric("stop_price").notNull(),
  // 현재 손절 기준가 (트레일링 시 동적 갱신)
  highestPrice: numeric("highest_price"),
  // 트레일링 스탑: 최고가 추적
  status: text("status").default("active"),
  // 'active' | 'triggered' | 'cancelled' | 'error'
  kisOrderNo: text("kis_order_no"),
  // 감시 발동 시 KIS 주문번호
  triggerPrice: numeric("trigger_price"),
  // 실제 발동 시점의 가격
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  triggeredAt: timestamp("triggered_at")
});
const insertStopLossOrderSchema = createInsertSchema(stopLossOrders).omit({ id: true, createdAt: true });
const savedEtfs = pgTable("saved_etfs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  etfCode: text("etf_code").notNull(),
  etfName: text("etf_name").notNull(),
  category: text("category"),
  // ETF 카테고리 (국내주식, 해외주식 등)
  assetManager: text("asset_manager"),
  // 운용사
  listingDate: text("listing_date"),
  // 상장일
  totalAsset: text("total_asset"),
  // 순자산총액
  expense: text("expense"),
  // 총보수
  benchmark: text("benchmark"),
  // 기초지수
  recentPrice: text("recent_price"),
  // 최근 가격
  recentChange: text("recent_change"),
  // 최근 등락률
  portfolioData: text("portfolio_data"),
  // 포트폴리오 구성 JSON
  comment: text("comment"),
  // 사용자 코멘트
  relatedLinks: text("related_links"),
  // 관련문서 링크 JSON [{title, url}]
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const insertSavedEtfSchema = createInsertSchema(savedEtfs).omit({ id: true, createdAt: true, updatedAt: true });
const watchlistEtfs = pgTable("watchlist_etfs", {
  id: serial("id").primaryKey(),
  etfCode: text("etf_code").notNull(),
  etfName: text("etf_name").notNull(),
  sector: text("sector").default("\uAE30\uBCF8"),
  // 섹터/카테고리 분류
  memo: text("memo"),
  // 간단 메모
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const insertWatchlistEtfSchema = createInsertSchema(watchlistEtfs).omit({ id: true, createdAt: true });
const satelliteEtfs = pgTable("satellite_etfs", {
  id: serial("id").primaryKey(),
  etfCode: text("etf_code").notNull(),
  etfName: text("etf_name").notNull(),
  sector: text("sector").default("\uAE30\uBCF8"),
  memo: text("memo"),
  listType: text("list_type").default("common"),
  // 'common' (공통관심) | 'personal' (개인관심)
  userId: integer("user_id"),
  // 개인관심일 때 사용자 ID (null이면 공통)
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const insertSatelliteEtfSchema = createInsertSchema(satelliteEtfs).omit({ id: true, createdAt: true });
const notices = pgTable("notices", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const insertNoticeSchema = createInsertSchema(notices).omit({ id: true, createdAt: true, updatedAt: true });
const steemPosts = pgTable("steem_posts", {
  id: serial("id").primaryKey(),
  author: text("author").notNull(),
  // 스팀 계정명
  permlink: text("permlink").notNull(),
  // 포스트 URL slug
  title: text("title").notNull(),
  body: text("body").notNull(),
  // 마크다운 본문
  tags: text("tags").notNull(),
  // JSON array of tags
  category: text("category").default("kr"),
  // 메인 카테고리/첫번째 태그
  status: text("status").default("published"),
  // 'draft' | 'published' | 'failed'
  steemUrl: text("steem_url"),
  // steemit.com URL
  txId: text("tx_id"),
  // 블록체인 트랜잭션 ID
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const insertSteemPostSchema = createInsertSchema(steemPosts).omit({ id: true, createdAt: true });
const aiReports = pgTable("ai_reports", {
  id: serial("id").primaryKey(),
  analysis: text("analysis").notNull(),
  // AI 분석 내용
  analyzedAt: text("analyzed_at").notNull(),
  // 분석 시점 (KST 문자열)
  savedAt: text("saved_at").notNull(),
  // 저장 시점 (KST 문자열)
  items: text("items").notNull(),
  // 분석에 사용된 항목 JSON [{ title, source, date }]
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const insertAiReportSchema = createInsertSchema(aiReports).omit({ id: true, createdAt: true });
const strategyReports = pgTable("strategy_reports", {
  id: serial("id").primaryKey(),
  period: text("period").notNull(),
  // "daily" | "weekly" | "monthly" | "yearly"
  title: text("title").notNull(),
  // 보고서 제목
  periodLabel: text("period_label").notNull(),
  // "일일" | "주간" | "월간" | "연간"
  reportData: text("report_data").notNull(),
  // MarketReport JSON
  userId: integer("user_id"),
  // 생성자 ID (null=admin 기존 데이터)
  createdBy: text("created_by"),
  // 생성자 이름
  isShared: boolean("is_shared").default(true),
  // 공유 여부 (기본 공유)
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const insertStrategyReportSchema = createInsertSchema(strategyReports).omit({ id: true, createdAt: true });
const strategyAnalyses = pgTable("strategy_analyses", {
  id: serial("id").primaryKey(),
  period: text("period").notNull(),
  // "daily" | "weekly" | "monthly" | "yearly"
  prompt: text("prompt").notNull(),
  // AI 프롬프트
  urls: text("urls").notNull(),
  // URL 목록 JSON
  fileNames: text("file_names").notNull(),
  // 파일 이름 목록 JSON
  source: text("source"),
  // "strategy" | "etf-realtime"
  analysisResult: text("analysis_result").notNull(),
  // AiAnalysisResult JSON
  userId: integer("user_id"),
  // 생성자 ID (null=admin 기존 데이터)
  createdBy: text("created_by"),
  // 생성자 이름
  isShared: boolean("is_shared").default(true),
  // 공유 여부 (기본 공유)
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const insertStrategyAnalysisSchema = createInsertSchema(strategyAnalyses).omit({ id: true, createdAt: true });
const gapStrategy = pgTable("gap_strategy", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull().default("\uC2DC\uAC00\uAE09\uB4F1 \uCD94\uC138\uCD94\uC885"),
  isActive: boolean("is_active").default(false),
  // 매수 조건
  universeType: text("universe_type").default("both"),
  // 'kospi200' | 'kosdaq150' | 'both'
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
  candidates: text("candidates"),
  // JSON string of stock codes
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const insertGapStrategySchema = createInsertSchema(gapStrategy).omit({ id: true, createdAt: true, updatedAt: true });
const gapStrategyPositions = pgTable("gap_strategy_positions", {
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
  closedAt: timestamp("closed_at")
});
const insertGapStrategyPositionSchema = createInsertSchema(gapStrategyPositions).omit({ id: true, openedAt: true });
const gapStrategyLogs = pgTable("gap_strategy_logs", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id").notNull(),
  positionId: integer("position_id"),
  action: text("action").notNull(),
  stockCode: text("stock_code"),
  stockName: text("stock_name"),
  detail: text("detail"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const insertGapStrategyLogSchema = createInsertSchema(gapStrategyLogs).omit({ id: true, createdAt: true });
const watchlistStocks = pgTable("watchlist_stocks", {
  id: serial("id").primaryKey(),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  market: text("market").default("domestic"),
  // 'domestic' | 'overseas'
  exchange: text("exchange"),
  // KOSPI, KOSDAQ, NYSE, NASDAQ 등
  sector: text("sector").default("\uAE30\uBCF8"),
  memo: text("memo"),
  listType: text("list_type").default("common"),
  // 'common' (공통관심) | 'personal' (개인관심)
  userId: integer("user_id"),
  // 개인관심일 때 사용자 ID (null이면 공통)
  isShared: boolean("is_shared").default(false),
  // 개인관심 종목 공유 여부 (true면 모든 계정에 공유 목록으로 표시)
  sharedBy: text("shared_by"),
  // 공유한 사용자 이름
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const insertWatchlistStockSchema = createInsertSchema(watchlistStocks).omit({ id: true, createdAt: true });
const stockComments = pgTable("stock_comments", {
  id: serial("id").primaryKey(),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name"),
  market: text("market").default("domestic"),
  // 'domestic' | 'overseas'
  userId: integer("user_id"),
  userName: text("user_name"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const qnaPosts = pgTable("qna_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  userName: text("user_name"),
  userEmail: text("user_email"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").default("general"),
  // 'improvement' | 'question' | 'general'
  replyCount: integer("reply_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const qnaReplies = pgTable("qna_replies", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: integer("user_id"),
  userName: text("user_name"),
  userEmail: text("user_email"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const bookmarks = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  title: text("title").notNull(),
  url: text("url").notNull(),
  section: text("section").default("\uAE30\uBCF8"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const insertBookmarkSchema = createInsertSchema(bookmarks).omit({ id: true, createdAt: true });
const tenbaggerStocks = pgTable("tenbagger_stocks", {
  id: serial("id").primaryKey(),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  market: text("market").default("domestic"),
  // 'domestic' | 'overseas'
  exchange: text("exchange"),
  // KOSPI, KOSDAQ, NYSE, NASDAQ 등
  sector: text("sector").default("\uAE30\uBCF8"),
  memo: text("memo"),
  targetPrice: text("target_price"),
  // 목표가
  buyPrice: text("buy_price"),
  // 매수가
  reason: text("reason"),
  // 선정 사유
  aiAnalysis: text("ai_analysis"),
  // AI 분석 결과
  aiAnalyzedAt: timestamp("ai_analyzed_at"),
  // AI 분석 일시
  listType: text("list_type").default("common"),
  // 'common' (공통관심) | 'personal' (개인관심)
  userId: integer("user_id"),
  // 개인관심일 때 사용자 ID (null이면 공통)
  isShared: boolean("is_shared").default(false),
  // 개인관심 종목 공유 여부 (true면 모든 계정에 공유 목록으로 표시)
  sharedBy: text("shared_by"),
  // 공유한 사용자 이름
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const insertTenbaggerStockSchema = createInsertSchema(tenbaggerStocks).omit({ id: true, createdAt: true });
const stockAiAnalyses = pgTable("stock_ai_analyses", {
  id: serial("id").primaryKey(),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  market: text("market").default("domestic"),
  // 'domestic' | 'overseas'
  exchange: text("exchange"),
  analysisResult: text("analysis_result").notNull(),
  summary: text("summary"),
  // 한줄 요약
  rating: text("rating"),
  // '강력매수' | '매수' | '중립' | '매도' | '강력매도'
  userId: integer("user_id"),
  userName: text("user_name"),
  isPublic: boolean("is_public").default(true),
  // true: 공개(모두 볼 수 있음), false: 비공개(본인만)
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const userAiConfigs = pgTable("user_ai_configs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  aiProvider: text("ai_provider").default("gemini"),
  // "gemini" | "openai"
  geminiApiKey: text("gemini_api_key"),
  openaiApiKey: text("openai_api_key"),
  useOwnKey: boolean("use_own_key").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const aiPrompts = pgTable("ai_prompts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").default("\uC77C\uBC18"),
  // 프롬프트 카테고리
  isDefault: boolean("is_default").default(false),
  // 기본(공통) 프롬프트 여부
  isShared: boolean("is_shared").default(false),
  // 공유 프롬프트 여부
  sharedBy: text("shared_by"),
  // 공유한 사용자 이름
  userId: integer("user_id"),
  // 개인 프롬프트일 때 사용자 ID
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const visitLogs = pgTable("visit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  userEmail: text("user_email"),
  userName: text("user_name"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  page: text("page").default("/"),
  // 접속 페이지
  sessionId: text("session_id"),
  // 세션 식별자
  visitedAt: timestamp("visited_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const securityAuditLogs = pgTable("security_audit_logs", {
  id: serial("id").primaryKey(),
  auditType: text("audit_type").notNull(),
  // 'scheduled' | 'manual'
  status: text("status").notNull(),
  // 'pass' | 'warning' | 'critical'
  summary: text("summary").notNull(),
  // 점검 요약
  details: text("details").notNull(),
  // 상세 결과 JSON
  totalChecks: integer("total_checks").default(0),
  passedChecks: integer("passed_checks").default(0),
  warningChecks: integer("warning_checks").default(0),
  criticalChecks: integer("critical_checks").default(0),
  executedAt: timestamp("executed_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
const securityDrillResults = pgTable("security_drill_results", {
  id: serial("id").primaryKey(),
  drillType: text("drill_type").notNull(),
  // 'full' | 'auth' | 'injection' | 'api'
  status: text("status").notNull(),
  // 'pass' | 'warning' | 'fail'
  summary: text("summary").notNull(),
  details: text("details").notNull(),
  // 상세 결과 JSON
  totalTests: integer("total_tests").default(0),
  passedTests: integer("passed_tests").default(0),
  failedTests: integer("failed_tests").default(0),
  duration: integer("duration").default(0),
  // 실행시간(ms)
  executedBy: text("executed_by"),
  // 실행한 admin 이름
  executedAt: timestamp("executed_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
export {
  aiPrompts,
  aiReports,
  autoTradeRules,
  bookmarks,
  etfTrends,
  gapStrategy,
  gapStrategyLogs,
  gapStrategyPositions,
  insertAiReportSchema,
  insertAutoTradeRuleSchema,
  insertBookmarkSchema,
  insertEtfTrendSchema,
  insertGapStrategyLogSchema,
  insertGapStrategyPositionSchema,
  insertGapStrategySchema,
  insertNoticeSchema,
  insertSatelliteEtfSchema,
  insertSavedEtfSchema,
  insertSteemPostSchema,
  insertStopLossOrderSchema,
  insertStrategyAnalysisSchema,
  insertStrategyReportSchema,
  insertTenbaggerStockSchema,
  insertTradingOrderSchema,
  insertUserTradingConfigSchema,
  insertWatchlistEtfSchema,
  insertWatchlistStockSchema,
  notices,
  qnaPosts,
  qnaReplies,
  satelliteEtfs,
  savedEtfs,
  securityAuditLogs,
  securityDrillResults,
  steemPosts,
  stockAiAnalyses,
  stockComments,
  stopLossOrders,
  strategyAnalyses,
  strategyReports,
  tenbaggerStocks,
  tradingOrders,
  userAiConfigs,
  userTradingConfigs,
  users,
  visitLogs,
  watchlistEtfs,
  watchlistStocks
};
