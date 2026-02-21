---
name: kis-kiwoom-api
description: Reference for using KIS (한국투자증권) and Kiwoom (키움증권) API wrappers in this project. Use when working with stock trading, placing orders, checking balances, fetching prices, market data, or any securities API integration.
---

# KIS & Kiwoom API Usage Guide

## File Locations

| File | Description |
|------|-------------|
| `server/kisApi.ts` | KIS API wrapper (시세, 주문, 잔고, 호가, ETF 등) |
| `server/kiwoomApi.ts` | Kiwoom API wrapper (인증, 잔고, 주문, 이력) |

## Authentication Flow

### System-level (Admin KIS Config)

```
서버 시작 → loadSystemConfigFromDB() → 모듈 변수 설정
                                         ↓
                                  ENV fallback (KIS_APP_KEY, etc.)
```

API 호출 시 자동으로 토큰 발급/캐싱:
- `getAccessToken()` → 매매용 토큰 (자동 갱신)
- `getMarketToken()` → 시세 조회용 토큰 (항상 실전 URL)

### User-level (개인 KIS 인증)

```typescript
// 1. DB에서 사용자 설정 조회
const config = await storage.getUserTradingConfig(userId);

// 2. UserKisCredentials 객체 구성
const creds: UserKisCredentials = {
  appKey: config.appKey,
  appSecret: config.appSecret,
  accountNo: config.accountNo,
  accountProductCd: config.accountProductCd || "01",
  mockTrading: config.mockTrading ?? true,  // 기본 모의투자
};

// 3. 사용자별 API 호출
const balance = await kisApi.getUserAccountBalance(userId, creds);
const order = await kisApi.userPlaceOrder(userId, creds, orderParams);
```

## KIS API Functions Reference

### 시세 조회 (토큰: 시장용)

| Function | Returns | Note |
|----------|---------|------|
| `getCurrentPrice(stockCode)` | `{ price, change, changePercent, volume, high, low, open, stockName }` | 실시간 현재가 |
| `getAskingPrice(stockCode)` | `{ sellPrices, buyPrices, totalSellQty, totalBuyQty }` | 네이버 금융 호가 (토큰 불필요) |
| `getStockDailyPrices(stockCode, period)` | `{ date, closePrice, openPrice, highPrice, lowPrice, volume }[]` | period: "1M", "3M", "6M", "1Y" |
| `getEtfDailyPrices(etfCode, period)` | 위와 동일 | ETF 전용 |
| `getMarketIndices()` | `{ name, price, change, changePercent }[]` | KOSPI, KOSDAQ 등 |
| `getInvestorTrends()` | `{ category, date, individual, foreign, institution }[]` | 투자자별 매매동향 |
| `getVolumeRanking()` | `{ stockCode, stockName, volume, price, changePercent, ... }[]` | 거래량 급등 순위 |
| `fetchNaverBulkPrices(codes[])` | `Map<string, { price, change, ... }>` | 네이버 벌크 시세 |
| `getEtfComponents(etfCode)` | `{ etfName, components: { stockCode, stockName, weight }[] }` | ETF 구성종목 |

### 매매 (토큰: 매매용)

| Function | Params | Returns |
|----------|--------|---------|
| `placeOrder(params)` | `{ stockCode, orderType: "buy"\|"sell", quantity, price, orderMethod: "limit"\|"market" }` | `{ success, orderNo?, message }` |
| `getAccountBalance()` | - | `{ holdings: HoldingItem[], summary: BalanceSummary }` |
| `getOrderHistory(start?, end?)` | YYYYMMDD strings | `OrderHistoryItem[]` |

### 사용자별 매매

| Function | Extra Params | Note |
|----------|-------------|------|
| `userPlaceOrder(userId, creds, params)` | UserKisCredentials | 사용자별 토큰 캐싱 |
| `getUserAccountBalance(userId, creds)` | UserKisCredentials | |
| `getUserOrderHistory(userId, creds, start?, end?)` | UserKisCredentials | |
| `validateUserCredentials(userId, creds)` | UserKisCredentials | 인증 테스트 |

### 유틸리티

| Function | Purpose |
|----------|---------|
| `isConfigured()` | APP_KEY + APP_SECRET 설정 여부 |
| `isTradingConfigured()` | + ACCOUNT_NO 포함 설정 여부 |
| `getTradingStatus()` | 현재 설정 상태 객체 |
| `clearUserTokenCache(userId)` | 특정 사용자 토큰 캐시 제거 |
| `clearAllCaches()` | 전체 캐시 초기화 |

## Kiwoom API Functions Reference

| Function | Purpose |
|----------|---------|
| `getKiwoomToken(userId, creds)` | 토큰 발급/캐싱 |
| `validateUserCredentials(userId, creds)` | 인증 테스트 |
| `getUserTradingStatus(creds)` | 설정 상태 확인 |
| `getUserAccountBalance(userId, creds)` | 계좌 잔고 조회 |
| `userPlaceOrder(userId, creds, params)` | 주문 실행 |
| `getUserOrderHistory(userId, creds, start?, end?)` | 주문 이력 |

## Key Types

```typescript
interface OrderParams {
  stockCode: string;
  orderType: "buy" | "sell";
  quantity: number;
  price: number;
  orderMethod: "limit" | "market";
}

interface OrderResult {
  success: boolean;
  orderNo?: string;
  message: string;
}

interface HoldingItem {
  stockCode: string;
  stockName: string;
  holdingQty: number;
  avgBuyPrice: number;
  currentPrice: number;
  evalAmount: number;
  evalProfitLoss: number;
  evalProfitRate: number;  // %
  buyAmount: number;
}

interface BalanceSummary {
  depositAmount: number;       // 예수금
  totalEvalAmount: number;     // 총평가금액
  totalBuyAmount: number;      // 매입금액합계
  totalEvalProfitLoss: number; // 평가손익합계
  totalEvalProfitRate: number; // 총수익률(%)
}

interface UserKisCredentials {
  appKey: string;
  appSecret: string;
  accountNo: string;
  accountProductCd: string;  // default "01"
  mockTrading: boolean;      // default true
}
```

## URL Routing

| Environment | URL | When |
|-------------|-----|------|
| 실전투자 | `https://openapi.koreainvestment.com:9443` | `mockTrading: false` |
| 모의투자 | `https://openapivts.koreainvestment.com:29443` | `mockTrading: true` (default) |
| 시세 조회 | 항상 실전 URL | 시세는 모의투자 서버에 없음 |

## TR_ID Mapping

모의투자와 실전투자에서 TR_ID가 다름:

```
실전: TTTC0802U (매수), TTTC0801U (매도), TTTC8434R (잔고)
모의: VTTC0802U (매수), VTTC0801U (매도), VTTC8434R (잔고)
```

`getTrIds(mockTrading)` 함수가 자동으로 적절한 TR_ID 반환.

## Common Patterns

### 현재가 조회 후 주문

```typescript
const price = await kisApi.getCurrentPrice("005930");
if (!price) throw new Error("시세 조회 실패");

const result = await kisApi.userPlaceOrder(userId, creds, {
  stockCode: "005930",
  orderType: "buy",
  quantity: 10,
  price: parseInt(price.price),
  orderMethod: "limit",
});

if (result.success) {
  console.log(`주문 성공: ${result.orderNo}`);
}
```

### Rate Limiting

KIS API는 초당 요청 제한이 있으므로 반복 호출 시 반드시 딜레이:

```typescript
for (const code of stockCodes) {
  const price = await kisApi.getCurrentPrice(code);
  await new Promise(r => setTimeout(r, 150)); // 150ms 이상
}
```

### 에러 핸들링

KIS API 응답 구조:
- `rt_cd === "0"` → 성공
- `rt_cd !== "0"` → 실패, `msg1` 필드에 에러 메시지

```typescript
if (response.data.rt_cd !== "0") {
  throw new Error(response.data.msg1 || "API 호출 실패");
}
```

## Important Notes

- 시세 API는 항상 **실전 URL** 사용 (모의투자 서버에 시세 데이터 없음)
- `mockTrading: true`가 프로젝트 기본값 — 실전 전환 시 사용자 동의 필수
- 토큰은 24시간 유효, 모듈 내부에서 자동 갱신/캐싱
- `hashkey`는 POST 요청(주문)에만 필요, GET 요청(시세/잔고)에는 불필요
- 계좌번호 형식: 8자리 계좌 + 2자리 상품코드 (예: `12345678` + `01`)
