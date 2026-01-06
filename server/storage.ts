import { db } from "./db.js";
import {
  etfs,
  etfTrends,
  etfPriceHistory,
  type Etf,
  type InsertEtf,
  type UpdateEtfRequest,
  type EtfTrend,
  type InsertEtfTrend,
  type EtfPriceHistory,
  type HistoryPeriod
} from "../shared/schema.js";
import { eq, ilike, and, desc, gte, sql } from "drizzle-orm";

export interface IStorage {
  getEtfs(params?: { search?: string; mainCategory?: string; subCategory?: string; country?: string }): Promise<Etf[]>;
  getEtf(id: number): Promise<Etf | undefined>;
  createEtf(etf: InsertEtf): Promise<Etf>;
  updateEtf(id: number, updates: UpdateEtfRequest): Promise<Etf>;
  deleteEtf(id: number): Promise<void>;
  getRecommendedEtfs(): Promise<Etf[]>;
  getTrendingEtfs(): Promise<Etf[]>;
  
  getEtfTrends(): Promise<EtfTrend[]>;
  getEtfTrend(id: number): Promise<EtfTrend | undefined>;
  createEtfTrend(trend: InsertEtfTrend): Promise<EtfTrend>;
  updateEtfTrend(id: number, comment: string): Promise<EtfTrend>;
  deleteEtfTrend(id: number): Promise<void>;
  
  // Price history
  getEtfPriceHistory(etfId: number, period: HistoryPeriod): Promise<EtfPriceHistory[]>;
}

export class DatabaseStorage implements IStorage {
  async getEtfs(params?: { search?: string; mainCategory?: string; subCategory?: string; country?: string }): Promise<Etf[]> {
    try {
      console.log("getEtfs called with params:", params);
      
      const conditions = [];
      
      if (params?.search) {
        conditions.push(ilike(etfs.name, `%${params.search}%`));
      }
      
      if (params?.mainCategory) {
        conditions.push(eq(etfs.mainCategory, params.mainCategory));
      }

      if (params?.subCategory) {
        conditions.push(eq(etfs.subCategory, params.subCategory));
      }

      if (params?.country) {
        conditions.push(eq(etfs.country, params.country));
      }

      const query = db.select().from(etfs);
      
      // conditions가 비어있지 않을 때만 where 절 추가
      let result;
      if (conditions.length > 0) {
        result = await query.where(and(...conditions));
      } else {
        result = await query;
      }
      
      console.log(`getEtfs returning ${result.length} ETFs`);
      return result;
    } catch (error: any) {
      console.error("Error in getEtfs:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      throw error;
    }
  }

  async getEtf(id: number): Promise<Etf | undefined> {
    const [etf] = await db.select().from(etfs).where(eq(etfs.id, id));
    return etf;
  }

  async createEtf(insertEtf: InsertEtf): Promise<Etf> {
    const [etf] = await db.insert(etfs).values(insertEtf).returning();
    return etf;
  }

  async updateEtf(id: number, updates: UpdateEtfRequest): Promise<Etf> {
    const [updated] = await db.update(etfs)
      .set(updates)
      .where(eq(etfs.id, id))
      .returning();
    return updated;
  }

  async deleteEtf(id: number): Promise<void> {
    await db.delete(etfs).where(eq(etfs.id, id));
  }
  async getRecommendedEtfs(): Promise<Etf[]> {
    return await db.select().from(etfs).where(eq(etfs.isRecommended, true));
  }

  async getTrendingEtfs(): Promise<Etf[]> {
    return await db.select().from(etfs).orderBy(desc(etfs.trendScore)).limit(5);
  }

  async getEtfTrends(): Promise<EtfTrend[]> {
    return await db.select().from(etfTrends).orderBy(desc(etfTrends.createdAt));
  }

  async getEtfTrend(id: number): Promise<EtfTrend | undefined> {
    const [trend] = await db.select().from(etfTrends).where(eq(etfTrends.id, id));
    return trend;
  }

  async createEtfTrend(trend: InsertEtfTrend): Promise<EtfTrend> {
    const [newTrend] = await db.insert(etfTrends).values(trend).returning();
    return newTrend;
  }

  async updateEtfTrend(id: number, comment: string): Promise<EtfTrend> {
    const [updated] = await db.update(etfTrends)
      .set({ comment })
      .where(eq(etfTrends.id, id))
      .returning();
    return updated;
  }

  async deleteEtfTrend(id: number): Promise<void> {
    await db.delete(etfTrends).where(eq(etfTrends.id, id));
  }

  async getEtfPriceHistory(etfId: number, period: HistoryPeriod): Promise<EtfPriceHistory[]> {
    const periodDays = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };
    const days = periodDays[period];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return await db.select()
      .from(etfPriceHistory)
      .where(and(
        eq(etfPriceHistory.etfId, etfId),
        gte(etfPriceHistory.date, startDate)
      ))
      .orderBy(etfPriceHistory.date);
  }
}

export const storage = new DatabaseStorage();
