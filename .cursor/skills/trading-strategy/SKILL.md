---
name: trading-strategy
description: Guide for adding new automated trading strategies to the Sheet-Manager project. Use when creating, modifying, or extending trading strategies, auto-trade logic, gap strategy, buy/sell signals, or position management. Covers the Phase-based execution pattern, DB schema conventions, and frontend panel structure.
---

# Trading Strategy Development Guide

## Architecture Overview

All trading strategies follow a **Phase-based pipeline** pattern:

```
Phase 1: Pre-market Scan → Phase 2: Signal Detection → Phase 3: Order Execution → Phase 4: Exit Check
```

### Key Files

| File | Role |
|------|------|
| `server/gapStrategy.ts` | Reference implementation (시가급등 추세추종) |
| `server/kisApi.ts` | KIS API wrapper (price, order, balance) |
| `server/kiwoomApi.ts` | Kiwoom API wrapper |
| `server/routes.ts` | API routes (`/api/trading/gap-strategy/*`) |
| `server/storage.ts` | DB CRUD operations |
| `shared/schema.ts` | Drizzle ORM table definitions |
| `client/src/components/GapStrategyPanel.tsx` | Reference UI panel |

## Adding a New Strategy

### Step 1: Define DB Schema (`shared/schema.ts`)

Follow the existing 3-table pattern:

```typescript
// 1) 전략 설정 테이블
export const myStrategy = pgTable("my_strategy", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull().default("전략 이름"),
  isActive: boolean("is_active").default(false),
  // ... strategy-specific config fields ...
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// 2) 포지션 추적 테이블
export const myStrategyPositions = pgTable("my_strategy_positions", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id").notNull(),
  userId: integer("user_id").notNull(),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  status: text("status").notNull().default("pending"),
  // ... position-specific fields (avgBuyPrice, totalQty, profitLoss, etc.) ...
  openedAt: timestamp("opened_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  closedAt: timestamp("closed_at"),
});

// 3) 실행 로그 테이블
export const myStrategyLogs = pgTable("my_strategy_logs", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id").notNull(),
  positionId: integer("position_id"),
  action: text("action").notNull(),
  stockCode: text("stock_code"),
  stockName: text("stock_name"),
  detail: text("detail"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});
```

After defining schema, add insert schemas + types, then run `npx drizzle-kit generate` and `npx drizzle-kit push`.

### Step 2: Add Storage Methods (`server/storage.ts`)

Add CRUD methods following existing pattern:

```typescript
// Interface methods to add:
getMyStrategy(userId: number): Promise<MyStrategy | undefined>;
upsertMyStrategy(data: InsertMyStrategy): Promise<MyStrategy>;
getActiveMyPositions(strategyId: number): Promise<MyStrategyPosition[]>;
createMyPosition(data: InsertMyStrategyPosition): Promise<MyStrategyPosition>;
updateMyPosition(id: number, updates: Partial<...>): Promise<void>;
createMyLog(data: InsertMyStrategyLog): Promise<MyStrategyLog>;
getMyLogs(strategyId: number, limit?: number): Promise<MyStrategyLog[]>;
```

### Step 3: Implement Strategy Engine (`server/myStrategy.ts`)

Follow the 4-phase pattern from `gapStrategy.ts`:

```typescript
// Phase 1: Universe/Candidate Scan
export async function runScan(strategy): Promise<string[]> { ... }

// Phase 2: Signal Detection (entry trigger)
export async function runSignalDetection(strategy, userCreds?): Promise<number> { ... }

// Phase 3: Order Execution & Monitoring
export async function runOrderMonitoring(strategy, userCreds?): Promise<string[]> { ... }

// Phase 4: Exit Check (stop-loss, take-profit, MA break, etc.)
export async function runExitCheck(strategy, userCreds?): Promise<string[]> { ... }

// Main dispatcher (time-based)
export async function executeStrategy(userId: number): Promise<{ phase: string; results: string[] }> {
  const strategy = await storage.getMyStrategy(userId);
  if (!strategy || !strategy.isActive) return { phase: "inactive", results: [] };

  const config = await storage.getUserTradingConfig(strategy.userId);
  const userCreds = config ? { appKey: config.appKey, ... } : undefined;

  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const timeCode = kst.getHours() * 100 + kst.getMinutes();

  if (timeCode >= 850 && timeCode < 900) return { phase: "scan", results: await runScan(strategy) };
  if (timeCode >= 901 && timeCode <= 905) return { phase: "signal", results: [...] };
  if (timeCode > 905 && timeCode <= 1520) return { phase: "monitor", results: await runOrderMonitoring(strategy, userCreds) };
  if (timeCode > 1520 && timeCode <= 1528) return { phase: "exit", results: await runExitCheck(strategy, userCreds) };

  return { phase: "closed", results: ["장 운영시간이 아닙니다."] };
}

// Manual phase execution (for testing)
export async function executePhase(userId: number, phase: string): Promise<{ results: string[] }> { ... }
```

### Step 4: Add API Routes (`server/routes.ts`)

Standard route set (place near existing gap-strategy routes):

```typescript
app.get("/api/trading/my-strategy", requireUser, ...);          // 설정 조회
app.post("/api/trading/my-strategy", requireUser, ...);         // 설정 저장
app.post("/api/trading/my-strategy/toggle", requireUser, ...);  // 활성화 토글
app.get("/api/trading/my-strategy/positions", requireUser, ...); // 포지션 목록
app.get("/api/trading/my-strategy/logs", requireUser, ...);     // 로그 조회
app.post("/api/trading/my-strategy/execute", requireUser, ...); // 수동 실행
app.post("/api/trading/my-strategy/positions/:id/close", requireUser, ...); // 수동 청산
```

### Step 5: Build UI Panel (`client/src/components/MyStrategyPanel.tsx`)

Follow `GapStrategyPanel.tsx` structure with 3 sections:

1. **설정 카드**: 전략 파라미터 입력 + 활성화 토글 + 저장 버튼
2. **포지션 테이블**: 활성 포지션 목록 (종목, 상태, 수익률, 수동청산 버튼)
3. **로그 패널**: 실행 로그 시간순 표시 + 수동 Phase 실행 버튼 (scan/signal/monitor/exit)

## Reusable Utilities

These functions from `gapStrategy.ts` and `kisApi.ts` are reusable across strategies:

| Function | What it does |
|----------|-------------|
| `kisApi.getCurrentPrice(code)` | 현재가/시가/고가/저가/거래량 조회 |
| `kisApi.getStockDailyPrices(code, period)` | 일봉 종가 배열 (MA 계산용) |
| `kisApi.getAccountBalance()` | 계좌 잔고/평가금액 |
| `kisApi.placeOrder({ stockCode, orderType, quantity, price, orderMethod })` | 매수/매도 주문 |
| `kisApi.getVolumeRanking()` | 거래량 급등 종목 순위 |
| `gapStrategy.calculateMA(code)` | MA5/10/20/60 + 정배열 체크 |
| `gapStrategy.createBuyPlan(amount, price, ...)` | 분할매수 계획 생성 |
| `gapStrategy.checkSellSignal(code, period)` | N일선 이탈 매도 판단 |

## Common Strategy Patterns

### RSI 계산

```typescript
function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const rs = losses === 0 ? 100 : gains / losses;
  return 100 - 100 / (1 + rs);
}
```

### 볼린저밴드

```typescript
function bollingerBands(closes: number[], period = 20, mult = 2) {
  const slice = closes.slice(-period);
  const mean = slice.reduce((s, v) => s + v, 0) / period;
  const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
  return { upper: mean + mult * std, middle: mean, lower: mean - mult * std };
}
```

### 손절/익절 로직

```typescript
function checkStopTakeProfit(
  currentPrice: number, avgBuyPrice: number,
  stopLossPercent: number, takeProfitPercent: number
): "hold" | "stop_loss" | "take_profit" {
  const pnlPercent = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
  if (pnlPercent <= -stopLossPercent) return "stop_loss";
  if (pnlPercent >= takeProfitPercent) return "take_profit";
  return "hold";
}
```

## Important Notes

- **Vercel Serverless**: 백그라운드 `setInterval` 금지 → Cron Job 또는 프론트엔드 수동 실행만 사용
- **모의투자 기본**: `mockTrading: true`가 기본값. 실전 전환 시 사용자 명시 확인 필요
- **API Rate Limit**: KIS API 호출 간 `await sleep(150~200)` 삽입 필수
- **인증 흐름**: `storage.getUserTradingConfig(userId)` → `userCreds` 객체 생성 → `kisApi.userPlaceOrder(userId, creds, params)`
