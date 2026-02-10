import axios from "axios";

// ========== KIS API 설정 ==========
const KIS_MOCK_TRADING = process.env.KIS_MOCK_TRADING === "true";
const KIS_REAL_URL = "https://openapi.koreainvestment.com:9443";
const KIS_MOCK_URL = "https://openapivts.koreainvestment.com:29443";
// 매매용 URL (모의/실전 분리)
const KIS_TRADE_URL = KIS_MOCK_TRADING ? KIS_MOCK_URL : KIS_REAL_URL;
// 시세조회용 URL (항상 실전 서버 사용 - 모의투자 서버는 시세 API 미지원)
const KIS_MARKET_URL = KIS_REAL_URL;
const KIS_APP_KEY = process.env.KIS_APP_KEY || "";
const KIS_APP_SECRET = process.env.KIS_APP_SECRET || "";
const KIS_ACCOUNT_NO = process.env.KIS_ACCOUNT_NO || ""; // 계좌번호 앞 8자리
const KIS_ACCOUNT_PRODUCT_CD = process.env.KIS_ACCOUNT_PRODUCT_CD || "01"; // 계좌상품코드 뒤 2자리

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

// 사용자별 토큰 캐시
const userTokenCache = new Map<number, { trade: { token: string; expiresAt: number } | null; market: { token: string; expiresAt: number } | null }>();

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
  if (cachedTradeToken && Date.now() < cachedTradeToken.expiresAt) {
    return cachedTradeToken.token;
  }

  const token = await getTokenFromServer(KIS_TRADE_URL, "trade");
  cachedTradeToken = {
    token,
    expiresAt: Date.now() + (86400 - 300) * 1000,
  };
  return token;
}

// 시세조회용 토큰 (항상 실전 서버)
async function getMarketToken(): Promise<string> {
  // 실전투자 모드면 매매 토큰과 동일
  if (!KIS_MOCK_TRADING) {
    return getAccessToken();
  }

  if (cachedMarketToken && Date.now() < cachedMarketToken.expiresAt) {
    return cachedMarketToken.token;
  }

  const token = await getTokenFromServer(KIS_REAL_URL, "market");
  cachedMarketToken = {
    token,
    expiresAt: Date.now() + (86400 - 300) * 1000,
  };
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

// 메모리 캐시 (5분)
const etfComponentCache: Map<string, { data: EtfComponentResult; expiry: number }> = new Map();
const ETF_CACHE_TTL = 5 * 60 * 1000; // 5분

// 종목명 → 종목코드 캐시 (세션 내 유지)
const stockCodeCache: Map<string, string> = new Map();

// 네이버 주식 자동완성 API로 종목코드 조회
async function resolveStockCode(stockName: string): Promise<string> {
  // 현금, 선물 등 비주식 항목 필터링
  if (stockName.includes("현금") || stockName.includes("선물") || stockName.includes("원화") ||
      stockName.includes("달러") || stockName.includes("국채") || stockName.includes("채권")) {
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
      return code;
    }
  } catch {
    // 검색 실패 시 빈 문자열
  }
  stockCodeCache.set(stockName, "");
  return "";
}

export async function getEtfComponents(etfCode: string): Promise<EtfComponentResult> {
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

  // ===== WiseReport (네이버 금융 ETF 분석 데이터) =====
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
              stockCode: "", // 나중에 네이버 검색으로 해결
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

    console.log(`[ETF Components] WiseReport: found ${components.length} components for ${etfCode}`);
  } catch (err: any) {
    console.log(`[ETF Components] WiseReport failed for ${etfCode}: ${err.message}`);
  }

  // ETF 이름이 없으면 KIS API로 가져오기
  if (!etfName) {
    try {
      const priceData = await getCurrentPrice(etfCode);
      etfName = priceData?.stockName || `ETF ${etfCode}`;
    } catch {
      etfName = `ETF ${etfCode}`;
    }
  }

  // ===== 종목코드 해결 (상위 30개만, 네이버 자동완성 API 활용) =====
  const stockComponents = components.filter(c =>
    !c.stockName.includes("현금") && !c.stockName.includes("선물") &&
    !c.stockName.includes("원화") && !c.stockName.includes("달러") &&
    !c.stockName.includes("국채") && !c.stockName.includes("채권")
  );
  const topForCode = stockComponents.slice(0, 30);

  if (topForCode.length > 0) {
    console.log(`[ETF Components] Resolving stock codes for ${topForCode.length} stocks...`);
    // 병렬로 5개씩 종목코드 조회
    for (let i = 0; i < topForCode.length; i += 5) {
      const batch = topForCode.slice(i, i + 5);
      const codes = await Promise.all(batch.map(c => resolveStockCode(c.stockName)));
      batch.forEach((c, idx) => {
        c.stockCode = codes[idx];
      });
      // 네이버 API 레이트 리밋 방지
      if (i + 5 < topForCode.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    console.log(`[ETF Components] Resolved ${topForCode.filter(c => c.stockCode).length} stock codes`);
  }

  // ===== KIS API로 실시간 시세 조회 (종목코드가 있는 상위 20개) =====
  if (isConfigured() && components.length > 0) {
    const topComponents = components
      .filter(c => c.stockCode && c.stockCode.match(/^\d{6}$/))
      .slice(0, 20);

    if (topComponents.length > 0) {
      console.log(`[ETF Components] Fetching real-time prices for ${topComponents.length} stocks...`);

      // 실패한 종목을 모아두고 나중에 재시도
      const failedIndices: number[] = [];

      for (let i = 0; i < topComponents.length; i++) {
        try {
          const priceData = await getCurrentPrice(topComponents[i].stockCode);
          if (priceData) {
            const comp = components.find(c => c.stockCode === topComponents[i].stockCode);
            if (comp) {
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
        } catch (err: any) {
          // 레이트 리밋 에러인 경우 재시도 대상으로
          if (err.message?.includes("500") || err.response?.data?.msg_cd === "EGW00201") {
            failedIndices.push(i);
          }
        }
        // KIS API 레이트 리밋 방지 (초당 거래건수 제한)
        if (i < topComponents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 350));
        }
      }

      // 레이트 리밋으로 실패한 종목 재시도 (1초 대기 후)
      if (failedIndices.length > 0) {
        console.log(`[ETF Components] Retrying ${failedIndices.length} rate-limited stocks...`);
        await new Promise(resolve => setTimeout(resolve, 1500));

        for (let j = 0; j < failedIndices.length; j++) {
          const i = failedIndices[j];
          try {
            const priceData = await getCurrentPrice(topComponents[i].stockCode);
            if (priceData) {
              const comp = components.find(c => c.stockCode === topComponents[i].stockCode);
              if (comp) {
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
          } catch {
            // 재시도도 실패하면 무시
          }
          if (j < failedIndices.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      const pricedCount = topComponents.filter(tc =>
        components.find(c => c.stockCode === tc.stockCode)?.price
      ).length;
      console.log(`[ETF Components] Prices fetched: ${pricedCount}/${topComponents.length}`);
    }
  }

  // 비중 순으로 정렬
  components.sort((a, b) => b.weight - a.weight);

  const result: EtfComponentResult = {
    etfCode,
    etfName,
    nav,
    marketCap,
    components,
    totalComponentCount: components.length,
    updatedAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
  };

  // 캐시 저장
  etfComponentCache.set(etfCode, { data: result, expiry: Date.now() + ETF_CACHE_TTL });

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
  let cache = userTokenCache.get(userId);
  if (!cache) {
    cache = { trade: null, market: null };
    userTokenCache.set(userId, cache);
  }

  // market 토큰: 실전투자 모드면 trade와 동일
  if (type === "market" && !creds.mockTrading) {
    type = "trade";
  }

  const cached = cache[type];
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

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
      cache[type] = { token, expiresAt: Date.now() + (86400 - 300) * 1000 };
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
