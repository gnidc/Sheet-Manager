/**
 * 멀티팩터 자동매매 전략 엔진
 *
 * 5개 팩터 복합 스코어링:
 *   1) MA 정배열 (MA5>MA10>MA20>MA60) + 현재가 위치
 *   2) RSI 과매수/과매도 판단
 *   3) 볼린저밴드 상하단 위치
 *   4) 거래량 폭증 (20일 평균 대비)
 *   5) 시초가 갭 상승폭
 *
 * 매수: 복합 스코어 >= buyScoreThreshold (기본 70점)
 * 매도: 복합 스코어 <= sellScoreThreshold (기본 30점) 또는 손절/익절
 */

import * as kisApi from "./kisApi.js";
import { storage } from "./storage.js";
import { loadUniverse, calculateMA, checkGapUp } from "./gapStrategy.js";
import type { MultiFactorStrategy, MultiFactorPosition } from "../shared/schema.js";

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ========== 팩터 계산 ==========

export interface FactorScores {
  maScore: number;
  rsiScore: number;
  bollingerScore: number;
  volumeScore: number;
  gapScore: number;
  totalScore: number;
  details: {
    ma5: number; ma20: number; ma60: number;
    rsi: number;
    bollingerUpper: number; bollingerLower: number; bollingerMid: number;
    volumeRatio: number;
    gapPercent: number;
    currentPrice: number;
  };
}

function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;

  const recent = closes.slice(-(period + 1));
  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  const avgGain = gainSum / period;
  const avgLoss = lossSum / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateBollinger(closes: number[], period: number = 20, mult: number = 2) {
  if (closes.length < period) return { upper: 0, lower: 0, mid: 0, width: 0 };

  const slice = closes.slice(-period);
  const mid = avg(slice);
  const variance = slice.reduce((sum, v) => sum + Math.pow(v - mid, 2), 0) / period;
  const std = Math.sqrt(variance);

  return {
    upper: mid + mult * std,
    lower: mid - mult * std,
    mid,
    width: (mult * std * 2) / mid * 100,
  };
}

function calculateVolumeRatio(volumes: number[], period: number = 20): number {
  if (volumes.length < period + 1) return 1;
  const avgVol = avg(volumes.slice(-(period + 1), -1));
  const todayVol = volumes[volumes.length - 1];
  return avgVol > 0 ? todayVol / avgVol : 1;
}

export async function computeFactorScores(
  stockCode: string,
  stockName: string,
  strategy: MultiFactorStrategy
): Promise<FactorScores | null> {
  try {
    const dailyPrices = await kisApi.getStockDailyPrices(stockCode, "3M");
    if (dailyPrices.length < 60) return null;

    const closes = dailyPrices.map(d => parseInt(d.closePrice));
    const volumes = dailyPrices.map(d => parseInt(d.volume || "0"));
    const currentPrice = closes[closes.length - 1];

    // 1) MA 팩터: 정배열 + 현재가 위치
    const ma5 = avg(closes.slice(-5));
    const ma10 = avg(closes.slice(-10));
    const ma20 = avg(closes.slice(-20));
    const ma60 = avg(closes.slice(-60));

    let maScore = 0;
    if (ma5 > ma10 && ma10 > ma20 && ma20 > ma60) maScore += 50;
    else if (ma5 > ma10 && ma10 > ma20) maScore += 30;
    else if (ma5 > ma20) maScore += 15;
    if (currentPrice > ma5) maScore += 30;
    else if (currentPrice > ma20) maScore += 15;
    const distFromMa5 = ((currentPrice - ma5) / ma5) * 100;
    if (distFromMa5 > 0 && distFromMa5 < 3) maScore += 20;
    maScore = Math.min(100, maScore);

    // 2) RSI 팩터
    const rsiPeriod = strategy.rsiPeriod || 14;
    const rsi = calculateRSI(closes, rsiPeriod);
    const rsiBuy = strategy.rsiBuyThreshold || 30;
    const rsiSell = strategy.rsiSellThreshold || 70;
    let rsiScore = 0;
    if (rsi <= rsiBuy) rsiScore = 100;
    else if (rsi <= 40) rsiScore = 80;
    else if (rsi <= 50) rsiScore = 60;
    else if (rsi <= 60) rsiScore = 40;
    else if (rsi <= rsiSell) rsiScore = 20;
    else rsiScore = 0;

    // 3) 볼린저밴드 팩터
    const bPeriod = strategy.bollingerPeriod || 20;
    const bMult = parseFloat(String(strategy.bollingerMult || "2"));
    const bb = calculateBollinger(closes, bPeriod, bMult);
    let bollingerScore = 0;
    if (bb.lower > 0 && bb.upper > 0) {
      const bbRange = bb.upper - bb.lower;
      const bbPosition = bbRange > 0 ? (currentPrice - bb.lower) / bbRange : 0.5;
      // 하단 근접 = 매수 기회, 상단 근접 = 주의
      if (bbPosition <= 0.2) bollingerScore = 100;
      else if (bbPosition <= 0.4) bollingerScore = 70;
      else if (bbPosition <= 0.6) bollingerScore = 50;
      else if (bbPosition <= 0.8) bollingerScore = 30;
      else bollingerScore = 10;
    }

    // 4) 거래량 팩터
    const volumeRatio = calculateVolumeRatio(volumes);
    let volumeScore = 0;
    if (volumeRatio >= 3) volumeScore = 100;
    else if (volumeRatio >= 2) volumeScore = 80;
    else if (volumeRatio >= 1.5) volumeScore = 60;
    else if (volumeRatio >= 1) volumeScore = 40;
    else volumeScore = 20;

    // 5) 갭 팩터
    let gapPercent = 0;
    try {
      const priceData = await kisApi.getCurrentPrice(stockCode);
      if (priceData && priceData.open) {
        const openPrice = parseInt(priceData.open);
        const prevClose = currentPrice - parseInt(priceData.change);
        if (prevClose > 0) gapPercent = ((openPrice - prevClose) / prevClose) * 100;
      }
    } catch { /* ignore */ }

    const minGap = parseFloat(String(strategy.minGapPercent || "2"));
    const maxGap = parseFloat(String(strategy.maxGapPercent || "8"));
    let gapScore = 0;
    if (gapPercent >= minGap && gapPercent <= maxGap) gapScore = 100;
    else if (gapPercent > 0 && gapPercent < minGap) gapScore = 40;
    else if (gapPercent > maxGap) gapScore = 20;
    else gapScore = 30;

    // 가중 평균 종합 스코어
    const wMa = strategy.weightMa || 30;
    const wRsi = strategy.weightRsi || 20;
    const wBb = strategy.weightBollinger || 20;
    const wVol = strategy.weightVolume || 15;
    const wGap = strategy.weightGap || 15;
    const totalWeight = wMa + wRsi + wBb + wVol + wGap;

    const totalScore = Math.round(
      (maScore * wMa + rsiScore * wRsi + bollingerScore * wBb + volumeScore * wVol + gapScore * wGap) / totalWeight
    );

    return {
      maScore, rsiScore, bollingerScore, volumeScore, gapScore, totalScore,
      details: {
        ma5: Math.round(ma5), ma20: Math.round(ma20), ma60: Math.round(ma60),
        rsi: Math.round(rsi * 100) / 100,
        bollingerUpper: Math.round(bb.upper), bollingerLower: Math.round(bb.lower), bollingerMid: Math.round(bb.mid),
        volumeRatio: Math.round(volumeRatio * 100) / 100,
        gapPercent: Math.round(gapPercent * 100) / 100,
        currentPrice,
      },
    };
  } catch (error: any) {
    console.error(`[MultiFactor] Factor computation failed for ${stockCode}:`, error.message);
    return null;
  }
}

// ========== 로그 헬퍼 ==========

async function logAction(
  strategyId: number,
  positionId: number | null,
  action: string,
  detail: string,
  stockCode?: string,
  stockName?: string
) {
  try {
    await storage.createMultiFactorLog({
      strategyId,
      positionId,
      action,
      detail,
      stockCode: stockCode || null,
      stockName: stockName || null,
    });
  } catch (e: any) {
    console.error("[MultiFactor] Log failed:", e.message);
  }
}

// ========== Phase 1: 사전 스캔 (08:50~09:00) ==========

export async function runFactorScan(strategy: MultiFactorStrategy): Promise<string[]> {
  await logAction(strategy.id, null, "scan_start", `유니버스(${strategy.universeType}) 멀티팩터 스캔 시작`);

  const universe = await loadUniverse(strategy.universeType || "both");
  await logAction(strategy.id, null, "universe_loaded", `유니버스 총 ${universe.length}종목 로드`);

  const candidates: { code: string; name: string; score: number }[] = [];
  let scanned = 0;

  for (const stock of universe) {
    scanned++;
    const ma = await calculateMA(stock.code);
    if (!ma) continue;

    // 1차 필터: 최소 MA 조건 (5일선 위)
    if (!ma.isAboveMa5) continue;

    // RSI 사전 필터
    const rsi = calculateRSI(ma.closes, strategy.rsiPeriod || 14);
    if (rsi > (strategy.rsiSellThreshold || 70)) continue;

    candidates.push({ code: stock.code, name: stock.name, score: 0 });

    if (scanned % 50 === 0) {
      await logAction(strategy.id, null, "scan_progress", `${scanned}/${universe.length} 스캔 중... 후보 ${candidates.length}종목`);
    }
    await sleep(150);
  }

  const candidateJson = JSON.stringify(candidates);
  await storage.updateMultiFactorStrategy(strategy.id, { candidates: candidateJson } as any);

  await logAction(strategy.id, null, "scan_complete",
    `스캔 완료: ${universe.length}종목 중 후보 ${candidates.length}종목 (MA + RSI 필터)`);

  return candidates.map(c => c.code);
}

// ========== Phase 2: 팩터 스코어링 & 신호 감지 (09:01~09:10) ==========

export async function runFactorScoring(strategy: MultiFactorStrategy, userCreds?: any): Promise<number> {
  const candidatesStr = strategy.candidates;
  if (!candidatesStr) {
    await logAction(strategy.id, null, "scoring", "후보종목 없음. 사전 스캔을 먼저 실행하세요.");
    return 0;
  }

  const candidates: { code: string; name: string }[] = JSON.parse(candidatesStr);
  const buyThreshold = strategy.buyScoreThreshold || 70;
  const maxStocks = strategy.maxStocksCount || 5;

  const activePositions = await storage.getActiveMultiFactorPositions(strategy.id);
  const remainingSlots = maxStocks - activePositions.length;

  if (remainingSlots <= 0) {
    await logAction(strategy.id, null, "scoring", `이미 최대 ${maxStocks}종목 보유 → 스킵`);
    return 0;
  }

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
    const usedAmount = activePositions.reduce((sum, p) => sum + parseFloat(p.totalBuyAmount || "0"), 0);
    maxInvestAmount -= usedAmount;
  } catch (e: any) {
    await logAction(strategy.id, null, "error", `잔고 조회 실패: ${e.message}`);
    return 0;
  }

  if (maxInvestAmount <= 0) {
    await logAction(strategy.id, null, "scoring", "투자 가능 한도 초과 → 스킵");
    return 0;
  }

  const perStockAmount = maxInvestAmount / remainingSlots;

  // 스코어링 후 상위 종목 선택
  const scored: { code: string; name: string; scores: FactorScores }[] = [];

  for (const stock of candidates) {
    if (activePositions.some(p => p.stockCode === stock.code)) continue;

    const scores = await computeFactorScores(stock.code, stock.name, strategy);
    if (scores && scores.totalScore >= buyThreshold) {
      scored.push({ code: stock.code, name: stock.name, scores });
    }
    await sleep(200);
  }

  scored.sort((a, b) => b.scores.totalScore - a.scores.totalScore);
  const topPicks = scored.slice(0, remainingSlots);

  let detected = 0;
  for (const pick of topPicks) {
    const s = pick.scores;
    const position = await storage.createMultiFactorPosition({
      strategyId: strategy.id,
      userId: strategy.userId,
      stockCode: pick.code,
      stockName: pick.name,
      status: "signal_detected",
      signalScore: String(s.totalScore),
      targetAmount: String(Math.round(perStockAmount)),
      totalBuyQty: 0,
      totalBuyAmount: "0",
      buyPhase: 0,
      factorDetails: JSON.stringify({
        ma: s.maScore, rsi: s.rsiScore, bollinger: s.bollingerScore,
        volume: s.volumeScore, gap: s.gapScore,
      }),
      ma5: String(s.details.ma5),
      ma20: String(s.details.ma20),
      rsi: String(s.details.rsi),
      bollingerUpper: String(s.details.bollingerUpper),
      bollingerLower: String(s.details.bollingerLower),
    });

    detected++;
    await logAction(strategy.id, position.id, "signal_detected",
      `${pick.name}(${pick.code}) 종합스코어 ${s.totalScore}점 | MA:${s.maScore} RSI:${s.rsiScore} BB:${s.bollingerScore} Vol:${s.volumeScore} Gap:${s.gapScore}`,
      pick.code, pick.name);
  }

  await logAction(strategy.id, null, "scoring_complete",
    `스코어링 완료: ${candidates.length}종목 평가, ${scored.length}종목 기준 충족, ${detected}종목 선택`);

  return detected;
}

// ========== Phase 3: 분할매수 실행 (09:10~15:20) ==========

export async function runMultiFactorBuy(strategy: MultiFactorStrategy, userCreds?: any): Promise<string[]> {
  const positions = await storage.getActiveMultiFactorPositions(strategy.id);
  const results: string[] = [];

  for (const pos of positions) {
    if (pos.status !== "signal_detected" && pos.status !== "buying") continue;

    try {
      const priceData = await kisApi.getCurrentPrice(pos.stockCode);
      if (!priceData) continue;

      const currentPrice = parseInt(priceData.price);
      const targetAmount = parseFloat(pos.targetAmount || "0");
      const firstRatio = strategy.firstBuyRatio || 40;
      const addRatio = strategy.addBuyRatio || 30;
      const addTrigger = parseFloat(String(strategy.addBuyTriggerPercent || "2"));
      const currentPhase = pos.buyPhase || 0;

      if (currentPhase === 0) {
        // 1차 매수
        const buyAmount = targetAmount * (firstRatio / 100);
        const qty = Math.max(1, Math.floor(buyAmount / currentPrice));

        let orderResult;
        try {
          if (userCreds) {
            orderResult = await kisApi.userPlaceOrder(strategy.userId, userCreds, {
              stockCode: pos.stockCode, orderType: "buy",
              quantity: qty, price: currentPrice, orderMethod: "limit",
            });
          } else {
            orderResult = await kisApi.placeOrder({
              stockCode: pos.stockCode, orderType: "buy",
              quantity: qty, price: currentPrice, orderMethod: "limit",
            });
          }
        } catch (e: any) {
          await logAction(strategy.id, pos.id, "error",
            `${pos.stockName} 1차 매수 주문 실패: ${e.message}`, pos.stockCode, pos.stockName);
          continue;
        }

        if (orderResult.success) {
          const totalAmount = currentPrice * qty;
          await storage.updateMultiFactorPosition(pos.id, {
            status: "buying",
            buyPhase: 1,
            lastBuyPrice: String(currentPrice),
            totalBuyQty: qty,
            totalBuyAmount: String(totalAmount),
            avgBuyPrice: String(currentPrice),
          });
          const msg = `${pos.stockName} 1차 매수: ${qty}주 @ ${currentPrice.toLocaleString()}원 (스코어 ${pos.signalScore}점)`;
          await logAction(strategy.id, pos.id, "buy_filled", msg, pos.stockCode, pos.stockName);
          results.push(msg);
        }
      } else if (currentPhase === 1) {
        // 2차 추가매수 (가격이 addTrigger% 상승 시)
        const lastPrice = parseFloat(pos.lastBuyPrice || "0");
        if (lastPrice > 0 && currentPrice >= lastPrice * (1 + addTrigger / 100)) {
          const buyAmount = targetAmount * (addRatio / 100);
          const qty = Math.max(1, Math.floor(buyAmount / currentPrice));

          let orderResult;
          try {
            if (userCreds) {
              orderResult = await kisApi.userPlaceOrder(strategy.userId, userCreds, {
                stockCode: pos.stockCode, orderType: "buy",
                quantity: qty, price: currentPrice, orderMethod: "limit",
              });
            } else {
              orderResult = await kisApi.placeOrder({
                stockCode: pos.stockCode, orderType: "buy",
                quantity: qty, price: currentPrice, orderMethod: "limit",
              });
            }
          } catch (e: any) {
            await logAction(strategy.id, pos.id, "error",
              `${pos.stockName} 2차 매수 실패: ${e.message}`, pos.stockCode, pos.stockName);
            continue;
          }

          if (orderResult.success) {
            const prevQty = pos.totalBuyQty || 0;
            const prevAmount = parseFloat(pos.totalBuyAmount || "0");
            const newQty = prevQty + qty;
            const newAmount = prevAmount + currentPrice * qty;

            await storage.updateMultiFactorPosition(pos.id, {
              status: "holding",
              buyPhase: 2,
              lastBuyPrice: String(currentPrice),
              totalBuyQty: newQty,
              totalBuyAmount: String(newAmount),
              avgBuyPrice: String(Math.round(newAmount / newQty)),
            });
            const msg = `${pos.stockName} 2차 매수: ${qty}주 @ ${currentPrice.toLocaleString()}원 (총 ${newQty}주)`;
            await logAction(strategy.id, pos.id, "buy_filled", msg, pos.stockCode, pos.stockName);
            results.push(msg);
          }
        }
      }
    } catch (e: any) {
      await logAction(strategy.id, pos.id, "error", `매수 모니터링 오류: ${e.message}`, pos.stockCode, pos.stockName);
    }
    await sleep(200);
  }

  return results;
}

// ========== Phase 4: 매도 체크 - 팩터 재평가 + 손절/익절 (15:20~15:28) ==========

export async function runMultiFactorSell(strategy: MultiFactorStrategy, userCreds?: any): Promise<string[]> {
  const positions = await storage.getActiveMultiFactorPositions(strategy.id);
  const results: string[] = [];
  const sellThreshold = strategy.sellScoreThreshold || 30;
  const stopLoss = parseFloat(String(strategy.stopLossPercent || "5"));
  const takeProfit = parseFloat(String(strategy.takeProfitPercent || "10"));

  for (const pos of positions) {
    if (pos.status !== "buying" && pos.status !== "holding") continue;
    if ((pos.totalBuyQty || 0) <= 0) continue;

    try {
      const priceData = await kisApi.getCurrentPrice(pos.stockCode);
      if (!priceData) continue;

      const currentPrice = parseInt(priceData.price);
      const avgPrice = parseFloat(pos.avgBuyPrice || "0");
      const totalQty = pos.totalBuyQty || 0;

      if (avgPrice <= 0) continue;

      const profitRate = ((currentPrice - avgPrice) / avgPrice) * 100;
      let shouldSell = false;
      let sellReason = "";

      // 손절 체크
      if (profitRate <= -stopLoss) {
        shouldSell = true;
        sellReason = `손절 (${profitRate.toFixed(2)}% <= -${stopLoss}%)`;
      }

      // 익절 체크
      if (!shouldSell && profitRate >= takeProfit) {
        shouldSell = true;
        sellReason = `익절 (${profitRate.toFixed(2)}% >= +${takeProfit}%)`;
      }

      // 팩터 재평가 매도
      if (!shouldSell) {
        const scores = await computeFactorScores(pos.stockCode, pos.stockName, strategy);
        if (scores && scores.totalScore <= sellThreshold) {
          shouldSell = true;
          sellReason = `팩터 하락 (스코어 ${scores.totalScore}점 <= ${sellThreshold}점)`;
        } else if (scores) {
          await logAction(strategy.id, pos.id, "factor_check",
            `${pos.stockName} 스코어 ${scores.totalScore}점 유지 중 (수익률 ${profitRate >= 0 ? "+" : ""}${profitRate.toFixed(2)}%) → 보유`,
            pos.stockCode, pos.stockName);
        }
      }

      if (shouldSell) {
        let orderResult;
        try {
          if (userCreds) {
            orderResult = await kisApi.userPlaceOrder(strategy.userId, userCreds, {
              stockCode: pos.stockCode, orderType: "sell",
              quantity: totalQty, price: currentPrice, orderMethod: "limit",
            });
          } else {
            orderResult = await kisApi.placeOrder({
              stockCode: pos.stockCode, orderType: "sell",
              quantity: totalQty, price: currentPrice, orderMethod: "limit",
            });
          }
        } catch (e: any) {
          await logAction(strategy.id, pos.id, "error",
            `${pos.stockName} 매도 주문 실패: ${e.message}`, pos.stockCode, pos.stockName);
          continue;
        }

        if (orderResult.success) {
          const sellAmount = currentPrice * totalQty;
          const buyAmount = parseFloat(pos.totalBuyAmount || "0");
          const profitLoss = sellAmount - buyAmount;
          const finalRate = buyAmount > 0 ? (profitLoss / buyAmount) * 100 : 0;

          await storage.updateMultiFactorPosition(pos.id, {
            status: "closed",
            sellPrice: String(currentPrice),
            sellQty: totalQty,
            sellAmount: String(sellAmount),
            profitLoss: String(Math.round(profitLoss)),
            profitRate: String(finalRate.toFixed(2)),
            closedAt: new Date(),
          });

          const msg = `${pos.stockName} 매도[${sellReason}]: ${totalQty}주 @ ${currentPrice.toLocaleString()}원 (손익 ${finalRate >= 0 ? "+" : ""}${finalRate.toFixed(2)}%, ${profitLoss >= 0 ? "+" : ""}${Math.round(profitLoss).toLocaleString()}원)`;
          await logAction(strategy.id, pos.id, "sell_filled", msg, pos.stockCode, pos.stockName);
          results.push(msg);
        }
      }
    } catch (e: any) {
      await logAction(strategy.id, pos.id, "error", `매도 체크 오류: ${e.message}`, pos.stockCode, pos.stockName);
    }
    await sleep(200);
  }

  return results;
}

// ========== 메인 실행 (스케줄러 호출) ==========

export async function executeMultiFactorStrategy(userId: number): Promise<{ phase: string; results: string[] }> {
  const strategy = await storage.getMultiFactorStrategy(userId);
  if (!strategy || !strategy.isActive) {
    return { phase: "inactive", results: ["멀티팩터 전략이 비활성 상태입니다."] };
  }

  const config = await storage.getUserTradingConfig(strategy.userId);
  const userCreds = config ? {
    appKey: config.appKey,
    appSecret: config.appSecret,
    accountNo: config.accountNo,
    accountProductCd: config.accountProductCd || "01",
    mockTrading: config.mockTrading ?? true,
  } : undefined;

  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hour = kst.getHours();
  const minute = kst.getMinutes();
  const timeCode = hour * 100 + minute;

  if (timeCode >= 850 && timeCode < 900) {
    const candidates = await runFactorScan(strategy);
    return { phase: "factor_scan", results: [`후보 ${candidates.length}종목 사전 필터 완료`] };
  }

  if (timeCode >= 901 && timeCode <= 910) {
    const detected = await runFactorScoring(strategy, userCreds);
    return { phase: "factor_scoring", results: [`${detected}종목 팩터 스코어링 완료`] };
  }

  if (timeCode > 910 && timeCode <= 1520) {
    const results = await runMultiFactorBuy(strategy, userCreds);
    return { phase: "buy_monitoring", results: results.length > 0 ? results : ["매수 대기 중"] };
  }

  if (timeCode > 1520 && timeCode <= 1528) {
    const results = await runMultiFactorSell(strategy, userCreds);
    return { phase: "sell_check", results: results.length > 0 ? results : ["매도 신호 없음 (보유 유지)"] };
  }

  return { phase: "market_closed", results: ["장 운영시간이 아닙니다."] };
}

// ========== 수동 실행 (테스트/디버그) ==========

export async function executeMultiFactorPhase(
  userId: number,
  phase: "scan" | "score" | "buy" | "sell"
): Promise<{ results: string[] }> {
  const strategy = await storage.getMultiFactorStrategy(userId);
  if (!strategy) return { results: ["멀티팩터 전략 설정이 없습니다."] };

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
      const candidates = await runFactorScan(strategy);
      return { results: [`사전 스캔 완료: 후보 ${candidates.length}종목`] };
    }
    case "score": {
      const detected = await runFactorScoring(strategy, userCreds);
      return { results: [`팩터 스코어링 완료: ${detected}종목 선택`] };
    }
    case "buy": {
      const results = await runMultiFactorBuy(strategy, userCreds);
      return { results: results.length > 0 ? results : ["매수 조건 미충족 또는 활성 포지션 없음"] };
    }
    case "sell": {
      const results = await runMultiFactorSell(strategy, userCreds);
      return { results: results.length > 0 ? results : ["매도 신호 없음"] };
    }
    default:
      return { results: ["잘못된 Phase 입니다."] };
  }
}
