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
    const maxRetries = 3; // 재시도 횟수 증가 (2 -> 3)
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const queryStart = Date.now();
      try {
        if (attempt > 1) {
          console.log(`getEtfs retry attempt ${attempt}/${maxRetries}`);
          // 재시도 전에 대기 시간 증가 (연결이 재설정될 시간 제공)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          // Pool 재설정 (새로운 연결 시도)
          try {
            const { resetPool } = await import("./db.js");
            await resetPool();
          } catch (err) {
            console.warn("Failed to reset pool during retry:", err);
          }
        }
        
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
        
        // 쿼리에 타임아웃 설정
        const queryPromise = conditions.length > 0 
          ? query.where(and(...conditions))
          : query;
        
        // 쿼리 실행에 타임아웃 추가
        // Vercel 환경에서는 더 짧은 타임아웃 사용 (함수 타임아웃 고려)
        const timeoutMs = process.env.VERCEL ? 8000 : 25000; // Vercel: 8초, 로컬: 25초
        let timeoutId: NodeJS.Timeout | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Query timeout after ${timeoutMs / 1000} seconds`));
          }, timeoutMs);
        });
        
        try {
          const result = await Promise.race([queryPromise, timeoutPromise]) as Etf[];
          // 쿼리가 성공하면 타이머 정리
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          return result;
        } catch (error) {
          // 에러 발생 시에도 타이머 정리
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          throw error;
        }
        
        const queryTime = Date.now() - queryStart;
        console.log(`getEtfs returning ${result.length} ETFs in ${queryTime}ms`);
        
        if (queryTime > 3000) {
          console.warn(`Slow query detected: ${queryTime}ms (should be < 3000ms)`);
        }
        
        return result;
      } catch (error: any) {
        lastError = error;
        const queryTime = Date.now() - queryStart;
        console.error(`Error in getEtfs (attempt ${attempt}/${maxRetries}, after ${queryTime}ms):`, error.message);
        if (error.code) {
          console.error(`Error code: ${error.code}`);
        }
        
        // 연결 관련 에러인 경우 재시도
        const isConnectionError = 
          error.code === 'ECONNRESET' ||
          error.code === 'EPIPE' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ENOTFOUND' ||
          error.code === '57P01' || // PostgreSQL: terminating connection due to administrator command
          error.code === '57P02' || // PostgreSQL: terminating connection due to crash
          error.code === '57P03' || // PostgreSQL: terminating connection due to idle-in-transaction timeout
          error.message?.includes('Connection terminated') ||
          error.message?.includes('timeout') ||
          error.message?.includes('Connection closed') ||
          error.message?.includes('Query timeout');
        
        if (isConnectionError && attempt < maxRetries) {
          console.log(`Connection error detected (${error.code || 'unknown'}), will retry after ${1000 * (attempt + 1)}ms...`);
          continue;
        }
        
        // 재시도할 수 없는 에러이거나 최대 재시도 횟수에 도달한 경우
        if (attempt === maxRetries) {
          console.error("Error in getEtfs (final):", error);
          console.error("Error code:", error.code);
          console.error("Error stack:", error.stack);
          throw error;
        }
      }
    }
    
    throw lastError;
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
