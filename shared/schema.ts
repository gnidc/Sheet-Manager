import { pgTable, text, serial, numeric, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export * from "./models/chat.js";

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

// ========== KIS 자동매매 관련 테이블 ==========

// 자동매매 규칙
export const autoTradeRules = pgTable("auto_trade_rules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  name: text("name").notNull(),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  ruleType: text("rule_type").notNull(), // 'buy_below' | 'sell_above' | 'trailing_stop'
  targetPrice: numeric("target_price").notNull(),
  quantity: integer("quantity").notNull(),
  orderMethod: text("order_method").default("limit"), // 'market' | 'limit'
  isActive: boolean("is_active").default(true),
  status: text("status").default("active"), // 'active' | 'executed' | 'cancelled' | 'failed'
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAutoTradeRuleSchema = createInsertSchema(autoTradeRules).omit({ id: true, createdAt: true });

export type AutoTradeRule = typeof autoTradeRules.$inferSelect;
export type InsertAutoTradeRule = z.infer<typeof insertAutoTradeRuleSchema>;

// 매매 주문 기록
export const tradingOrders = pgTable("trading_orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name"),
  orderType: text("order_type").notNull(), // 'buy' | 'sell'
  orderMethod: text("order_method").default("limit"), // 'market' | 'limit'
  quantity: integer("quantity").notNull(),
  price: numeric("price"),
  totalAmount: numeric("total_amount"),
  status: text("status").default("pending"), // 'pending' | 'filled' | 'cancelled' | 'failed'
  kisOrderNo: text("kis_order_no"),
  autoTradeRuleId: integer("auto_trade_rule_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  executedAt: timestamp("executed_at"),
});

export const insertTradingOrderSchema = createInsertSchema(tradingOrders).omit({ id: true, createdAt: true });

export type TradingOrder = typeof tradingOrders.$inferSelect;
export type InsertTradingOrder = z.infer<typeof insertTradingOrderSchema>;

// ========== 사용자 (Google OAuth) ==========
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  picture: text("picture"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ========== 사용자별 KIS 매매 설정 ==========
export const userTradingConfigs = pgTable("user_trading_configs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(), // 유저당 1개
  appKey: text("app_key").notNull(),
  appSecret: text("app_secret").notNull(),
  accountNo: text("account_no").notNull(),        // 계좌번호 앞 8자리
  accountProductCd: text("account_product_cd").default("01"), // 뒤 2자리
  mockTrading: boolean("mock_trading").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserTradingConfigSchema = createInsertSchema(userTradingConfigs).omit({ id: true, createdAt: true, updatedAt: true });

export type UserTradingConfig = typeof userTradingConfigs.$inferSelect;
export type InsertUserTradingConfig = z.infer<typeof insertUserTradingConfigSchema>;

// ========== 즐겨찾기 (북마크) ==========
export const bookmarks = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  title: text("title").notNull(),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertBookmarkSchema = createInsertSchema(bookmarks).omit({ id: true, createdAt: true });

export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;
