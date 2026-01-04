import { db } from "./db";
import {
  etfs,
  type Etf,
  type InsertEtf,
  type UpdateEtfRequest
} from "@shared/schema";
import { eq, ilike, and, desc } from "drizzle-orm";

export interface IStorage {
  getEtfs(params?: { search?: string; category?: string; country?: string; assetClass?: string }): Promise<Etf[]>;
  getEtf(id: number): Promise<Etf | undefined>;
  createEtf(etf: InsertEtf): Promise<Etf>;
  updateEtf(id: number, updates: UpdateEtfRequest): Promise<Etf>;
  deleteEtf(id: number): Promise<void>;
  getRecommendedEtfs(): Promise<Etf[]>;
  getTrendingEtfs(): Promise<Etf[]>;
}

export class DatabaseStorage implements IStorage {
  async getEtfs(params?: { search?: string; category?: string; country?: string; assetClass?: string }): Promise<Etf[]> {
    const conditions = [];
    
    if (params?.search) {
      conditions.push(ilike(etfs.name, `%${params.search}%`));
    }
    
    if (params?.category) {
      conditions.push(eq(etfs.category, params.category));
    }

    if (params?.country) {
      conditions.push(eq(etfs.country, params.country));
    }

    if (params?.assetClass) {
      conditions.push(eq(etfs.assetClass, params.assetClass));
    }

    return await db.select()
      .from(etfs)
      .where(and(...conditions));
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
}

export const storage = new DatabaseStorage();
