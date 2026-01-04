import { pgTable, text, serial, numeric, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export * from "./models/chat";

export const etfs = pgTable("etfs", {
  id: serial("id").primaryKey(),
  generation: text("generation"),
  mainCategory: text("main_category"),
  subCategory: text("sub_category"),
  country: text("country"),
  name: text("name").notNull(),
  code: text("code").notNull(),
  fee: text("fee"),
  yield: text("yield"),
  marketCap: text("market_cap"),
  dividendCycle: text("dividend_cycle"),
  optionType: text("option_type"),
  underlyingAsset: text("underlying_asset"),
  callOption: text("call_option"),
  listingDate: text("listing_date"),
  notes: text("notes"),
  linkProduct: text("link_product"),
  linkBlog: text("link_blog"),
  
  // Real-time data
  currentPrice: numeric("current_price"),
  dailyChangeRate: numeric("daily_change_rate"),
  lastUpdated: timestamp("last_updated"),
  
  // Metadata for trends/recommendations
  isRecommended: boolean("is_recommended").default(false),
  isFavorite: boolean("is_favorite").default(false),
  trendScore: numeric("trend_score").default("0"),
});

export const insertEtfSchema = createInsertSchema(etfs).omit({ id: true, lastUpdated: true });

export type Etf = typeof etfs.$inferSelect;
export type InsertEtf = z.infer<typeof insertEtfSchema>;

export type CreateEtfRequest = InsertEtf;
export type UpdateEtfRequest = Partial<InsertEtf>;

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
