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

  // User Trading Configs
  getUserTradingConfig(userId: number): Promise<UserTradingConfig | undefined>;
  upsertUserTradingConfig(config: InsertUserTradingConfig): Promise<UserTradingConfig>;
  deleteUserTradingConfig(userId: number): Promise<void>;

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

  // AI Reports (AI 분석 보고서)
  getAiReports(limit?: number): Promise<AiReport[]>;
  getAiReport(id: number): Promise<AiReport | undefined>;
  createAiReport(data: InsertAiReport): Promise<AiReport>;
  deleteAiReport(id: number): Promise<void>;

  // Watchlist Stocks (관심종목)
  getWatchlistStocks(market?: string, listType?: string, userId?: number): Promise<WatchlistStock[]>;
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

  // ========== User Trading Configs ==========

  async getUserTradingConfig(userId: number): Promise<UserTradingConfig | undefined> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        const [config] = await db.select().from(userTradingConfigs).where(eq(userTradingConfigs.userId, userId));
        return config;
      });
    }
    const [config] = await db.select().from(userTradingConfigs).where(eq(userTradingConfigs.userId, userId));
    return config;
  }

  async upsertUserTradingConfig(config: InsertUserTradingConfig): Promise<UserTradingConfig> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        // userId 기준 upsert
        const existing = await db.select().from(userTradingConfigs).where(eq(userTradingConfigs.userId, config.userId));
        if (existing.length > 0) {
          const [updated] = await db.update(userTradingConfigs)
            .set({ ...config, updatedAt: new Date() })
            .where(eq(userTradingConfigs.userId, config.userId))
            .returning();
          return updated;
        }
        const [created] = await db.insert(userTradingConfigs).values(config).returning();
        return created;
      });
    }
    const existing = await db.select().from(userTradingConfigs).where(eq(userTradingConfigs.userId, config.userId));
    if (existing.length > 0) {
      const [updated] = await db.update(userTradingConfigs)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(userTradingConfigs.userId, config.userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(userTradingConfigs).values(config).returning();
    return created;
  }

  async deleteUserTradingConfig(userId: number): Promise<void> {
    if (process.env.VERCEL) {
      return await executeWithClient(async (db) => {
        await db.delete(userTradingConfigs).where(eq(userTradingConfigs.userId, userId));
      });
    }
    await db.delete(userTradingConfigs).where(eq(userTradingConfigs.userId, userId));
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
    let whereClause;
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
}

export const storage = new DatabaseStorage();
