import axios from "axios";

// ========== KIS API 설정 ==========
const KIS_MOCK_TRADING = process.env.KIS_MOCK_TRADING?.toLowerCase() === "true";
const KIS_REAL_URL = "https://openapi.koreainvestment.com:9443";
const KIS_MOCK_URL = "https://openapivts.koreainvestment.com:29443";
// 매매용 URL (모의/실전 분리)
const KIS_TRADE_URL = KIS_MOCK_TRADING ? KIS_MOCK_URL : KIS_REAL_URL;
// 시세조회용 URL (항상 실전 서버 사용 - 모의투자 서버는 시세 API 미지원)
const KIS_MARKET_URL = KIS_REAL_URL;
const KIS_APP_KEY = process.env.KIS_APP_KEY || "";
const KIS_APP_SECRET = process.env.KIS_APP_SECRET || "";

// 계좌번호 자동 파싱: "50151234-01", "5015123401", "50151234" 모두 지원
const rawAccountNo = (process.env.KIS_ACCOUNT_NO || "").replace(/-/g, "").trim();
const KIS_ACCOUNT_NO = rawAccountNo.length >= 10 ? rawAccountNo.slice(0, 8) : rawAccountNo; // 앞 8자리
const KIS_ACCOUNT_PRODUCT_CD = rawAccountNo.length >= 10 
  ? rawAccountNo.slice(8, 10) 
  : (process.env.KIS_ACCOUNT_PRODUCT_CD || "01"); // 뒤 2자리

console.log(`[KIS] Account parsed: CANO=${KIS_ACCOUNT_NO.slice(0,4)}****, ACNT_PRDT_CD=${KIS_ACCOUNT_PRODUCT_CD}, rawLength=${rawAccountNo.length}`);

// tr_id는 모의투자/실전투자에 따라 다름
const TR_ID = {
  buy: KIS_MOCK_TRADING ? "VTTC0802U" : "TTTC0802U",
  sell: KIS_MOCK_TRADING ? "VTTC0801U" : "TTTC0801U",
  balance: KIS_MOCK_TRADING ? "VTTC8434R" : "TTTC8434R",
  orderHistory: KIS_MOCK_TRADING ? "VTTC8001R" : "TTTC8001R",
  currentPrice: "FHKST01010100",
  dailyPrice: "FHKST03010100",
};

// 사용자별 인증 정보 인터페이스
export interface UserKisCredentials {
  appKey: string;
  appSecret: string;
  accountNo: string;
  accountProductCd: string;
  mockTrading: boolean;
}

function getTrIds(mockTrading: boolean) {
  return {
    buy: mockTrading ? "VTTC0802U" : "TTTC0802U",
    sell: mockTrading ? "VTTC0801U" : "TTTC0801U",
    balance: mockTrading ? "VTTC8434R" : "TTTC8434R",
    orderHistory: mockTrading ? "VTTC8001R" : "TTTC8001R",
    currentPrice: "FHKST01010100",
    dailyPrice: "FHKST03010100",
  };
}

function getTradeUrl(mockTrading: boolean) {
  return mockTrading ? KIS_MOCK_URL : KIS_REAL_URL;
}

// 매매용 토큰 (모의투자 서버)
let cachedTradeToken: { token: string; expiresAt: number } | null = null;
// 시세조회용 토큰 (실전 서버 - 모의투자 서버는 시세 API 미지원)
let cachedMarketToken: { token: string; expiresAt: number } | null = null;

// 사용자별 토큰 캐시 (최대 50명 - 메모리 보호)
const userTokenCache = new Map<number, { trade: { token: string; expiresAt: number } | null; market: { token: string; expiresAt: number } | null }>();
const USER_TOKEN_CACHE_MAX_SIZE = 50;

// ========== DB 기반 토큰 캐싱 (Vercel cold start 대응) ==========
// 메모리 캐시에서 DB 재확인까지의 간격 (30분)
const DB_TOKEN_MEMORY_TTL = 30 * 60 * 1000;

async function getTokenFromDB(cacheKey: string): Promise<{ token: string; expiresAt: number } | null> {
  try {
    const { db } = await import("./db.js");
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(
      sql`SELECT token, expires_at FROM kis_token_cache WHERE cache_key = ${cacheKey} LIMIT 1`
    );
    const row = (result as any).rows?.[0];
    if (row && Date.now() < Number(row.expires_at)) {
      console.log(`[KIS] Token cache HIT from DB: ${cacheKey}`);
      return { token: row.token, expiresAt: Number(row.expires_at) };
    }
    return null;
  } catch (err: any) {
    // 테이블이 아직 없을 수 있음 (첫 실행 시)
    if (err.message?.includes('does not exist') || err.code === '42P01') {
      return null;
    }
    console.warn(`[KIS] Token DB read failed for ${cacheKey}:`, err.message);
    return null;
  }
}

async function saveTokenToDB(cacheKey: string, token: string, expiresAt: number): Promise<void> {
  try {
    const { db } = await import("./db.js");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      INSERT INTO kis_token_cache (cache_key, token, expires_at)
      VALUES (${cacheKey}, ${token}, ${String(expiresAt)})
      ON CONFLICT (cache_key) DO UPDATE SET token = ${token}, expires_at = ${String(expiresAt)}, created_at = CURRENT_TIMESTAMP
    `);
    console.log(`[KIS] Token saved to DB: ${cacheKey}`);
  } catch (err: any) {
    if (err.message?.includes('does not exist') || err.code === '42P01') {
      return; // 테이블 미존재 시 무시
    }
    console.warn(`[KIS] Token DB save failed for ${cacheKey}:`, err.message);
  }
}

// ========== 인증 ==========
async function getTokenFromServer(baseUrl: string, label: string, retries = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(`${baseUrl}/oauth2/tokenP`, {
        grant_type: "client_credentials",
        appkey: KIS_APP_KEY,
        appsecret: KIS_APP_SECRET,
      });

      const token = response.data.access_token;
      console.log(`KIS API ${label} token obtained successfully`);
      return token;
    } catch (error: any) {
      const errCode = error.response?.data?.error_code;
      // EGW00133: 토큰 발급 1분 쿨다운
      if (errCode === "EGW00133" && attempt < retries) {
        console.log(`KIS ${label} token rate limited, waiting 65s... (attempt ${attempt + 1}/${retries + 1})`);
        await new Promise(resolve => setTimeout(resolve, 65000));
        continue;
      }
      console.error(`Failed to get KIS ${label} access token:`, error.response?.data || error.message);
      throw new Error(`Failed to authenticate with Korea Investment API (${label})`);
    }
  }
  throw new Error(`Failed to get KIS ${label} token after retries`);
}

// 매매용 토큰 (모의/실전 서버)
export async function getAccessToken(): Promise<string> {
  // 1순위: 메모리 캐시 (동일 인스턴스 내 가장 빠름)
  if (cachedTradeToken && Date.now() < cachedTradeToken.expiresAt) {
    return cachedTradeToken.token;
  }

  // 2순위: DB 캐시 (다른 인스턴스에서 발급한 토큰 재사용 - Vercel cold start 대응)
  const dbCached = await getTokenFromDB("admin-trade");
  if (dbCached) {
    // 메모리에도 캐싱 (DB_TOKEN_MEMORY_TTL 후 DB 재확인)
    cachedTradeToken = { token: dbCached.token, expiresAt: Math.min(dbCached.expiresAt, Date.now() + DB_TOKEN_MEMORY_TTL) };
    return dbCached.token;
  }

  // 3순위: KIS API에서 새 토큰 발급
  const token = await getTokenFromServer(KIS_TRADE_URL, "trade");
  const expiresAt = Date.now() + (86400 - 300) * 1000;
  cachedTradeToken = { token, expiresAt };

  // DB에 저장 (비동기, 실패해도 무방)
  saveTokenToDB("admin-trade", token, expiresAt);

  return token;
}

// 시세조회용 토큰 (항상 실전 서버)
async function getMarketToken(): Promise<string> {
  // 실전투자 모드면 매매 토큰과 동일
  if (!KIS_MOCK_TRADING) {
    return getAccessToken();
  }

  // 1순위: 메모리 캐시
  if (cachedMarketToken && Date.now() < cachedMarketToken.expiresAt) {
    return cachedMarketToken.token;
  }

  // 2순위: DB 캐시
  const dbCached = await getTokenFromDB("admin-market");
  if (dbCached) {
    cachedMarketToken = { token: dbCached.token, expiresAt: Math.min(dbCached.expiresAt, Date.now() + DB_TOKEN_MEMORY_TTL) };
    return dbCached.token;
  }

  // 3순위: KIS API 새 토큰 발급
  const token = await getTokenFromServer(KIS_REAL_URL, "market");
  const expiresAt = Date.now() + (86400 - 300) * 1000;
  cachedMarketToken = { token, expiresAt };
  saveTokenToDB("admin-market", token, expiresAt);
  return token;
}

// ========== HashKey (POST 요청 시 필요) ==========
async function getHashKey(body: Record<string, string>): Promise<string> {
  try {
    const response = await axios.post(`${KIS_TRADE_URL}/uapi/hashkey`, body, {
      headers: {
        "content-type": "application/json",
        appkey: KIS_APP_KEY,
        appsecret: KIS_APP_SECRET,
      },
    });
    return response.data.HASH;
  } catch (error: any) {
    console.error("Failed to get hashkey:", error.response?.data || error.message);
    throw new Error("Failed to get hashkey for KIS API");
  }
}

// ========== 가격 조회 (기존) ==========
export interface KisPriceData {
  date: string;
  closePrice: string;
  openPrice?: string;
  highPrice?: string;
  lowPrice?: string;
  volume?: string;
}

async function fetchPriceChunk(
  token: string,
  stockCode: string,
  startDate: Date,
  endDate: Date
): Promise<KisPriceData[]> {
  const formatDate = (d: Date) =>
    d.getFullYear().toString() +
    (d.getMonth() + 1).toString().padStart(2, "0") +
    d.getDate().toString().padStart(2, "0");

  try {
    const response = await axios.get(
      `${KIS_MARKET_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: KIS_APP_KEY,
          appsecret: KIS_APP_SECRET,
          tr_id: TR_ID.dailyPrice,
          custtype: "P",
        },
        params: {
          FID_COND_MRKT_DIV_CODE: "J",
          FID_INPUT_ISCD: stockCode,
          FID_INPUT_DATE_1: formatDate(startDate),
          FID_INPUT_DATE_2: formatDate(endDate),
          FID_PERIOD_DIV_CODE: "D",
          FID_ORG_ADJ_PRC: "0",
        },
      }
    );

    if (response.data.rt_cd !== "0") {
      console.error("KIS API error:", response.data.msg1);
      return [];
    }

    const output2 = response.data.output2 || [];
    
    return output2
      .filter((item: any) => item.stck_bsop_date)
      .map((item: any) => ({
        date: `${item.stck_bsop_date.slice(0, 4)}-${item.stck_bsop_date.slice(4, 6)}-${item.stck_bsop_date.slice(6, 8)}`,
        closePrice: item.stck_clpr,
        openPrice: item.stck_oprc,
        highPrice: item.stck_hgpr,
        lowPrice: item.stck_lwpr,
        volume: item.acml_vol,
      }));
  } catch (error: any) {
    console.error("Failed to fetch ETF prices chunk:", error.response?.data || error.message);
    return [];
  }
}

export async function getEtfDailyPrices(
  stockCode: string,
  period: "1M" | "3M" | "6M" | "1Y"
): Promise<KisPriceData[]> {
  const token = await getMarketToken();

  const periodDays: Record<string, number> = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };
  const days = periodDays[period];

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const allPrices: KisPriceData[] = [];
  
  if (period === "1Y" || period === "6M") {
    const chunkDays = 80;
    let currentEnd = new Date(endDate);
    
    while (currentEnd > startDate) {
      const currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() - chunkDays);
      
      if (currentStart < startDate) {
        currentStart.setTime(startDate.getTime());
      }
      
      const chunk = await fetchPriceChunk(token, stockCode, currentStart, currentEnd);
      allPrices.unshift(...chunk);
      
      currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() - 1);
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const uniquePrices = allPrices.reduce((acc: KisPriceData[], curr) => {
      if (!acc.find(p => p.date === curr.date)) {
        acc.push(curr);
      }
      return acc;
    }, []);
    
    uniquePrices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    console.log(`Fetched ${uniquePrices.length} price records for ${stockCode} (${period})`);
    return uniquePrices;
  } else {
    const prices = await fetchPriceChunk(token, stockCode, startDate, endDate);
    prices.reverse();
    console.log(`Fetched ${prices.length} price records for ${stockCode} (${period})`);
    return prices;
  }
}

export async function getCurrentPrice(stockCode: string): Promise<{
  price: string;
  change: string;
  changePercent: string;
  changeSign?: string;
  volume?: string;
  high?: string;
  low?: string;
  open?: string;
  stockName?: string;
} | null> {
  const token = await getMarketToken();

  try {
    const response = await axios.get(
      `${KIS_MARKET_URL}/uapi/domestic-stock/v1/quotations/inquire-price`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: KIS_APP_KEY,
          appsecret: KIS_APP_SECRET,
          tr_id: TR_ID.currentPrice,
          custtype: "P",
        },
        params: {
          FID_COND_MRKT_DIV_CODE: "J",
          FID_INPUT_ISCD: stockCode,
        },
      }
    );

    if (response.data.rt_cd !== "0") {
      console.error("KIS API error:", response.data.msg1);
      return null;
    }

    const output = response.data.output;
    // 종목명: 여러 필드에서 시도 (API 버전에 따라 다를 수 있음)
    const stockName = output.hts_kor_isnm || output.prdt_name || output.rprs_mrkt_kor_name || undefined;
    return {
      price: output.stck_prpr,
      change: output.prdy_vrss,
      changePercent: output.prdy_ctrt,
      changeSign: output.prdy_vrss_sign, // 1:상한, 2:상승, 3:보합, 4:하한, 5:하락
      volume: output.acml_vol,
      high: output.stck_hgpr,
      low: output.stck_lwpr,
      open: output.stck_oprc,
      stockName,
    };
  } catch (error: any) {
    console.error("Failed to fetch current price:", error.response?.data || error.message);
    throw error;
  }
}

// ========== 종목 호가 조회 (네이버 금융 API - 토큰 불필요, 빠름) ==========
export interface AskingPrice {
  sellPrices: { price: string; qty: string }[];  // 매도호가 (높은가→낮은가)
  buyPrices: { price: string; qty: string }[];   // 매수호가 (높은가→낮은가)
  totalSellQty: string;
  totalBuyQty: string;
}

export async function getAskingPrice(stockCode: string): Promise<AskingPrice | null> {
  try {
    const response = await axios.get(
      `https://m.stock.naver.com/api/stock/${stockCode}/askingPrice`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 5000,
      }
    );

    const data = response.data;
    if (!data) return null;

    // 매도호가: sellInfo 배열 (높은가→낮은가, 이미 정렬됨)
    const sellPrices = (data.sellInfo || []).map((item: any) => ({
      price: String(item.price).replace(/,/g, ""),
      qty: String(item.count).replace(/,/g, ""),
    }));

    // 매수호가: buyInfos 배열 (높은가→낮은가, 이미 정렬됨)
    const buyPrices = (data.buyInfos || []).map((item: any) => ({
      price: String(item.price).replace(/,/g, ""),
      qty: String(item.count).replace(/,/g, ""),
    }));

    return {
      sellPrices,
      buyPrices,
      totalSellQty: String(data.totalSell || "0").replace(/,/g, ""),
      totalBuyQty: String(data.totalBuy || "0").replace(/,/g, ""),
    };
  } catch (error: any) {
    console.error("Failed to fetch Naver asking price:", error.message);
    throw error;
  }
}

// ========== 종목 일봉 차트 조회 (네이버 fchart API - 토큰 불필요, 1회 요청으로 완료) ==========
export async function getStockDailyPrices(
  stockCode: string,
  period: "1M" | "3M" | "6M" | "1Y" = "3M"
): Promise<KisPriceData[]> {
  const countMap: Record<string, number> = { "1M": 22, "3M": 66, "6M": 132, "1Y": 252 };
  const count = countMap[period] || 66;

  try {
    const response = await axios.get(
      `https://fchart.stock.naver.com/sise.nhn`,
      {
        params: { symbol: stockCode, timeframe: "day", count, requestType: 0 },
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 5000,
        responseType: "text",
      }
    );

    const xml = response.data as string;
    // XML 파싱: <item data="20260206|154100|160300|151600|158600|36358081" />
    const items: KisPriceData[] = [];
    const regex = /data="([^"]+)"/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const parts = match[1].split("|");
      if (parts.length >= 6) {
        const [dateStr, open, high, low, close, volume] = parts;
        items.push({
          date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
          closePrice: close,
          openPrice: open,
          highPrice: high,
          lowPrice: low,
          volume: volume,
        });
      }
    }

    console.log(`[Naver Chart] Fetched ${items.length} records for ${stockCode} (${period})`);
    return items;
  } catch (error: any) {
    console.error("Failed to fetch Naver chart:", error.message);
    // 네이버 실패 시 KIS API 폴백
    console.log("[Naver Chart] Falling back to KIS API...");
    return getEtfDailyPrices(stockCode, period);
  }
}

// ========== 주가지수 조회 ==========
export interface MarketIndex {
  name: string;
  code: string;
  price: string;
  change: string;
  changePercent: string;
  changeSign: string; // 1:상한 2:상승 3:보합 4:하한 5:하락
}

export async function getMarketIndices(): Promise<MarketIndex[]> {
  const token = await getMarketToken();
  const indices = [
    { code: "0001", name: "코스피" },
    { code: "1001", name: "코스닥" },
    { code: "2001", name: "코스피200" },
  ];

  const results: MarketIndex[] = [];

  for (const idx of indices) {
    try {
      const response = await axios.get(
        `${KIS_MARKET_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`,
        {
          headers: {
            authorization: `Bearer ${token}`,
            appkey: KIS_APP_KEY,
            appsecret: KIS_APP_SECRET,
            tr_id: "FHPUP02100000",
            custtype: "P",
          },
          params: {
            FID_COND_MRKT_DIV_CODE: "U",
            FID_INPUT_ISCD: idx.code,
          },
        }
      );

      if (response.data.rt_cd === "0") {
        const o = response.data.output;
        results.push({
          name: idx.name,
          code: idx.code,
          price: o.bstp_nmix_prpr || "0",
          change: o.bstp_nmix_prdy_vrss || "0",
          changePercent: o.bstp_nmix_prdy_ctrt || "0",
          changeSign: o.prdy_vrss_sign || "3",
        });
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error: any) {
      console.error(`Failed to fetch index ${idx.name}:`, error.response?.data?.msg1 || error.message);
    }
  }

  return results;
}

// ========== 투자자별 매매동향 ==========
export interface InvestorTrend {
  name: string;
  buyAmount: string;
  sellAmount: string;
  netAmount: string;
}

export async function getInvestorTrends(): Promise<InvestorTrend[]> {
  const token = await getMarketToken();

  try {
    const response = await axios.get(
      `${KIS_MARKET_URL}/uapi/domestic-stock/v1/quotations/investor`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: KIS_APP_KEY,
          appsecret: KIS_APP_SECRET,
          tr_id: "FHPTJ04400000",
          custtype: "P",
        },
        params: {
          FID_COND_MRKT_DIV_CODE: "V", // 전체
          FID_INPUT_ISCD: "0001", // 코스피
        },
      }
    );

    if (response.data.rt_cd !== "0") {
      console.error("Investor trend API error:", response.data.msg1);
      return [];
    }

    const items = response.data.output;
    if (!items || !Array.isArray(items) || items.length === 0) return [];

    // 오늘 데이터 (첫 번째 항목)
    const today = items[0];
    return [
      {
        name: "개인",
        buyAmount: today.prsn_trdvol || "0",
        sellAmount: today.prsn_trdvol || "0",
        netAmount: today.prsn_ntby_qty || "0",
      },
      {
        name: "외국인",
        buyAmount: today.frgn_trdvol || "0",
        sellAmount: today.frgn_trdvol || "0",
        netAmount: today.frgn_ntby_qty || "0",
      },
      {
        name: "기관",
        buyAmount: today.orgn_trdvol || "0",
        sellAmount: today.orgn_trdvol || "0",
        netAmount: today.orgn_ntby_qty || "0",
      },
    ];
  } catch (error: any) {
    console.error("Failed to fetch investor trends:", error.response?.data || error.message);
    return [];
  }
}

// ========== 거래량 상위 종목 ==========
export interface VolumeRankItem {
  rank: number;
  stockCode: string;
  stockName: string;
  price: string;
  change: string;
  changePercent: string;
  volume: string;
  changeSign: string;
}

export async function getVolumeRanking(): Promise<VolumeRankItem[]> {
  const token = await getMarketToken();

  try {
    const response = await axios.get(
      `${KIS_MARKET_URL}/uapi/domestic-stock/v1/quotations/volume-rank`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: KIS_APP_KEY,
          appsecret: KIS_APP_SECRET,
          tr_id: "FHPST01710000",
          custtype: "P",
        },
        params: {
          FID_COND_MRKT_DIV_CODE: "J",
          FID_COND_SCR_DIV_CODE: "20101",
          FID_INPUT_ISCD: "0000",
          FID_DIV_CLS_CODE: "0",
          FID_BLNG_CLS_CODE: "0",
          FID_TRGT_CLS_CODE: "111111111",
          FID_TRGT_EXLS_CLS_CODE: "000000",
          FID_INPUT_PRICE_1: "",
          FID_INPUT_PRICE_2: "",
          FID_VOL_CNT: "",
          FID_INPUT_DATE_1: "",
        },
      }
    );

    if (response.data.rt_cd !== "0") {
      console.error("Volume ranking API error:", response.data.msg1);
      return [];
    }

    const items = response.data.output || [];
    return items.slice(0, 10).map((item: any, i: number) => ({
      rank: i + 1,
      stockCode: item.mksc_shrn_iscd || "",
      stockName: item.hts_kor_isnm || "",
      price: item.stck_prpr || "0",
      change: item.prdy_vrss || "0",
      changePercent: item.prdy_ctrt || "0",
      volume: item.acml_vol || "0",
      changeSign: item.prdy_vrss_sign || "3",
    }));
  } catch (error: any) {
    console.error("Failed to fetch volume ranking:", error.response?.data || error.message);
    return [];
  }
}

// ========== ETF 구성종목 조회 (WiseReport + 네이버 종목검색 + KIS API 실시간 시세) ==========
export interface EtfComponentStock {
  stockCode: string;
  stockName: string;
  weight: number;       // 비중 (%)
  quantity: number;      // 수량 (주)
  evalAmount: number;    // 평가금액 (백만원)
  // 실시간 시세 (KIS API)
  price?: string;
  change?: string;
  changePercent?: string;
  changeSign?: string;
  volume?: string;
  high?: string;
  low?: string;
  open?: string;
}

export interface EtfComponentResult {
  etfCode: string;
  etfName: string;
  nav?: string;           // 순자산가치(NAV)
  marketCap?: string;     // 시가총액
  components: EtfComponentStock[];
  totalComponentCount: number;
  updatedAt: string;
}

// 🛡️ Map 크기 제한 헬퍼 (FIFO eviction - 가장 오래된 것부터 제거)
function evictIfOverLimit<K, V>(map: Map<K, V>, maxSize: number): void {
  if (map.size <= maxSize) return;
  const excess = map.size - maxSize;
  const keys = map.keys();
  for (let i = 0; i < excess; i++) {
    const k = keys.next().value;
    if (k !== undefined) map.delete(k);
  }
}

// 메모리 캐시 (5분, 최대 100개 ETF)
const etfComponentCache: Map<string, { data: EtfComponentResult; expiry: number }> = new Map();
const ETF_CACHE_TTL = 5 * 60 * 1000; // 5분
const ETF_CACHE_MAX_SIZE = 100;

// 종목명 → 종목코드 캐시 (최대 500개 - 메모리 보호)
const stockCodeCache: Map<string, string> = new Map();
const STOCK_CODE_CACHE_MAX_SIZE = 500;

// 네이버 주식 자동완성 API로 종목코드 조회
async function resolveStockCode(stockName: string): Promise<string> {
  // 현금, 선물 등 비주식 항목 필터링
  if (stockName.includes("현금") || stockName.includes("선물") || stockName.includes("원화") ||
      stockName.includes("달러") || stockName.includes("국채") || stockName.includes("채권") ||
      stockName.includes("스왑") || stockName.includes("예금") || stockName.includes("콜") ||
      stockName.includes("RP") || stockName.includes("CASH")) {
    return "";
  }

  const cached = stockCodeCache.get(stockName);
  if (cached !== undefined) return cached;

  try {
    const res = await axios.get("https://ac.stock.naver.com/ac", {
      params: { q: stockName, target: "stock", st: "111" },
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 5000,
    });

    const items = res.data?.items;
    if (items && items.length > 0) {
      // 정확히 일치하는 종목 우선, 없으면 첫 번째 결과
      const exact = items.find((item: any) =>
        item.name === stockName && (item.typeCode === "KOSPI" || item.typeCode === "KOSDAQ")
      );
      const code = exact?.code || items[0]?.code || "";
      stockCodeCache.set(stockName, code);
      evictIfOverLimit(stockCodeCache, STOCK_CODE_CACHE_MAX_SIZE);
      return code;
    }
  } catch {
    // 검색 실패 시 빈 문자열
  }
  stockCodeCache.set(stockName, "");
  evictIfOverLimit(stockCodeCache, STOCK_CODE_CACHE_MAX_SIZE);
  return "";
}

// ===== 네이버 금융 실시간 시세 bulk 조회 (레이트리밋 없음, 20개씩 1회 요청) =====
export interface NaverRealtimePrice {
  stockCode: string;
  stockName: string;
  price: string;
  change: string;
  changePercent: string;
  changeSign: string; // 1:상한, 2:상승, 3:보합, 4:하한, 5:하락 (KIS 포맷 변환)
  volume: string;
  high: string;
  low: string;
  open: string;
}

export async function fetchNaverBulkPrices(stockCodes: string[]): Promise<Map<string, NaverRealtimePrice>> {
  const result = new Map<string, NaverRealtimePrice>();
  if (stockCodes.length === 0) return result;

  // 네이버 API는 한 번에 여러 종목 가능 (쉼표 구분)
  // 안전하게 40개씩 나눠서 요청
  const BATCH_SIZE = 40;
  for (let i = 0; i < stockCodes.length; i += BATCH_SIZE) {
    const batch = stockCodes.slice(i, i + BATCH_SIZE);
    const codesParam = batch.join(",");

    try {
      const res = await axios.get(
        `https://polling.finance.naver.com/api/realtime/domestic/stock/${codesParam}`,
        {
          headers: { "User-Agent": "Mozilla/5.0" },
          timeout: 10000,
        }
      );

      const datas = res.data?.datas || [];
      for (const item of datas) {
        const code = item.itemCode || "";
        if (!code) continue;

        // 네이버 compareToPreviousPrice.code → KIS changeSign 변환
        // 네이버: "1"=하락, "2"=상승, "3"=보합, "4"=상한, "5"=하한
        // KIS:    "1"=상한, "2"=상승, "3"=보합, "4"=하한, "5"=하락
        const naverSignCode = item.compareToPreviousPrice?.code || "3";
        let kisChangeSign = "3"; // 기본: 보합
        if (naverSignCode === "2") kisChangeSign = "2"; // 상승
        else if (naverSignCode === "1") kisChangeSign = "5"; // 하락
        else if (naverSignCode === "4") kisChangeSign = "1"; // 상한
        else if (naverSignCode === "5") kisChangeSign = "4"; // 하한

        // 가격 문자열에서 쉼표 제거
        const cleanNum = (s: string) => (s || "0").replace(/,/g, "");

        result.set(code, {
          stockCode: code,
          stockName: item.stockName || "",
          price: cleanNum(item.closePrice),
          change: cleanNum(item.compareToPreviousClosePrice),
          changePercent: item.fluctuationsRatio || "0",
          changeSign: kisChangeSign,
          volume: cleanNum(item.accumulatedTradingVolume),
          high: cleanNum(item.highPrice),
          low: cleanNum(item.lowPrice),
          open: cleanNum(item.openPrice),
        });
      }
    } catch (err: any) {
      console.log(`[Naver Bulk] Failed to fetch batch: ${err.message}`);
    }
  }

  return result;
}

export async function getEtfComponents(etfCode: string): Promise<EtfComponentResult> {
  const startTime = Date.now();

  // 캐시 확인
  const cached = etfComponentCache.get(etfCode);
  if (cached && Date.now() < cached.expiry) {
    console.log(`[ETF Components] Cache hit for ${etfCode}`);
    return cached.data;
  }

  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  let components: EtfComponentStock[] = [];
  let etfName = "";
  let nav = "";
  let marketCap = "";

  // ===== Step 1: WiseReport에서 구성종목 목록 가져오기 =====
  try {
    const wrRes = await axios.get(
      `https://navercomp.wisereport.co.kr/v2/ETF/Index.aspx`,
      {
        params: { cn: "", cmp_cd: etfCode, menuType: "block" },
        headers: { "User-Agent": UA },
        timeout: 15000,
        maxRedirects: 5,
      }
    );

    const html = typeof wrRes.data === "string" ? wrRes.data : "";

    // summary_data에서 ETF 이름 추출
    const summaryMatch = html.match(/var\s+summary_data\s*=\s*(\{[^}]+\})/);
    if (summaryMatch) {
      try {
        const summary = JSON.parse(summaryMatch[1]);
        etfName = summary.CMP_KOR || "";
      } catch { /* ignore parse error */ }
    }

    // CU_data에서 구성종목 추출
    const cuMatch = html.match(/CU_data\s*=\s*(\{"grid_data":\[[\s\S]*?\],"chart_data":\[[\s\S]*?\]\})/);
    if (cuMatch) {
      try {
        const cuData = JSON.parse(cuMatch[1]);
        const gridData = cuData.grid_data || [];

        for (const item of gridData) {
          const name = item.STK_NM_KOR || "";
          const weight = item.ETF_WEIGHT ?? 0;
          const qty = item.AGMT_STK_CNT ?? 0;

          if (name) {
            components.push({
              stockCode: "",
              stockName: name,
              weight: typeof weight === "number" ? weight : parseFloat(weight) || 0,
              quantity: typeof qty === "number" ? Math.floor(qty) : parseInt(qty) || 0,
              evalAmount: 0,
            });
          }
        }
      } catch (e: any) {
        console.log(`[ETF Components] CU_data parse error: ${e.message}`);
      }
    }

    console.log(`[ETF Components] WiseReport: ${components.length} components (${Date.now() - startTime}ms)`);
  } catch (err: any) {
    console.log(`[ETF Components] WiseReport failed for ${etfCode}: ${err.message}`);
  }

  // ETF 이름이 없으면 네이버에서 조회
  if (!etfName) {
    try {
      const naverRes = await axios.get(
        `https://polling.finance.naver.com/api/realtime/domestic/stock/${etfCode}`,
        { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 5000 }
      );
      const datas = naverRes.data?.datas;
      if (datas && datas.length > 0) {
        etfName = datas[0].stockName || `ETF ${etfCode}`;
      }
    } catch {
      etfName = `ETF ${etfCode}`;
    }
  }

  // ===== Step 2: 종목코드 변환 (10개씩 병렬 배치, 캐시 활용) =====
  const stockComponents = components.filter(c =>
    !c.stockName.includes("현금") && !c.stockName.includes("선물") &&
    !c.stockName.includes("원화") && !c.stockName.includes("달러") &&
    !c.stockName.includes("국채") && !c.stockName.includes("채권") &&
    !c.stockName.includes("스왑") && !c.stockName.includes("예금") &&
    !c.stockName.includes("콜") && !c.stockName.includes("RP") &&
    !c.stockName.includes("CASH")
  );
  const topForCode = stockComponents.slice(0, 30);

  if (topForCode.length > 0) {
    const codeStartTime = Date.now();
    // 캐시된 것과 아닌 것 분리
    const needsResolve: typeof topForCode = [];
    for (const comp of topForCode) {
      const cached = stockCodeCache.get(comp.stockName);
      if (cached !== undefined) {
        comp.stockCode = cached;
      } else {
        needsResolve.push(comp);
      }
    }

    // 캐시 미스 종목만 10개씩 병렬 조회
    if (needsResolve.length > 0) {
      const BATCH_SIZE = 10;
      for (let i = 0; i < needsResolve.length; i += BATCH_SIZE) {
        const batch = needsResolve.slice(i, i + BATCH_SIZE);
        const codes = await Promise.all(batch.map(c => resolveStockCode(c.stockName)));
        batch.forEach((c, idx) => {
          c.stockCode = codes[idx];
        });
        // 다음 배치 전 짧은 딜레이
        if (i + BATCH_SIZE < needsResolve.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    const resolvedCount = topForCode.filter(c => c.stockCode).length;
    console.log(`[ETF Components] Stock codes resolved: ${resolvedCount}/${topForCode.length} (cache: ${topForCode.length - needsResolve.length}, API: ${needsResolve.length}) (${Date.now() - codeStartTime}ms)`);
  }

  // ===== Step 3: 네이버 실시간 bulk API로 시세 조회 (1회 요청으로 전체 조회) =====
  const validCodes = components
    .filter(c => c.stockCode && /^\d{6}$/.test(c.stockCode))
    .map(c => c.stockCode);

  if (validCodes.length > 0) {
    const priceStartTime = Date.now();
    console.log(`[ETF Components] Fetching prices for ${validCodes.length} stocks via Naver bulk API...`);

    const priceMap = await fetchNaverBulkPrices(validCodes);

    // 시세 데이터 매핑
    for (const comp of components) {
      const priceData = priceMap.get(comp.stockCode);
      if (priceData) {
        comp.price = priceData.price;
        comp.change = priceData.change;
        comp.changePercent = priceData.changePercent;
        comp.changeSign = priceData.changeSign;
        comp.volume = priceData.volume;
        comp.high = priceData.high;
        comp.low = priceData.low;
        comp.open = priceData.open;
      }
    }

    const pricedCount = components.filter(c => c.price).length;
    console.log(`[ETF Components] Prices fetched: ${pricedCount}/${validCodes.length} (${Date.now() - priceStartTime}ms)`);
  }

  // 비중 순으로 정렬
  components.sort((a, b) => b.weight - a.weight);

  const totalTime = Date.now() - startTime;
  console.log(`[ETF Components] Total time for ${etfCode}: ${totalTime}ms`);

  const result: EtfComponentResult = {
    etfCode,
    etfName,
    nav,
    marketCap,
    components,
    totalComponentCount: components.length,
    updatedAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
  };

  // 캐시 저장 (크기 제한 적용)
  // 만료된 캐시 먼저 정리
  const now = Date.now();
  etfComponentCache.forEach((v, k) => { if (now > v.expiry) etfComponentCache.delete(k); });
  etfComponentCache.set(etfCode, { data: result, expiry: now + ETF_CACHE_TTL });
  evictIfOverLimit(etfComponentCache, ETF_CACHE_MAX_SIZE);

  return result;
}

// ========== 설정 확인 ==========
export function isConfigured(): boolean {
  return !!(KIS_APP_KEY && KIS_APP_SECRET);
}

export function isTradingConfigured(): boolean {
  return !!(KIS_APP_KEY && KIS_APP_SECRET && KIS_ACCOUNT_NO);
}

export function getTradingStatus() {
  return {
    configured: isConfigured(),
    tradingConfigured: isTradingConfigured(),
    mockTrading: KIS_MOCK_TRADING,
    accountNo: KIS_ACCOUNT_NO ? KIS_ACCOUNT_NO.slice(0, 4) + "****" : "",
    accountProductCd: KIS_ACCOUNT_PRODUCT_CD,
  };
}

// ========== 계좌 잔고 조회 ==========
export interface HoldingItem {
  stockCode: string;        // 종목코드
  stockName: string;        // 종목명
  holdingQty: number;       // 보유수량
  avgBuyPrice: number;      // 매입평균가
  currentPrice: number;     // 현재가
  evalAmount: number;       // 평가금액
  evalProfitLoss: number;   // 평가손익금액
  evalProfitRate: number;   // 평가수익률(%)
  buyAmount: number;        // 매입금액
}

export interface BalanceSummary {
  depositAmount: number;        // 예수금총금액
  totalEvalAmount: number;      // 총평가금액
  totalBuyAmount: number;       // 매입금액합계
  totalEvalProfitLoss: number;  // 평가손익합계
  totalEvalProfitRate: number;  // 총수익률(%)
}

export interface AccountBalance {
  holdings: HoldingItem[];
  summary: BalanceSummary;
}

export async function getAccountBalance(): Promise<AccountBalance> {
  if (!isTradingConfigured()) {
    throw new Error("KIS trading is not configured. Set KIS_APP_KEY, KIS_APP_SECRET, and KIS_ACCOUNT_NO.");
  }

  const token = await getAccessToken();

  try {
    const response = await axios.get(
      `${KIS_TRADE_URL}/uapi/domestic-stock/v1/trading/inquire-balance`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: KIS_APP_KEY,
          appsecret: KIS_APP_SECRET,
          tr_id: TR_ID.balance,
          custtype: "P",
        },
        params: {
          CANO: KIS_ACCOUNT_NO,
          ACNT_PRDT_CD: KIS_ACCOUNT_PRODUCT_CD,
          AFHR_FLPR_YN: "N",
          OFL_YN: "",
          INQR_DVSN: "02",
          UNPR_DVSN: "01",
          FUND_STTL_ICLD_YN: "N",
          FNCG_AMT_AUTO_RDPT_YN: "N",
          PRCS_DVSN: "01",
          CTX_AREA_FK100: "",
          CTX_AREA_NK100: "",
        },
      }
    );

    if (response.data.rt_cd !== "0") {
      console.error("KIS balance API error:", response.data.msg1);
      throw new Error(response.data.msg1 || "잔고 조회 실패");
    }

    const output1 = response.data.output1 || [];
    const output2 = response.data.output2?.[0] || {};

    const holdings: HoldingItem[] = output1
      .filter((item: any) => parseInt(item.hldg_qty) > 0)
      .map((item: any) => ({
        stockCode: item.pdno,
        stockName: item.prdt_name,
        holdingQty: parseInt(item.hldg_qty) || 0,
        avgBuyPrice: parseFloat(item.pchs_avg_pric) || 0,
        currentPrice: parseInt(item.prpr) || 0,
        evalAmount: parseInt(item.evlu_amt) || 0,
        evalProfitLoss: parseInt(item.evlu_pfls_amt) || 0,
        evalProfitRate: parseFloat(item.evlu_pfls_rt) || 0,
        buyAmount: parseInt(item.pchs_amt) || 0,
      }));

    const totalBuyAmount = parseInt(output2.pchs_amt_smtl_amt) || 0;
    const totalEvalAmount = parseInt(output2.evlu_amt_smtl_amt) || 0;

    const summary: BalanceSummary = {
      depositAmount: parseInt(output2.dnca_tot_amt) || 0,
      totalEvalAmount: parseInt(output2.tot_evlu_amt) || 0,
      totalBuyAmount,
      totalEvalProfitLoss: parseInt(output2.evlu_pfls_smtl_amt) || 0,
      totalEvalProfitRate: totalBuyAmount > 0 
        ? ((totalEvalAmount - totalBuyAmount) / totalBuyAmount) * 100 
        : 0,
    };

    return { holdings, summary };
  } catch (error: any) {
    if (error.response) {
      console.error("KIS balance API error:", error.response.data);
      throw new Error(error.response.data?.msg1 || "잔고 조회 실패");
    }
    throw error;
  }
}

// ========== 주문 ==========
export interface OrderParams {
  stockCode: string;   // 종목코드 6자리
  orderType: "buy" | "sell";
  quantity: number;
  price?: number;      // 지정가 (시장가일 경우 0)
  orderMethod: "market" | "limit";
}

export interface OrderResult {
  success: boolean;
  orderNo?: string;     // KIS 주문번호
  message: string;
}

export async function placeOrder(params: OrderParams): Promise<OrderResult> {
  if (!isTradingConfigured()) {
    throw new Error("KIS trading is not configured.");
  }

  const token = await getAccessToken();

  const trId = params.orderType === "buy" ? TR_ID.buy : TR_ID.sell;
  
  // ORD_DVSN: 00(지정가), 01(시장가)
  const ordDvsn = params.orderMethod === "market" ? "01" : "00";
  const ordUnpr = params.orderMethod === "market" ? "0" : String(params.price || 0);

  const body: Record<string, string> = {
    CANO: KIS_ACCOUNT_NO,
    ACNT_PRDT_CD: KIS_ACCOUNT_PRODUCT_CD,
    PDNO: params.stockCode,
    ORD_DVSN: ordDvsn,
    ORD_QTY: String(params.quantity),
    ORD_UNPR: ordUnpr,
  };

  try {
    // hashkey 발급 (POST 요청 시 필요)
    const hashkey = await getHashKey(body);

    const response = await axios.post(
      `${KIS_TRADE_URL}/uapi/domestic-stock/v1/trading/order-cash`,
      body,
      {
        headers: {
          "content-type": "application/json; charset=utf-8",
          authorization: `Bearer ${token}`,
          appkey: KIS_APP_KEY,
          appsecret: KIS_APP_SECRET,
          tr_id: trId,
          custtype: "P",
          hashkey,
        },
      }
    );

    if (response.data.rt_cd !== "0") {
      console.error("KIS order API error:", response.data.msg1);
      return {
        success: false,
        message: response.data.msg1 || "주문 실패",
      };
    }

    const output = response.data.output;
    console.log(`KIS order placed: ${params.orderType} ${params.stockCode} x${params.quantity} @ ${ordUnpr}`);
    
    return {
      success: true,
      orderNo: output?.ODNO || output?.odno,
      message: response.data.msg1 || "주문 성공",
    };
  } catch (error: any) {
    console.error("Failed to place order:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.msg1 || error.message || "주문 처리 중 오류 발생",
    };
  }
}

// ========== 주문 체결 내역 조회 ==========
export interface OrderHistoryItem {
  orderDate: string;      // 주문일자
  orderTime: string;      // 주문시각
  stockCode: string;      // 종목코드
  stockName: string;      // 종목명
  orderType: string;      // 매수/매도
  orderQty: number;       // 주문수량
  orderPrice: number;     // 주문단가
  filledQty: number;      // 체결수량
  filledAmount: number;   // 체결금액
  orderNo: string;        // 주문번호
  orderStatus: string;    // 주문상태
}

export async function getOrderHistory(startDate?: string, endDate?: string): Promise<OrderHistoryItem[]> {
  if (!isTradingConfigured()) {
    throw new Error("KIS trading is not configured.");
  }

  const token = await getAccessToken();
  const today = new Date();
  const formatDate = (d: Date) =>
    d.getFullYear().toString() +
    (d.getMonth() + 1).toString().padStart(2, "0") +
    d.getDate().toString().padStart(2, "0");

  const end = endDate || formatDate(today);
  const start = startDate || (() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    return formatDate(d);
  })();

  try {
    const response = await axios.get(
      `${KIS_TRADE_URL}/uapi/domestic-stock/v1/trading/inquire-daily-ccld`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: KIS_APP_KEY,
          appsecret: KIS_APP_SECRET,
          tr_id: TR_ID.orderHistory,
          custtype: "P",
        },
        params: {
          CANO: KIS_ACCOUNT_NO,
          ACNT_PRDT_CD: KIS_ACCOUNT_PRODUCT_CD,
          INQR_STRT_DT: start,
          INQR_END_DT: end,
          SLL_BUY_DVSN_CD: "00", // 전체
          INQR_DVSN: "00",
          PDNO: "",
          CCLD_DVSN: "00", // 전체
          ORD_GNO_BRNO: "",
          ODNO: "",
          INQR_DVSN_3: "00",
          INQR_DVSN_1: "",
          CTX_AREA_FK100: "",
          CTX_AREA_NK100: "",
        },
      }
    );

    if (response.data.rt_cd !== "0") {
      console.error("KIS order history API error:", response.data.msg1);
      throw new Error(response.data.msg1 || "주문내역 조회 실패");
    }

    const output1 = response.data.output1 || [];

    return output1.map((item: any) => ({
      orderDate: item.ord_dt,
      orderTime: item.ord_tmd,
      stockCode: item.pdno,
      stockName: item.prdt_name,
      orderType: item.sll_buy_dvsn_cd === "01" ? "sell" : "buy",
      orderQty: parseInt(item.ord_qty) || 0,
      orderPrice: parseInt(item.ord_unpr) || 0,
      filledQty: parseInt(item.tot_ccld_qty) || 0,
      filledAmount: parseInt(item.tot_ccld_amt) || 0,
      orderNo: item.odno,
      orderStatus: parseInt(item.tot_ccld_qty) > 0 ? "filled" : "pending",
    }));
  } catch (error: any) {
    if (error.response) {
      console.error("KIS order history API error:", error.response.data);
      throw new Error(error.response.data?.msg1 || "주문내역 조회 실패");
    }
    throw error;
  }
}

// ==================================================================
// ========== 사용자별 인증정보 기반 함수들 (User-specific) ==========
// ==================================================================

async function getUserToken(
  userId: number,
  creds: UserKisCredentials,
  type: "trade" | "market"
): Promise<string> {
  // market 토큰: 실전투자 모드면 trade와 동일
  if (type === "market" && !creds.mockTrading) {
    type = "trade";
  }

  // 메모리 캐시 초기화/확보 헬퍼
  function ensureMemoryCache() {
    let cache = userTokenCache.get(userId);
    if (!cache) {
      cache = { trade: null, market: null };
      if (userTokenCache.size >= USER_TOKEN_CACHE_MAX_SIZE) {
        const now = Date.now();
        for (const [uid, uc] of userTokenCache) {
          const tradeExpired = !uc.trade || now >= uc.trade.expiresAt;
          const marketExpired = !uc.market || now >= uc.market.expiresAt;
          if (tradeExpired && marketExpired) { userTokenCache.delete(uid); }
        }
        if (userTokenCache.size >= USER_TOKEN_CACHE_MAX_SIZE) {
          const k = userTokenCache.keys().next().value;
          if (k !== undefined) userTokenCache.delete(k);
        }
      }
      userTokenCache.set(userId, cache);
    }
    return cache;
  }

  // 1순위: 메모리 캐시
  const memCache = ensureMemoryCache();
  const cached = memCache[type];
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  // 2순위: DB 캐시 (Vercel cold start 대응)
  const dbCacheKey = `user-${userId}-${type}`;
  const dbCached = await getTokenFromDB(dbCacheKey);
  if (dbCached) {
    memCache[type] = { token: dbCached.token, expiresAt: Math.min(dbCached.expiresAt, Date.now() + DB_TOKEN_MEMORY_TTL) };
    return dbCached.token;
  }

  // 3순위: KIS API 새 토큰 발급
  const baseUrl = type === "trade" ? getTradeUrl(creds.mockTrading) : KIS_REAL_URL;
  const label = `user(${userId})-${type}`;

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const response = await axios.post(`${baseUrl}/oauth2/tokenP`, {
        grant_type: "client_credentials",
        appkey: creds.appKey,
        appsecret: creds.appSecret,
      });
      const token = response.data.access_token;
      console.log(`KIS API ${label} token obtained successfully`);
      const expiresAt = Date.now() + (86400 - 300) * 1000;
      memCache[type] = { token, expiresAt };

      // DB에 저장
      saveTokenToDB(dbCacheKey, token, expiresAt);

      return token;
    } catch (error: any) {
      const errCode = error.response?.data?.error_code;
      if (errCode === "EGW00133" && attempt < 2) {
        console.log(`KIS ${label} token rate limited, waiting 65s...`);
        await new Promise(resolve => setTimeout(resolve, 65000));
        continue;
      }
      console.error(`Failed to get KIS ${label} access token:`, error.response?.data || error.message);
      throw new Error(`KIS API 인증 실패 (${label}): ${error.response?.data?.msg1 || error.message}`);
    }
  }
  throw new Error(`KIS ${label} token 발급 실패`);
}

async function getUserHashKey(creds: UserKisCredentials, body: Record<string, string>): Promise<string> {
  const tradeUrl = getTradeUrl(creds.mockTrading);
  try {
    const response = await axios.post(`${tradeUrl}/uapi/hashkey`, body, {
      headers: {
        "content-type": "application/json",
        appkey: creds.appKey,
        appsecret: creds.appSecret,
      },
    });
    return response.data.HASH;
  } catch (error: any) {
    console.error("Failed to get user hashkey:", error.response?.data || error.message);
    throw new Error("Failed to get hashkey for KIS API");
  }
}

/** 사용자별 인증정보 검증 (토큰 발급 가능한지 확인) */
export async function validateUserCredentials(userId: number, creds: UserKisCredentials): Promise<{ success: boolean; message: string }> {
  try {
    const token = await getUserToken(userId, creds, "trade");
    return { success: true, message: "인증 성공" };
  } catch (error: any) {
    // 토큰 캐시 제거
    userTokenCache.delete(userId);
    return { success: false, message: error.message || "인증 실패" };
  }
}

/** 사용자별 매매 상태 */
export function getUserTradingStatus(creds: UserKisCredentials) {
  return {
    configured: !!(creds.appKey && creds.appSecret),
    tradingConfigured: !!(creds.appKey && creds.appSecret && creds.accountNo),
    mockTrading: creds.mockTrading,
    accountNo: creds.accountNo ? creds.accountNo.slice(0, 4) + "****" : "",
    accountProductCd: creds.accountProductCd || "01",
  };
}

/** 사용자별 계좌 잔고 조회 */
export async function getUserAccountBalance(userId: number, creds: UserKisCredentials): Promise<AccountBalance> {
  if (!creds.appKey || !creds.appSecret || !creds.accountNo) {
    throw new Error("KIS trading is not configured for this user.");
  }

  const token = await getUserToken(userId, creds, "trade");
  const tradeUrl = getTradeUrl(creds.mockTrading);
  const trIds = getTrIds(creds.mockTrading);

  try {
    const response = await axios.get(
      `${tradeUrl}/uapi/domestic-stock/v1/trading/inquire-balance`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: creds.appKey,
          appsecret: creds.appSecret,
          tr_id: trIds.balance,
          custtype: "P",
        },
        params: {
          CANO: creds.accountNo,
          ACNT_PRDT_CD: creds.accountProductCd || "01",
          AFHR_FLPR_YN: "N",
          OFL_YN: "",
          INQR_DVSN: "02",
          UNPR_DVSN: "01",
          FUND_STTL_ICLD_YN: "N",
          FNCG_AMT_AUTO_RDPT_YN: "N",
          PRCS_DVSN: "01",
          CTX_AREA_FK100: "",
          CTX_AREA_NK100: "",
        },
      }
    );

    if (response.data.rt_cd !== "0") {
      throw new Error(response.data.msg1 || "잔고 조회 실패");
    }

    const output1 = response.data.output1 || [];
    const output2 = response.data.output2?.[0] || {};

    const holdings: HoldingItem[] = output1
      .filter((item: any) => parseInt(item.hldg_qty) > 0)
      .map((item: any) => ({
        stockCode: item.pdno,
        stockName: item.prdt_name,
        holdingQty: parseInt(item.hldg_qty) || 0,
        avgBuyPrice: parseFloat(item.pchs_avg_pric) || 0,
        currentPrice: parseInt(item.prpr) || 0,
        evalAmount: parseInt(item.evlu_amt) || 0,
        evalProfitLoss: parseInt(item.evlu_pfls_amt) || 0,
        evalProfitRate: parseFloat(item.evlu_pfls_rt) || 0,
        buyAmount: parseInt(item.pchs_amt) || 0,
      }));

    const totalBuyAmount = parseInt(output2.pchs_amt_smtl_amt) || 0;
    const totalEvalAmount = parseInt(output2.evlu_amt_smtl_amt) || 0;

    const summary: BalanceSummary = {
      depositAmount: parseInt(output2.dnca_tot_amt) || 0,
      totalEvalAmount: parseInt(output2.tot_evlu_amt) || 0,
      totalBuyAmount,
      totalEvalProfitLoss: parseInt(output2.evlu_pfls_smtl_amt) || 0,
      totalEvalProfitRate: totalBuyAmount > 0
        ? ((totalEvalAmount - totalBuyAmount) / totalBuyAmount) * 100
        : 0,
    };

    return { holdings, summary };
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data?.msg1 || "잔고 조회 실패");
    }
    throw error;
  }
}

/** 사용자별 주문 */
export async function userPlaceOrder(userId: number, creds: UserKisCredentials, params: OrderParams): Promise<OrderResult> {
  if (!creds.appKey || !creds.appSecret || !creds.accountNo) {
    throw new Error("KIS trading is not configured for this user.");
  }

  const token = await getUserToken(userId, creds, "trade");
  const tradeUrl = getTradeUrl(creds.mockTrading);
  const trIds = getTrIds(creds.mockTrading);

  const trId = params.orderType === "buy" ? trIds.buy : trIds.sell;
  const ordDvsn = params.orderMethod === "market" ? "01" : "00";
  const ordUnpr = params.orderMethod === "market" ? "0" : String(params.price || 0);

  const body: Record<string, string> = {
    CANO: creds.accountNo,
    ACNT_PRDT_CD: creds.accountProductCd || "01",
    PDNO: params.stockCode,
    ORD_DVSN: ordDvsn,
    ORD_QTY: String(params.quantity),
    ORD_UNPR: ordUnpr,
  };

  try {
    const hashkey = await getUserHashKey(creds, body);

    const response = await axios.post(
      `${tradeUrl}/uapi/domestic-stock/v1/trading/order-cash`,
      body,
      {
        headers: {
          "content-type": "application/json; charset=utf-8",
          authorization: `Bearer ${token}`,
          appkey: creds.appKey,
          appsecret: creds.appSecret,
          tr_id: trId,
          custtype: "P",
          hashkey,
        },
      }
    );

    if (response.data.rt_cd !== "0") {
      return { success: false, message: response.data.msg1 || "주문 실패" };
    }

    const output = response.data.output;
    console.log(`KIS user(${userId}) order: ${params.orderType} ${params.stockCode} x${params.quantity}`);

    return {
      success: true,
      orderNo: output?.ODNO || output?.odno,
      message: response.data.msg1 || "주문 성공",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.msg1 || error.message || "주문 처리 중 오류 발생",
    };
  }
}

/** 사용자별 주문 체결 내역 조회 */
export async function getUserOrderHistory(userId: number, creds: UserKisCredentials, startDate?: string, endDate?: string): Promise<OrderHistoryItem[]> {
  if (!creds.appKey || !creds.appSecret || !creds.accountNo) {
    throw new Error("KIS trading is not configured for this user.");
  }

  const token = await getUserToken(userId, creds, "trade");
  const tradeUrl = getTradeUrl(creds.mockTrading);
  const trIds = getTrIds(creds.mockTrading);

  const today = new Date();
  const formatDate = (d: Date) =>
    d.getFullYear().toString() +
    (d.getMonth() + 1).toString().padStart(2, "0") +
    d.getDate().toString().padStart(2, "0");

  const end = endDate || formatDate(today);
  const start = startDate || (() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    return formatDate(d);
  })();

  try {
    const response = await axios.get(
      `${tradeUrl}/uapi/domestic-stock/v1/trading/inquire-daily-ccld`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: creds.appKey,
          appsecret: creds.appSecret,
          tr_id: trIds.orderHistory,
          custtype: "P",
        },
        params: {
          CANO: creds.accountNo,
          ACNT_PRDT_CD: creds.accountProductCd || "01",
          INQR_STRT_DT: start,
          INQR_END_DT: end,
          SLL_BUY_DVSN_CD: "00",
          INQR_DVSN: "00",
          PDNO: "",
          CCLD_DVSN: "00",
          ORD_GNO_BRNO: "",
          ODNO: "",
          INQR_DVSN_3: "00",
          INQR_DVSN_1: "",
          CTX_AREA_FK100: "",
          CTX_AREA_NK100: "",
        },
      }
    );

    if (response.data.rt_cd !== "0") {
      throw new Error(response.data.msg1 || "주문내역 조회 실패");
    }

    return (response.data.output1 || []).map((item: any) => ({
      orderDate: item.ord_dt,
      orderTime: item.ord_tmd,
      stockCode: item.pdno,
      stockName: item.prdt_name,
      orderType: item.sll_buy_dvsn_cd === "01" ? "sell" : "buy",
      orderQty: parseInt(item.ord_qty) || 0,
      orderPrice: parseInt(item.ord_unpr) || 0,
      filledQty: parseInt(item.tot_ccld_qty) || 0,
      filledAmount: parseInt(item.tot_ccld_amt) || 0,
      orderNo: item.odno,
      orderStatus: parseInt(item.tot_ccld_qty) > 0 ? "filled" : "pending",
    }));
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data?.msg1 || "주문내역 조회 실패");
    }
    throw error;
  }
}

/** 사용자 토큰 캐시 제거 */
export function clearUserTokenCache(userId: number) {
  userTokenCache.delete(userId);
}
