import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const etfs = pgTable("etfs", {
  id: serial("id").primaryKey(),
  generation: text("generation"), // e.g. 2세대
  category: text("category"),     // e.g. 미국국채
  country: text("country"),       // e.g. 미국
  name: text("name").notNull(),   // e.g. TIGER 미국30년국채...
  code: text("code").notNull(),   // e.g. 476550
  fee: text("fee"),               // e.g. 0.39%
  yield: text("yield"),           // e.g. 12%(타겟)
  marketCap: text("market_cap"),  // e.g. 1.1조/>100억
  dividendCycle: text("dividend_cycle"), // e.g. 월지급(말일)
  optionType: text("option_type"),       // e.g. 위클리(30%)
  underlyingAsset: text("underlying_asset"),
  callOption: text("call_option"),       // e.g. TLT
  listingDate: text("listing_date"),     // e.g. 24.02
  notes: text("notes"),
  linkProduct: text("link_product"),
  linkBlog: text("link_blog"),
});

export const insertEtfSchema = createInsertSchema(etfs).omit({ id: true });

export type Etf = typeof etfs.$inferSelect;
export type InsertEtf = z.infer<typeof insertEtfSchema>;

// API types
export type CreateEtfRequest = InsertEtf;
export type UpdateEtfRequest = Partial<InsertEtf>;
