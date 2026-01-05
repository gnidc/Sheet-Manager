import axios from "axios";

const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443";
const KIS_APP_KEY = process.env.KIS_APP_KEY || "";
const KIS_APP_SECRET = process.env.KIS_APP_SECRET || "";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  try {
    const response = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
      grant_type: "client_credentials",
      appkey: KIS_APP_KEY,
      appsecret: KIS_APP_SECRET,
    });

    const token = response.data.access_token;
    const expiresIn = response.data.expires_in || 86400;
    
    cachedToken = {
      token,
      expiresAt: Date.now() + (expiresIn - 300) * 1000,
    };

    console.log("KIS API token obtained successfully");
    return token;
  } catch (error: any) {
    console.error("Failed to get KIS access token:", error.response?.data || error.message);
    throw new Error("Failed to authenticate with Korea Investment API");
  }
}

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
      `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: KIS_APP_KEY,
          appsecret: KIS_APP_SECRET,
          tr_id: "FHKST03010100",
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
  const token = await getAccessToken();

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
} | null> {
  const token = await getAccessToken();

  try {
    const response = await axios.get(
      `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: KIS_APP_KEY,
          appsecret: KIS_APP_SECRET,
          tr_id: "FHKST01010100",
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
    return {
      price: output.stck_prpr,
      change: output.prdy_vrss,
      changePercent: output.prdy_ctrt,
    };
  } catch (error: any) {
    console.error("Failed to fetch current price:", error.response?.data || error.message);
    return null;
  }
}

export function isConfigured(): boolean {
  return !!(KIS_APP_KEY && KIS_APP_SECRET);
}
