import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Users,
  Newspaper,
  Star,
  ExternalLink,
  FileText,
  Clock,
  FilePlus,
  FileOutput,
  BrainCircuit,
  Send,
  Trash2,
  Eye,
  BookOpen,
  Copy,
  Save,
  ZoomIn,
  ZoomOut,
  Type,
} from "lucide-react";

interface MarketIndex {
  name: string;
  code: string;
  price: string;
  change: string;
  changePercent: string;
  changeSign: string;
}

interface VolumeRankItem {
  rank: number;
  stockCode: string;
  stockName: string;
  price: string;
  change: string;
  changePercent: string;
  volume: string;
  changeSign: string;
}

interface InvestorTrend {
  name: string;
  buyAmount: string;
  sellAmount: string;
  netAmount: string;
}

interface NewsItem {
  title: string;
  link: string;
  source: string;
  time: string;
}

interface TopEtf {
  id: number;
  name: string;
  code: string;
  mainCategory: string;
  trendScore: string;
  yield: string;
  fee: string;
}

interface MarketReport {
  period: string;
  periodLabel: string;
  periodRange: string;
  reportTime: string;
  marketSummary: string;
  indices: MarketIndex[];
  volumeRanking: VolumeRankItem[];
  investorTrends: InvestorTrend[];
  topEtfs: TopEtf[];
  news: NewsItem[];
}

interface AiAnalysisResult {
  analysis: string;
  analyzedAt: string;
  dataPoints?: {
    indicesCount: number;
    volumeCount: number;
    newsCount: number;
    urlCount?: number;
    fileCount?: number;
    market: string;
  };
}

interface SavedReport {
  id: string;
  title: string;
  createdAt: string;
  periodLabel: string;
  report: MarketReport;
}

interface SavedAnalysis {
  id: string;
  createdAt: string;
  prompt: string;
  urls: string[];
  fileNames: string[];
  source?: "strategy" | "etf-realtime";
  result: AiAnalysisResult;
}

interface SavedPromptItem {
  id: string;
  label: string;
  prompt: string;
  urls: string[];
  createdAt: string;
}

type ReportPeriod = "daily" | "weekly" | "monthly" | "yearly";

interface DailyStrategyProps {
  period?: ReportPeriod;
  isAdmin?: boolean;
}

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  daily: "일일",
  weekly: "주간",
  monthly: "월간",
  yearly: "연간",
};

const PERIOD_DESCRIPTIONS: Record<ReportPeriod, string> = {
  daily: "오늘의 시장 동향과 투자 전략을 확인합니다.",
  weekly: "이번 주 시장 동향과 투자 전략을 확인합니다.",
  monthly: "이번 달 시장 동향과 투자 전략을 확인합니다.",
  yearly: "올해 시장 동향과 투자 전략을 확인합니다.",
};

const DEFAULT_PROMPTS: Record<ReportPeriod, string> = {
  daily: "실시간 ETF 상승리스트, 네이버 실시간 뉴스(https://stock.naver.com/news ), 네이버 마켓동향 (https://stock.naver.com/market/stock/kr )을 참고하여 오늘의 시장 동향을 요약 정리해줘",
  weekly: "이번 주 시장 동향과 주요 이벤트, ETF 상승리스트, 뉴스를 참고하여 주간 시장 분석을 요약 정리해줘",
  monthly: "이번 달 시장 동향과 주요 이벤트, ETF 흐름, 뉴스를 참고하여 월간 시장 분석을 요약 정리해줘",
  yearly: "올해 시장 동향과 주요 이벤트, ETF 흐름, 뉴스를 참고하여 연간 시장 분석을 요약 정리해줘",
};

const MAX_SAVED_REPORTS = 5;
const MAX_SAVED_ANALYSES = 5;
const MAX_PROMPT_HISTORY = 10;
const REPORT_RETENTION_DAYS = 7; // 일주일 보관

// localStorage key helpers
const SAVED_REPORTS_BASE = "strategy_saved_reports_";
const PROMPT_BASE = "strategy_prompt_";
const AI_ANALYSIS_BASE = "strategy_ai_analysis_";
const PROMPT_HISTORY_BASE = "strategy_prompt_history_";

function storageKey(base: string, period: ReportPeriod) {
  return `${base}${period}`;
}

// 일주일 이전 항목 필터링 (id가 Date.now() 타임스탬프 기반)
function filterByRetention<T extends { id: string }>(items: T[]): T[] {
  const cutoff = Date.now() - REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return items.filter((item) => {
    const ts = Number(item.id);
    // id가 숫자가 아닌 경우 보관 (안전장치)
    if (isNaN(ts)) return true;
    return ts >= cutoff;
  });
}

// localStorage CRUD
function getSavedReports(period: ReportPeriod): SavedReport[] {
  try {
    const raw = localStorage.getItem(storageKey(SAVED_REPORTS_BASE, period));
    if (!raw) return [];
    const all: SavedReport[] = JSON.parse(raw);
    const filtered = filterByRetention(all);
    // 만료된 항목이 있으면 localStorage도 정리
    if (filtered.length !== all.length) {
      localStorage.setItem(storageKey(SAVED_REPORTS_BASE, period), JSON.stringify(filtered));
    }
    return filtered;
  } catch { return []; }
}
function setSavedReportsLS(period: ReportPeriod, reports: SavedReport[]) {
  localStorage.setItem(storageKey(SAVED_REPORTS_BASE, period), JSON.stringify(filterByRetention(reports)));
}
function getSavedPrompt(period: ReportPeriod): { prompt: string; urls: string[] } | null {
  try {
    const raw = localStorage.getItem(storageKey(PROMPT_BASE, period));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function setSavedPrompt(period: ReportPeriod, prompt: string, urls: string[]) {
  localStorage.setItem(storageKey(PROMPT_BASE, period), JSON.stringify({ prompt, urls }));
}
function getSavedAnalyses(period: ReportPeriod): SavedAnalysis[] {
  try {
    const raw = localStorage.getItem(storageKey(AI_ANALYSIS_BASE, period));
    if (!raw) return [];
    const all: SavedAnalysis[] = JSON.parse(raw);
    const filtered = filterByRetention(all);
    // 만료된 항목이 있으면 localStorage도 정리
    if (filtered.length !== all.length) {
      localStorage.setItem(storageKey(AI_ANALYSIS_BASE, period), JSON.stringify(filtered));
    }
    return filtered;
  } catch { return []; }
}
function setSavedAnalysesLS(period: ReportPeriod, analyses: SavedAnalysis[]) {
  localStorage.setItem(storageKey(AI_ANALYSIS_BASE, period), JSON.stringify(filterByRetention(analyses)));
}
function getPromptHistory(period: ReportPeriod): SavedPromptItem[] {
  try {
    const raw = localStorage.getItem(storageKey(PROMPT_HISTORY_BASE, period));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function savePromptToHistory(prompt: string, urls: string[], period: ReportPeriod) {
  const history = getPromptHistory(period);
  const newItem: SavedPromptItem = {
    id: Date.now().toString(),
    label: prompt.substring(0, 50) + (prompt.length > 50 ? "..." : ""),
    prompt,
    urls: urls.filter((u) => u.trim()),
    createdAt: new Date().toLocaleString("ko-KR"),
  };
  const updated = [newItem, ...history].slice(0, MAX_PROMPT_HISTORY);
  localStorage.setItem(storageKey(PROMPT_HISTORY_BASE, period), JSON.stringify(updated));
}
function deletePromptFromHistory(id: string, period: ReportPeriod) {
  const history = getPromptHistory(period);
  const updated = history.filter((item) => item.id !== id);
  localStorage.setItem(storageKey(PROMPT_HISTORY_BASE, period), JSON.stringify(updated));
}

// ===== Helper functions =====
function ChangeIcon({ sign }: { sign: string }) {
  if (["1", "2"].includes(sign)) return <TrendingUp className="w-4 h-4 text-red-500" />;
  if (["4", "5"].includes(sign)) return <TrendingDown className="w-4 h-4 text-blue-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

function changeColor(sign: string) {
  if (["1", "2"].includes(sign)) return "text-red-500";
  if (["4", "5"].includes(sign)) return "text-blue-500";
  return "text-muted-foreground";
}

function changePrefix(sign: string) {
  if (["1", "2"].includes(sign)) return "+";
  if (["4", "5"].includes(sign)) return "-";
  return "";
}

function changePrefixHtml(sign: string) {
  if (["1", "2"].includes(sign)) return "+";
  if (["4", "5"].includes(sign)) return "-";
  return "";
}

function changeColorHtml(sign: string) {
  if (["1", "2"].includes(sign)) return "#dc2626";
  if (["4", "5"].includes(sign)) return "#2563eb";
  return "#6b7280";
}

function changeArrowHtml(sign: string) {
  if (["1", "2"].includes(sign)) return "▲";
  if (["4", "5"].includes(sign)) return "▼";
  return "-";
}

// ===== Font size control component =====
function FontSizeControl({ fontSize, onIncrease, onDecrease, onReset }: {
  fontSize: number;
  onIncrease: () => void;
  onDecrease: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-1 border rounded-md px-1.5 py-0.5 bg-muted/30">
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDecrease} title="글자 축소">
        <ZoomOut className="w-3.5 h-3.5" />
      </Button>
      <button onClick={onReset} className="text-xs font-medium min-w-[32px] text-center hover:text-primary transition-colors" title="기본 크기로 복원">
        {fontSize}px
      </button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onIncrease} title="글자 확대">
        <ZoomIn className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function generateReportHTML(report: MarketReport, periodLabel: string): string {
  const indicesHTML = report.indices.map(idx => {
    const color = changeColorHtml(idx.changeSign);
    const arrow = changeArrowHtml(idx.changeSign);
    const prefix = changePrefixHtml(idx.changeSign);
    return `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;text-align:center;flex:1;min-width:200px;">
        <div style="font-size:13px;color:#6b7280;font-weight:600;margin-bottom:6px;">${idx.name}</div>
        <div style="font-size:28px;font-weight:800;color:#111827;letter-spacing:-0.5px;">
          ${parseFloat(idx.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div style="font-size:14px;font-weight:600;color:${color};margin-top:4px;">
          ${arrow} ${prefix}${Math.abs(parseFloat(idx.change)).toFixed(2)} (${prefix}${Math.abs(parseFloat(idx.changePercent)).toFixed(2)}%)
        </div>
      </div>`;
  }).join("");

  const investorHTML = report.investorTrends.map(trend => {
    const net = parseFloat(trend.netAmount);
    const isPositive = net > 0;
    const color = net === 0 ? "#6b7280" : isPositive ? "#dc2626" : "#2563eb";
    const label = isPositive ? "순매수" : net === 0 ? "-" : "순매도";
    return `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;text-align:center;flex:1;min-width:150px;">
        <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px;">${trend.name}</div>
        <div style="font-size:22px;font-weight:800;color:${color};">${isPositive ? "+" : ""}${net.toLocaleString()}</div>
        <div style="font-size:11px;color:#9ca3af;margin-top:4px;">${label}</div>
      </div>`;
  }).join("");

  const volumeRows = report.volumeRanking.map(item => {
    const color = changeColorHtml(item.changeSign);
    const prefix = changePrefixHtml(item.changeSign);
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#9ca3af;font-weight:600;">${item.rank}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;">
          <div style="font-weight:600;color:#111827;">${item.stockName}</div>
          <div style="font-size:11px;color:#9ca3af;">${item.stockCode}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;">
          ${parseInt(item.price).toLocaleString()}원
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:${color};font-variant-numeric:tabular-nums;">
          ${prefix}${Math.abs(parseFloat(item.changePercent)).toFixed(2)}%
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#6b7280;font-variant-numeric:tabular-nums;">
          ${parseInt(item.volume).toLocaleString()}
        </td>
      </tr>`;
  }).join("");

  const etfHTML = report.topEtfs.map((etf, i) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#9ca3af;font-weight:600;">${i + 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;">
        <div style="font-weight:600;color:#111827;">${etf.name}</div>
        <div style="font-size:11px;color:#9ca3af;">${etf.code} · ${etf.mainCategory}${etf.fee ? ` · 수수료 ${etf.fee}` : ""}</div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:center;">
        <span style="background:#ecfdf5;color:#059669;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">${etf.trendScore}점</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:#111827;">
        ${etf.yield || "-"}
      </td>
    </tr>`).join("");

  const newsHTML = report.news.map((item, i) => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:14px 0;${i < report.news.length - 1 ? "border-bottom:1px solid #f3f4f6;" : ""}">
      <span style="background:#f3f4f6;color:#6b7280;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${i + 1}</span>
      <div style="flex:1;min-width:0;">
        <a href="${item.link}" target="_blank" rel="noopener noreferrer" style="color:#111827;text-decoration:none;font-weight:500;font-size:14px;line-height:1.5;">
          ${item.title}
        </a>
        <div style="font-size:11px;color:#9ca3af;margin-top:3px;">${[item.source, item.time].filter(Boolean).join(" · ")}</div>
      </div>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${periodLabel} 시장 전략 보고서 - ${report.periodRange}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Noto Sans KR', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f8fafc;
      color: #111827;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 40px 24px; }
    .header {
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%);
      color: white;
      padding: 48px 40px;
      border-radius: 20px;
      margin-bottom: 32px;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 400px;
      height: 400px;
      background: rgba(255,255,255,0.05);
      border-radius: 50%;
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: -30%;
      left: -10%;
      width: 300px;
      height: 300px;
      background: rgba(255,255,255,0.03);
      border-radius: 50%;
    }
    .header h1 { font-size: 28px; font-weight: 800; margin-bottom: 8px; position: relative; z-index: 1; }
    .header .subtitle { font-size: 15px; opacity: 0.9; position: relative; z-index: 1; }
    .header .meta { font-size: 12px; opacity: 0.7; margin-top: 16px; position: relative; z-index: 1; }
    .summary-banner {
      background: linear-gradient(90deg, #eff6ff, #f0fdf4);
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 16px 24px;
      text-align: center;
      font-weight: 600;
      font-size: 15px;
      color: #1e40af;
      margin-bottom: 32px;
    }
    .section { margin-bottom: 32px; }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-icon { font-size: 20px; }
    .cards-row { display: flex; gap: 16px; flex-wrap: wrap; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
    thead th {
      background: #f9fafb;
      padding: 12px;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 2px solid #e5e7eb;
    }
    .news-container { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 8px 20px; }
    .footer {
      text-align: center;
      padding: 32px 0 16px;
      font-size: 11px;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
      margin-top: 40px;
    }
    .print-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #1e40af;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(30,64,175,0.3);
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .print-btn:hover { background: #1d4ed8; }
    .copy-btn {
      position: fixed;
      bottom: 24px;
      right: 160px;
      background: #059669;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(5,150,105,0.3);
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .copy-btn:hover { background: #047857; }
    @media print {
      body { background: white; }
      .container { padding: 20px 0; }
      .print-btn, .copy-btn { display: none !important; }
      .header { break-inside: avoid; }
      .section { break-inside: avoid; }
    }
    @media (max-width: 640px) {
      .cards-row { flex-direction: column; }
      .header { padding: 32px 24px; }
      .header h1 { font-size: 22px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 ${periodLabel} 시장 전략 보고서</h1>
      <div class="subtitle">${report.periodRange}</div>
      <div class="meta">생성일시: ${report.reportTime} | 데이터 출처: 한국투자증권 API, 네이버 금융</div>
    </div>

    ${report.marketSummary ? `<div class="summary-banner">📈 ${report.marketSummary}</div>` : ""}

    ${report.indices.length > 0 ? `
    <div class="section">
      <div class="section-title"><span class="section-icon">📊</span> 주요 시장 지수</div>
      <div class="cards-row">${indicesHTML}</div>
    </div>` : ""}

    ${report.investorTrends.length > 0 ? `
    <div class="section">
      <div class="section-title"><span class="section-icon">👥</span> 투자자별 매매동향 (코스피)</div>
      <div class="cards-row">${investorHTML}</div>
    </div>` : ""}

    ${report.volumeRanking.length > 0 ? `
    <div class="section">
      <div class="section-title"><span class="section-icon">🔥</span> 거래량 상위 종목 TOP 10</div>
      <table>
        <thead>
          <tr>
            <th style="text-align:left;width:40px;">#</th>
            <th style="text-align:left;">종목명</th>
            <th style="text-align:right;">현재가</th>
            <th style="text-align:right;">등락률</th>
            <th style="text-align:right;">거래량</th>
          </tr>
        </thead>
        <tbody>${volumeRows}</tbody>
      </table>
    </div>` : ""}

    ${report.topEtfs.length > 0 ? `
    <div class="section">
      <div class="section-title"><span class="section-icon">⭐</span> 주요 추천 ETF</div>
      <table>
        <thead>
          <tr>
            <th style="text-align:left;width:40px;">#</th>
            <th style="text-align:left;">ETF명</th>
            <th style="text-align:center;">트렌드 점수</th>
            <th style="text-align:right;">수익률</th>
          </tr>
        </thead>
        <tbody>${etfHTML}</tbody>
      </table>
    </div>` : ""}

    ${report.news.length > 0 ? `
    <div class="section">
      <div class="section-title"><span class="section-icon">📰</span> 주요 금융 뉴스</div>
      <div class="news-container">${newsHTML}</div>
    </div>` : ""}

    <div class="footer">
      <p>⚠️ 본 보고서는 참고용이며, 투자 판단의 최종 책임은 투자자 본인에게 있습니다.</p>
      <p style="margin-top:4px;">데이터 출처: 한국투자증권 API, 네이버 금융 | ${report.reportTime} 기준</p>
    </div>
  </div>

  <button class="copy-btn" onclick="copyReport()">📋 복사하기</button>
  <button class="print-btn" onclick="window.print()">🖨️ 인쇄 / PDF</button>

  <script>
    function copyReport() {
      const container = document.querySelector('.container');
      const range = document.createRange();
      range.selectNodeContents(container);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      try {
        document.execCommand('copy');
        const btn = document.querySelector('.copy-btn');
        btn.textContent = '✅ 복사 완료!';
        setTimeout(() => { btn.innerHTML = '📋 복사하기'; }, 2000);
      } catch(e) {
        alert('복사에 실패했습니다. Ctrl+A → Ctrl+C로 복사해주세요.');
      }
      selection.removeAllRanges();
    }
  </script>
</body>
</html>`;
}

export default function DailyStrategy({ period = "daily", isAdmin = false }: DailyStrategyProps) {
  const { toast } = useToast();
  const periodLabel = PERIOD_LABELS[period];
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ===== State =====
  const [prompt, setPrompt] = useState(() => {
    const saved = getSavedPrompt(period);
    return saved?.prompt || DEFAULT_PROMPTS[period];
  });
  const [urls, setUrls] = useState<string[]>(() => {
    const saved = getSavedPrompt(period);
    return saved?.urls?.length ? saved.urls : ["https://stock.naver.com/"];
  });
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>(() => getSavedReports(period));
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>(() => getSavedAnalyses(period));
  const [activeReport, setActiveReport] = useState<MarketReport | null>(null);
  const [showPromptHistory, setShowPromptHistory] = useState(false);
  const [promptHistory, setPromptHistory] = useState<SavedPromptItem[]>(() => getPromptHistory(period));
  const [viewingReport, setViewingReport] = useState<SavedReport | null>(null);
  const [viewingAnalysis, setViewingAnalysis] = useState<SavedAnalysis | null>(null);

  // ===== 팝업 폰트 크기 State =====
  const DEFAULT_FONT_SIZE = 14;
  const [reportFontSize, setReportFontSize] = useState(DEFAULT_FONT_SIZE);
  const [analysisFontSize, setAnalysisFontSize] = useState(DEFAULT_FONT_SIZE);

  // ===== Auto-save prompt =====
  useEffect(() => {
    const timer = setTimeout(() => {
      setSavedPrompt(period, prompt, urls);
    }, 500);
    return () => clearTimeout(timer);
  }, [prompt, urls, period]);

  // ===== Data query =====
  const {
    data: report,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<MarketReport>({
    queryKey: ["/api/report", period],
    queryFn: async () => {
      const res = await fetch(`/api/report/${period}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error("관리자 로그인이 필요합니다");
        throw new Error(err.message || "보고서 생성 실패");
      }
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    enabled: false,
  });

  // ===== AI Analyze Mutation =====
  const aiAnalyzeMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("prompt", prompt);
      formData.append("urls", JSON.stringify(urls.filter((u) => u.trim())));
      attachedFiles.forEach((file) => formData.append("files", file));

      const res = await fetch("/api/report/ai-analyze", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "AI 분석 실패");
      }
      return res.json() as Promise<AiAnalysisResult>;
    },
    onSuccess: (data) => {
      setAiAnalysis(data);
      // Save to analyses
      const newSaved: SavedAnalysis = {
        id: Date.now().toString(),
        createdAt: new Date().toLocaleString("ko-KR"),
        prompt,
        urls: urls.filter((u) => u.trim()),
        fileNames: attachedFiles.map((f) => f.name),
        result: data,
      };
      const updated = [newSaved, ...savedAnalyses].slice(0, MAX_SAVED_ANALYSES);
      setSavedAnalysesLS(period, updated);
      setSavedAnalyses(updated);
      // Save prompt to history
      savePromptToHistory(prompt, urls, period);
      setPromptHistory(getPromptHistory(period));
      toast({ title: "AI 분석 완료", description: "분석 보고서가 생성되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "AI 분석 실패", description: error.message, variant: "destructive" });
    },
  });

  // ===== Callbacks =====
  const handleGenerate = useCallback(() => {
    refetch();
  }, [refetch]);

  // Save report when new data arrives
  useEffect(() => {
    if (report && !isFetching) {
      const newSaved: SavedReport = {
        id: Date.now().toString(),
        title: `${periodLabel} 시장 보고서`,
        createdAt: new Date().toLocaleString("ko-KR"),
        periodLabel,
        report,
      };
      const updated = [newSaved, ...savedReports.filter((r) => r.id !== newSaved.id)].slice(0, MAX_SAVED_REPORTS);
      setSavedReportsLS(period, updated);
      setSavedReports(updated);
    }
  }, [report]);

  const addUrl = useCallback(() => {
    if (urls.length < 5) setUrls([...urls, ""]);
  }, [urls]);
  const updateUrl = useCallback((idx: number, val: string) => {
    const next = [...urls];
    next[idx] = val;
    setUrls(next);
  }, [urls]);
  const removeUrl = useCallback((idx: number) => {
    if (urls.length > 1) setUrls(urls.filter((_, i) => i !== idx));
  }, [urls]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 5 * 1024 * 1024;
    const valid = files.filter((f) => f.size <= maxSize);
    if (valid.length < files.length) {
      toast({ title: "파일 크기 초과", description: "5MB 이하 파일만 첨부 가능합니다.", variant: "destructive" });
    }
    setAttachedFiles((prev) => [...prev, ...valid].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [toast]);
  const removeFile = useCallback((idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleDelete = useCallback((id: string) => {
    const updated = savedReports.filter((r) => r.id !== id);
    setSavedReportsLS(period, updated);
    setSavedReports(updated);
    toast({ title: "삭제 완료" });
  }, [savedReports, toast, period]);

  const handleDeleteAnalysis = useCallback((id: string) => {
    const updated = savedAnalyses.filter((a) => a.id !== id);
    setSavedAnalysesLS(period, updated);
    setSavedAnalyses(updated);
    toast({ title: "삭제 완료" });
  }, [savedAnalyses, toast, period]);

  const handleLoadPrompt = useCallback((item: SavedPromptItem) => {
    setPrompt(item.prompt);
    if (item.urls.length > 0) setUrls(item.urls);
    setShowPromptHistory(false);
    toast({ title: "프롬프트 로드 완료", description: "이전에 사용한 프롬프트가 적용되었습니다." });
  }, [toast]);

  const handleDeletePromptHistory = useCallback((id: string) => {
    deletePromptFromHistory(id, period);
    setPromptHistory(getPromptHistory(period));
    toast({ title: "프롬프트 삭제 완료" });
  }, [toast, period]);

  const handleSaveCurrentPrompt = useCallback(() => {
    if (!prompt.trim()) return;
    savePromptToHistory(prompt, urls, period);
    setPromptHistory(getPromptHistory(period));
    toast({ title: "프롬프트 저장 완료", description: "프롬프트 예시 목록에 저장되었습니다." });
  }, [prompt, urls, toast, period]);

  const openReportHtml = useCallback((rpt: MarketReport, label: string) => {
    const html = generateReportHTML(rpt, label);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, []);

  const displayReport = activeReport || report;

  return (
    <div className="space-y-6">
      {/* ===== 프롬프트 입력 영역 (Admin 전용) ===== */}
      {isAdmin && (
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-primary" />
              {periodLabel} 보고서 프롬프트
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            프롬프트에 참고 URL이나 파일을 함께 첨부하면 AI가 내용을 분석에 포함합니다. 프롬프트는 자동 저장됩니다.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="보고서 분석 프롬프트를 입력하세요..."
            className="min-h-[100px] text-sm resize-y"
            disabled={aiAnalyzeMutation.isPending || isFetching}
          />

          {/* URL 입력 영역 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                🔗 참고 URL (선택)
              </label>
              <Button variant="ghost" size="sm" onClick={addUrl} disabled={urls.length >= 5 || aiAnalyzeMutation.isPending} className="h-6 text-[11px] px-2">
                + URL 추가
              </Button>
            </div>
            {urls.map((url, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => updateUrl(idx, e.target.value)}
                  placeholder="https://finance.naver.com/... 분석할 페이지 URL"
                  className="flex-1 h-8 rounded-md border border-input bg-background px-3 text-xs"
                  disabled={aiAnalyzeMutation.isPending}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeUrl(idx)} disabled={urls.length <= 1 || aiAnalyzeMutation.isPending}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              URL 입력 시 해당 페이지 내용을 자동으로 크롤링하여 AI 분석에 포함합니다 (최대 5개)
            </p>
          </div>

          {/* 파일 첨부 영역 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                📎 파일 첨부 (선택)
              </label>
              <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={attachedFiles.length >= 5 || aiAnalyzeMutation.isPending} className="h-6 text-[11px] px-2">
                + 파일 선택
              </Button>
              <input ref={fileInputRef} type="file" accept=".txt,.csv,.json,.md,.log,.html,.htm" multiple onChange={handleFileSelect} className="hidden" />
            </div>
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2.5 py-1.5 text-xs">
                    <FileText className="w-3 h-3 text-muted-foreground" />
                    <span className="max-w-[150px] truncate">{file.name}</span>
                    <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)}KB)</span>
                    <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-destructive ml-0.5" disabled={aiAnalyzeMutation.isPending}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              텍스트 기반 파일을 첨부하면 AI 분석에 포함됩니다 (.txt, .csv, .json, .md, .html 지원, 최대 5MB)
            </p>
          </div>

          {/* 버튼 영역 */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>📊 시장 데이터</span>
              <span>+</span>
              <span>📰 뉴스</span>
              {urls.some((u) => u.trim()) && <><span>+</span><span>🔗 URL {urls.filter((u) => u.trim()).length}개</span></>}
              {attachedFiles.length > 0 && <><span>+</span><span>📎 파일 {attachedFiles.length}개</span></>}
              <span className="text-muted-foreground/50">→ AI 분석</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowPromptHistory(true)} disabled={aiAnalyzeMutation.isPending} className="h-8 text-xs gap-1">
                <BookOpen className="w-3 h-3" />
                프롬프트 예시보기
                {promptHistory.length > 0 && (
                  <span className="ml-0.5 text-[10px] bg-primary/10 text-primary rounded-full px-1.5 py-0 font-bold">{promptHistory.length}</span>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={handleSaveCurrentPrompt} disabled={aiAnalyzeMutation.isPending || !prompt.trim()} className="h-8 text-xs gap-1" title="현재 프롬프트를 예시 목록에 저장">
                <Save className="w-3 h-3" />
                프롬프트 저장
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPrompt(DEFAULT_PROMPTS[period])} disabled={aiAnalyzeMutation.isPending} className="h-8 text-xs">
                <RefreshCw className="w-3 h-3 mr-1" />
                기본 프롬프트
              </Button>
              <Button onClick={handleGenerate} disabled={isFetching || isLoading} variant="outline" className="h-8 gap-1.5 px-3 text-xs">
                {isFetching || isLoading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 시장 데이터</>
                ) : (
                  <><BarChart3 className="w-3.5 h-3.5" /> 시장 데이터 보고서</>
                )}
              </Button>
              <Button onClick={() => aiAnalyzeMutation.mutate()} disabled={aiAnalyzeMutation.isPending || !prompt.trim()} className="h-8 gap-1.5 px-4">
                {aiAnalyzeMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> AI 분석 중...</>
                ) : (
                  <><Send className="w-4 h-4" /> AI 분석 실행</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* ===== AI 분석 진행/결과 (Admin 전용) ===== */}
      {isAdmin && aiAnalyzeMutation.isPending && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">AI가 보고서를 분석하고 있습니다...</p>
            <p className="text-xs text-muted-foreground">시장 데이터 + URL + 파일 내용을 종합 분석 중 (30초~2분 소요)</p>
          </CardContent>
        </Card>
      )}

      {isAdmin && aiAnalyzeMutation.isError && !aiAnalyzeMutation.isPending && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">AI 분석 실패</p>
              <p className="text-xs text-muted-foreground">{(aiAnalyzeMutation.error as Error)?.message}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => aiAnalyzeMutation.mutate()} className="h-7 text-xs">
              다시 시도
            </Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && aiAnalysis && !aiAnalyzeMutation.isPending && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-primary" />
                AI 분석 보고서
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {aiAnalysis.analyzedAt}
                </span>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                  navigator.clipboard.writeText(aiAnalysis.analysis).then(() => {
                    toast({ title: "복사 완료", description: "AI 분석 결과가 클립보드에 복사되었습니다." });
                  }).catch(() => {
                    toast({ title: "복사 실패", description: "클립보드 복사에 실패했습니다.", variant: "destructive" });
                  });
                }}>
                  <Copy className="w-3 h-3" /> 복사
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAiAnalysis(null)} className="h-7 text-xs">닫기</Button>
              </div>
            </div>
            {aiAnalysis.dataPoints && (
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                <span>📊 지수 {aiAnalysis.dataPoints.indicesCount}개</span>
                <span>📰 뉴스 {aiAnalysis.dataPoints.newsCount}건</span>
                {(aiAnalysis.dataPoints.urlCount || 0) > 0 && <span>🔗 URL {aiAnalysis.dataPoints.urlCount}개</span>}
                {(aiAnalysis.dataPoints.fileCount || 0) > 0 && <span>📎 파일 {aiAnalysis.dataPoints.fileCount}개</span>}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
              {aiAnalysis.analysis.split("\n").map((line, i) => {
                const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                if (formattedLine.includes("<strong>")) {
                  return <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: formattedLine }} />;
                }
                if (line.trim() === "") return <br key={i} />;
                return <p key={i} className="mb-1">{line}</p>;
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== 최근 보고서 목차 (최대 5개) ===== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" />
            최근 보고서
            <span className="text-xs text-muted-foreground font-normal ml-1">
              (최대 5개 저장)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {savedReports.length === 0 && savedAnalyses.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">저장된 보고서가 없습니다.</p>
              <p className="text-xs mt-1">
                {isAdmin
                  ? '"시장 데이터 보고서" 또는 "AI 분석 실행" 버튼으로 보고서를 생성하세요.'
                  : "관리자가 보고서를 생성하면 여기에 표시됩니다."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {/* 시간순 통합 리스트: AI 분석 + 시장 보고서 */}
              {(() => {
                type MergedItem =
                  | { type: "analysis"; data: typeof savedAnalyses[0] }
                  | { type: "report"; data: typeof savedReports[0] };
                const merged: MergedItem[] = [
                  ...savedAnalyses.map((a) => ({ type: "analysis" as const, data: a })),
                  ...savedReports.map((r) => ({ type: "report" as const, data: r })),
                ];
                // id는 Date.now() 기반이므로 내림차순 정렬 (최신 먼저)
                merged.sort((a, b) => Number(b.data.id) - Number(a.data.id));
                return merged.map((item, idx) => {
                  if (item.type === "analysis") {
                    const saved = item.data;
                    const isEtfSource = (saved as any).source === "etf-realtime";
                    return (
                      <div key={`a-${saved.id}`} className="flex items-center gap-3 py-3 group hover:bg-muted/30 rounded-md px-2 -mx-2 transition-colors">
                        <span className="flex-shrink-0"><BrainCircuit className={`w-4 h-4 ${isEtfSource ? "text-orange-500" : "text-primary"}`} /></span>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setViewingAnalysis(saved); setAnalysisFontSize(DEFAULT_FONT_SIZE); }}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate hover:text-primary transition-colors">
                              {isEtfSource ? "ETF실시간 AI 분석" : "AI 분석 보고서"}
                            </span>
                            {idx === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold flex-shrink-0">최신</span>}
                            {isEtfSource && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 font-medium flex-shrink-0">📈 ETF</span>}
                            {saved.urls.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-medium flex-shrink-0">🔗 URL {saved.urls.length}</span>}
                            {saved.fileNames.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 font-medium flex-shrink-0">📎 파일 {saved.fileNames.length}</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{saved.createdAt}</span>
                            <span className="opacity-40">|</span>
                            <span className="truncate max-w-[300px]">{saved.prompt.substring(0, 50)}...</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="상세 보기" onClick={() => { setViewingAnalysis(saved); setAnalysisFontSize(DEFAULT_FONT_SIZE); }}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="삭제" onClick={() => handleDeleteAnalysis(saved.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  } else {
                    const saved = item.data;
                    return (
                      <div key={`r-${saved.id}`} className="flex items-center gap-3 py-3 group hover:bg-muted/30 rounded-md px-2 -mx-2 transition-colors">
                        <span className="flex-shrink-0"><BarChart3 className="w-4 h-4 text-indigo-500" /></span>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setViewingReport(saved); setReportFontSize(DEFAULT_FONT_SIZE); }}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate hover:text-primary transition-colors">{saved.title}</span>
                            {idx === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 font-bold flex-shrink-0">최신</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{saved.createdAt}</span>
                            <span className="opacity-40">|</span>
                            <span>{saved.report.indices?.length || 0}개 지수</span>
                            <span className="opacity-40">|</span>
                            <span>{saved.report.news?.length || 0}건 뉴스</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="상세 보기" onClick={() => { setViewingReport(saved); setReportFontSize(DEFAULT_FONT_SIZE); }}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="HTML 보고서" onClick={() => openReportHtml(saved.report, saved.periodLabel)}>
                                <FileOutput className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="삭제" onClick={() => handleDelete(saved.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }
                });
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== 보고서 생성 진행 상태 (Admin 전용) ===== */}
      {isAdmin && (isFetching || isLoading) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{periodLabel} 시장 데이터를 수집하고 있습니다...</p>
            <p className="text-xs text-muted-foreground">KIS API, 뉴스 등 여러 소스에서 데이터를 가져옵니다</p>
          </CardContent>
        </Card>
      )}

      {/* ===== 에러 표시 (Admin 전용) ===== */}
      {isAdmin && error && !displayReport && !isFetching && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">보고서 생성 실패</p>
              <p className="text-xs text-muted-foreground">{(error as Error)?.message}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleGenerate} className="h-7 text-xs">
              다시 시도
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ===== 현재 생성된 보고서 표시 (Admin 전용) ===== */}
      {isAdmin && displayReport && !isFetching && (
        <>
      {/* 보고서 헤더 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {periodLabel} 시장 전략 보고서
          </h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {displayReport.periodRange && <span className="font-medium">{displayReport.periodRange}</span>}
            <span>·</span>
            <span>{displayReport.reportTime} 생성</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isFetching} className="gap-2">
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus className="w-4 h-4" />}
            새로 생성
          </Button>
          <Button size="sm" onClick={() => openReportHtml(displayReport, periodLabel)} className="gap-2">
            <FileOutput className="w-4 h-4" />
            보고서 작성
          </Button>
        </div>
      </div>

      {/* 시장 요약 배너 */}
      {displayReport.marketSummary && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-center">{displayReport.marketSummary}</p>
          </CardContent>
        </Card>
      )}

      {/* 주가지수 */}
      {displayReport.indices.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              주요 지수
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {displayReport.indices.map((idx) => (
                <div key={idx.code} className="rounded-lg border p-4 text-center space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{idx.name}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {parseFloat(idx.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className={`flex items-center justify-center gap-1 text-sm font-medium ${changeColor(idx.changeSign)}`}>
                    <ChangeIcon sign={idx.changeSign} />
                    <span>{changePrefix(idx.changeSign)}{Math.abs(parseFloat(idx.change)).toFixed(2)}</span>
                    <span>({changePrefix(idx.changeSign)}{Math.abs(parseFloat(idx.changePercent)).toFixed(2)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 투자자 매매동향 */}
      {displayReport.investorTrends.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              투자자별 매매동향 (코스피)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {displayReport.investorTrends.map((trend) => {
                const net = parseFloat(trend.netAmount);
                const isPositive = net > 0;
                const isNeutral = net === 0;
                return (
                  <div key={trend.name} className="rounded-lg border p-4 text-center space-y-2">
                    <p className="text-sm font-medium">{trend.name}</p>
                    <p className={`text-xl font-bold tabular-nums ${isNeutral ? "text-muted-foreground" : isPositive ? "text-red-500" : "text-blue-500"}`}>
                      {isPositive ? "+" : ""}{net.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isPositive ? "순매수" : isNeutral ? "-" : "순매도"}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 거래량 상위 종목 */}
      {displayReport.volumeRanking.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              거래량 상위 종목 TOP 10
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2 w-8">#</th>
                    <th className="text-left py-2 px-2">종목</th>
                    <th className="text-right py-2 px-2">현재가</th>
                    <th className="text-right py-2 px-2">등락률</th>
                    <th className="text-right py-2 px-2">거래량</th>
                  </tr>
                </thead>
                <tbody>
                  {displayReport.volumeRanking.map((item) => (
                    <tr key={item.stockCode} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-2 text-muted-foreground">{item.rank}</td>
                      <td className="py-2 px-2">
                        <div className="font-medium">{item.stockName}</div>
                        <div className="text-xs text-muted-foreground">{item.stockCode}</div>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-medium">
                        {parseInt(item.price).toLocaleString()}
                      </td>
                      <td className={`py-2 px-2 text-right tabular-nums font-medium ${changeColor(item.changeSign)}`}>
                        {changePrefix(item.changeSign)}{Math.abs(parseFloat(item.changePercent)).toFixed(2)}%
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {parseInt(item.volume).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 추천 ETF */}
      {displayReport.topEtfs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              주요 추천 ETF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {displayReport.topEtfs.map((etf) => (
                <div key={etf.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{etf.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{etf.code}</span>
                      <span>·</span>
                      <span>{etf.mainCategory}</span>
                      {etf.fee && (<><span>·</span><span>수수료 {etf.fee}</span></>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {etf.yield && (
                      <StatusBadge variant="success" className="text-xs whitespace-nowrap">{etf.yield}</StatusBadge>
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">점수 {etf.trendScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 주요 뉴스 */}
      {displayReport.news.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-primary" />
              주요 금융 뉴스
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {displayReport.news.map((item, i) => (
                <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors group">
                  <span className="text-xs text-muted-foreground font-medium mt-0.5 min-w-[20px]">{i + 1}</span>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2">{item.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {item.source && <span>{item.source}</span>}
                      {item.time && <span>{item.time}</span>}
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 면책 조항 */}
      <p className="text-xs text-muted-foreground text-center py-4">
        본 보고서는 참고용이며, 투자 판단의 최종 책임은 투자자 본인에게 있습니다.
        데이터 출처: 한국투자증권 API, 네이버 금융
      </p>
        </>
      )}

      {/* ===== 프롬프트 예시보기 다이얼로그 ===== */}
      <Dialog open={showPromptHistory} onOpenChange={setShowPromptHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <BookOpen className="w-5 h-5 text-primary" />
              프롬프트 예시 목록
              <span className="text-xs text-muted-foreground font-normal ml-1">(최대 {MAX_PROMPT_HISTORY}개 저장)</span>
            </DialogTitle>
          </DialogHeader>

          {promptHistory.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">저장된 프롬프트가 없습니다.</p>
              <p className="text-xs mt-1">AI 분석 실행 시 프롬프트가 자동 저장되거나, "프롬프트 저장" 버튼으로 수동 저장할 수 있습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {promptHistory.map((item, idx) => (
                <div key={item.id} className="group border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleLoadPrompt(item)}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                        <span className="text-sm font-medium truncate hover:text-primary transition-colors">{item.label}</span>
                        {idx === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold flex-shrink-0">최신</span>}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{item.createdAt}</span>
                        {item.urls.length > 0 && (<><span className="opacity-40">|</span><span className="text-blue-500">🔗 URL {item.urls.length}개</span></>)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="이 프롬프트 사용" onClick={() => handleLoadPrompt(item)}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="삭제" onClick={() => handleDeletePromptHistory(item.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground bg-muted/20 rounded px-2.5 py-2 whitespace-pre-wrap line-clamp-3 cursor-pointer hover:line-clamp-none transition-all" onClick={() => handleLoadPrompt(item)}>
                    {item.prompt}
                  </div>
                  {item.urls.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {item.urls.map((url, i) => (
                        <span key={i} className="text-[10px] bg-blue-50 text-blue-600 rounded px-1.5 py-0.5 truncate max-w-[200px]">🔗 {url}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t">
            <Button variant="outline" onClick={() => setShowPromptHistory(false)}>닫기</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== 저장된 AI 분석 상세보기 다이얼로그 (폰트 크기 조절 포함) ===== */}
      <Dialog open={!!viewingAnalysis} onOpenChange={(open) => !open && setViewingAnalysis(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="flex items-center gap-2 text-base">
                <BrainCircuit className="w-5 h-5 text-primary" />
                AI 분석 보고서
              </DialogTitle>
              <FontSizeControl
                fontSize={analysisFontSize}
                onIncrease={() => setAnalysisFontSize((s) => Math.min(s + 1, 24))}
                onDecrease={() => setAnalysisFontSize((s) => Math.max(s - 1, 10))}
                onReset={() => setAnalysisFontSize(DEFAULT_FONT_SIZE)}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Clock className="w-3 h-3" />
              <span>{viewingAnalysis?.createdAt}</span>
              {viewingAnalysis?.urls && viewingAnalysis.urls.length > 0 && (
                <span className="text-blue-500">· 🔗 URL {viewingAnalysis.urls.length}개 참조</span>
              )}
              {viewingAnalysis?.fileNames && viewingAnalysis.fileNames.length > 0 && (
                <span className="text-amber-500">· 📎 파일 {viewingAnalysis.fileNames.length}개 참조</span>
              )}
            </div>
          </DialogHeader>

          {viewingAnalysis && (
            <div className="space-y-4 mt-2" style={{ fontSize: `${analysisFontSize}px` }}>
              {/* 프롬프트 */}
              <div className="bg-muted/30 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-muted-foreground mb-1">사용된 프롬프트</h4>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{viewingAnalysis.prompt}</p>
              </div>

              {/* 참조 URL */}
              {viewingAnalysis.urls.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1">참조 URL</h4>
                  <div className="space-y-1">
                    {viewingAnalysis.urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                        🔗 {url}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* 참조 파일 */}
              {viewingAnalysis.fileNames.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1">참조 파일</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingAnalysis.fileNames.map((name, i) => (
                      <span key={i} className="text-xs bg-amber-50 text-amber-700 rounded px-2 py-0.5">📎 {name}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* 분석 결과 */}
              <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed border-t pt-4" style={{ fontSize: `${analysisFontSize}px` }}>
                {viewingAnalysis.result.analysis.split("\n").map((line, i) => {
                  const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                  if (formattedLine.includes("<strong>")) {
                    return <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: formattedLine }} />;
                  }
                  if (line.trim() === "") return <br key={i} />;
                  return <p key={i} className="mb-1">{line}</p>;
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setViewingAnalysis(null)}>닫기</Button>
            {viewingAnalysis && (
              <>
                <Button variant="outline" className="gap-1.5" onClick={() => {
                  navigator.clipboard.writeText(viewingAnalysis.result.analysis).then(() => {
                    toast({ title: "복사 완료", description: "AI 분석 결과가 클립보드에 복사되었습니다." });
                  }).catch(() => {
                    toast({ title: "복사 실패", description: "클립보드 복사에 실패했습니다.", variant: "destructive" });
                  });
                }}>
                  <Copy className="w-4 h-4" />
                  복사
                </Button>
                <Button onClick={() => {
                  setAiAnalysis(viewingAnalysis.result);
                  setViewingAnalysis(null);
                  toast({ title: "분석 결과 로드", description: "이전 AI 분석 결과가 로드되었습니다." });
                }} className="gap-1.5">
                  <BrainCircuit className="w-4 h-4" />
                  이 분석 결과 사용
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== 저장된 보고서 상세보기 다이얼로그 (폰트 크기 조절 포함) ===== */}
      <Dialog open={!!viewingReport} onOpenChange={(open) => !open && setViewingReport(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileText className="w-5 h-5 text-primary" />
                {viewingReport?.title || "보고서"}
              </DialogTitle>
              <FontSizeControl
                fontSize={reportFontSize}
                onIncrease={() => setReportFontSize((s) => Math.min(s + 1, 24))}
                onDecrease={() => setReportFontSize((s) => Math.max(s - 1, 10))}
                onReset={() => setReportFontSize(DEFAULT_FONT_SIZE)}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Clock className="w-3 h-3" />
              <span>{viewingReport?.createdAt}</span>
            </div>
          </DialogHeader>

          {viewingReport && (
            <div className="space-y-4 mt-2" style={{ fontSize: `${reportFontSize}px` }}>
              {/* 시장 요약 */}
              {viewingReport.report.marketSummary && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 font-medium text-center">
                  📈 {viewingReport.report.marketSummary}
                </div>
              )}

              {/* 주가 지수 */}
              {viewingReport.report.indices.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-primary" /> 주요 지수
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {viewingReport.report.indices.map((idx) => (
                      <div key={idx.code} className="border rounded-lg p-3 text-center">
                        <p className="text-muted-foreground" style={{ fontSize: `${Math.max(reportFontSize - 2, 10)}px` }}>{idx.name}</p>
                        <p className="font-bold tabular-nums" style={{ fontSize: `${reportFontSize + 4}px` }}>
                          {parseFloat(idx.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className={`font-medium ${changeColor(idx.changeSign)}`} style={{ fontSize: `${Math.max(reportFontSize - 2, 10)}px` }}>
                          {changePrefix(idx.changeSign)}{Math.abs(parseFloat(idx.change)).toFixed(2)}
                          ({changePrefix(idx.changeSign)}{Math.abs(parseFloat(idx.changePercent)).toFixed(2)}%)
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 거래량 TOP */}
              {viewingReport.report.volumeRanking.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-primary" /> 거래량 상위 종목
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full" style={{ fontSize: `${Math.max(reportFontSize - 2, 10)}px` }}>
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-1.5 px-2">#</th>
                          <th className="text-left py-1.5 px-2">종목</th>
                          <th className="text-right py-1.5 px-2">현재가</th>
                          <th className="text-right py-1.5 px-2">등락률</th>
                          <th className="text-right py-1.5 px-2">거래량</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingReport.report.volumeRanking.map((item) => (
                          <tr key={item.stockCode} className="border-b last:border-0">
                            <td className="py-1.5 px-2 text-muted-foreground">{item.rank}</td>
                            <td className="py-1.5 px-2 font-medium">{item.stockName}</td>
                            <td className="py-1.5 px-2 text-right tabular-nums">{parseInt(item.price).toLocaleString()}</td>
                            <td className={`py-1.5 px-2 text-right tabular-nums font-medium ${changeColor(item.changeSign)}`}>
                              {changePrefix(item.changeSign)}{Math.abs(parseFloat(item.changePercent)).toFixed(2)}%
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{parseInt(item.volume).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 뉴스 */}
              {viewingReport.report.news.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-1.5">
                    <Newspaper className="w-4 h-4 text-primary" /> 주요 뉴스
                  </h4>
                  <div className="space-y-1.5">
                    {viewingReport.report.news.map((item, i) => (
                      <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-1 hover:text-primary transition-colors" style={{ fontSize: `${Math.max(reportFontSize - 2, 10)}px` }}>
                        <span className="text-muted-foreground w-4 text-right flex-shrink-0">{i + 1}.</span>
                        <span className="truncate">{item.title}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 하단 버튼 */}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setViewingReport(null)}>닫기</Button>
            {viewingReport && (
              <Button onClick={() => openReportHtml(viewingReport.report, viewingReport.periodLabel)} className="gap-1.5">
                <FileOutput className="w-4 h-4" />
                HTML 보고서 열기
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
