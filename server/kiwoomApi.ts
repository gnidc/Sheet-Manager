import axios from "axios";

// ========== 키움증권 REST API ==========
// 키움 오픈API: https://openapi.kiwoom.com
const KIWOOM_REAL_URL = "https://openapi.koreainvestment.com:9443"; // 키움 REST API base URL
const KIWOOM_API_URL = "https://openapi.kiwoom.com";

// 사용자별 인증 정보 인터페이스 (KIS와 동일한 구조)
export interface UserKiwoomCredentials {
  appKey: string;
  appSecret: string;
  accountNo: string;
  mockTrading: boolean;
}

// 사용자별 토큰 캐시
const userTokenCache = new Map<number, { token: string; expiresAt: number }>();

/** 키움 액세스 토큰 발급 */
async function getKiwoomToken(userId: number, creds: UserKiwoomCredentials): Promise<string> {
  const cached = userTokenCache.get(userId);
  if (cached && Date.now() < cached.expiresAt - 60000) {
    return cached.token;
  }

  try {
    const response = await axios.post(
      `${KIWOOM_API_URL}/oauth2/token`,
      {
        grant_type: "client_credentials",
        appkey: creds.appKey,
        secretkey: creds.appSecret,
      },
      { timeout: 15000 }
    );

    const token = response.data.access_token;
    const expiresIn = response.data.expires_in || 86400; // 기본 24시간

    userTokenCache.set(userId, {
      token,
      expiresAt: Date.now() + expiresIn * 1000,
    });

    console.log(`[Kiwoom] Token issued for user ${userId}`);
    return token;
  } catch (error: any) {
    console.error(`[Kiwoom] Token error:`, error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "키움 인증 토큰 발급 실패");
  }
}

/** 키움 사용자 인증정보 검증 */
export async function validateUserCredentials(
  userId: number,
  creds: UserKiwoomCredentials
): Promise<{ success: boolean; message: string }> {
  try {
    await getKiwoomToken(userId, creds);
    return { success: true, message: "키움 인증 성공" };
  } catch (error: any) {
    userTokenCache.delete(userId);
    return { success: false, message: error.message || "키움 인증 실패" };
  }
}

/** 키움 매매 상태 조회 */
export function getUserTradingStatus(creds: UserKiwoomCredentials) {
  return {
    configured: !!(creds.appKey && creds.appSecret),
    tradingConfigured: !!(creds.appKey && creds.appSecret && creds.accountNo),
    mockTrading: creds.mockTrading,
    accountNo: creds.accountNo ? creds.accountNo.slice(0, 4) + "****" : "",
    accountProductCd: "",
  };
}

// ========== 공통 인터페이스 (KIS와 호환) ==========
export interface HoldingItem {
  stockCode: string;
  stockName: string;
  holdingQty: number;
  avgBuyPrice: number;
  currentPrice: number;
  evalAmount: number;
  evalProfitLoss: number;
  evalProfitRate: number;
  buyAmount: number;
}

export interface BalanceSummary {
  depositAmount: number;
  totalEvalAmount: number;
  totalBuyAmount: number;
  totalEvalProfitLoss: number;
  totalEvalProfitRate: number;
}

export interface AccountBalance {
  holdings: HoldingItem[];
  summary: BalanceSummary;
}

export interface OrderParams {
  stockCode: string;
  orderType: "buy" | "sell";
  quantity: number;
  price?: number;
  orderMethod?: "market" | "limit";
}

export interface OrderResult {
  success: boolean;
  orderNo?: string;
  message: string;
}

export interface OrderHistoryItem {
  orderDate: string;
  orderTime: string;
  stockCode: string;
  stockName: string;
  orderType: string;
  orderQty: number;
  orderPrice: number;
  filledQty: number;
  filledAmount: number;
  orderNo: string;
  orderStatus: string;
}

/** 키움 계좌 잔고 조회 */
export async function getUserAccountBalance(
  userId: number,
  creds: UserKiwoomCredentials
): Promise<AccountBalance> {
  if (!creds.appKey || !creds.appSecret || !creds.accountNo) {
    throw new Error("키움 API 설정이 완료되지 않았습니다.");
  }

  const token = await getKiwoomToken(userId, creds);

  try {
    const response = await axios.get(
      `${KIWOOM_API_URL}/api/dostk/acntbal`,
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          authorization: `Bearer ${token}`,
          appkey: creds.appKey,
          appsecretkey: creds.appSecret,
        },
        params: {
          acnt_no: creds.accountNo,
          cost_icld_yn: "Y",
        },
        timeout: 15000,
      }
    );

    const data = response.data;
    if (data.return_code !== "0" && data.rt_cd !== "0") {
      throw new Error(data.return_msg || data.msg1 || "잔고 조회 실패");
    }

    const outputList = data.output || data.output1 || [];
    const summaryData = data.output2?.[0] || data.summary || {};

    const holdings: HoldingItem[] = outputList
      .filter((item: any) => parseInt(item.holdqty || item.hldg_qty || "0") > 0)
      .map((item: any) => ({
        stockCode: item.stk_cd || item.pdno || "",
        stockName: item.stk_nm || item.prdt_name || "",
        holdingQty: parseInt(item.holdqty || item.hldg_qty || "0"),
        avgBuyPrice: parseFloat(item.avg_buy_prc || item.pchs_avg_pric || "0"),
        currentPrice: parseInt(item.cur_prc || item.prpr || "0"),
        evalAmount: parseInt(item.eval_amt || item.evlu_amt || "0"),
        evalProfitLoss: parseInt(item.eval_pfls || item.evlu_pfls_amt || "0"),
        evalProfitRate: parseFloat(item.eval_pfls_rt || item.evlu_pfls_rt || "0"),
        buyAmount: parseInt(item.buy_amt || item.pchs_amt || "0"),
      }));

    const totalBuyAmount = parseInt(summaryData.tot_buy_amt || summaryData.pchs_amt_smtl_amt || "0");
    const totalEvalAmount = parseInt(summaryData.tot_eval_amt || summaryData.evlu_amt_smtl_amt || "0");

    const summary: BalanceSummary = {
      depositAmount: parseInt(summaryData.deposit_amt || summaryData.dnca_tot_amt || "0"),
      totalEvalAmount: parseInt(summaryData.tot_asset_amt || summaryData.tot_evlu_amt || "0"),
      totalBuyAmount,
      totalEvalProfitLoss: parseInt(summaryData.tot_eval_pfls || summaryData.evlu_pfls_smtl_amt || "0"),
      totalEvalProfitRate: totalBuyAmount > 0
        ? ((totalEvalAmount - totalBuyAmount) / totalBuyAmount) * 100
        : 0,
    };

    return { holdings, summary };
  } catch (error: any) {
    if (error.response) {
      console.error("[Kiwoom] Balance error:", error.response.data);
      throw new Error(error.response.data?.return_msg || error.response.data?.msg1 || "키움 잔고 조회 실패");
    }
    throw error;
  }
}

/** 키움 주문 */
export async function userPlaceOrder(
  userId: number,
  creds: UserKiwoomCredentials,
  params: OrderParams
): Promise<OrderResult> {
  if (!creds.appKey || !creds.appSecret || !creds.accountNo) {
    throw new Error("키움 API 설정이 완료되지 않았습니다.");
  }

  const token = await getKiwoomToken(userId, creds);

  const orderPath = params.orderType === "buy"
    ? "/api/dostk/order"
    : "/api/dostk/order";

  const body: Record<string, any> = {
    acnt_no: creds.accountNo,
    stk_cd: params.stockCode,
    order_type: params.orderType === "buy" ? "2" : "1", // 2:매수, 1:매도
    order_qty: params.quantity,
    order_prc: params.orderMethod === "market" ? 0 : (params.price || 0),
    prc_type: params.orderMethod === "market" ? "03" : "00", // 03:시장가, 00:지정가
  };

  try {
    const response = await axios.post(
      `${KIWOOM_API_URL}${orderPath}`,
      body,
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          authorization: `Bearer ${token}`,
          appkey: creds.appKey,
          appsecretkey: creds.appSecret,
        },
        timeout: 15000,
      }
    );

    const data = response.data;
    if (data.return_code !== "0" && data.rt_cd !== "0") {
      return { success: false, message: data.return_msg || data.msg1 || "주문 실패" };
    }

    console.log(`[Kiwoom] user(${userId}) order: ${params.orderType} ${params.stockCode} x${params.quantity}`);

    return {
      success: true,
      orderNo: data.order_no || data.output?.ODNO || "",
      message: data.return_msg || data.msg1 || "주문 성공",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.return_msg || error.response?.data?.msg1 || error.message || "주문 처리 중 오류 발생",
    };
  }
}

/** 키움 주문 내역 조회 */
export async function getUserOrderHistory(
  userId: number,
  creds: UserKiwoomCredentials,
  startDate?: string,
  endDate?: string
): Promise<OrderHistoryItem[]> {
  if (!creds.appKey || !creds.appSecret || !creds.accountNo) {
    throw new Error("키움 API 설정이 완료되지 않았습니다.");
  }

  const token = await getKiwoomToken(userId, creds);

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
      `${KIWOOM_API_URL}/api/dostk/orderlist`,
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          authorization: `Bearer ${token}`,
          appkey: creds.appKey,
          appsecretkey: creds.appSecret,
        },
        params: {
          acnt_no: creds.accountNo,
          start_dt: start,
          end_dt: end,
        },
        timeout: 15000,
      }
    );

    const data = response.data;
    if (data.return_code !== "0" && data.rt_cd !== "0") {
      throw new Error(data.return_msg || data.msg1 || "주문내역 조회 실패");
    }

    const outputList = data.output || data.output1 || [];

    return outputList.map((item: any) => ({
      orderDate: item.ord_dt || item.order_date || "",
      orderTime: item.ord_tm || item.order_time || "",
      stockCode: item.stk_cd || item.pdno || "",
      stockName: item.stk_nm || item.prdt_name || "",
      orderType: (item.order_type === "1" || item.sll_buy_dvsn_cd === "01") ? "sell" : "buy",
      orderQty: parseInt(item.order_qty || item.ord_qty || "0"),
      orderPrice: parseInt(item.order_prc || item.ord_unpr || "0"),
      filledQty: parseInt(item.filled_qty || item.tot_ccld_qty || "0"),
      filledAmount: parseInt(item.filled_amt || item.tot_ccld_amt || "0"),
      orderNo: item.order_no || item.odno || "",
      orderStatus: parseInt(item.filled_qty || item.tot_ccld_qty || "0") > 0 ? "filled" : "pending",
    }));
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data?.return_msg || error.response.data?.msg1 || "키움 주문내역 조회 실패");
    }
    throw error;
  }
}

/** 사용자 토큰 캐시 제거 */
export function clearUserTokenCache(userId: number) {
  userTokenCache.delete(userId);
}

