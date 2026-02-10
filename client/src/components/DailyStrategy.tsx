import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
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

type ReportPeriod = "daily" | "weekly" | "monthly" | "yearly";

interface DailyStrategyProps {
  period?: ReportPeriod;
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

export default function DailyStrategy({ period = "daily" }: DailyStrategyProps) {
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
        if (res.status === 401) {
          throw new Error("관리자 로그인이 필요합니다");
        }
        throw new Error(err.message || "보고서 생성 실패");
      }
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const periodLabel = PERIOD_LABELS[period];

  if (isLoading && !report) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground">{periodLabel} 시장 데이터를 수집하고 있습니다...</p>
        <p className="text-xs text-muted-foreground">KIS API, 뉴스 등 여러 소스에서 데이터를 가져옵니다</p>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">
          {error?.message || "보고서 데이터를 불러올 수 없습니다."}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          재시도
        </Button>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="text-center space-y-2">
          <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <h3 className="text-lg font-semibold">{periodLabel} 시장 전략 보고서</h3>
          <p className="text-sm text-muted-foreground">{PERIOD_DESCRIPTIONS[period]}</p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} className="gap-2">
          {isFetching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          보고서 생성하기
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 보고서 헤더 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {periodLabel} 시장 전략 보고서
          </h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {report.periodRange && <span className="font-medium">{report.periodRange}</span>}
            <span>·</span>
            <span>{report.reportTime} 생성</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            {isFetching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FilePlus className="w-4 h-4" />
            )}
            새로 생성
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (!report) return;
              const html = generateReportHTML(report, periodLabel);
              const blob = new Blob([html], { type: "text/html;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              window.open(url, "_blank");
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            }}
            className="gap-2"
          >
            <FileOutput className="w-4 h-4" />
            보고서 작성
          </Button>
        </div>
      </div>

      {/* 시장 요약 배너 */}
      {report.marketSummary && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-center">{report.marketSummary}</p>
          </CardContent>
        </Card>
      )}

      {/* 주가지수 */}
      {report.indices.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              주요 지수
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {report.indices.map((idx) => (
                <div
                  key={idx.code}
                  className="rounded-lg border p-4 text-center space-y-1"
                >
                  <p className="text-sm font-medium text-muted-foreground">{idx.name}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {parseFloat(idx.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className={`flex items-center justify-center gap-1 text-sm font-medium ${changeColor(idx.changeSign)}`}>
                    <ChangeIcon sign={idx.changeSign} />
                    <span>
                      {changePrefix(idx.changeSign)}{Math.abs(parseFloat(idx.change)).toFixed(2)}
                    </span>
                    <span>({changePrefix(idx.changeSign)}{Math.abs(parseFloat(idx.changePercent)).toFixed(2)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 투자자 매매동향 */}
      {report.investorTrends.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              투자자별 매매동향 (코스피)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {report.investorTrends.map((trend) => {
                const net = parseFloat(trend.netAmount);
                const isPositive = net > 0;
                const isNeutral = net === 0;
                return (
                  <div key={trend.name} className="rounded-lg border p-4 text-center space-y-2">
                    <p className="text-sm font-medium">{trend.name}</p>
                    <p
                      className={`text-xl font-bold tabular-nums ${
                        isNeutral ? "text-muted-foreground" : isPositive ? "text-red-500" : "text-blue-500"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {net.toLocaleString()}
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
      {report.volumeRanking.length > 0 && (
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
                  {report.volumeRanking.map((item) => (
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
      {report.topEtfs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              주요 추천 ETF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {report.topEtfs.map((etf) => (
                <div
                  key={etf.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{etf.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{etf.code}</span>
                      <span>·</span>
                      <span>{etf.mainCategory}</span>
                      {etf.fee && (
                        <>
                          <span>·</span>
                          <span>수수료 {etf.fee}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {etf.yield && (
                      <StatusBadge variant="success" className="text-xs whitespace-nowrap">
                        {etf.yield}
                      </StatusBadge>
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      점수 {etf.trendScore}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 주요 뉴스 */}
      {report.news.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-primary" />
              주요 금융 뉴스
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.news.map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors group"
                >
                  <span className="text-xs text-muted-foreground font-medium mt-0.5 min-w-[20px]">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2">
                      {item.title}
                    </p>
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
    </div>
  );
}

