import { db, executeWithClient } from "./db.js";
import {
  etfTrends,
  autoTradeRules,
  tradingOrders,
  bookmarks,
  users,
  userTradingConfigs,
  stopLossOrders,
  savedEtfs,
  watchlistEtfs,
  satelliteEtfs,
  notices,
  steemPosts,
  aiReports,
  type EtfTrend,
  type InsertEtfTrend,
  type AutoTradeRule,
  type InsertAutoTradeRule,
  type TradingOrder,
  type InsertTradingOrder,
  type Bookmark,
  type InsertBookmark,
  type User,
  type InsertUser,
  type UserTradingConfig,
  type InsertUserTradingConfig,
  type StopLossOrder,
  type InsertStopLossOrder,
  type SavedEtf,
  type InsertSavedEtf,
  type WatchlistEtf,
  type InsertWatchlistEtf,
  type SatelliteEtf,
  type InsertSatelliteEtf,
  type Notice,
  type InsertNotice,
  type SteemPost,
  type InsertSteemPost,
  type AiReport,
  type InsertAiReport,
  watchlistStocks,
  type WatchlistStock,
  type InsertWatchlistStock,
  gapStrategy,
  gapStrategyPositions,
  gapStrategyLogs,
  type GapStrategy,
  type InsertGapStrategy,
  type GapStrategyPosition,
  type InsertGapStrategyPosition,
  type GapStrategyLog,
  type InsertGapStrategyLog,
  stockComments,
  type StockComment,
  type InsertStockComment,
  qnaPosts,
  qnaReplies,
  type QnaPost,
  type InsertQnaPost,
  type QnaReply,
  type InsertQnaReply,
  tenbaggerStocks,
  type TenbaggerStock,
  type InsertTenbaggerStock,
  stockAiAnalyses,
  type StockAiAnalysis,
  type InsertStockAiAnalysis,
  userAiConfigs,
  type UserAiConfig,
  type InsertUserAiConfig,
  aiPrompts,
  type AiPrompt,
  type InsertAiPrompt,
  visitLogs,
  type VisitLog,
  type InsertVisitLog,
  strategyReports,
  strategyAnalyses,
  type StrategyReport,
  type InsertStrategyReport,
  type StrategyAnalysis,
  type InsertStrategyAnalysis,
  securityAuditLogs,
  type SecurityAuditLog,
  type InsertSecurityAuditLog,
  securityDrillResults,
  type SecurityDrillResult,
  type InsertSecurityDrillResult,
  blockedIps,
  type BlockedIp,
  type InsertBlockedIp,
  securityRemediations,
  type SecurityRemediation,
  type InsertSecurityRemediation,
  userLinkedAccounts,
  type UserLinkedAccount,
  type InsertUserLinkedAccount,
  tradingSkills,
  type TradingSkill,
  type InsertTradingSkill,
  userSkillInstances,
  type UserSkillInstance,
  type InsertUserSkillInstance,
  skillExecutionLogs,
  type SkillExecutionLog,
  type InsertSkillExecutionLog,
  systemTradingConfig,
  type SystemTradingConfig,
  keyResearch,
  type KeyResearchItem,
  notionConfig,
  type NotionConfig,
  multiFactorStrategy,
  multiFactorPositions,
  multiFactorLogs,
  type MultiFactorStrategy,
  type InsertMultiFactorStrategy,
  type MultiFactorPosition,
  type InsertMultiFactorPosition,
  type MultiFactorLog,
  type InsertMultiFactorLog,
} from "../shared/schema.js";
import { eq, and, or, desc, isNull, inArray, sql } from "drizzle-orm";

export interface IStorage {
  // ETF Trends
  getEtfTrends(): Promise<EtfTrend[]>;
  getEtfTrend(id: number): Promise<EtfTrend | undefined>;
  createEtfTrend(trend: InsertEtfTrend): Promise<EtfTrend>;
  updateEtfTrend(id: number, comment: string): Promise<EtfTrend>;
  deleteEtfTrend(id: number): Promise<void>;
  
  // Trading - Auto Trade Rules
  getAutoTradeRules(userId?: number): Promise<AutoTradeRule[]>;
  getAutoTradeRule(id: number): Promise<AutoTradeRule | undefined>;
  getActiveAutoTradeRules(userId?: number): Promise<AutoTradeRule[]>;
  createAutoTradeRule(rule: InsertAutoTradeRule): Promise<AutoTradeRule>;
  updateAutoTradeRule(id: number, updates: Partial<InsertAutoTradeRule>): Promise<AutoTradeRule>;
  deleteAutoTradeRule(id: number): Promise<void>;
  
  // Trading - Orders
  getTradingOrders(limit?: number, userId?: number): Promise<TradingOrder[]>;
  createTradingOrder(order: InsertTradingOrder): Promise<TradingOrder>;
  updateTradingOrder(id: number, updates: Partial<InsertTradingOrder>): Promise<TradingOrder>;

  // Bookmarks
  getBookmarks(userId?: number): Promise<Bookmark[]>;
  getBookmarkById(id: number): Promise<Bookmark | undefined>;
  createBookmark(bookmark: InsertBookmark): Promise<Bookmark>;
  updateBookmark(id: number, updates: Partial<InsertBookmark>): Promise<Bookmark>;
  deleteBookmark(id: number): Promise<void>;

  // Users
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUsers(): Promise<User[]>;

  // System Trading Config (관리자 시스템 기본 - DB 기반)
  getSystemTradingConfig(): Promise<SystemTradingConfig | undefined>;
  upsertSystemTradingConfig(data: Partial<SystemTradingConfig>): Promise<SystemTradingConfig>;

  // User Trading Configs (멀티 API)
  getUserTradingConfig(userId: number): Promise<UserTradingConfig | undefined>;  // 활성 설정 반환 (호환성)
  getUserTradingConfigs(userId: number): Promise<UserTradingConfig[]>;           // 전체 목록
  createTradingConfig(config: InsertUserTradingConfig): Promise<UserTradingConfig>;
  updateTradingConfig(id: number, userId: number, updates: Partial<InsertUserTradingConfig>): Promise<UserTradingConfig>;
  deleteTradingConfig(id: number, userId: number): Promise<void>;
  setActiveTradingConfig(id: number, userId: number): Promise<void>;
  deactivateAllTradingConfigs(userId: number): Promise<void>;
  upsertUserTradingConfig(config: InsertUserTradingConfig): Promise<UserTradingConfig>; // 호환성 유지
  deleteUserTradingConfig(userId: number): Promise<void>; // 호환성 유지

  // User AI Configs (멀티 API)
  getUserAiConfigs(userId: number): Promise<UserAiConfig[]>;
  createAiConfig(data: InsertUserAiConfig): Promise<UserAiConfig>;
  updateAiConfig(id: number, userId: number, updates: Partial<InsertUserAiConfig>): Promise<UserAiConfig>;
  deleteAiConfig(id: number, userId: number): Promise<void>;
  setActiveAiConfig(id: number, userId: number): Promise<void>;

  // Google 계정 연결
  getLinkedAccounts(primaryUserId: number): Promise<UserLinkedAccount[]>;
  linkAccount(data: InsertUserLinkedAccount): Promise<UserLinkedAccount>;
  unlinkAccount(id: number, primaryUserId: number): Promise<void>;

  // Stop Loss Orders
  getStopLossOrders(userId?: number): Promise<StopLossOrder[]>;
  getActiveStopLossOrders(): Promise<StopLossOrder[]>;
  createStopLossOrder(order: InsertStopLossOrder): Promise<StopLossOrder>;
  updateStopLossOrder(id: number, updates: Partial<InsertStopLossOrder>): Promise<StopLossOrder>;
  cancelStopLossOrder(id: number): Promise<void>;

  // Watchlist ETFs (관심/추천 ETF)
  getWatchlistEtfs(): Promise<WatchlistEtf[]>;
  createWatchlistEtf(data: InsertWatchlistEtf): Promise<WatchlistEtf>;
  updateWatchlistEtf(id: number, updates: Partial<InsertWatchlistEtf>): Promise<WatchlistEtf>;
  deleteWatchlistEtf(id: number): Promise<void>;

  // Satellite ETFs
  getSatelliteEtfs(listType?: string, userId?: number): Promise<SatelliteEtf[]>;
  createSatelliteEtf(data: InsertSatelliteEtf): Promise<SatelliteEtf>;
  updateSatelliteEtf(id: number, updates: Partial<InsertSatelliteEtf>): Promise<SatelliteEtf>;
  deleteSatelliteEtf(id: number): Promise<void>;

  // Notices (공지사항)
  getNotices(): Promise<Notice[]>;
  getActiveNotices(): Promise<Notice[]>;
  createNotice(data: InsertNotice): Promise<Notice>;
  updateNotice(id: number, updates: Partial<InsertNotice>): Promise<Notice>;
  deleteNotice(id: number): Promise<void>;

  // Steem Posts (스팀 포스팅)
  getSteemPosts(limit?: number): Promise<SteemPost[]>;
  getSteemPost(id: number): Promise<SteemPost | undefined>;
  createSteemPost(data: InsertSteemPost): Promise<SteemPost>;
  updateSteemPost(id: number, updates: Partial<InsertSteemPost>): Promise<SteemPost>;
  deleteSteemPost(id: number): Promise<void>;

  // Key Research (주요 리서치 - DB 영속)
  getKeyResearch(limit?: number): Promise<KeyResearchItem[]>;
  saveKeyResearch(items: Array<{ title: string; link: string; source: string; date: string; file: string }>): Promise<void>;
  deleteKeyResearch(id: number): Promise<void>;

  // Notion Config (사용자별, 용도별)
  getNotionConfig(userId: number, purpose?: string): Promise<NotionConfig | null>;
  getAllNotionConfigs(userId: number): Promise<NotionConfig[]>;
  saveNotionConfig(userId: number, apiKey: string, databaseId: string, purpose?: string): Promise<void>;
  deleteNotionConfig(userId: number, purpose?: string): Promise<void>;

  // AI Reports (AI 분석 보고서)
  getAiReports(limit?: number): Promise<AiReport[]>;
  getAiReport(id: number): Promise<AiReport | undefined>;
  createAiReport(data: InsertAiReport): Promise<AiReport>;
  deleteAiReport(id: number): Promise<void>;

  // Strategy Reports (전략 보고서 - 일일/주간/월간/연간)
  getStrategyReports(period: string, limit?: number): Promise<StrategyReport[]>;
  createStrategyReport(data: InsertStrategyReport): Promise<StrategyReport>;
  deleteStrategyReport(id: number): Promise<void>;
  updateStrategyReportShared(id: number, isShared: boolean): Promise<void>;

  // Strategy Analyses (전략 AI 분석)
  getStrategyAnalyses(period: string, limit?: number): Promise<StrategyAnalysis[]>;
  createStrategyAnalysis(data: InsertStrategyAnalysis): Promise<StrategyAnalysis>;
  deleteStrategyAnalysis(id: number): Promise<void>;
  updateStrategyAnalysisShared(id: number, isShared: boolean): Promise<void>;

  // Watchlist Stocks (관심종목)
  getWatchlistStocks(market?: string, listType?: string, userId?: number): Promise<WatchlistStock[]>;
  getWatchlistStocksShared(market?: string): Promise<WatchlistStock[]>;
  getWatchlistStock(id: number): Promise<WatchlistStock | undefined>;
  createWatchlistStock(data: InsertWatchlistStock): Promise<WatchlistStock>;
  updateWatchlistStock(id: number, updates: Partial<InsertWatchlistStock>): Promise<WatchlistStock>;
  deleteWatchlistStock(id: number): Promise<void>;

  // Gap Strategy (시가급등 추세추종)
  getGapStrategy(userId: number): Promise<GapStrategy | undefined>;
  upsertGapStrategy(data: InsertGapStrategy): Promise<GapStrategy>;
  updateGapStrategy(id: number, updates: Partial<InsertGapStrategy>): Promise<GapStrategy>;
  deleteGapStrategy(id: number): Promise<void>;
  getAllActiveGapStrategies(): Promise<GapStrategy[]>;

  // Gap Strategy Positions
  getGapPositions(strategyId: number): Promise<GapStrategyPosition[]>;
  getActiveGapPositions(strategyId: number): Promise<GapStrategyPosition[]>;
  getGapPosition(id: number): Promise<GapStrategyPosition | undefined>;
  createGapPosition(data: InsertGapStrategyPosition): Promise<GapStrategyPosition>;
  updateGapPosition(id: number, updates: Partial<InsertGapStrategyPosition>): Promise<GapStrategyPosition>;

  // Gap Strategy Logs
  getGapLogs(strategyId: number, limit?: number): Promise<GapStrategyLog[]>;
  createGapLog(data: InsertGapStrategyLog): Promise<GapStrategyLog>;

  // Multi-Factor Strategy (멀티팩터 전략)
  getMultiFactorStrategy(userId: number): Promise<MultiFactorStrategy | undefined>;
  upsertMultiFactorStrategy(data: InsertMultiFactorStrategy): Promise<MultiFactorStrategy>;
  updateMultiFactorStrategy(id: number, updates: Partial<InsertMultiFactorStrategy>): Promise<MultiFactorStrategy>;
  getMultiFactorPositions(strategyId: number): Promise<MultiFactorPosition[]>;
  getActiveMultiFactorPositions(strategyId: number): Promise<MultiFactorPosition[]>;
  createMultiFactorPosition(data: InsertMultiFactorPosition): Promise<MultiFactorPosition>;
  updateMultiFactorPosition(id: number, updates: Partial<InsertMultiFactorPosition>): Promise<MultiFactorPosition>;
  getMultiFactorLogs(strategyId: number, limit?: number): Promise<MultiFactorLog[]>;
  createMultiFactorLog(data: InsertMultiFactorLog): Promise<MultiFactorLog>;

  // Stock Comments (종목 코멘트)
  getStockComments(stockCode: string, market?: string): Promise<StockComment[]>;
  getStockComment(id: number): Promise<StockComment | undefined>;
  createStockComment(data: InsertStockComment): Promise<StockComment>;
  deleteStockComment(id: number): Promise<void>;

  // QnA 게시판
  getQnaPosts(limit?: number): Promise<QnaPost[]>;
  getQnaPost(id: number): Promise<QnaPost | undefined>;
  createQnaPost(data: InsertQnaPost): Promise<QnaPost>;
  updateQnaPost(id: number, updates: Partial<InsertQnaPost>): Promise<QnaPost>;
  deleteQnaPost(id: number): Promise<void>;
  getQnaReplies(postId: number): Promise<QnaReply[]>;
  createQnaReply(data: InsertQnaReply): Promise<QnaReply>;
  deleteQnaReply(id: number): Promise<void>;

  // 10X (Ten Bagger) 종목
  getTenbaggerStocks(listType?: string, userId?: number): Promise<TenbaggerStock[]>;
  getTenbaggerStocksShared(): Promise<TenbaggerStock[]>;
  getTenbaggerStock(id: number): Promise<TenbaggerStock | undefined>;
  createTenbaggerStock(data: InsertTenbaggerStock): Promise<TenbaggerStock>;
  updateTenbaggerStock(id: number, updates: Partial<InsertTenbaggerStock>): Promise<TenbaggerStock>;
  deleteTenbaggerStock(id: number): Promise<void>;

  // 종목 AI 종합분석
  getStockAiAnalyses(stockCode?: string, market?: string, currentUserId?: number | null): Promise<StockAiAnalysis[]>;
  getStockAiAnalysis(id: number): Promise<StockAiAnalysis | undefined>;
  createStockAiAnalysis(data: InsertStockAiAnalysis): Promise<StockAiAnalysis>;
  deleteStockAiAnalysis(id: number): Promise<void>;

  // 사용자별 AI API 설정 (호환성)
  getUserAiConfig(userId: number): Promise<UserAiConfig | undefined>;
  upsertUserAiConfig(data: InsertUserAiConfig): Promise<UserAiConfig>;
  deleteUserAiConfig(userId: number): Promise<void>;

  // AI 프롬프트
  getAiPrompts(userId?: number): Promise<AiPrompt[]>;
  getAiPrompt(id: number): Promise<AiPrompt | undefined>;
  createAiPrompt(data: InsertAiPrompt): Promise<AiPrompt>;
  updateAiPrompt(id: number, updates: Partial<InsertAiPrompt>): Promise<AiPrompt>;
  deleteAiPrompt(id: number): Promise<void>;

  // Visit Logs (Dashboard)
  createVisitLog(data: InsertVisitLog): Promise<VisitLog>;
  getVisitLogs(limit?: number): Promise<VisitLog[]>;
  getVisitStats(days?: number): Promise<any>;

  // Security Audit Logs
  createSecurityAuditLog(data: InsertSecurityAuditLog): Promise<SecurityAuditLog>;
  getSecurityAuditLogs(limit?: number): Promise<SecurityAuditLog[]>;

  // Security Drill Results
  createSecurityDrillResult(data: InsertSecurityDrillResult): Promise<SecurityDrillResult>;
  getSecurityDrillResults(limit?: number): Promise<SecurityDrillResult[]>;

  // Blocked IPs
  createBlockedIp(data: InsertBlockedIp): Promise<BlockedIp>;
  getBlockedIps(): Promise<BlockedIp[]>;
  getActiveBlockedIps(): Promise<BlockedIp[]>;
  deleteBlockedIp(id: number): Promise<void>;
  isIpBlocked(ip: string): Promise<boolean>;

  // Security Remediations
  createSecurityRemediation(data: InsertSecurityRemediation): Promise<SecurityRemediation>;
  getSecurityRemediations(limit?: number): Promise<SecurityRemediation[]>;

  // Visit Logs cleanup
  deleteOldVisitLogs(days: number): Promise<number>;

  // User AI configs for bulk operations
  getAllUserAiConfigs(): Promise<any[]>;
  getAllUserTradingConfigs(): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // ========== ETF Trends ==========

  async getEtfTrends(): Promise<EtfTrend[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(etfTrends).orderBy(desc(etfTrends.createdAt));
      });
    }
    return await db.select().from(etfTrends).orderBy(desc(etfTrends.createdAt));
  }

  async getEtfTrend(id: number): Promise<EtfTrend | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [trend] = await db.select().from(etfTrends).where(eq(etfTrends.id, id));
        return trend;
      });
    }
    const [trend] = await db.select().from(etfTrends).where(eq(etfTrends.id, id));
    return trend;
  }

  async createEtfTrend(trend: InsertEtfTrend): Promise<EtfTrend> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [newTrend] = await db.insert(etfTrends).values(trend).returning();
        return newTrend;
      });
    }
    const [newTrend] = await db.insert(etfTrends).values(trend).returning();
    return newTrend;
  }

  async updateEtfTrend(id: number, comment: string): Promise<EtfTrend> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(etfTrends)
          .set({ comment })
          .where(eq(etfTrends.id, id))
          .returning();
        return updated;
      });
    }
    const [updated] = await db.update(etfTrends)
      .set({ comment })
      .where(eq(etfTrends.id, id))
      .returning();
    return updated;
  }

  async deleteEtfTrend(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(etfTrends).where(eq(etfTrends.id, id));
      });
    }
    await db.delete(etfTrends).where(eq(etfTrends.id, id));
  }

  // ========== Trading - Auto Trade Rules ==========
  
  async getAutoTradeRules(userId?: number): Promise<AutoTradeRule[]> {
    const condition = userId ? eq(autoTradeRules.userId, userId) : undefined;
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const query = db.select().from(autoTradeRules);
        if (condition) return await query.where(condition).orderBy(desc(autoTradeRules.createdAt));
        return await query.orderBy(desc(autoTradeRules.createdAt));
      });
    }
    const query = db.select().from(autoTradeRules);
    if (condition) return await query.where(condition).orderBy(desc(autoTradeRules.createdAt));
    return await query.orderBy(desc(autoTradeRules.createdAt));
  }

  async getAutoTradeRule(id: number): Promise<AutoTradeRule | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [rule] = await db.select().from(autoTradeRules).where(eq(autoTradeRules.id, id));
        return rule;
      });
    }
    const [rule] = await db.select().from(autoTradeRules).where(eq(autoTradeRules.id, id));
    return rule;
  }

  async getActiveAutoTradeRules(userId?: number): Promise<AutoTradeRule[]> {
    const conditions = [eq(autoTradeRules.isActive, true), eq(autoTradeRules.status, "active")];
    if (userId) conditions.push(eq(autoTradeRules.userId, userId));
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(autoTradeRules).where(and(...conditions));
      });
    }
    return await db.select().from(autoTradeRules).where(and(...conditions));
  }

  async createAutoTradeRule(rule: InsertAutoTradeRule): Promise<AutoTradeRule> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [newRule] = await db.insert(autoTradeRules).values(rule).returning();
        return newRule;
      });
    }
    const [newRule] = await db.insert(autoTradeRules).values(rule).returning();
    return newRule;
  }

  async updateAutoTradeRule(id: number, updates: Partial<InsertAutoTradeRule>): Promise<AutoTradeRule> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(autoTradeRules)
          .set(updates)
          .where(eq(autoTradeRules.id, id))
          .returning();
        return updated;
      });
    }
    const [updated] = await db.update(autoTradeRules)
      .set(updates)
      .where(eq(autoTradeRules.id, id))
      .returning();
    return updated;
  }

  async deleteAutoTradeRule(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(autoTradeRules).where(eq(autoTradeRules.id, id));
      });
    }
    await db.delete(autoTradeRules).where(eq(autoTradeRules.id, id));
  }

  // ========== Trading - Orders ==========
  
  async getTradingOrders(limit: number = 50, userId?: number): Promise<TradingOrder[]> {
    const condition = userId ? eq(tradingOrders.userId, userId) : undefined;
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const query = db.select().from(tradingOrders);
        if (condition) return await query.where(condition).orderBy(desc(tradingOrders.createdAt)).limit(limit);
        return await query.orderBy(desc(tradingOrders.createdAt)).limit(limit);
      });
    }
    const query = db.select().from(tradingOrders);
    if (condition) return await query.where(condition).orderBy(desc(tradingOrders.createdAt)).limit(limit);
    return await query.orderBy(desc(tradingOrders.createdAt)).limit(limit);
  }

  async createTradingOrder(order: InsertTradingOrder): Promise<TradingOrder> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [newOrder] = await db.insert(tradingOrders).values(order).returning();
        return newOrder;
      });
    }
    const [newOrder] = await db.insert(tradingOrders).values(order).returning();
    return newOrder;
  }

  async updateTradingOrder(id: number, updates: Partial<InsertTradingOrder>): Promise<TradingOrder> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(tradingOrders)
          .set(updates)
          .where(eq(tradingOrders.id, id))
          .returning();
        return updated;
      });
    }
    const [updated] = await db.update(tradingOrders)
      .set(updates)
      .where(eq(tradingOrders.id, id))
      .returning();
    return updated;
  }

  // ========== Bookmarks ==========

  async getBookmarks(userId?: number): Promise<Bookmark[]> {
    // userId가 있으면 해당 유저의 북마크만 반환, 없으면 전체(기존 admin용) 반환
    const condition = userId ? eq(bookmarks.userId, userId) : isNull(bookmarks.userId);
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(bookmarks).where(condition).orderBy(bookmarks.sortOrder, bookmarks.createdAt);
      });
    }
    return await db.select().from(bookmarks).where(condition).orderBy(bookmarks.sortOrder, bookmarks.createdAt);
  }

  async createBookmark(bookmark: InsertBookmark): Promise<Bookmark> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [newBookmark] = await db.insert(bookmarks).values(bookmark).returning();
        return newBookmark;
      });
    }
    const [newBookmark] = await db.insert(bookmarks).values(bookmark).returning();
    return newBookmark;
  }

  async getBookmarkById(id: number): Promise<Bookmark | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [bookmark] = await db.select().from(bookmarks).where(eq(bookmarks.id, id));
        return bookmark;
      });
    }
    const [bookmark] = await db.select().from(bookmarks).where(eq(bookmarks.id, id));
    return bookmark;
  }

  async updateBookmark(id: number, updates: Partial<InsertBookmark>): Promise<Bookmark> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(bookmarks)
          .set(updates)
          .where(eq(bookmarks.id, id))
          .returning();
        return updated;
      });
    }
    const [updated] = await db.update(bookmarks)
      .set(updates)
      .where(eq(bookmarks.id, id))
      .returning();
    return updated;
  }

  async deleteBookmark(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(bookmarks).where(eq(bookmarks.id, id));
      });
    }
    await db.delete(bookmarks).where(eq(bookmarks.id, id));
  }

  // ========== Users ==========

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
        return user;
      });
    }
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [newUser] = await db.insert(users).values(user).returning();
        return newUser;
      });
    }
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getUser(id: number): Promise<User | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user;
      });
    }
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUsers(): Promise<User[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(users).orderBy(desc(users.createdAt));
      });
    }
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  // ========== System Trading Config (관리자 시스템 기본) ==========

  async getSystemTradingConfig(): Promise<SystemTradingConfig | undefined> {
    const query = async (database: any) => {
      const [row] = await database.select().from(systemTradingConfig).limit(1);
      return row;
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  async upsertSystemTradingConfig(data: Partial<SystemTradingConfig>): Promise<SystemTradingConfig> {
    const query = async (database: any) => {
      const [existing] = await database.select().from(systemTradingConfig).limit(1);
      if (existing) {
        const [updated] = await database.update(systemTradingConfig)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(systemTradingConfig.id, existing.id))
          .returning();
        return updated;
      }
      const [created] = await database.insert(systemTradingConfig)
        .values({
          broker: data.broker || "kis",
          appKey: data.appKey || "",
          appSecret: data.appSecret || "",
          accountNo: data.accountNo || "",
          accountProductCd: data.accountProductCd || "01",
          mockTrading: data.mockTrading ?? true,
        })
        .returning();
      return created;
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // ========== User Trading Configs ==========

  // 활성 Trading Config 반환 (호환성 유지)
  async getUserTradingConfig(userId: number): Promise<UserTradingConfig | undefined> {
    const query = async (database: any) => {
      // isActive=true인 설정 우선, 없으면 첫 번째 설정 반환
      const [active] = await database.select().from(userTradingConfigs)
        .where(and(eq(userTradingConfigs.userId, userId), eq(userTradingConfigs.isActive, true)));
      if (active) return active;
      const [first] = await database.select().from(userTradingConfigs)
        .where(eq(userTradingConfigs.userId, userId))
        .orderBy(userTradingConfigs.createdAt);
      return first;
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // 전체 Trading Config 목록
  async getUserTradingConfigs(userId: number): Promise<UserTradingConfig[]> {
    const query = async (database: any) => {
      return await database.select().from(userTradingConfigs)
        .where(eq(userTradingConfigs.userId, userId))
        .orderBy(desc(userTradingConfigs.isActive), userTradingConfigs.createdAt);
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // Trading Config 신규 생성
  async createTradingConfig(config: InsertUserTradingConfig): Promise<UserTradingConfig> {
    const query = async (database: any) => {
      // 첫 번째 등록이면 자동 활성화
      const existing = await database.select().from(userTradingConfigs)
        .where(eq(userTradingConfigs.userId, config.userId));
      const isFirst = existing.length === 0;
      const [created] = await database.insert(userTradingConfigs)
        .values({ ...config, isActive: isFirst })
        .returning();
      return created;
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // Trading Config 수정
  async updateTradingConfig(id: number, userId: number, updates: Partial<InsertUserTradingConfig>): Promise<UserTradingConfig> {
    const query = async (database: any) => {
      const [updated] = await database.update(userTradingConfigs)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(userTradingConfigs.id, id), eq(userTradingConfigs.userId, userId)))
        .returning();
      return updated;
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // Trading Config 개별 삭제
  async deleteTradingConfig(id: number, userId: number): Promise<void> {
    const query = async (database: any) => {
      await database.delete(userTradingConfigs)
        .where(and(eq(userTradingConfigs.id, id), eq(userTradingConfigs.userId, userId)));
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // Trading Config 활성화 전환
  async setActiveTradingConfig(id: number, userId: number): Promise<void> {
    const query = async (database: any) => {
      // 모두 비활성화
      await database.update(userTradingConfigs)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(userTradingConfigs.userId, userId));
      // 선택한 것만 활성화
      await database.update(userTradingConfigs)
        .set({ isActive: true, updatedAt: new Date() })
        .where(and(eq(userTradingConfigs.id, id), eq(userTradingConfigs.userId, userId)));
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // Admin 시스템 기본 전환: DB의 모든 Trading Config를 비활성화
  async deactivateAllTradingConfigs(userId: number): Promise<void> {
    const query = async (database: any) => {
      await database.update(userTradingConfigs)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(userTradingConfigs.userId, userId));
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // 호환성: upsert (기존 단일 API 방식)
  async upsertUserTradingConfig(config: InsertUserTradingConfig): Promise<UserTradingConfig> {
    const query = async (database: any) => {
      const existing = await database.select().from(userTradingConfigs)
        .where(eq(userTradingConfigs.userId, config.userId));
      if (existing.length > 0) {
        // 활성 설정 업데이트
        const activeConfig = existing.find((c: any) => c.isActive) || existing[0];
        const [updated] = await database.update(userTradingConfigs)
          .set({ ...config, updatedAt: new Date() })
          .where(eq(userTradingConfigs.id, activeConfig.id))
          .returning();
        return updated;
      }
      const [created] = await database.insert(userTradingConfigs)
        .values({ ...config, isActive: true })
        .returning();
      return created;
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // 호환성: 전체 삭제
  async deleteUserTradingConfig(userId: number): Promise<void> {
    const query = async (database: any) => {
      await database.delete(userTradingConfigs).where(eq(userTradingConfigs.userId, userId));
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // ========== Stop Loss Orders ==========

  async getStopLossOrders(userId?: number): Promise<StopLossOrder[]> {
    const condition = userId ? eq(stopLossOrders.userId, userId) : undefined;
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const query = db.select().from(stopLossOrders);
        if (condition) return await query.where(condition).orderBy(desc(stopLossOrders.createdAt));
        return await query.orderBy(desc(stopLossOrders.createdAt));
      });
    }
    const query = db.select().from(stopLossOrders);
    if (condition) return await query.where(condition).orderBy(desc(stopLossOrders.createdAt));
    return await query.orderBy(desc(stopLossOrders.createdAt));
  }

  async getActiveStopLossOrders(): Promise<StopLossOrder[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(stopLossOrders)
          .where(eq(stopLossOrders.status, "active"));
      });
    }
    return await db.select().from(stopLossOrders)
      .where(eq(stopLossOrders.status, "active"));
  }

  async createStopLossOrder(order: InsertStopLossOrder): Promise<StopLossOrder> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [newOrder] = await db.insert(stopLossOrders).values(order).returning();
        return newOrder;
      });
    }
    const [newOrder] = await db.insert(stopLossOrders).values(order).returning();
    return newOrder;
  }

  async updateStopLossOrder(id: number, updates: Partial<InsertStopLossOrder>): Promise<StopLossOrder> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(stopLossOrders)
          .set(updates)
          .where(eq(stopLossOrders.id, id))
          .returning();
        return updated;
      });
    }
    const [updated] = await db.update(stopLossOrders)
      .set(updates)
      .where(eq(stopLossOrders.id, id))
      .returning();
    return updated;
  }

  async cancelStopLossOrder(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.update(stopLossOrders)
          .set({ status: "cancelled" })
          .where(eq(stopLossOrders.id, id));
      });
    }
    await db.update(stopLossOrders)
      .set({ status: "cancelled" })
      .where(eq(stopLossOrders.id, id));
  }

  // ========== Saved ETFs (신규ETF 관리) ==========

  async getSavedEtfs(userId?: number): Promise<SavedEtf[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        if (userId) {
          return await db.select().from(savedEtfs).where(eq(savedEtfs.userId, userId)).orderBy(desc(savedEtfs.updatedAt));
        }
        return await db.select().from(savedEtfs).orderBy(desc(savedEtfs.updatedAt));
      });
    }
    if (userId) {
      return await db.select().from(savedEtfs).where(eq(savedEtfs.userId, userId)).orderBy(desc(savedEtfs.updatedAt));
    }
    return await db.select().from(savedEtfs).orderBy(desc(savedEtfs.updatedAt));
  }

  async getSavedEtf(id: number): Promise<SavedEtf | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [etf] = await db.select().from(savedEtfs).where(eq(savedEtfs.id, id));
        return etf;
      });
    }
    const [etf] = await db.select().from(savedEtfs).where(eq(savedEtfs.id, id));
    return etf;
  }

  async createSavedEtf(data: InsertSavedEtf): Promise<SavedEtf> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [newEtf] = await db.insert(savedEtfs).values(data).returning();
        return newEtf;
      });
    }
    const [newEtf] = await db.insert(savedEtfs).values(data).returning();
    return newEtf;
  }

  async updateSavedEtf(id: number, updates: Partial<InsertSavedEtf>): Promise<SavedEtf> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(savedEtfs)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(savedEtfs.id, id))
          .returning();
        return updated;
      });
    }
    const [updated] = await db.update(savedEtfs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(savedEtfs.id, id))
      .returning();
    return updated;
  }

  async deleteSavedEtf(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(savedEtfs).where(eq(savedEtfs.id, id));
      });
    }
    await db.delete(savedEtfs).where(eq(savedEtfs.id, id));
  }

  // ========== Watchlist ETFs (관심/추천 ETF) ==========

  async getWatchlistEtfs(): Promise<WatchlistEtf[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(watchlistEtfs).orderBy(desc(watchlistEtfs.createdAt));
      });
    }
    return await db.select().from(watchlistEtfs).orderBy(desc(watchlistEtfs.createdAt));
  }

  async createWatchlistEtf(data: InsertWatchlistEtf): Promise<WatchlistEtf> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [newEtf] = await db.insert(watchlistEtfs).values(data).returning();
        return newEtf;
      });
    }
    const [newEtf] = await db.insert(watchlistEtfs).values(data).returning();
    return newEtf;
  }

  async updateWatchlistEtf(id: number, updates: Partial<InsertWatchlistEtf>): Promise<WatchlistEtf> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(watchlistEtfs)
          .set(updates)
          .where(eq(watchlistEtfs.id, id))
          .returning();
        return updated;
      });
    }
    const [updated] = await db.update(watchlistEtfs)
      .set(updates)
      .where(eq(watchlistEtfs.id, id))
      .returning();
    return updated;
  }

  async deleteWatchlistEtf(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(watchlistEtfs).where(eq(watchlistEtfs.id, id));
      });
    }
    await db.delete(watchlistEtfs).where(eq(watchlistEtfs.id, id));
  }

  // ========== Satellite ETFs (관심ETF Satellite) ==========

  async getSatelliteEtfs(listType?: string, userId?: number): Promise<SatelliteEtf[]> {
    let whereClause: any = undefined;
    if (listType === "common") {
      whereClause = or(eq(satelliteEtfs.listType, "common"), isNull(satelliteEtfs.listType));
    } else if (listType === "personal" && userId != null) {
      whereClause = and(eq(satelliteEtfs.listType, "personal"), eq(satelliteEtfs.userId, userId));
    }

    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        if (whereClause) {
          return await db.select().from(satelliteEtfs).where(whereClause).orderBy(desc(satelliteEtfs.createdAt));
        }
        return await db.select().from(satelliteEtfs).orderBy(desc(satelliteEtfs.createdAt));
      });
    }
    if (whereClause) {
      return await db.select().from(satelliteEtfs).where(whereClause).orderBy(desc(satelliteEtfs.createdAt));
    }
    return await db.select().from(satelliteEtfs).orderBy(desc(satelliteEtfs.createdAt));
  }

  async createSatelliteEtf(data: InsertSatelliteEtf): Promise<SatelliteEtf> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [newEtf] = await db.insert(satelliteEtfs).values(data).returning();
        return newEtf;
      });
    }
    const [newEtf] = await db.insert(satelliteEtfs).values(data).returning();
    return newEtf;
  }

  async updateSatelliteEtf(id: number, updates: Partial<InsertSatelliteEtf>): Promise<SatelliteEtf> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(satelliteEtfs)
          .set(updates)
          .where(eq(satelliteEtfs.id, id))
          .returning();
        return updated;
      });
    }
    const [updated] = await db.update(satelliteEtfs)
      .set(updates)
      .where(eq(satelliteEtfs.id, id))
      .returning();
    return updated;
  }

  async deleteSatelliteEtf(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(satelliteEtfs).where(eq(satelliteEtfs.id, id));
      });
    }
    await db.delete(satelliteEtfs).where(eq(satelliteEtfs.id, id));
  }

  // ========== Notices (공지사항) ==========

  async getNotices(): Promise<Notice[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(notices).orderBy(notices.sortOrder, desc(notices.createdAt));
      });
    }
    return await db.select().from(notices).orderBy(notices.sortOrder, desc(notices.createdAt));
  }

  async getActiveNotices(): Promise<Notice[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(notices).where(eq(notices.isActive, true)).orderBy(notices.sortOrder, desc(notices.createdAt));
      });
    }
    return await db.select().from(notices).where(eq(notices.isActive, true)).orderBy(notices.sortOrder, desc(notices.createdAt));
  }

  async createNotice(data: InsertNotice): Promise<Notice> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [newNotice] = await db.insert(notices).values(data).returning();
        return newNotice;
      });
    }
    const [newNotice] = await db.insert(notices).values(data).returning();
    return newNotice;
  }

  async updateNotice(id: number, updates: Partial<InsertNotice>): Promise<Notice> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(notices)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(notices.id, id))
          .returning();
        return updated;
      });
    }
    const [updated] = await db.update(notices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(notices.id, id))
      .returning();
    return updated;
  }

  async deleteNotice(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(notices).where(eq(notices.id, id));
      });
    }
    await db.delete(notices).where(eq(notices.id, id));
  }

  // ========== Steem Posts (스팀 포스팅) ==========

  async getSteemPosts(limit: number = 50): Promise<SteemPost[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(steemPosts).orderBy(desc(steemPosts.createdAt)).limit(limit);
      });
    }
    return await db.select().from(steemPosts).orderBy(desc(steemPosts.createdAt)).limit(limit);
  }

  async getSteemPost(id: number): Promise<SteemPost | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [post] = await db.select().from(steemPosts).where(eq(steemPosts.id, id));
        return post;
      });
    }
    const [post] = await db.select().from(steemPosts).where(eq(steemPosts.id, id));
    return post;
  }

  async createSteemPost(data: InsertSteemPost): Promise<SteemPost> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [newPost] = await db.insert(steemPosts).values(data).returning();
        return newPost;
      });
    }
    const [newPost] = await db.insert(steemPosts).values(data).returning();
    return newPost;
  }

  async updateSteemPost(id: number, updates: Partial<InsertSteemPost>): Promise<SteemPost> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(steemPosts)
          .set(updates)
          .where(eq(steemPosts.id, id))
          .returning();
        return updated;
      });
    }
    const [updated] = await db.update(steemPosts)
      .set(updates)
      .where(eq(steemPosts.id, id))
      .returning();
    return updated;
  }

  async deleteSteemPost(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(steemPosts).where(eq(steemPosts.id, id));
      });
    }
    await db.delete(steemPosts).where(eq(steemPosts.id, id));
  }

  // ========== Key Research (주요 리서치) ==========

  async getKeyResearch(limit: number = 200): Promise<KeyResearchItem[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(keyResearch).orderBy(desc(keyResearch.createdAt)).limit(limit);
      });
    }
    return await db.select().from(keyResearch).orderBy(desc(keyResearch.createdAt)).limit(limit);
  }

  async saveKeyResearch(items: Array<{ title: string; link: string; source: string; date: string; file: string }>): Promise<void> {
    if (process.env.VERCEL) {
      await executeWithClient(async (db) => {
        await db.delete(keyResearch);
        if (items.length > 0) {
          await db.insert(keyResearch).values(items.map(item => ({
            title: item.title,
            link: item.link || "",
            source: item.source || "",
            date: item.date || "",
            file: item.file || "",
          })));
        }
      });
      return;
    }
    await db.delete(keyResearch);
    if (items.length > 0) {
      await db.insert(keyResearch).values(items.map(item => ({
        title: item.title,
        link: item.link || "",
        source: item.source || "",
        date: item.date || "",
        file: item.file || "",
      })));
    }
  }

  async deleteKeyResearch(id: number): Promise<void> {
    if (process.env.VERCEL) {
      await executeWithClient(async (db) => {
        await db.delete(keyResearch).where(eq(keyResearch.id, id));
      });
      return;
    }
    await db.delete(keyResearch).where(eq(keyResearch.id, id));
  }

  // ========== Notion Config (용도별) ==========

  async getNotionConfig(userId: number, purpose: string = "research"): Promise<NotionConfig | null> {
    const cond = and(eq(notionConfig.userId, userId), eq(notionConfig.purpose, purpose));
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const rows = await db.select().from(notionConfig).where(cond).limit(1);
        return rows[0] || null;
      });
    }
    const rows = await db.select().from(notionConfig).where(cond).limit(1);
    return rows[0] || null;
  }

  async getAllNotionConfigs(userId: number): Promise<NotionConfig[]> {
    const cond = eq(notionConfig.userId, userId);
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(notionConfig).where(cond);
      });
    }
    return await db.select().from(notionConfig).where(cond);
  }

  async saveNotionConfig(userId: number, apiKey: string, databaseId: string, purpose: string = "research"): Promise<void> {
    const cond = and(eq(notionConfig.userId, userId), eq(notionConfig.purpose, purpose));
    if (process.env.VERCEL) {
      await executeWithClient(async (db) => {
        await db.delete(notionConfig).where(cond);
        await db.insert(notionConfig).values({ userId, apiKey, databaseId, purpose });
      });
      return;
    }
    await db.delete(notionConfig).where(cond);
    await db.insert(notionConfig).values({ userId, apiKey, databaseId, purpose });
  }

  async deleteNotionConfig(userId: number, purpose?: string): Promise<void> {
    const cond = purpose
      ? and(eq(notionConfig.userId, userId), eq(notionConfig.purpose, purpose))
      : eq(notionConfig.userId, userId);
    if (process.env.VERCEL) {
      await executeWithClient(async (db) => {
        await db.delete(notionConfig).where(cond);
      });
      return;
    }
    await db.delete(notionConfig).where(cond);
  }

  // ========== AI Reports ==========

  async getAiReports(limit: number = 20): Promise<AiReport[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(aiReports).orderBy(desc(aiReports.createdAt)).limit(limit);
      });
    }
    return await db.select().from(aiReports).orderBy(desc(aiReports.createdAt)).limit(limit);
  }

  async getAiReport(id: number): Promise<AiReport | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [report] = await db.select().from(aiReports).where(eq(aiReports.id, id));
        return report;
      });
    }
    const [report] = await db.select().from(aiReports).where(eq(aiReports.id, id));
    return report;
  }

  async createAiReport(data: InsertAiReport): Promise<AiReport> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [newReport] = await db.insert(aiReports).values(data).returning();
        return newReport;
      });
    }
    const [newReport] = await db.insert(aiReports).values(data).returning();
    return newReport;
  }

  async deleteAiReport(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(aiReports).where(eq(aiReports.id, id));
      });
    }
    await db.delete(aiReports).where(eq(aiReports.id, id));
  }

  // ========== Strategy Reports (전략 보고서 - 일일/주간/월간/연간) ==========

  async getStrategyReports(period: string, limit: number = 10): Promise<StrategyReport[]> {
    const query = (dbInstance: any) => {
      let q = dbInstance.select().from(strategyReports);
      if (period) q = q.where(eq(strategyReports.period, period));
      return q.orderBy(desc(strategyReports.createdAt)).limit(limit);
    };
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => query(db));
    }
    return await query(db);
  }

  async createStrategyReport(data: InsertStrategyReport): Promise<StrategyReport> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [newReport] = await db.insert(strategyReports).values(data).returning();
        return newReport;
      });
    }
    const [newReport] = await db.insert(strategyReports).values(data).returning();
    return newReport;
  }

  async deleteStrategyReport(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(strategyReports).where(eq(strategyReports.id, id));
      });
    }
    await db.delete(strategyReports).where(eq(strategyReports.id, id));
  }

  async updateStrategyReportShared(id: number, isShared: boolean): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.update(strategyReports).set({ isShared }).where(eq(strategyReports.id, id));
      });
    }
    await db.update(strategyReports).set({ isShared }).where(eq(strategyReports.id, id));
  }

  // ========== Strategy Analyses (전략 AI 분석) ==========

  async getStrategyAnalyses(period: string, limit: number = 10): Promise<StrategyAnalysis[]> {
    const query = (dbInstance: any) => {
      let q = dbInstance.select().from(strategyAnalyses);
      if (period) q = q.where(eq(strategyAnalyses.period, period));
      return q.orderBy(desc(strategyAnalyses.createdAt)).limit(limit);
    };
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => query(db));
    }
    return await query(db);
  }

  async createStrategyAnalysis(data: InsertStrategyAnalysis): Promise<StrategyAnalysis> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [newAnalysis] = await db.insert(strategyAnalyses).values(data).returning();
        return newAnalysis;
      });
    }
    const [newAnalysis] = await db.insert(strategyAnalyses).values(data).returning();
    return newAnalysis;
  }

  async deleteStrategyAnalysis(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(strategyAnalyses).where(eq(strategyAnalyses.id, id));
      });
    }
    await db.delete(strategyAnalyses).where(eq(strategyAnalyses.id, id));
  }

  async updateStrategyAnalysisShared(id: number, isShared: boolean): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.update(strategyAnalyses).set({ isShared }).where(eq(strategyAnalyses.id, id));
      });
    }
    await db.update(strategyAnalyses).set({ isShared }).where(eq(strategyAnalyses.id, id));
  }

  // ========== Gap Strategy (시가급등 추세추종) ==========

  async getGapStrategy(userId: number): Promise<GapStrategy | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [s] = await db.select().from(gapStrategy).where(eq(gapStrategy.userId, userId));
        return s;
      });
    }
    const [s] = await db.select().from(gapStrategy).where(eq(gapStrategy.userId, userId));
    return s;
  }

  async upsertGapStrategy(data: InsertGapStrategy): Promise<GapStrategy> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const existing = await db.select().from(gapStrategy).where(eq(gapStrategy.userId, data.userId));
        if (existing.length > 0) {
          const [updated] = await db.update(gapStrategy).set({ ...data, updatedAt: new Date() }).where(eq(gapStrategy.id, existing[0].id)).returning();
          return updated;
        }
        const [created] = await db.insert(gapStrategy).values(data).returning();
        return created;
      });
    }
    const existing = await db.select().from(gapStrategy).where(eq(gapStrategy.userId, data.userId));
    if (existing.length > 0) {
      const [updated] = await db.update(gapStrategy).set({ ...data, updatedAt: new Date() }).where(eq(gapStrategy.id, existing[0].id)).returning();
      return updated;
    }
    const [created] = await db.insert(gapStrategy).values(data).returning();
    return created;
  }

  async updateGapStrategy(id: number, updates: Partial<InsertGapStrategy>): Promise<GapStrategy> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(gapStrategy).set({ ...updates, updatedAt: new Date() }).where(eq(gapStrategy.id, id)).returning();
        return updated;
      });
    }
    const [updated] = await db.update(gapStrategy).set({ ...updates, updatedAt: new Date() }).where(eq(gapStrategy.id, id)).returning();
    return updated;
  }

  async deleteGapStrategy(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(gapStrategy).where(eq(gapStrategy.id, id));
      });
    }
    await db.delete(gapStrategy).where(eq(gapStrategy.id, id));
  }

  async getAllActiveGapStrategies(): Promise<GapStrategy[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(gapStrategy).where(eq(gapStrategy.isActive, true));
      });
    }
    return await db.select().from(gapStrategy).where(eq(gapStrategy.isActive, true));
  }

  // ========== Gap Strategy Positions ==========

  async getGapPositions(strategyId: number): Promise<GapStrategyPosition[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(gapStrategyPositions).where(eq(gapStrategyPositions.strategyId, strategyId)).orderBy(desc(gapStrategyPositions.openedAt));
      });
    }
    return await db.select().from(gapStrategyPositions).where(eq(gapStrategyPositions.strategyId, strategyId)).orderBy(desc(gapStrategyPositions.openedAt));
  }

  async getActiveGapPositions(strategyId: number): Promise<GapStrategyPosition[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(gapStrategyPositions)
          .where(and(
            eq(gapStrategyPositions.strategyId, strategyId),
            inArray(gapStrategyPositions.status, ["gap_detected", "buying", "holding"])
          ))
          .orderBy(desc(gapStrategyPositions.openedAt));
      });
    }
    return await db.select().from(gapStrategyPositions)
      .where(and(
        eq(gapStrategyPositions.strategyId, strategyId),
        inArray(gapStrategyPositions.status, ["gap_detected", "buying", "holding"])
      ))
      .orderBy(desc(gapStrategyPositions.openedAt));
  }

  async getGapPosition(id: number): Promise<GapStrategyPosition | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [pos] = await db.select().from(gapStrategyPositions).where(eq(gapStrategyPositions.id, id));
        return pos;
      });
    }
    const [pos] = await db.select().from(gapStrategyPositions).where(eq(gapStrategyPositions.id, id));
    return pos;
  }

  async createGapPosition(data: InsertGapStrategyPosition): Promise<GapStrategyPosition> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [created] = await db.insert(gapStrategyPositions).values(data).returning();
        return created;
      });
    }
    const [created] = await db.insert(gapStrategyPositions).values(data).returning();
    return created;
  }

  async updateGapPosition(id: number, updates: Partial<InsertGapStrategyPosition>): Promise<GapStrategyPosition> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(gapStrategyPositions).set(updates).where(eq(gapStrategyPositions.id, id)).returning();
        return updated;
      });
    }
    const [updated] = await db.update(gapStrategyPositions).set(updates).where(eq(gapStrategyPositions.id, id)).returning();
    return updated;
  }

  // ========== Gap Strategy Logs ==========

  async getGapLogs(strategyId: number, limit: number = 50): Promise<GapStrategyLog[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(gapStrategyLogs).where(eq(gapStrategyLogs.strategyId, strategyId)).orderBy(desc(gapStrategyLogs.createdAt)).limit(limit);
      });
    }
    return await db.select().from(gapStrategyLogs).where(eq(gapStrategyLogs.strategyId, strategyId)).orderBy(desc(gapStrategyLogs.createdAt)).limit(limit);
  }

  async createGapLog(data: InsertGapStrategyLog): Promise<GapStrategyLog> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [created] = await db.insert(gapStrategyLogs).values(data).returning();
        return created;
      });
    }
    const [created] = await db.insert(gapStrategyLogs).values(data).returning();
    return created;
  }

  // ========== Multi-Factor Strategy (멀티팩터 전략) ==========

  async getMultiFactorStrategy(userId: number): Promise<MultiFactorStrategy | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [s] = await db.select().from(multiFactorStrategy).where(eq(multiFactorStrategy.userId, userId));
        return s;
      });
    }
    const [s] = await db.select().from(multiFactorStrategy).where(eq(multiFactorStrategy.userId, userId));
    return s;
  }

  async upsertMultiFactorStrategy(data: InsertMultiFactorStrategy): Promise<MultiFactorStrategy> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const existing = await db.select().from(multiFactorStrategy).where(eq(multiFactorStrategy.userId, data.userId));
        if (existing.length > 0) {
          const [updated] = await db.update(multiFactorStrategy).set({ ...data, updatedAt: new Date() }).where(eq(multiFactorStrategy.id, existing[0].id)).returning();
          return updated;
        }
        const [created] = await db.insert(multiFactorStrategy).values(data).returning();
        return created;
      });
    }
    const existing = await db.select().from(multiFactorStrategy).where(eq(multiFactorStrategy.userId, data.userId));
    if (existing.length > 0) {
      const [updated] = await db.update(multiFactorStrategy).set({ ...data, updatedAt: new Date() }).where(eq(multiFactorStrategy.id, existing[0].id)).returning();
      return updated;
    }
    const [created] = await db.insert(multiFactorStrategy).values(data).returning();
    return created;
  }

  async updateMultiFactorStrategy(id: number, updates: Partial<InsertMultiFactorStrategy>): Promise<MultiFactorStrategy> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(multiFactorStrategy).set({ ...updates, updatedAt: new Date() }).where(eq(multiFactorStrategy.id, id)).returning();
        return updated;
      });
    }
    const [updated] = await db.update(multiFactorStrategy).set({ ...updates, updatedAt: new Date() }).where(eq(multiFactorStrategy.id, id)).returning();
    return updated;
  }

  async getMultiFactorPositions(strategyId: number): Promise<MultiFactorPosition[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(multiFactorPositions).where(eq(multiFactorPositions.strategyId, strategyId)).orderBy(desc(multiFactorPositions.openedAt));
      });
    }
    return await db.select().from(multiFactorPositions).where(eq(multiFactorPositions.strategyId, strategyId)).orderBy(desc(multiFactorPositions.openedAt));
  }

  async getActiveMultiFactorPositions(strategyId: number): Promise<MultiFactorPosition[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(multiFactorPositions)
          .where(and(eq(multiFactorPositions.strategyId, strategyId), inArray(multiFactorPositions.status, ["signal_detected", "buying", "holding"])))
          .orderBy(desc(multiFactorPositions.openedAt));
      });
    }
    return await db.select().from(multiFactorPositions)
      .where(and(eq(multiFactorPositions.strategyId, strategyId), inArray(multiFactorPositions.status, ["signal_detected", "buying", "holding"])))
      .orderBy(desc(multiFactorPositions.openedAt));
  }

  async createMultiFactorPosition(data: InsertMultiFactorPosition): Promise<MultiFactorPosition> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [created] = await db.insert(multiFactorPositions).values(data).returning();
        return created;
      });
    }
    const [created] = await db.insert(multiFactorPositions).values(data).returning();
    return created;
  }

  async updateMultiFactorPosition(id: number, updates: Partial<InsertMultiFactorPosition>): Promise<MultiFactorPosition> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(multiFactorPositions).set(updates).where(eq(multiFactorPositions.id, id)).returning();
        return updated;
      });
    }
    const [updated] = await db.update(multiFactorPositions).set(updates).where(eq(multiFactorPositions.id, id)).returning();
    return updated;
  }

  async getMultiFactorLogs(strategyId: number, limit: number = 50): Promise<MultiFactorLog[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(multiFactorLogs).where(eq(multiFactorLogs.strategyId, strategyId)).orderBy(desc(multiFactorLogs.createdAt)).limit(limit);
      });
    }
    return await db.select().from(multiFactorLogs).where(eq(multiFactorLogs.strategyId, strategyId)).orderBy(desc(multiFactorLogs.createdAt)).limit(limit);
  }

  async createMultiFactorLog(data: InsertMultiFactorLog): Promise<MultiFactorLog> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [created] = await db.insert(multiFactorLogs).values(data).returning();
        return created;
      });
    }
    const [created] = await db.insert(multiFactorLogs).values(data).returning();
    return created;
  }

  // ========== Watchlist Stocks (관심종목) ==========

  async getWatchlistStocks(market?: string, listType?: string, userId?: number): Promise<WatchlistStock[]> {
    const conditions: any[] = [];
    if (market) conditions.push(eq(watchlistStocks.market, market));
    if (listType) conditions.push(eq(watchlistStocks.listType, listType));
    if (listType === "personal" && userId) conditions.push(eq(watchlistStocks.userId, userId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        if (whereClause) {
          return await db.select().from(watchlistStocks).where(whereClause).orderBy(desc(watchlistStocks.createdAt));
        }
        return await db.select().from(watchlistStocks).orderBy(desc(watchlistStocks.createdAt));
      });
    }
    if (whereClause) {
      return await db.select().from(watchlistStocks).where(whereClause).orderBy(desc(watchlistStocks.createdAt));
    }
    return await db.select().from(watchlistStocks).orderBy(desc(watchlistStocks.createdAt));
  }

  async getWatchlistStocksShared(market?: string): Promise<WatchlistStock[]> {
    const conditions: any[] = [
      eq(watchlistStocks.listType, "personal"),
      eq(watchlistStocks.isShared, true),
    ];
    if (market) conditions.push(eq(watchlistStocks.market, market));
    const whereClause = and(...conditions);

    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(watchlistStocks).where(whereClause).orderBy(desc(watchlistStocks.createdAt));
      });
    }
    return await db.select().from(watchlistStocks).where(whereClause).orderBy(desc(watchlistStocks.createdAt));
  }

  async getWatchlistStock(id: number): Promise<WatchlistStock | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [stock] = await db.select().from(watchlistStocks).where(eq(watchlistStocks.id, id));
        return stock;
      });
    }
    const [stock] = await db.select().from(watchlistStocks).where(eq(watchlistStocks.id, id));
    return stock;
  }

  async createWatchlistStock(data: InsertWatchlistStock): Promise<WatchlistStock> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [created] = await db.insert(watchlistStocks).values(data).returning();
        return created;
      });
    }
    const [created] = await db.insert(watchlistStocks).values(data).returning();
    return created;
  }

  async updateWatchlistStock(id: number, updates: Partial<InsertWatchlistStock>): Promise<WatchlistStock> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(watchlistStocks).set(updates).where(eq(watchlistStocks.id, id)).returning();
        return updated;
      });
    }
    const [updated] = await db.update(watchlistStocks).set(updates).where(eq(watchlistStocks.id, id)).returning();
    return updated;
  }

  async deleteWatchlistStock(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(watchlistStocks).where(eq(watchlistStocks.id, id));
      });
    }
    await db.delete(watchlistStocks).where(eq(watchlistStocks.id, id));
  }

  // ========== Stock Comments ==========
  async getStockComments(stockCode: string, market?: string): Promise<StockComment[]> {
    const conditions = [eq(stockComments.stockCode, stockCode)];
    if (market) conditions.push(eq(stockComments.market, market));
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(stockComments).where(and(...conditions)).orderBy(desc(stockComments.createdAt));
      });
    }
    return await db.select().from(stockComments).where(and(...conditions)).orderBy(desc(stockComments.createdAt));
  }

  async getStockComment(id: number): Promise<StockComment | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [comment] = await db.select().from(stockComments).where(eq(stockComments.id, id));
        return comment;
      });
    }
    const [comment] = await db.select().from(stockComments).where(eq(stockComments.id, id));
    return comment;
  }

  async createStockComment(data: InsertStockComment): Promise<StockComment> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [created] = await db.insert(stockComments).values(data).returning();
        return created;
      });
    }
    const [created] = await db.insert(stockComments).values(data).returning();
    return created;
  }

  async deleteStockComment(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(stockComments).where(eq(stockComments.id, id));
      });
    }
    await db.delete(stockComments).where(eq(stockComments.id, id));
  }

  // ========== QnA 게시판 ==========
  async getQnaPosts(limit = 50): Promise<QnaPost[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(qnaPosts).orderBy(desc(qnaPosts.createdAt)).limit(limit);
      });
    }
    return await db.select().from(qnaPosts).orderBy(desc(qnaPosts.createdAt)).limit(limit);
  }

  async getQnaPost(id: number): Promise<QnaPost | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [post] = await db.select().from(qnaPosts).where(eq(qnaPosts.id, id));
        return post;
      });
    }
    const [post] = await db.select().from(qnaPosts).where(eq(qnaPosts.id, id));
    return post;
  }

  async createQnaPost(data: InsertQnaPost): Promise<QnaPost> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [created] = await db.insert(qnaPosts).values(data).returning();
        return created;
      });
    }
    const [created] = await db.insert(qnaPosts).values(data).returning();
    return created;
  }

  async updateQnaPost(id: number, updates: Partial<InsertQnaPost>): Promise<QnaPost> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(qnaPosts).set({ ...updates, updatedAt: new Date() }).where(eq(qnaPosts.id, id)).returning();
        return updated;
      });
    }
    const [updated] = await db.update(qnaPosts).set({ ...updates, updatedAt: new Date() }).where(eq(qnaPosts.id, id)).returning();
    return updated;
  }

  async deleteQnaPost(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(qnaReplies).where(eq(qnaReplies.postId, id));
        await db.delete(qnaPosts).where(eq(qnaPosts.id, id));
      });
    }
    await db.delete(qnaReplies).where(eq(qnaReplies.postId, id));
    await db.delete(qnaPosts).where(eq(qnaPosts.id, id));
  }

  async getQnaReplies(postId: number): Promise<QnaReply[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(qnaReplies).where(eq(qnaReplies.postId, postId)).orderBy(qnaReplies.createdAt);
      });
    }
    return await db.select().from(qnaReplies).where(eq(qnaReplies.postId, postId)).orderBy(qnaReplies.createdAt);
  }

  async createQnaReply(data: InsertQnaReply): Promise<QnaReply> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [reply] = await db.insert(qnaReplies).values(data).returning();
        // 댓글 수 업데이트
        await db.update(qnaPosts).set({ 
          replyCount: sql`COALESCE(${qnaPosts.replyCount}, 0) + 1`,
          updatedAt: new Date()
        }).where(eq(qnaPosts.id, data.postId!));
        return reply;
      });
    }
    const [reply] = await db.insert(qnaReplies).values(data).returning();
    await db.update(qnaPosts).set({ 
      replyCount: sql`COALESCE(${qnaPosts.replyCount}, 0) + 1`,
      updatedAt: new Date()
    }).where(eq(qnaPosts.id, data.postId!));
    return reply;
  }

  async deleteQnaReply(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [reply] = await db.select().from(qnaReplies).where(eq(qnaReplies.id, id));
        if (reply) {
          await db.delete(qnaReplies).where(eq(qnaReplies.id, id));
          await db.update(qnaPosts).set({
            replyCount: sql`GREATEST(COALESCE(${qnaPosts.replyCount}, 1) - 1, 0)`,
          }).where(eq(qnaPosts.id, reply.postId));
        }
      });
    }
    const [reply] = await db.select().from(qnaReplies).where(eq(qnaReplies.id, id));
    if (reply) {
      await db.delete(qnaReplies).where(eq(qnaReplies.id, id));
      await db.update(qnaPosts).set({
        replyCount: sql`GREATEST(COALESCE(${qnaPosts.replyCount}, 1) - 1, 0)`,
      }).where(eq(qnaPosts.id, reply.postId));
    }
  }

  // ========== 10X (Ten Bagger) 종목 ==========

  async getTenbaggerStocks(listType?: string, userId?: number): Promise<TenbaggerStock[]> {
    const conditions: any[] = [];
    if (listType) conditions.push(eq(tenbaggerStocks.listType, listType));
    if (listType === "personal" && userId) conditions.push(eq(tenbaggerStocks.userId, userId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        if (whereClause) {
          return await db.select().from(tenbaggerStocks).where(whereClause).orderBy(desc(tenbaggerStocks.createdAt));
        }
        return await db.select().from(tenbaggerStocks).orderBy(desc(tenbaggerStocks.createdAt));
      });
    }
    if (whereClause) {
      return await db.select().from(tenbaggerStocks).where(whereClause).orderBy(desc(tenbaggerStocks.createdAt));
    }
    return await db.select().from(tenbaggerStocks).orderBy(desc(tenbaggerStocks.createdAt));
  }

  async getTenbaggerStocksShared(): Promise<TenbaggerStock[]> {
    const whereClause = and(
      eq(tenbaggerStocks.listType, "personal"),
      eq(tenbaggerStocks.isShared, true)
    );
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(tenbaggerStocks).where(whereClause).orderBy(desc(tenbaggerStocks.createdAt));
      });
    }
    return await db.select().from(tenbaggerStocks).where(whereClause).orderBy(desc(tenbaggerStocks.createdAt));
  }

  async getTenbaggerStock(id: number): Promise<TenbaggerStock | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [stock] = await db.select().from(tenbaggerStocks).where(eq(tenbaggerStocks.id, id));
        return stock;
      });
    }
    const [stock] = await db.select().from(tenbaggerStocks).where(eq(tenbaggerStocks.id, id));
    return stock;
  }

  async createTenbaggerStock(data: InsertTenbaggerStock): Promise<TenbaggerStock> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [stock] = await db.insert(tenbaggerStocks).values(data).returning();
        return stock;
      });
    }
    const [stock] = await db.insert(tenbaggerStocks).values(data).returning();
    return stock;
  }

  async updateTenbaggerStock(id: number, updates: Partial<InsertTenbaggerStock>): Promise<TenbaggerStock> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [updated] = await db.update(tenbaggerStocks).set(updates).where(eq(tenbaggerStocks.id, id)).returning();
        return updated;
      });
    }
    const [updated] = await db.update(tenbaggerStocks).set(updates).where(eq(tenbaggerStocks.id, id)).returning();
    return updated;
  }

  async deleteTenbaggerStock(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(tenbaggerStocks).where(eq(tenbaggerStocks.id, id));
      });
    }
    await db.delete(tenbaggerStocks).where(eq(tenbaggerStocks.id, id));
  }

  // ========== 종목 AI 종합분석 ==========
  async getStockAiAnalyses(stockCode?: string, market?: string, currentUserId?: number | null): Promise<StockAiAnalysis[]> {
    // 공개 분석 + 본인 비공개 분석만 조회
    const baseConditions: any[] = [];
    if (stockCode) baseConditions.push(eq(stockAiAnalyses.stockCode, stockCode));
    if (market) baseConditions.push(eq(stockAiAnalyses.market, market));

    // 공개(isPublic=true) OR 본인 작성(userId=currentUserId)
    const visibilityCondition = currentUserId
      ? or(
          eq(stockAiAnalyses.isPublic, true),
          eq(stockAiAnalyses.userId, currentUserId)
        )
      : eq(stockAiAnalyses.isPublic, true);

    const allConditions = [...baseConditions, visibilityCondition];

    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(stockAiAnalyses)
          .where(and(...allConditions))
          .orderBy(desc(stockAiAnalyses.createdAt));
      });
    }
    return await db.select().from(stockAiAnalyses)
      .where(and(...allConditions))
      .orderBy(desc(stockAiAnalyses.createdAt));
  }

  async getStockAiAnalysis(id: number): Promise<StockAiAnalysis | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [analysis] = await db.select().from(stockAiAnalyses).where(eq(stockAiAnalyses.id, id));
        return analysis;
      });
    }
    const [analysis] = await db.select().from(stockAiAnalyses).where(eq(stockAiAnalyses.id, id));
    return analysis;
  }

  async createStockAiAnalysis(data: InsertStockAiAnalysis): Promise<StockAiAnalysis> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [analysis] = await db.insert(stockAiAnalyses).values(data).returning();
        return analysis;
      });
    }
    const [analysis] = await db.insert(stockAiAnalyses).values(data).returning();
    return analysis;
  }

  async deleteStockAiAnalysis(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(stockAiAnalyses).where(eq(stockAiAnalyses.id, id));
      });
    }
    await db.delete(stockAiAnalyses).where(eq(stockAiAnalyses.id, id));
  }

  // ========== 사용자별 AI API 설정 ==========

  // 활성 AI Config 반환 (호환성 유지)
  async getUserAiConfig(userId: number): Promise<UserAiConfig | undefined> {
    const query = async (database: any) => {
      const [active] = await database.select().from(userAiConfigs)
        .where(and(eq(userAiConfigs.userId, userId), eq(userAiConfigs.isActive, true)));
      if (active) return active;
      const [first] = await database.select().from(userAiConfigs)
        .where(eq(userAiConfigs.userId, userId))
        .orderBy(userAiConfigs.createdAt);
      return first;
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // 전체 AI Config 목록
  async getUserAiConfigs(userId: number): Promise<UserAiConfig[]> {
    const query = async (database: any) => {
      return await database.select().from(userAiConfigs)
        .where(eq(userAiConfigs.userId, userId))
        .orderBy(desc(userAiConfigs.isActive), userAiConfigs.createdAt);
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // AI Config 신규 생성
  async createAiConfig(data: InsertUserAiConfig): Promise<UserAiConfig> {
    const query = async (database: any) => {
      const existing = await database.select().from(userAiConfigs)
        .where(eq(userAiConfigs.userId, data.userId));
      const isFirst = existing.length === 0;
      const [created] = await database.insert(userAiConfigs)
        .values({ ...data, isActive: isFirst })
        .returning();
      return created;
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // AI Config 수정
  async updateAiConfig(id: number, userId: number, updates: Partial<InsertUserAiConfig>): Promise<UserAiConfig> {
    const query = async (database: any) => {
      const [updated] = await database.update(userAiConfigs)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(userAiConfigs.id, id), eq(userAiConfigs.userId, userId)))
        .returning();
      return updated;
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // AI Config 개별 삭제
  async deleteAiConfig(id: number, userId: number): Promise<void> {
    const query = async (database: any) => {
      await database.delete(userAiConfigs)
        .where(and(eq(userAiConfigs.id, id), eq(userAiConfigs.userId, userId)));
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // AI Config 활성화 전환
  async setActiveAiConfig(id: number, userId: number): Promise<void> {
    const query = async (database: any) => {
      await database.update(userAiConfigs)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(userAiConfigs.userId, userId));
      await database.update(userAiConfigs)
        .set({ isActive: true, updatedAt: new Date() })
        .where(and(eq(userAiConfigs.id, id), eq(userAiConfigs.userId, userId)));
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // 호환성: upsert
  async upsertUserAiConfig(data: InsertUserAiConfig): Promise<UserAiConfig> {
    const query = async (database: any) => {
      const existing = await database.select().from(userAiConfigs)
        .where(eq(userAiConfigs.userId, data.userId));
      if (existing.length > 0) {
        const activeConfig = existing.find((c: any) => c.isActive) || existing[0];
        const [updated] = await database.update(userAiConfigs)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(userAiConfigs.id, activeConfig.id))
          .returning();
        return updated;
      }
      const [created] = await database.insert(userAiConfigs)
        .values({ ...data, isActive: true })
        .returning();
      return created;
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // 호환성: 전체 삭제
  async deleteUserAiConfig(userId: number): Promise<void> {
    const query = async (database: any) => {
      await database.delete(userAiConfigs).where(eq(userAiConfigs.userId, userId));
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // ========== Google 계정 연결 ==========
  async getLinkedAccounts(primaryUserId: number): Promise<UserLinkedAccount[]> {
    const query = async (database: any) => {
      return await database.select().from(userLinkedAccounts)
        .where(eq(userLinkedAccounts.primaryUserId, primaryUserId))
        .orderBy(userLinkedAccounts.linkedAt);
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  async linkAccount(data: InsertUserLinkedAccount): Promise<UserLinkedAccount> {
    const query = async (database: any) => {
      const [created] = await database.insert(userLinkedAccounts).values(data).returning();
      return created;
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  async unlinkAccount(id: number, primaryUserId: number): Promise<void> {
    const query = async (database: any) => {
      await database.delete(userLinkedAccounts)
        .where(and(eq(userLinkedAccounts.id, id), eq(userLinkedAccounts.primaryUserId, primaryUserId)));
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  // ========== AI 프롬프트 ==========
  async getAiPrompts(userId?: number): Promise<AiPrompt[]> {
    // 기본 프롬프트 + 공유 프롬프트 + 본인 프롬프트
    const conditions = userId
      ? or(
          eq(aiPrompts.isDefault, true),
          eq(aiPrompts.isShared, true),
          eq(aiPrompts.userId, userId)
        )
      : or(eq(aiPrompts.isDefault, true), eq(aiPrompts.isShared, true));

    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(aiPrompts).where(conditions).orderBy(desc(aiPrompts.isDefault), desc(aiPrompts.createdAt));
      });
    }
    return await db.select().from(aiPrompts).where(conditions).orderBy(desc(aiPrompts.isDefault), desc(aiPrompts.createdAt));
  }

  async getAiPrompt(id: number): Promise<AiPrompt | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [prompt] = await db.select().from(aiPrompts).where(eq(aiPrompts.id, id));
        return prompt;
      });
    }
    const [prompt] = await db.select().from(aiPrompts).where(eq(aiPrompts.id, id));
    return prompt;
  }

  async createAiPrompt(data: InsertAiPrompt): Promise<AiPrompt> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [prompt] = await db.insert(aiPrompts).values(data).returning();
        return prompt;
      });
    }
    const [prompt] = await db.insert(aiPrompts).values(data).returning();
    return prompt;
  }

  async updateAiPrompt(id: number, updates: Partial<InsertAiPrompt>): Promise<AiPrompt> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [prompt] = await db.update(aiPrompts).set({ ...updates, updatedAt: new Date() }).where(eq(aiPrompts.id, id)).returning();
        return prompt;
      });
    }
    const [prompt] = await db.update(aiPrompts).set({ ...updates, updatedAt: new Date() }).where(eq(aiPrompts.id, id)).returning();
    return prompt;
  }

  async deleteAiPrompt(id: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(aiPrompts).where(eq(aiPrompts.id, id));
      });
    }
    await db.delete(aiPrompts).where(eq(aiPrompts.id, id));
  }

  // ========== Visit Logs (Dashboard) ==========

  async createVisitLog(data: InsertVisitLog): Promise<VisitLog> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [log] = await db.insert(visitLogs).values(data).returning();
        return log;
      });
    }
    const [log] = await db.insert(visitLogs).values(data).returning();
    return log;
  }

  async getVisitLogs(limit: number = 100): Promise<VisitLog[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(visitLogs).orderBy(desc(visitLogs.visitedAt)).limit(limit);
      });
    }
    return await db.select().from(visitLogs).orderBy(desc(visitLogs.visitedAt)).limit(limit);
  }

  async getVisitStats(days: number = 30): Promise<any> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const query = async (database: any) => {
      // 전체 방문 로그 (기간 내)
      const allLogs = await database
        .select()
        .from(visitLogs)
        .where(sql`${visitLogs.visitedAt} >= ${since}`)
        .orderBy(desc(visitLogs.visitedAt));

      // 총 방문 수
      const totalVisits = allLogs.length;

      // 고유 방문자 수 (userId 기준 + 비로그인은 ip 기준)
      const uniqueVisitors = new Set<string>();
      allLogs.forEach((log: VisitLog) => {
        if (log.userId) {
          uniqueVisitors.add(`user:${log.userId}`);
        } else if (log.ipAddress) {
          uniqueVisitors.add(`ip:${log.ipAddress}`);
        }
      });

      // 일별 방문 통계
      const dailyMap = new Map<string, { total: number; unique: Set<string> }>();
      allLogs.forEach((log: VisitLog) => {
        const dateStr = new Date(log.visitedAt).toISOString().split("T")[0];
        if (!dailyMap.has(dateStr)) {
          dailyMap.set(dateStr, { total: 0, unique: new Set() });
        }
        const entry = dailyMap.get(dateStr)!;
        entry.total++;
        if (log.userId) entry.unique.add(`user:${log.userId}`);
        else if (log.ipAddress) entry.unique.add(`ip:${log.ipAddress}`);
      });

      const dailyStats = Array.from(dailyMap.entries())
        .map(([date, stat]) => ({
          date,
          totalVisits: stat.total,
          uniqueVisitors: stat.unique.size,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 계정별 방문 통계
      const userMap = new Map<string, { email: string; name: string; count: number; lastVisit: Date }>();
      allLogs.forEach((log: VisitLog) => {
        if (log.userId && log.userEmail) {
          const key = String(log.userId);
          if (!userMap.has(key)) {
            userMap.set(key, {
              email: log.userEmail,
              name: log.userName || log.userEmail,
              count: 0,
              lastVisit: log.visitedAt,
            });
          }
          const entry = userMap.get(key)!;
          entry.count++;
          if (log.visitedAt > entry.lastVisit) entry.lastVisit = log.visitedAt;
        }
      });

      const userStats = Array.from(userMap.values())
        .sort((a, b) => b.count - a.count);

      // 시간대별 방문 통계
      const hourlyMap = new Map<number, number>();
      for (let i = 0; i < 24; i++) hourlyMap.set(i, 0);
      allLogs.forEach((log: VisitLog) => {
        const hour = new Date(log.visitedAt).getHours();
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
      });
      const hourlyStats = Array.from(hourlyMap.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour - b.hour);

      // 페이지별 방문 통계
      const pageMap = new Map<string, number>();
      allLogs.forEach((log: VisitLog) => {
        const page = log.page || "/";
        pageMap.set(page, (pageMap.get(page) || 0) + 1);
      });
      const pageStats = Array.from(pageMap.entries())
        .map(([page, count]) => ({ page, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      // 최근 방문 로그 (50개)
      const recentLogs = allLogs.slice(0, 50).map((log: VisitLog) => ({
        id: log.id,
        userEmail: log.userEmail,
        userName: log.userName,
        ipAddress: log.ipAddress,
        page: log.page,
        visitedAt: log.visitedAt,
      }));

      // 오늘 방문 통계
      const todayStr = new Date().toISOString().split("T")[0];
      const todayLogs = allLogs.filter((l: VisitLog) => new Date(l.visitedAt).toISOString().split("T")[0] === todayStr);
      const todayUniqueSet = new Set<string>();
      todayLogs.forEach((log: VisitLog) => {
        if (log.userId) todayUniqueSet.add(`user:${log.userId}`);
        else if (log.ipAddress) todayUniqueSet.add(`ip:${log.ipAddress}`);
      });

      return {
        summary: {
          totalVisits,
          uniqueVisitors: uniqueVisitors.size,
          todayVisits: todayLogs.length,
          todayUniqueVisitors: todayUniqueSet.size,
          totalUsers: userMap.size,
          period: `${days}일`,
        },
        dailyStats,
        userStats,
        hourlyStats,
        pageStats,
        recentLogs,
      };
    };

    if (process.env.VERCEL) {
      return await executeWithClient(query);
    }
    return await query(db);
  }

  // ========== Security Audit Logs ==========

  async createSecurityAuditLog(data: InsertSecurityAuditLog): Promise<SecurityAuditLog> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [log] = await db.insert(securityAuditLogs).values(data).returning();
        return log;
      });
    }
    const [log] = await db.insert(securityAuditLogs).values(data).returning();
    return log;
  }

  async getSecurityAuditLogs(limit: number = 50): Promise<SecurityAuditLog[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(securityAuditLogs).orderBy(desc(securityAuditLogs.executedAt)).limit(limit);
      });
    }
    return await db.select().from(securityAuditLogs).orderBy(desc(securityAuditLogs.executedAt)).limit(limit);
  }

  // ========== Security Drill Results ==========

  async createSecurityDrillResult(data: InsertSecurityDrillResult): Promise<SecurityDrillResult> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [result] = await db.insert(securityDrillResults).values(data).returning();
        return result;
      });
    }
    const [result] = await db.insert(securityDrillResults).values(data).returning();
    return result;
  }

  async getSecurityDrillResults(limit: number = 50): Promise<SecurityDrillResult[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(securityDrillResults).orderBy(desc(securityDrillResults.executedAt)).limit(limit);
      });
    }
    return await db.select().from(securityDrillResults).orderBy(desc(securityDrillResults.executedAt)).limit(limit);
  }

  // ========== Blocked IPs ==========

  async createBlockedIp(data: InsertBlockedIp): Promise<BlockedIp> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [ip] = await db.insert(blockedIps).values(data).returning();
        return ip;
      });
    }
    const [ip] = await db.insert(blockedIps).values(data).returning();
    return ip;
  }

  async getBlockedIps(): Promise<BlockedIp[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(blockedIps).orderBy(desc(blockedIps.blockedAt));
      });
    }
    return await db.select().from(blockedIps).orderBy(desc(blockedIps.blockedAt));
  }

  async getActiveBlockedIps(): Promise<BlockedIp[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(blockedIps).where(eq(blockedIps.isActive, true));
      });
    }
    return await db.select().from(blockedIps).where(eq(blockedIps.isActive, true));
  }

  async deleteBlockedIp(id: number): Promise<void> {
    if (process.env.VERCEL) {
      await executeWithClient(async (db) => {
        await db.update(blockedIps).set({ isActive: false }).where(eq(blockedIps.id, id));
      });
      return;
    }
    await db.update(blockedIps).set({ isActive: false }).where(eq(blockedIps.id, id));
  }

  async isIpBlocked(ip: string): Promise<boolean> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [row] = await db.select().from(blockedIps)
          .where(and(eq(blockedIps.ipAddress, ip), eq(blockedIps.isActive, true)));
        return !!row;
      });
    }
    const [row] = await db.select().from(blockedIps)
      .where(and(eq(blockedIps.ipAddress, ip), eq(blockedIps.isActive, true)));
    return !!row;
  }

  // ========== Security Remediations ==========

  async createSecurityRemediation(data: InsertSecurityRemediation): Promise<SecurityRemediation> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [rem] = await db.insert(securityRemediations).values(data).returning();
        return rem;
      });
    }
    const [rem] = await db.insert(securityRemediations).values(data).returning();
    return rem;
  }

  async getSecurityRemediations(limit: number = 50): Promise<SecurityRemediation[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(securityRemediations).orderBy(desc(securityRemediations.executedAt)).limit(limit);
      });
    }
    return await db.select().from(securityRemediations).orderBy(desc(securityRemediations.executedAt)).limit(limit);
  }

  // ========== Visit Logs Cleanup ==========

  async deleteOldVisitLogs(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const query = async (dbConn: any) => {
      const result = await dbConn.delete(visitLogs)
        .where(sql`${visitLogs.visitedAt} < ${cutoff}`)
        .returning();
      return result.length;
    };
    if (process.env.VERCEL) {
      return await executeWithClient(query);
    }
    return await query(db);
  }

  // ========== Bulk AI/Trading Config Access ==========

  async getAllUserAiConfigs(): Promise<any[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(userAiConfigs);
      });
    }
    return await db.select().from(userAiConfigs);
  }

  async getAllUserTradingConfigs(): Promise<any[]> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        return await db.select().from(userTradingConfigs);
      });
    }
    return await db.select().from(userTradingConfigs);
  }

  // ========== Trading Skills Registry ==========

  async getTradingSkills(): Promise<TradingSkill[]> {
    const query = async (dbConn: any) =>
      await dbConn.select().from(tradingSkills).orderBy(tradingSkills.category, tradingSkills.name);
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  async getTradingSkillByCode(skillCode: string): Promise<TradingSkill | undefined> {
    const query = async (dbConn: any) => {
      const rows = await dbConn.select().from(tradingSkills).where(eq(tradingSkills.skillCode, skillCode));
      return rows[0];
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  async createTradingSkill(data: InsertTradingSkill): Promise<TradingSkill> {
    const query = async (dbConn: any) => {
      const rows = await dbConn.insert(tradingSkills).values(data).returning();
      return rows[0];
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  async upsertTradingSkill(data: InsertTradingSkill): Promise<TradingSkill> {
    const existing = await this.getTradingSkillByCode(data.skillCode);
    if (existing) {
      const query = async (dbConn: any) => {
        const rows = await dbConn.update(tradingSkills)
          .set({ name: data.name, category: data.category, description: data.description, icon: data.icon, paramsSchema: data.paramsSchema, defaultParams: data.defaultParams, isBuiltin: data.isBuiltin, isEnabled: data.isEnabled })
          .where(eq(tradingSkills.id, existing.id))
          .returning();
        return rows[0];
      };
      if (process.env.VERCEL) return await executeWithClient(query);
      return await query(db);
    }
    return await this.createTradingSkill(data);
  }

  // ========== User Skill Instances ==========

  async getUserSkillInstances(userId: number): Promise<UserSkillInstance[]> {
    const query = async (dbConn: any) =>
      await dbConn.select().from(userSkillInstances)
        .where(eq(userSkillInstances.userId, userId))
        .orderBy(userSkillInstances.priority, desc(userSkillInstances.createdAt));
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  async getUserSkillInstance(id: number): Promise<UserSkillInstance | undefined> {
    const query = async (dbConn: any) => {
      const rows = await dbConn.select().from(userSkillInstances).where(eq(userSkillInstances.id, id));
      return rows[0];
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  async getActiveUserSkillInstances(userId?: number): Promise<UserSkillInstance[]> {
    const query = async (dbConn: any) => {
      if (userId) {
        return await dbConn.select().from(userSkillInstances)
          .where(and(eq(userSkillInstances.userId, userId), eq(userSkillInstances.isActive, true), eq(userSkillInstances.status, "active")))
          .orderBy(userSkillInstances.priority);
      }
      return await dbConn.select().from(userSkillInstances)
        .where(and(eq(userSkillInstances.isActive, true), eq(userSkillInstances.status, "active")))
        .orderBy(userSkillInstances.priority);
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  async createUserSkillInstance(data: InsertUserSkillInstance): Promise<UserSkillInstance> {
    const query = async (dbConn: any) => {
      const rows = await dbConn.insert(userSkillInstances).values(data).returning();
      return rows[0];
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  async updateUserSkillInstance(id: number, userId: number, updates: Partial<UserSkillInstance>): Promise<UserSkillInstance | undefined> {
    const query = async (dbConn: any) => {
      const rows = await dbConn.update(userSkillInstances)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(userSkillInstances.id, id), eq(userSkillInstances.userId, userId)))
        .returning();
      return rows[0];
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  async deleteUserSkillInstance(id: number, userId: number): Promise<void> {
    const query = async (dbConn: any) => {
      await dbConn.delete(userSkillInstances)
        .where(and(eq(userSkillInstances.id, id), eq(userSkillInstances.userId, userId)));
    };
    if (process.env.VERCEL) { await executeWithClient(query); return; }
    await query(db);
  }

  // ========== Skill Execution Logs ==========

  async createSkillExecutionLog(data: InsertSkillExecutionLog): Promise<SkillExecutionLog> {
    const query = async (dbConn: any) => {
      const rows = await dbConn.insert(skillExecutionLogs).values(data).returning();
      return rows[0];
    };
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  async getSkillExecutionLogs(userId: number, limit: number = 50): Promise<SkillExecutionLog[]> {
    const query = async (dbConn: any) =>
      await dbConn.select().from(skillExecutionLogs)
        .where(eq(skillExecutionLogs.userId, userId))
        .orderBy(desc(skillExecutionLogs.createdAt))
        .limit(limit);
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }

  async getSkillExecutionLogsByInstance(instanceId: number, limit: number = 20): Promise<SkillExecutionLog[]> {
    const query = async (dbConn: any) =>
      await dbConn.select().from(skillExecutionLogs)
        .where(eq(skillExecutionLogs.instanceId, instanceId))
        .orderBy(desc(skillExecutionLogs.createdAt))
        .limit(limit);
    if (process.env.VERCEL) return await executeWithClient(query);
    return await query(db);
  }
}

export const storage = new DatabaseStorage();
