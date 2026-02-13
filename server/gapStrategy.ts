/**
 * 시가급등 추세추종 자동매매 전략 엔진
 * 
 * 매수조건:
 *   - 코스닥150, 코스피200 종목
 *   - 이동평균선 정배열(MA5>MA10>MA20>MA60) + 현재가 > 5일선
 *   - 시초가 갭 3~7% 상승
 *   - 분할매수: 1차 30% → +1%마다 20% 추가매수
 * 
 * 매도조건:
 *   - 종가 기준 5일선 이탈 시 전량 매도
 * 
 * 리스크: 전체 운용잔고의 50% 한도 내
 */

import axios from "axios";
import * as cheerio from "cheerio";
import * as kisApi from "./kisApi.js";
import { storage } from "./storage.js";
import type { GapStrategy, GapStrategyPosition } from "../shared/schema.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ========== 1. 유니버스 로드 (코스피200/코스닥150 구성종목) ==========

async function fetchIndexStocks(url: string): Promise<{ code: string; name: string }[]> {
  const stocks: { code: string; name: string }[] = [];
  try {
    // 네이버 금융 - 코스피200/코스닥150 구성종목 (여러 페이지)
    for (let page = 1; page <= 8; page++) {
      const res = await axios.get(url, {
        params: { page },
        headers: { "User-Agent": UA },
        timeout: 8000,
        responseType: "arraybuffer",
      });
      const iconv = await import("iconv-lite");
      const html = iconv.default.decode(Buffer.from(res.data), "euc-kr");
      const $ = cheerio.load(html);

      $("table.type_1 tr, table.type_2 tr").each((_i, row) => {
        const tds = $(row).find("td");
        if (tds.length < 2) return;
        const nameEl = $(tds[0]).find("a").length > 0 ? $(tds[0]).find("a") : $(tds[1]).find("a");
        const name = nameEl.text().trim();
        if (!name) return;
        const href = nameEl.attr("href") || "";
        const codeMatch = href.match(/code=(\d{6})/);
        if (codeMatch) {
          stocks.push({ code: codeMatch[1], name });
        }
      });
      await sleep(200);
    }
  } catch (error: any) {
    console.error(`[GapStrategy] Failed to fetch index stocks from ${url}:`, error.message);
  }
  return stocks;
}

export async function loadUniverse(type: string): Promise<{ code: string; name: string }[]> {
  const all: { code: string; name: string }[] = [];

  if (type === "kospi200" || type === "both") {
    const kospi200 = await fetchIndexStocks("https://finance.naver.com/sise/entryJongmok.naver");
    all.push(...kospi200);
    console.log(`[GapStrategy] 코스피200: ${kospi200.length}종목 로드`);
  }

  if (type === "kosdaq150" || type === "both") {
    const kosdaq150 = await fetchIndexStocks("https://finance.naver.com/sise/entryJongmok2.naver");
    all.push(...kosdaq150);
    console.log(`[GapStrategy] 코스닥150: ${kosdaq150.length}종목 로드`);
  }

  // 중복 제거
  const unique = new Map<string, { code: string; name: string }>();
  for (const s of all) {
    unique.set(s.code, s);
  }
  return Array.from(unique.values());
}

// ========== 2. 이동평균선 계산 & 정배열 체크 ==========

export interface MAData {
  ma5: number;
  ma10: number;
  ma20: number;
  ma60: number;
  currentPrice: number;
  closes: number[];        // 원본 종가 배열 (최근순)
  isAligned: boolean;      // MA5>MA10>MA20>MA60
  isAboveMa5: boolean;     // 현재가 > MA5
}

export async function calculateMA(stockCode: string): Promise<MAData | null> {
  try {
    const dailyPrices = await kisApi.getStockDailyPrices(stockCode, "3M");
    if (dailyPrices.length < 60) return null;

    const closes = dailyPrices.map(d => parseInt(d.closePrice));
    const recent = closes[closes.length - 1];

    const ma5 = avg(closes.slice(-5));
    const ma10 = avg(closes.slice(-10));
    const ma20 = avg(closes.slice(-20));
    const ma60 = avg(closes.slice(-60));

    const isAligned = ma5 > ma10 && ma10 > ma20 && ma20 > ma60;
    const isAboveMa5 = recent > ma5;

    return { ma5, ma10, ma20, ma60, currentPrice: recent, closes, isAligned, isAboveMa5 };
  } catch (error: any) {
    console.error(`[GapStrategy] MA calculation failed for ${stockCode}:`, error.message);
    return null;
  }
}

// ========== 3. 시초가 갭 체크 ==========

export interface GapCheckResult {
  stockCode: string;
  stockName: string;
  prevClose: number;
  openPrice: number;
  currentPrice: number;
  gapPercent: number;
}

export async function checkGapUp(
  stockCode: string,
  stockName: string,
  minGap: number,
  maxGap: number
): Promise<GapCheckResult | null> {
  try {
    const priceData = await kisApi.getCurrentPrice(stockCode);
    if (!priceData || !priceData.open) return null;

    const openPrice = parseInt(priceData.open);
    const currentPrice = parseInt(priceData.price);
    // 전일 종가 = 현재가 - 전일대비
    const prevClose = currentPrice - parseInt(priceData.change);
    if (prevClose <= 0) return null;

    const gapPercent = ((openPrice - prevClose) / prevClose) * 100;

    if (gapPercent < minGap || gapPercent > maxGap) return null;

    return {
      stockCode,
      stockName: priceData.stockName || stockName,
      prevClose,
      openPrice,
      currentPrice,
      gapPercent,
    };
  } catch (error: any) {
    return null;
  }
}

// ========== 4. 분할매수 계획 ==========

export interface BuyPlan {
  phase: number;
  triggerPrice: number;
  quantity: number;
  ratio: number;
  amount: number;
}

export function createBuyPlan(
  targetAmount: number,
  basePrice: number,
  firstRatio: number = 30,
  addRatio: number = 20,
  triggerPercent: number = 1
): BuyPlan[] {
  if (basePrice <= 0 || targetAmount <= 0) return [];

  const plans: BuyPlan[] = [];
  let remaining = 100;

  // 1차: firstRatio%
  const firstAmount = targetAmount * (firstRatio / 100);
  plans.push({
    phase: 1,
    triggerPrice: basePrice,
    quantity: Math.max(1, Math.floor(firstAmount / basePrice)),
    ratio: firstRatio,
    amount: firstAmount,
  });
  remaining -= firstRatio;

  // 추가매수: addRatio%씩
  let phase = 2;
  let cumulativeRise = triggerPercent;
  while (remaining > 0) {
    const ratio = Math.min(addRatio, remaining);
    const price = Math.round(basePrice * (1 + cumulativeRise / 100));
    const amount = targetAmount * (ratio / 100);
    const qty = Math.max(1, Math.floor(amount / price));
    plans.push({
      phase,
      triggerPrice: price,
      quantity: qty,
      ratio,
      amount,
    });
    remaining -= ratio;
    cumulativeRise += triggerPercent;
    phase++;
  }

  return plans;
}

// ========== 5. 매도 판단 (종가 기준 5일선 이탈) ==========

export async function checkSellSignal(stockCode: string, maPeriod: number = 5): Promise<{ shouldSell: boolean; currentPrice: number; ma: number }> {
  try {
    const dailyPrices = await kisApi.getStockDailyPrices(stockCode, "1M");
    if (dailyPrices.length < maPeriod) return { shouldSell: false, currentPrice: 0, ma: 0 };

    const closes = dailyPrices.map(d => parseInt(d.closePrice));
    const ma = avg(closes.slice(-maPeriod));
    const todayClose = closes[closes.length - 1];

    return {
      shouldSell: todayClose < ma,
      currentPrice: todayClose,
      ma,
    };
  } catch {
    return { shouldSell: false, currentPrice: 0, ma: 0 };
  }
}

// ========== 6. 로그 기록 헬퍼 ==========

async function logAction(
  strategyId: number,
  positionId: number | null,
  action: string,
  detail: string,
  stockCode?: string,
  stockName?: string
) {
  try {
    await storage.createGapLog({
      strategyId,
      positionId,
      action,
      detail,
      stockCode: stockCode || null,
      stockName: stockName || null,
    });
  } catch (e: any) {
    console.error("[GapStrategy] Log failed:", e.message);
  }
}

// ========== 7. 메인 실행 엔진 ==========

/**
 * Phase 1: 사전 스캔 (08:50~09:00)
 * - 유니버스 로드 → 이동평균선 정배열 + 현재가>5일선 필터
 */
export async function runPreMarketScan(strategy: GapStrategy): Promise<string[]> {
  await logAction(strategy.id, null, "scan_start", `유니버스(${strategy.universeType}) 스캔 시작`);

  const universe = await loadUniverse(strategy.universeType || "both");
  await logAction(strategy.id, null, "scan_start", `유니버스 총 ${universe.length}종목 로드 완료`);

  const candidates: { code: string; name: string }[] = [];
  let scanned = 0;

  for (const stock of universe) {
    scanned++;
    const ma = await calculateMA(stock.code);
    if (!ma) continue;

    const maAligned = strategy.maAligned !== false;
    const priceAboveMa5 = strategy.priceAboveMa5 !== false;

    if (maAligned && !ma.isAligned) continue;
    if (priceAboveMa5 && !ma.isAboveMa5) continue;

    candidates.push(stock);

    if (scanned % 50 === 0) {
      await logAction(strategy.id, null, "scan_progress", `${scanned}/${universe.length} 스캔 중... 후보 ${candidates.length}종목`);
    }
    await sleep(150);
  }

  // 후보 저장
  const candidateJson = JSON.stringify(candidates);
  await storage.updateGapStrategy(strategy.id, { candidates: candidateJson } as any);

  await logAction(strategy.id, null, "scan_complete",
    `스캔 완료: ${universe.length}종목 중 정배열+5일선 위 후보 ${candidates.length}종목`);

  return candidates.map(c => c.code);
}

/**
 * Phase 2: 갭 감지 (09:01~09:05)
 * - 후보종목 중 갭 3~7% 상승 감지 → 포지션 생성
 */
export async function runGapDetection(strategy: GapStrategy, userCreds?: any): Promise<number> {
  const candidatesStr = strategy.candidates;
  if (!candidatesStr) {
    await logAction(strategy.id, null, "gap_scan", "후보종목이 없습니다. 사전 스캔을 먼저 실행하세요.");
    return 0;
  }

  const candidates: { code: string; name: string }[] = JSON.parse(candidatesStr);
  const minGap = parseFloat(strategy.minGapPercent || "3");
  const maxGap = parseFloat(strategy.maxGapPercent || "7");
  const maxStocks = strategy.maxStocksCount || 5;

  // 이미 활성 포지션이 있는지 확인
  const activePositions = await storage.getActiveGapPositions(strategy.id);
  const activeCount = activePositions.length;
  const remainingSlots = maxStocks - activeCount;

  if (remainingSlots <= 0) {
    await logAction(strategy.id, null, "gap_scan", `이미 최대 ${maxStocks}종목 보유 중 → 갭 스캔 스킵`);
    return 0;
  }

  // 잔고 확인 (투자한도 계산)
  let maxInvestAmount = 0;
  try {
    let balance;
    if (userCreds) {
      balance = await kisApi.getUserAccountBalance(strategy.userId, userCreds);
    } else {
      balance = await kisApi.getAccountBalance();
    }
    const positionRatio = (strategy.maxPositionRatio || 50) / 100;
    maxInvestAmount = balance.summary.totalEvalAmount * positionRatio;
    // 이미 투입된 금액 차감
    const usedAmount = activePositions.reduce((sum, p) => sum + parseFloat(p.totalBuyAmount || "0"), 0);
    maxInvestAmount -= usedAmount;
  } catch (e: any) {
    await logAction(strategy.id, null, "error", `잔고 조회 실패: ${e.message}`);
    return 0;
  }

  if (maxInvestAmount <= 0) {
    await logAction(strategy.id, null, "gap_scan", "투자 가능 한도 초과 → 갭 스캔 스킵");
    return 0;
  }

  const perStockAmount = maxInvestAmount / remainingSlots;

  let detected = 0;
  for (const stock of candidates) {
    if (detected >= remainingSlots) break;

    // 이미 이 종목에 포지션이 있으면 스킵
    if (activePositions.some(p => p.stockCode === stock.code)) continue;

    const gap = await checkGapUp(stock.code, stock.name, minGap, maxGap);
    if (gap) {
      const ma = await calculateMA(stock.code);
      const position = await storage.createGapPosition({
        strategyId: strategy.id,
        userId: strategy.userId,
        stockCode: gap.stockCode,
        stockName: gap.stockName,
        status: "gap_detected",
        prevClose: String(gap.prevClose),
        openPrice: String(gap.openPrice),
        gapPercent: String(gap.gapPercent.toFixed(2)),
        targetAmount: String(Math.round(perStockAmount)),
        totalBuyQty: 0,
        totalBuyAmount: "0",
        buyPhase: 0,
        ma5: ma ? String(Math.round(ma.ma5)) : null,
        ma10: ma ? String(Math.round(ma.ma10)) : null,
        ma20: ma ? String(Math.round(ma.ma20)) : null,
        ma60: ma ? String(Math.round(ma.ma60)) : null,
      });

      detected++;
      await logAction(strategy.id, position.id, "gap_detected",
        `${gap.stockName}(${gap.stockCode}) 갭 +${gap.gapPercent.toFixed(2)}% | 시초가 ${gap.openPrice.toLocaleString()}원 | 전일종가 ${gap.prevClose.toLocaleString()}원`,
        gap.stockCode, gap.stockName
      );
    }
    await sleep(200);
  }

  await logAction(strategy.id, null, "gap_scan_complete",
    `갭 스캔 완료: ${candidates.length}종목 중 ${detected}종목 감지`);

  return detected;
}

/**
 * Phase 3: 분할매수 모니터링 (09:05~15:20)
 * - 활성 포지션의 현재가 체크 → 분할매수 트리거 시 주문 실행
 */
export async function runBuyMonitoring(strategy: GapStrategy, userCreds?: any): Promise<string[]> {
  const positions = await storage.getActiveGapPositions(strategy.id);
  const results: string[] = [];

  for (const pos of positions) {
    if (pos.status !== "gap_detected" && pos.status !== "buying") continue;

    try {
      const priceData = await kisApi.getCurrentPrice(pos.stockCode);
      if (!priceData) continue;

      const currentPrice = parseInt(priceData.price);
      const openPrice = parseFloat(pos.openPrice || "0");
      const targetAmount = parseFloat(pos.targetAmount || "0");

      const buyPlans = createBuyPlan(
        targetAmount,
        openPrice,
        strategy.firstBuyRatio || 30,
        strategy.addBuyRatio || 20,
        parseFloat(strategy.addBuyTriggerPercent || "1")
      );

      const nextPhase = (pos.buyPhase || 0) + 1;
      const nextPlan = buyPlans.find(p => p.phase === nextPhase);

      if (nextPlan && currentPrice >= nextPlan.triggerPrice && nextPlan.quantity > 0) {
        // 주문 실행
        let orderResult;
        try {
          if (userCreds) {
            orderResult = await kisApi.userPlaceOrder(strategy.userId, userCreds, {
              stockCode: pos.stockCode,
              orderType: "buy",
              quantity: nextPlan.quantity,
              price: currentPrice,
              orderMethod: "limit",
            });
          } else {
            orderResult = await kisApi.placeOrder({
              stockCode: pos.stockCode,
              orderType: "buy",
              quantity: nextPlan.quantity,
              price: currentPrice,
              orderMethod: "limit",
            });
          }
        } catch (e: any) {
          await logAction(strategy.id, pos.id, "error",
            `${pos.stockName} ${nextPhase}차 매수 주문 실패: ${e.message}`,
            pos.stockCode, pos.stockName);
          continue;
        }

        if (orderResult.success) {
          const newTotalQty = (pos.totalBuyQty || 0) + nextPlan.quantity;
          const newTotalAmount = parseFloat(pos.totalBuyAmount || "0") + (currentPrice * nextPlan.quantity);

          await storage.updateGapPosition(pos.id, {
            status: "buying",
            buyPhase: nextPhase,
            lastBuyPrice: String(currentPrice),
            totalBuyQty: newTotalQty,
            totalBuyAmount: String(newTotalAmount),
            avgBuyPrice: String(Math.round(newTotalAmount / newTotalQty)),
          });

          const msg = `${pos.stockName} ${nextPhase}차 매수 체결: ${nextPlan.quantity}주 @ ${currentPrice.toLocaleString()}원 (총 ${newTotalQty}주)`;
          await logAction(strategy.id, pos.id, "buy_filled", msg, pos.stockCode, pos.stockName);
          results.push(msg);

          // 매수 완료 확인
          if (nextPhase >= buyPlans.length) {
            await storage.updateGapPosition(pos.id, { status: "holding" });
            await logAction(strategy.id, pos.id, "buy_complete",
              `${pos.stockName} 분할매수 완료 (총 ${buyPlans.length}단계)`, pos.stockCode, pos.stockName);
          }
        } else {
          await logAction(strategy.id, pos.id, "buy_failed",
            `${pos.stockName} ${nextPhase}차 매수 실패: ${orderResult.message}`, pos.stockCode, pos.stockName);
        }
      }
    } catch (e: any) {
      await logAction(strategy.id, pos.id, "error", `모니터링 오류: ${e.message}`, pos.stockCode, pos.stockName);
    }
    await sleep(200);
  }

  return results;
}

/**
 * Phase 4: 장마감 전 매도 체크 (15:20~15:28)
 * - 종가 기준 5일선 이탈 시 전량 매도
 */
export async function runClosingSellCheck(strategy: GapStrategy, userCreds?: any): Promise<string[]> {
  const positions = await storage.getActiveGapPositions(strategy.id);
  const results: string[] = [];

  for (const pos of positions) {
    if (pos.status !== "buying" && pos.status !== "holding") continue;
    if ((pos.totalBuyQty || 0) <= 0) continue;

    try {
      const maPeriod = strategy.sellMaPeriod || 5;
      const signal = await checkSellSignal(pos.stockCode, maPeriod);

      if (signal.shouldSell) {
        const priceData = await kisApi.getCurrentPrice(pos.stockCode);
        if (!priceData) continue;

        const price = parseInt(priceData.price);
        const totalQty = pos.totalBuyQty || 0;

        let orderResult;
        try {
          if (userCreds) {
            orderResult = await kisApi.userPlaceOrder(strategy.userId, userCreds, {
              stockCode: pos.stockCode,
              orderType: "sell",
              quantity: totalQty,
              price,
              orderMethod: "limit",
            });
          } else {
            orderResult = await kisApi.placeOrder({
              stockCode: pos.stockCode,
              orderType: "sell",
              quantity: totalQty,
              price,
              orderMethod: "limit",
            });
          }
        } catch (e: any) {
          await logAction(strategy.id, pos.id, "error",
            `${pos.stockName} 매도 주문 실패: ${e.message}`, pos.stockCode, pos.stockName);
          continue;
        }

        if (orderResult.success) {
          const sellAmount = price * totalQty;
          const buyAmount = parseFloat(pos.totalBuyAmount || "0");
          const profitLoss = sellAmount - buyAmount;
          const profitRate = buyAmount > 0 ? (profitLoss / buyAmount) * 100 : 0;

          await storage.updateGapPosition(pos.id, {
            status: "closed",
            sellPrice: String(price),
            sellQty: totalQty,
            sellAmount: String(sellAmount),
            profitLoss: String(Math.round(profitLoss)),
            profitRate: String(profitRate.toFixed(2)),
            closedAt: new Date(),
          });

          const msg = `${pos.stockName} 전량매도: ${totalQty}주 @ ${price.toLocaleString()}원 (손익: ${profitRate >= 0 ? "+" : ""}${profitRate.toFixed(2)}%, ${profitLoss >= 0 ? "+" : ""}${Math.round(profitLoss).toLocaleString()}원)`;
          await logAction(strategy.id, pos.id, "sell_filled", msg, pos.stockCode, pos.stockName);
          results.push(msg);
        }
      } else {
        await logAction(strategy.id, pos.id, "ma_check",
          `${pos.stockName} ${strategy.sellMaPeriod || 5}일선 유지 중 (현재가 ${signal.currentPrice.toLocaleString()}원 > MA ${Math.round(signal.ma).toLocaleString()}원) → 계속 보유`,
          pos.stockCode, pos.stockName);
      }
    } catch (e: any) {
      await logAction(strategy.id, pos.id, "error", `매도 체크 오류: ${e.message}`, pos.stockCode, pos.stockName);
    }
    await sleep(200);
  }

  return results;
}

/**
 * 전략 메인 실행 (스케줄러에서 호출)
 */
export async function executeGapStrategy(userId: number): Promise<{ phase: string; results: string[] }> {
  const strategy = await storage.getGapStrategy(userId);
  if (!strategy || !strategy.isActive) {
    return { phase: "inactive", results: ["전략이 비활성 상태입니다."] };
  }

  // 사용자 KIS 인증정보 조회
  const config = await storage.getUserTradingConfig(strategy.userId);
  const userCreds = config ? {
    appKey: config.appKey,
    appSecret: config.appSecret,
    accountNo: config.accountNo,
    accountProductCd: config.accountProductCd || "01",
    mockTrading: config.mockTrading ?? true,
  } : undefined;

  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC → KST
  const hour = kst.getHours();
  const minute = kst.getMinutes();
  const timeCode = hour * 100 + minute;

  // Phase 1: 사전 스캔 (08:50~09:00)
  if (timeCode >= 850 && timeCode < 900) {
    const candidates = await runPreMarketScan(strategy);
    return { phase: "pre_scan", results: [`후보 ${candidates.length}종목 발견`] };
  }

  // Phase 2: 갭 감지 (09:01~09:05)
  if (timeCode >= 901 && timeCode <= 905) {
    const detected = await runGapDetection(strategy, userCreds);
    return { phase: "gap_detection", results: [`${detected}종목 갭 감지`] };
  }

  // Phase 3: 분할매수 모니터링 (09:05~15:20)
  if (timeCode > 905 && timeCode <= 1520) {
    const results = await runBuyMonitoring(strategy, userCreds);
    return { phase: "buy_monitoring", results: results.length > 0 ? results : ["매수 대기 중"] };
  }

  // Phase 4: 장마감 매도 체크 (15:20~15:28)
  if (timeCode > 1520 && timeCode <= 1528) {
    const results = await runClosingSellCheck(strategy, userCreds);
    return { phase: "sell_check", results: results.length > 0 ? results : ["매도 신호 없음 (보유 유지)"] };
  }

  return { phase: "market_closed", results: ["장 운영시간이 아닙니다."] };
}

/**
 * 수동 실행 (테스트/디버그용) - 특정 Phase만 실행
 */
export async function executePhase(
  userId: number,
  phase: "scan" | "gap" | "buy" | "sell"
): Promise<{ results: string[] }> {
  const strategy = await storage.getGapStrategy(userId);
  if (!strategy) return { results: ["전략 설정이 없습니다."] };

  const config = await storage.getUserTradingConfig(strategy.userId);
  const userCreds = config ? {
    appKey: config.appKey,
    appSecret: config.appSecret,
    accountNo: config.accountNo,
    accountProductCd: config.accountProductCd || "01",
    mockTrading: config.mockTrading ?? true,
  } : undefined;

  switch (phase) {
    case "scan": {
      const candidates = await runPreMarketScan(strategy);
      return { results: [`사전 스캔 완료: 후보 ${candidates.length}종목`] };
    }
    case "gap": {
      const detected = await runGapDetection(strategy, userCreds);
      return { results: [`갭 감지 완료: ${detected}종목`] };
    }
    case "buy": {
      const results = await runBuyMonitoring(strategy, userCreds);
      return { results: results.length > 0 ? results : ["매수 조건 미충족 또는 활성 포지션 없음"] };
    }
    case "sell": {
      const results = await runClosingSellCheck(strategy, userCreds);
      return { results: results.length > 0 ? results : ["매도 신호 없음"] };
    }
    default:
      return { results: ["잘못된 Phase 입니다."] };
  }
}

