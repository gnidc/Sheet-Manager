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
  notices,
  steemPosts,
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
  type Notice,
  type InsertNotice,
  type SteemPost,
  type InsertSteemPost,
} from "../shared/schema.js";
import { eq, and, desc, isNull } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
