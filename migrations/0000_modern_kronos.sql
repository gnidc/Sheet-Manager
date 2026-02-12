CREATE TABLE "auto_trade_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" text NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"rule_type" text NOT NULL,
	"target_price" numeric NOT NULL,
	"quantity" integer NOT NULL,
	"order_method" text DEFAULT 'limit',
	"is_active" boolean DEFAULT true,
	"status" text DEFAULT 'active',
	"executed_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"section" text DEFAULT '기본',
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "etf_trends" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"comment" text,
	"thumbnail" text,
	"source_type" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"stock_code" text NOT NULL,
	"stock_name" text,
	"order_type" text NOT NULL,
	"order_method" text DEFAULT 'limit',
	"quantity" integer NOT NULL,
	"price" numeric,
	"total_amount" numeric,
	"status" text DEFAULT 'pending',
	"kis_order_no" text,
	"auto_trade_rule_id" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"executed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_trading_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"app_key" text NOT NULL,
	"app_secret" text NOT NULL,
	"account_no" text NOT NULL,
	"account_product_cd" text DEFAULT '01',
	"mock_trading" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "user_trading_configs_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"google_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"picture" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;