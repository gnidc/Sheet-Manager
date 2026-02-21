CREATE TABLE "ai_prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT '일반',
	"is_default" boolean DEFAULT false,
	"is_shared" boolean DEFAULT false,
	"shared_by" text,
	"user_id" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"analysis" text NOT NULL,
	"analyzed_at" text NOT NULL,
	"saved_at" text NOT NULL,
	"items" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocked_ips" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_address" text NOT NULL,
	"reason" text NOT NULL,
	"blocked_by" text,
	"access_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"blocked_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "gap_strategy" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text DEFAULT '시가급등 추세추종' NOT NULL,
	"is_active" boolean DEFAULT false,
	"universe_type" text DEFAULT 'both',
	"min_gap_percent" numeric DEFAULT '3',
	"max_gap_percent" numeric DEFAULT '7',
	"ma_aligned" boolean DEFAULT true,
	"price_above_ma5" boolean DEFAULT true,
	"first_buy_ratio" integer DEFAULT 30,
	"add_buy_ratio" integer DEFAULT 20,
	"add_buy_trigger_percent" numeric DEFAULT '1',
	"sell_ma_period" integer DEFAULT 5,
	"max_position_ratio" integer DEFAULT 50,
	"max_stocks_count" integer DEFAULT 5,
	"candidates" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gap_strategy_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_id" integer NOT NULL,
	"position_id" integer,
	"action" text NOT NULL,
	"stock_code" text,
	"stock_name" text,
	"detail" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gap_strategy_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"status" text DEFAULT 'scanning',
	"prev_close" numeric,
	"open_price" numeric,
	"gap_percent" numeric,
	"target_amount" numeric,
	"total_buy_qty" integer DEFAULT 0,
	"total_buy_amount" numeric DEFAULT '0',
	"avg_buy_price" numeric,
	"buy_phase" integer DEFAULT 0,
	"last_buy_price" numeric,
	"sell_price" numeric,
	"sell_qty" integer,
	"sell_amount" numeric,
	"profit_loss" numeric,
	"profit_rate" numeric,
	"ma5" numeric,
	"ma10" numeric,
	"ma20" numeric,
	"ma60" numeric,
	"opened_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "key_research" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"link" text DEFAULT '',
	"source" text DEFAULT '',
	"date" text DEFAULT '',
	"file" text DEFAULT '',
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "multi_factor_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_id" integer NOT NULL,
	"position_id" integer,
	"action" text NOT NULL,
	"stock_code" text,
	"stock_name" text,
	"detail" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "multi_factor_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"status" text DEFAULT 'signal_detected',
	"signal_score" numeric,
	"target_amount" numeric,
	"total_buy_qty" integer DEFAULT 0,
	"total_buy_amount" numeric DEFAULT '0',
	"avg_buy_price" numeric,
	"buy_phase" integer DEFAULT 0,
	"last_buy_price" numeric,
	"sell_price" numeric,
	"sell_qty" integer,
	"sell_amount" numeric,
	"profit_loss" numeric,
	"profit_rate" numeric,
	"factor_details" text,
	"ma5" numeric,
	"ma20" numeric,
	"rsi" numeric,
	"bollinger_upper" numeric,
	"bollinger_lower" numeric,
	"opened_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "multi_factor_strategy" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text DEFAULT '멀티팩터 전략' NOT NULL,
	"is_active" boolean DEFAULT false,
	"universe_type" text DEFAULT 'both',
	"weight_ma" integer DEFAULT 30,
	"weight_rsi" integer DEFAULT 20,
	"weight_bollinger" integer DEFAULT 20,
	"weight_volume" integer DEFAULT 15,
	"weight_gap" integer DEFAULT 15,
	"rsi_period" integer DEFAULT 14,
	"rsi_buy_threshold" integer DEFAULT 30,
	"rsi_sell_threshold" integer DEFAULT 70,
	"bollinger_period" integer DEFAULT 20,
	"bollinger_mult" numeric DEFAULT '2',
	"volume_top_n" integer DEFAULT 50,
	"min_gap_percent" numeric DEFAULT '2',
	"max_gap_percent" numeric DEFAULT '8',
	"buy_score_threshold" integer DEFAULT 70,
	"sell_score_threshold" integer DEFAULT 30,
	"first_buy_ratio" integer DEFAULT 40,
	"add_buy_ratio" integer DEFAULT 30,
	"add_buy_trigger_percent" numeric DEFAULT '2',
	"stop_loss_percent" numeric DEFAULT '5',
	"take_profit_percent" numeric DEFAULT '10',
	"max_position_ratio" integer DEFAULT 50,
	"max_stocks_count" integer DEFAULT 5,
	"candidates" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notion_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer DEFAULT -1 NOT NULL,
	"api_key" text NOT NULL,
	"database_id" text NOT NULL,
	"purpose" text DEFAULT 'research' NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qna_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"user_name" text,
	"user_email" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT 'general',
	"reply_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qna_replies" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer,
	"user_name" text,
	"user_email" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "satellite_etfs" (
	"id" serial PRIMARY KEY NOT NULL,
	"etf_code" text NOT NULL,
	"etf_name" text NOT NULL,
	"sector" text DEFAULT '기본',
	"memo" text,
	"list_type" text DEFAULT 'common',
	"user_id" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_etfs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"etf_code" text NOT NULL,
	"etf_name" text NOT NULL,
	"category" text,
	"asset_manager" text,
	"listing_date" text,
	"total_asset" text,
	"expense" text,
	"benchmark" text,
	"recent_price" text,
	"recent_change" text,
	"portfolio_data" text,
	"comment" text,
	"related_links" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"audit_type" text NOT NULL,
	"status" text NOT NULL,
	"summary" text NOT NULL,
	"details" text NOT NULL,
	"total_checks" integer DEFAULT 0,
	"passed_checks" integer DEFAULT 0,
	"warning_checks" integer DEFAULT 0,
	"critical_checks" integer DEFAULT 0,
	"executed_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_drill_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"drill_type" text NOT NULL,
	"status" text NOT NULL,
	"summary" text NOT NULL,
	"details" text NOT NULL,
	"total_tests" integer DEFAULT 0,
	"passed_tests" integer DEFAULT 0,
	"failed_tests" integer DEFAULT 0,
	"duration" integer DEFAULT 0,
	"executed_by" text,
	"executed_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_remediations" (
	"id" serial PRIMARY KEY NOT NULL,
	"action_type" text NOT NULL,
	"status" text NOT NULL,
	"summary" text NOT NULL,
	"details" text NOT NULL,
	"affected_count" integer DEFAULT 0,
	"executed_by" text,
	"executed_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_execution_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"instance_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"skill_code" text NOT NULL,
	"stock_code" text,
	"stock_name" text,
	"action" text NOT NULL,
	"detail" text,
	"current_price" numeric,
	"indicator_values" text,
	"order_result" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "steem_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"author" text NOT NULL,
	"permlink" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"tags" text NOT NULL,
	"category" text DEFAULT 'kr',
	"status" text DEFAULT 'published',
	"steem_url" text,
	"tx_id" text,
	"error_message" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_ai_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"market" text DEFAULT 'domestic',
	"exchange" text,
	"analysis_result" text NOT NULL,
	"summary" text,
	"rating" text,
	"user_id" integer,
	"user_name" text,
	"is_public" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text,
	"market" text DEFAULT 'domestic',
	"user_id" integer,
	"user_name" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stop_loss_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"stock_code" text NOT NULL,
	"stock_name" text,
	"buy_price" numeric NOT NULL,
	"quantity" integer NOT NULL,
	"stop_loss_percent" numeric NOT NULL,
	"stop_type" text DEFAULT 'simple' NOT NULL,
	"stop_price" numeric NOT NULL,
	"highest_price" numeric,
	"status" text DEFAULT 'active',
	"kis_order_no" text,
	"trigger_price" numeric,
	"error_message" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"triggered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "strategy_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"period" text NOT NULL,
	"prompt" text NOT NULL,
	"urls" text NOT NULL,
	"file_names" text NOT NULL,
	"source" text,
	"analysis_result" text NOT NULL,
	"user_id" integer,
	"created_by" text,
	"is_shared" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"period" text NOT NULL,
	"title" text NOT NULL,
	"period_label" text NOT NULL,
	"report_data" text NOT NULL,
	"user_id" integer,
	"created_by" text,
	"is_shared" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_trading_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"broker" text DEFAULT 'kis',
	"app_key" text NOT NULL,
	"app_secret" text NOT NULL,
	"account_no" text NOT NULL,
	"account_product_cd" text DEFAULT '01',
	"mock_trading" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenbagger_stocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"market" text DEFAULT 'domestic',
	"exchange" text,
	"sector" text DEFAULT '기본',
	"memo" text,
	"target_price" text,
	"buy_price" text,
	"reason" text,
	"ai_analysis" text,
	"ai_analyzed_at" timestamp,
	"list_type" text DEFAULT 'common',
	"user_id" integer,
	"is_shared" boolean DEFAULT false,
	"shared_by" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"skill_code" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"icon" text,
	"params_schema" text,
	"default_params" text,
	"is_builtin" boolean DEFAULT true,
	"is_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "trading_skills_skill_code_unique" UNIQUE("skill_code")
);
--> statement-breakpoint
CREATE TABLE "user_ai_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"label" text DEFAULT '기본',
	"ai_provider" text DEFAULT 'gemini',
	"gemini_api_key" text,
	"openai_api_key" text,
	"groq_api_key" text,
	"use_own_key" boolean DEFAULT true,
	"is_active" boolean DEFAULT false,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_linked_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"primary_user_id" integer NOT NULL,
	"linked_user_id" integer NOT NULL,
	"is_active" boolean DEFAULT false,
	"linked_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_skill_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"skill_id" integer NOT NULL,
	"label" text,
	"stock_code" text,
	"stock_name" text,
	"params" text,
	"quantity" integer DEFAULT 0,
	"order_method" text DEFAULT 'limit',
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 0,
	"status" text DEFAULT 'active',
	"last_checked_at" timestamp,
	"triggered_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"user_email" text,
	"user_name" text,
	"ip_address" text,
	"user_agent" text,
	"page" text DEFAULT '/',
	"session_id" text,
	"visited_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_etfs" (
	"id" serial PRIMARY KEY NOT NULL,
	"etf_code" text NOT NULL,
	"etf_name" text NOT NULL,
	"sector" text DEFAULT '기본',
	"memo" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_stocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_code" text NOT NULL,
	"stock_name" text NOT NULL,
	"market" text DEFAULT 'domestic',
	"exchange" text,
	"sector" text DEFAULT '기본',
	"memo" text,
	"list_type" text DEFAULT 'common',
	"user_id" integer,
	"is_shared" boolean DEFAULT false,
	"shared_by" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_trading_configs" DROP CONSTRAINT "user_trading_configs_user_id_unique";--> statement-breakpoint
ALTER TABLE "user_trading_configs" ADD COLUMN "broker" text DEFAULT 'kis';--> statement-breakpoint
ALTER TABLE "user_trading_configs" ADD COLUMN "label" text DEFAULT '기본';--> statement-breakpoint
ALTER TABLE "user_trading_configs" ADD COLUMN "is_active" boolean DEFAULT false;