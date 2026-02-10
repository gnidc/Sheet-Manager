import { db, executeWithClient } from "./db.js";
import {
  etfTrends,
  autoTradeRules,
  tradingOrders,
  bookmarks,
  users,
  userTradingConfigs,
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
}

export const storage = new DatabaseStorage();
