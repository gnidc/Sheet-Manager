import { pgTable, text, serial, numeric, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
export * from "./models/chat.js";
const etfs = pgTable("etfs", {
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
  trendScore: numeric("trend_score").default("0")
});
const insertEtfSchema = createInsertSchema(etfs).omit({ id: true, lastUpdated: true });
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
const etfPriceHistory = pgTable("etf_price_history", {
  id: serial("id").primaryKey(),
  etfId: integer("etf_id").notNull(),
  date: timestamp("date").notNull(),
  closePrice: numeric("close_price").notNull()
});
const insertEtfPriceHistorySchema = createInsertSchema(etfPriceHistory).omit({ id: true });
export {
  etfPriceHistory,
  etfTrends,
  etfs,
  insertEtfPriceHistorySchema,
  insertEtfSchema,
  insertEtfTrendSchema
};
