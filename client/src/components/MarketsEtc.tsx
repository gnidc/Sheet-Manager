import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Coins,
  Gem,
  Landmark,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
  ComposedChart,
  XAxis,
  Tooltip,
  Customized,
  Line as RLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";

// ===== 타입 정의 =====
interface BondData {
  name: string;
  symbol: string;
  category?: string;
  value: number;
  change: number;
  changeRate: number;
  high: number;
  low: number;
}
interface ForexData {
  name: string;
  value: number;
  change: number;
  changeRate: number;
  ttb?: number;
  tts?: number;
}
interface CryptoData {
  rank: number;
  name: string;
  symbol: string;
  image: string;
  priceUsd: number;
  priceKrw: number;
  change24h: number;
  change7d: number;
  change1h: number;
  marketCapUsd: number;
  volume24hUsd: number;
  high24hUsd: number;
  low24hUsd: number;
  sparkline: number[];
  upbitKrw?: number;
  kimchiPremium?: number;
}
interface CommodityData {
  name: string;
  symbol?: string;
  category?: string;
  value: number;
  change: number;
  changeRate: number;
  high?: number;
  low?: number;
  unit?: string;
}

// ===== 포맷 헬퍼 =====
function fmtNum(n: number, digits = 2): string {
  if (!n && n !== 0) return "-";
  return n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtKrw(n: number): string {
  if (!n) return "-";
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "조";
  if (n >= 1e8) return (n / 1e8).toFixed(1) + "억";
  if (n >= 1e4) return (n / 1e4).toFixed(1) + "만";
  return n.toLocaleString("ko-KR");
}

function ChangeIndicator({ value, rate, className = "" }: { value: number; rate?: number; className?: string }) {
  const isUp = value > 0;
  const isDown = value < 0;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {isUp ? (
        <span className="badge-rise">
          <ArrowUpRight className="w-3 h-3" />
          {rate !== undefined ? `+${Math.abs(rate).toFixed(2)}%` : `+${fmtNum(Math.abs(value))}`}
        </span>
      ) : isDown ? (
        <span className="badge-fall">
          <ArrowDownRight className="w-3 h-3" />
          {rate !== undefined ? `${rate.toFixed(2)}%` : `${fmtNum(value)}`}
        </span>
      ) : (
        <span className="badge-steady">
          <Minus className="w-3 h-3" /> 0.00%
        </span>
      )}
    </span>
  );
}

// ===== 미니 스파크라인 차트 =====
function SparklineChart({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={1.5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ===== 캔들차트 다이얼로그 =====
interface ChartTarget {
  name: string;
  symbol: string;
  type: string; // bond, forex, crypto, commodity
}

function AssetChartDialog({ open, onClose, target }: { open: boolean; onClose: () => void; target: ChartTarget | null }) {
  const [chartPeriod, setChartPeriod] = useState<"day" | "week" | "month">("day");

  const { data: chartData, isLoading } = useQuery<{ chartData: any[]; meta?: any; message?: string }>({
    queryKey: ["etc-chart", target?.symbol, target?.type, chartPeriod],
    queryFn: async () => {
      const res = await fetch(
        `/api/markets/etc/chart?symbol=${encodeURIComponent(target!.symbol)}&type=${target!.type}&period=${chartPeriod}`
      );
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: open && !!target?.symbol,
    staleTime: 60_000,
  });

  const displayData = useMemo(() => {
    if (!chartData?.chartData) return [];
    const count = chartPeriod === "day" ? 90 : chartPeriod === "week" ? 104 : 60;
    return chartData.chartData.slice(-count);
  }, [chartData, chartPeriod]);

  if (!target) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              {target.name}
            </span>
            {/* 일봉/주봉/월봉 전환 */}
            <div className="inline-flex rounded-md border bg-muted/40 p-0.5 gap-0.5">
              {([
                { key: "day" as const, label: "일봉" },
                { key: "week" as const, label: "주봉" },
                { key: "month" as const, label: "월봉" },
              ]).map((p) => (
                <button
                  key={p.key}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    chartPeriod === p.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setChartPeriod(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {chartPeriod === "day" ? "(최근 6개월)" : chartPeriod === "week" ? "(최근 2년)" : "(최근 5년)"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">차트 데이터 로딩 중...</span>
            </div>
          ) : displayData.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">차트 데이터가 없습니다</p>
              {chartData?.message && <p className="text-xs mt-1">{chartData.message}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {/* 현재가 정보 */}
              {chartData?.meta?.regularMarketPrice && (
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl font-bold num">
                    {chartData.meta.regularMarketPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </span>
                  {chartData.meta.currency && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{chartData.meta.currency}</span>
                  )}
                  {displayData.length >= 2 && (() => {
                    const last = displayData[displayData.length - 1];
                    const prev = displayData[displayData.length - 2];
                    const change = last.close - prev.close;
                    const changeRate = prev.close ? (change / prev.close) * 100 : 0;
                    return (
                      <span className={`text-sm font-semibold ${change > 0 ? "num-rise" : change < 0 ? "num-fall" : ""}`}>
                        {change > 0 ? "+" : ""}{change.toFixed(4)} ({change > 0 ? "+" : ""}{changeRate.toFixed(2)}%)
                      </span>
                    );
                  })()}
                </div>
              )}

              {/* 캔들스틱 차트 */}
              <div style={{ userSelect: "none" }}>
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart data={displayData} margin={{ top: 10, right: 10, left: 5, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9 }}
                      interval="preserveStartEnd"
                      tickFormatter={(v: string) => v.slice(5)} // MM-DD
                    />
                    <YAxis
                      yAxisId="price"
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 10 }}
                      width={70}
                      tickFormatter={(v: number) =>
                        v >= 1e6 ? `${(v / 1e6).toFixed(1)}M`
                          : v >= 1e4 ? `${(v / 1e4).toFixed(1)}만`
                          : v >= 100 ? v.toLocaleString()
                          : v.toFixed(2)
                      }
                    />
                    <Tooltip
                      contentStyle={{ fontSize: "11px", borderRadius: "8px" }}
                      formatter={(v: any, name: string) => {
                        const n = Number(v);
                        const label: Record<string, string> = { open: "시가", high: "고가", low: "저가", close: "종가", ma5: "MA5", ma20: "MA20", ma60: "MA60" };
                        return [n >= 100 ? n.toLocaleString() : n.toFixed(4), label[name] || name];
                      }}
                      labelFormatter={(l) => `📅 ${l}`}
                    />
                    {/* 캔들스틱 커스텀 렌더링 */}
                    <Customized component={(props: any) => {
                      const { xAxisMap, yAxisMap } = props;
                      if (!xAxisMap || !yAxisMap) return null;
                      const xAxis = Object.values(xAxisMap)[0] as any;
                      const yAxis = Object.values(yAxisMap)[0] as any;
                      if (!xAxis || !yAxis) return null;

                      const xScale = xAxis.scale;
                      const yScale = yAxis.scale;
                      if (!xScale || !yScale) return null;

                      const bandwidth = typeof xScale.bandwidth === "function" ? xScale.bandwidth() : 8;
                      const barW = Math.max(Math.min(bandwidth * 0.7, 12), 2);

                      return (
                        <g>
                          {displayData.map((d, i) => {
                            const xVal = xScale(d.date);
                            if (xVal === undefined || xVal === null) return null;
                            const cx = xVal + bandwidth / 2;
                            const yO = yScale(d.open);
                            const yC = yScale(d.close);
                            const yH = yScale(d.high);
                            const yL = yScale(d.low);
                            if ([yO, yC, yH, yL].some((v: number) => v === undefined || isNaN(v))) return null;
                            const rising = d.close >= d.open;
                            const color = rising ? "#ef4444" : "#3b82f6";
                            const bodyTop = Math.min(yO, yC);
                            const bodyH = Math.max(Math.abs(yO - yC), 1);
                            return (
                              <g key={`candle-${i}`}>
                                <line x1={cx} y1={yH} x2={cx} y2={bodyTop} stroke={color} strokeWidth={1} />
                                <line x1={cx} y1={bodyTop + bodyH} x2={cx} y2={yL} stroke={color} strokeWidth={1} />
                                <rect
                                  x={cx - barW / 2}
                                  y={bodyTop}
                                  width={barW}
                                  height={bodyH}
                                  fill={rising ? "transparent" : color}
                                  stroke={color}
                                  strokeWidth={1}
                                />
                              </g>
                            );
                          })}
                        </g>
                      );
                    }} />
                    {/* 이동평균선 */}
                    <Line yAxisId="price" type="monotone" dataKey="ma5" stroke="#eab308" strokeWidth={1.5} dot={false} connectNulls name="ma5" />
                    <Line yAxisId="price" type="monotone" dataKey="ma20" stroke="#22c55e" strokeWidth={1.5} dot={false} connectNulls name="ma20" />
                    <Line yAxisId="price" type="monotone" dataKey="ma60" stroke="#a855f7" strokeWidth={1.5} dot={false} connectNulls name="ma60" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* 거래량 차트 */}
              {displayData.some(d => d.volume > 0) && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1 font-medium">거래량</div>
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={displayData} margin={{ top: 0, right: 10, left: 5, bottom: 0 }}>
                      <XAxis dataKey="date" tick={false} />
                      <YAxis
                        tick={{ fontSize: 9 }}
                        width={70}
                        tickFormatter={(v: number) =>
                          v >= 1e9 ? `${(v / 1e9).toFixed(1)}B`
                            : v >= 1e6 ? `${(v / 1e6).toFixed(0)}M`
                            : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K`
                            : String(v)
                        }
                      />
                      <Tooltip
                        contentStyle={{ fontSize: "11px" }}
                        formatter={(v: any) => [Number(v).toLocaleString(), "거래량"]}
                        labelFormatter={(l) => `📅 ${l}`}
                      />
                      <Bar dataKey="volume" barSize={3}>
                        {displayData.map((entry, index) => (
                          <Cell key={index} fill={entry.close >= entry.open ? "#ef444490" : "#3b82f690"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* 범례 */}
              <div className="flex items-center gap-4 text-xs justify-center pt-1 border-t">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-500 inline-block" />MA5</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block" />MA20</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 inline-block" />MA60</span>
                <span className="text-muted-foreground/60 ml-2">| 상승: <span className="text-red-500">빨간</span> · 하락: <span className="text-blue-500">파란</span></span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== 메인 컴포넌트 =====
export default function MarketsEtc() {
  const [activeSection, setActiveSection] = useState<"bonds" | "forex" | "crypto" | "commodities">("bonds");
  const [chartTarget, setChartTarget] = useState<ChartTarget | null>(null);
  const [chartOpen, setChartOpen] = useState(false);

  const openChart = (name: string, symbol: string, type: string) => {
    setChartTarget({ name, symbol, type });
    setChartOpen(true);
  };

  const sections = [
    { key: "bonds" as const, label: "채권/금리", icon: <Landmark className="w-4 h-4" />, emoji: "🏛️" },
    { key: "forex" as const, label: "환율", icon: <DollarSign className="w-4 h-4" />, emoji: "💱" },
    { key: "crypto" as const, label: "크립토", icon: <Coins className="w-4 h-4" />, emoji: "₿" },
    { key: "commodities" as const, label: "실물자산", icon: <Gem className="w-4 h-4" />, emoji: "🪙" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          💹 ETC Markets
          <span className="text-sm font-normal text-muted-foreground">채권 · 환율 · 크립토 · 실물자산</span>
        </h2>
      </div>

      {/* 섹션 탭 */}
      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <Button
            key={s.key}
            variant={activeSection === s.key ? "default" : "outline"}
            size="sm"
            className={`gap-2 btn-hover-lift ${activeSection === s.key ? "" : "hover:border-primary/30"}`}
            onClick={() => setActiveSection(s.key)}
          >
            {s.emoji} {s.label}
          </Button>
        ))}
      </div>

      {/* 콘텐츠 */}
      {activeSection === "bonds" && <BondsSection onChartOpen={openChart} />}
      {activeSection === "forex" && <ForexSection onChartOpen={openChart} />}
      {activeSection === "crypto" && <CryptoSection onChartOpen={openChart} />}
      {activeSection === "commodities" && <CommoditiesSection onChartOpen={openChart} />}

      {/* 캔들차트 다이얼로그 */}
      <AssetChartDialog open={chartOpen} onClose={() => setChartOpen(false)} target={chartTarget} />
    </div>
  );
}

// ===== 채권/금리 섹션 =====
function BondsSection({ onChartOpen }: { onChartOpen: (name: string, symbol: string, type: string) => void }) {
  const { data, isLoading, refetch, isFetching } = useQuery<{ bonds: BondData[]; updatedAt: string }>({
    queryKey: ["/api/markets/etc/bonds"],
    staleTime: 60_000,
  });

  if (isLoading) return <SectionSkeleton />;

  const bonds = data?.bonds || [];
  const globalBonds = bonds.filter(b => b.category !== "kr");
  const krBonds = bonds.filter(b => b.category === "kr");
  const usBonds = bonds.filter(b => b.category === "us");

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {bonds.slice(0, 4).map((bond) => (
          <Card key={bond.symbol} className="card-premium cursor-pointer hover:shadow-md transition-shadow" onClick={() => onChartOpen(bond.name, bond.symbol, "bond")}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 truncate">{bond.name}</p>
              <p className="text-lg font-bold num">{fmtNum(bond.value, 3)}%</p>
              <ChangeIndicator value={bond.change} rate={bond.changeRate} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 해외 금리 테이블 */}
      {globalBonds.length > 0 && (
      <Card className="card-premium">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            🇺🇸 해외 국채 금리
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{data?.updatedAt}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="table-finance">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">채권</TableHead>
                <TableHead className="text-right">금리(%)</TableHead>
                <TableHead className="text-right">변동</TableHead>
                <TableHead className="text-right">등락률</TableHead>
                <TableHead className="text-right">고가</TableHead>
                <TableHead className="text-right">저가</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {globalBonds.map((bond) => (
                <TableRow key={bond.symbol} className="cursor-pointer hover:bg-muted/50" onClick={() => onChartOpen(bond.name, bond.symbol, "bond")}>
                  <TableCell className="font-medium text-sm text-primary hover:underline">{bond.name}</TableCell>
                  <TableCell className="text-right num font-semibold">{fmtNum(bond.value, 3)}</TableCell>
                  <TableCell className="text-right">
                    <span className={`num ${bond.change > 0 ? "num-rise" : bond.change < 0 ? "num-fall" : "num-steady"}`}>
                      {bond.change > 0 ? "+" : ""}{fmtNum(bond.change, 3)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <ChangeIndicator value={bond.change} rate={bond.changeRate} />
                  </TableCell>
                  <TableCell className="text-right num text-xs text-muted-foreground">{bond.high ? fmtNum(bond.high, 3) : "-"}</TableCell>
                  <TableCell className="text-right num text-xs text-muted-foreground">{bond.low ? fmtNum(bond.low, 3) : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      {/* 국내 금리 테이블 */}
      {krBonds.length > 0 && (
      <Card className="card-premium">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            🇰🇷 국내 시장 금리
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="table-finance">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">구분</TableHead>
                <TableHead className="text-right">금리(%)</TableHead>
                <TableHead className="text-right">변동(%p)</TableHead>
                <TableHead className="text-right">등락률</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {krBonds.map((bond) => (
                <TableRow key={bond.symbol} className="cursor-pointer hover:bg-muted/50" onClick={() => onChartOpen(bond.name, bond.symbol, "bond")}>
                  <TableCell className="font-medium text-sm text-primary hover:underline">{bond.name}</TableCell>
                  <TableCell className="text-right num font-semibold">{fmtNum(bond.value, 2)}</TableCell>
                  <TableCell className="text-right">
                    <span className={`num ${bond.change > 0 ? "num-rise" : bond.change < 0 ? "num-fall" : "num-steady"}`}>
                      {bond.change > 0 ? "+" : ""}{fmtNum(bond.change, 2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <ChangeIndicator value={bond.change} rate={bond.changeRate} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      {bonds.length === 0 && (
        <Card className="card-premium">
          <CardContent className="py-8 text-center text-muted-foreground">데이터를 불러올 수 없습니다</CardContent>
        </Card>
      )}

      {/* 금리 동향 안내 */}
      <Card className="card-premium bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/30">
        <CardContent className="p-4">
          <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">📊 금리 동향 읽는 법</h4>
          <ul className="text-xs text-blue-600/80 dark:text-blue-300/70 space-y-1">
            <li>• <b>10년물-2년물 스프레드</b>가 역전(마이너스)되면 경기침체 신호</li>
            <li>• 금리 상승 → 채권 가격 하락, 주식시장 부담 증가</li>
            <li>• 미국 10년물은 글로벌 자산가격의 기준금리 역할</li>
            <li>• 한국 국채와 미국 국채 금리 차이는 원/달러 환율에 영향</li>
          </ul>
          {usBonds.length >= 2 && (
            <div className="mt-3 p-2 bg-white/60 dark:bg-slate-900/40 rounded-lg">
              <span className="text-xs font-medium">
                🔑 미국 10Y-2Y 스프레드: {" "}
                <span className={`num font-bold ${
                  (usBonds.find(b => b.name.includes("10년"))?.value || 0) - (usBonds.find(b => b.name.includes("2년"))?.value || 0) < 0
                    ? "num-fall" : "num-rise"
                }`}>
                  {fmtNum((usBonds.find(b => b.name.includes("10년"))?.value || 0) - (usBonds.find(b => b.name.includes("2년"))?.value || 0), 3)}%p
                </span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===== 환율 섹션 =====
// 환율 이름 → Yahoo Finance 심볼 매핑
const FOREX_SYMBOL_MAP: Record<string, string> = {
  "미국 USD": "FX_USDKRW",
  "유럽연합 EUR": "FX_EURKRW",
  "일본 JPY(100엔)": "FX_JPYKRW",
  "일본 JPY": "FX_JPYKRW",
  "중국 CNY": "FX_CNYKRW",
  "영국 GBP": "FX_GBPKRW",
  "EUR/USD": "FX_EURUSD",
  "USD/JPY": "FX_USDJPY",
  "GBP/USD": "FX_GBPUSD",
  "USD/KRW (달러)": "FX_USDKRW",
  "EUR/KRW (유로)": "FX_EURKRW",
  "JPY/KRW (엔화, 100엔)": "FX_JPYKRW",
  "CNY/KRW (위안)": "FX_CNYKRW",
  "GBP/KRW (파운드)": "FX_GBPKRW",
};

function getForexSymbol(name: string): string {
  if (FOREX_SYMBOL_MAP[name]) return FOREX_SYMBOL_MAP[name];
  // 부분 매칭
  for (const [key, val] of Object.entries(FOREX_SYMBOL_MAP)) {
    if (name.includes(key) || key.includes(name)) return val;
  }
  return name;
}

function ForexSection({ onChartOpen }: { onChartOpen: (name: string, symbol: string, type: string) => void }) {
  const { data, isLoading, refetch, isFetching } = useQuery<{ rates: ForexData[]; updatedAt: string }>({
    queryKey: ["/api/markets/etc/forex"],
    staleTime: 60_000,
  });

  if (isLoading) return <SectionSkeleton />;

  const rates = data?.rates || [];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 주요 환율 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {rates.slice(0, 4).map((rate, i) => (
          <Card key={i} className="card-premium cursor-pointer hover:shadow-md transition-shadow" onClick={() => onChartOpen(rate.name, getForexSymbol(rate.name), "forex")}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 truncate">{rate.name}</p>
              <p className="text-lg font-bold num">{fmtNum(rate.value)}</p>
              <ChangeIndicator value={rate.change} rate={rate.changeRate} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 환율 테이블 */}
      <Card className="card-premium">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            💱 주요 환율
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{data?.updatedAt}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="table-finance">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">통화</TableHead>
                <TableHead className="text-right">현재가</TableHead>
                <TableHead className="text-right">변동</TableHead>
                <TableHead className="text-right">등락률</TableHead>
                {rates.some(r => r.ttb) && <TableHead className="text-right">살 때 (TTB)</TableHead>}
                {rates.some(r => r.tts) && <TableHead className="text-right">팔 때 (TTS)</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate, i) => (
                <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => onChartOpen(rate.name, getForexSymbol(rate.name), "forex")}>
                  <TableCell className="font-medium text-sm text-primary hover:underline">{rate.name}</TableCell>
                  <TableCell className="text-right num font-semibold">{fmtNum(rate.value)}</TableCell>
                  <TableCell className="text-right">
                    <span className={`num ${rate.change > 0 ? "num-rise" : rate.change < 0 ? "num-fall" : "num-steady"}`}>
                      {rate.change > 0 ? "▲" : rate.change < 0 ? "▼" : ""} {fmtNum(Math.abs(rate.change))}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <ChangeIndicator value={rate.change} rate={rate.changeRate} />
                  </TableCell>
                  {rates.some(r => r.ttb) && <TableCell className="text-right num text-xs">{rate.ttb ? fmtNum(rate.ttb) : "-"}</TableCell>}
                  {rates.some(r => r.tts) && <TableCell className="text-right num text-xs">{rate.tts ? fmtNum(rate.tts) : "-"}</TableCell>}
                </TableRow>
              ))}
              {rates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">데이터를 불러올 수 없습니다</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== 크립토 섹션 =====
function fmtUsd(n: number): string {
  if (!n && n !== 0) return "-";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function CryptoSection({ onChartOpen }: { onChartOpen: (name: string, symbol: string, type: string) => void }) {
  const { data, isLoading, refetch, isFetching } = useQuery<{ cryptos: CryptoData[]; usdKrw: number; kimchiPremiums?: Record<string, { upbitKrw: number; premium: number }>; updatedAt: string }>({
    queryKey: ["/api/markets/etc/crypto"],
    staleTime: 30_000,
  });

  if (isLoading) return <SectionSkeleton />;

  const cryptos = data?.cryptos || [];
  const usdKrw = data?.usdKrw || 1440;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 주요 크립토 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cryptos.slice(0, 4).map((coin) => (
          <Card key={coin.symbol} className="card-premium cursor-pointer hover:shadow-md transition-shadow" onClick={() => onChartOpen(`${coin.name} (${coin.symbol})`, coin.symbol, "crypto")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {coin.image && <img src={coin.image} alt={coin.symbol} className="w-6 h-6 rounded-full" />}
                <div>
                  <p className="text-xs font-medium">{coin.symbol}</p>
                  <p className="text-[10px] text-muted-foreground">{coin.name}</p>
                </div>
              </div>
              <p className="text-lg font-bold num">
                {coin.priceUsd >= 1 ? `$${fmtNum(coin.priceUsd)}` : `$${coin.priceUsd.toFixed(4)}`}
              </p>
              <p className="text-xs text-muted-foreground num">
                ₩{coin.priceKrw >= 1000 ? Math.round(coin.priceKrw).toLocaleString("ko-KR") : fmtNum(coin.priceKrw)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <ChangeIndicator value={coin.change24h} rate={coin.change24h} />
                {coin.kimchiPremium !== undefined && (
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    coin.kimchiPremium > 0
                      ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
                      : coin.kimchiPremium < 0
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}>
                    🥬 {coin.kimchiPremium > 0 ? "+" : ""}{coin.kimchiPremium.toFixed(2)}%
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 김치프리미엄 요약 카드 */}
      {Object.keys(data?.kimchiPremiums || {}).length > 0 && (
        <Card className="card-premium bg-orange-50/50 dark:bg-orange-950/20 border-orange-200/50 dark:border-orange-800/30">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-1.5">
              🥬 김치프리미엄 (Upbit vs 글로벌)
            </h4>
            <div className="flex flex-wrap gap-4">
              {Object.entries(data?.kimchiPremiums || {}).map(([sym, info]) => (
                <div key={sym} className="flex items-center gap-2">
                  <span className="text-sm font-bold">{sym}</span>
                  <span className="text-xs text-muted-foreground">
                    업비트 ₩{Math.round(info.upbitKrw).toLocaleString("ko-KR")}
                  </span>
                  <span className={`text-sm font-bold ${
                    info.premium > 0 ? "text-orange-600 dark:text-orange-400"
                      : info.premium < 0 ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500"
                  }`}>
                    {info.premium > 0 ? "+" : ""}{info.premium.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-orange-600/60 dark:text-orange-400/50 mt-2">
              * 김치프리미엄 = (업비트 KRW가격 - 글로벌USD가격×환율) / (글로벌USD가격×환율) × 100
            </p>
          </CardContent>
        </Card>
      )}

      {/* 환율 정보 배지 */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="bg-muted/50 px-2 py-1 rounded-md">💱 적용 환율: $1 = ₩{usdKrw.toLocaleString("ko-KR")}</span>
      </div>

      {/* 크립토 테이블 */}
      <Card className="card-premium">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            ₿ 암호화폐 시세 TOP 20
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{data?.updatedAt}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="table-finance">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead className="w-[140px]">코인</TableHead>
                <TableHead className="text-right">USD</TableHead>
                <TableHead className="text-right">KRW</TableHead>
                <TableHead className="text-right">1시간</TableHead>
                <TableHead className="text-right">24시간</TableHead>
                <TableHead className="text-right">7일</TableHead>
                <TableHead className="text-center">🥬김프</TableHead>
                <TableHead className="text-right">시가총액(USD)</TableHead>
                <TableHead className="text-right">24h 거래량</TableHead>
                <TableHead className="text-center w-28">7일 추이</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cryptos.map((coin) => {
                const sparkColor = coin.change7d >= 0 ? "#ef4444" : "#3b82f6";
                return (
                  <TableRow key={coin.symbol} className="cursor-pointer hover:bg-muted/50" onClick={() => onChartOpen(`${coin.name} (${coin.symbol})`, coin.symbol, "crypto")}>
                    <TableCell className="text-center text-xs text-muted-foreground">{coin.rank}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {coin.image && <img src={coin.image} alt={coin.symbol} className="w-5 h-5 rounded-full" />}
                        <div>
                          <span className="font-medium text-sm text-primary hover:underline">{coin.symbol}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">{coin.name}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right num font-semibold text-sm">
                      {coin.priceUsd >= 1
                        ? `$${coin.priceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : `$${coin.priceUsd.toFixed(4)}`}
                    </TableCell>
                    <TableCell className="text-right num text-xs text-muted-foreground">
                      ₩{coin.priceKrw >= 1000
                        ? Math.round(coin.priceKrw).toLocaleString("ko-KR")
                        : coin.priceKrw < 1 ? coin.priceKrw.toFixed(2) : fmtNum(coin.priceKrw)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`num text-xs ${coin.change1h > 0 ? "num-rise" : coin.change1h < 0 ? "num-fall" : "num-steady"}`}>
                        {coin.change1h > 0 ? "+" : ""}{coin.change1h.toFixed(2)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <ChangeIndicator value={coin.change24h} rate={coin.change24h} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`num text-xs ${coin.change7d > 0 ? "num-rise" : coin.change7d < 0 ? "num-fall" : "num-steady"}`}>
                        {coin.change7d > 0 ? "+" : ""}{coin.change7d.toFixed(2)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {coin.kimchiPremium !== undefined ? (
                        <span className={`inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                          coin.kimchiPremium > 0
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
                            : coin.kimchiPremium < 0
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}>
                          {coin.kimchiPremium > 0 ? "+" : ""}{coin.kimchiPremium.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right num text-xs">{fmtUsd(coin.marketCapUsd)}</TableCell>
                    <TableCell className="text-right num text-xs">{fmtUsd(coin.volume24hUsd)}</TableCell>
                    <TableCell className="text-center">
                      <SparklineChart data={coin.sparkline} color={sparkColor} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {cryptos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">데이터를 불러올 수 없습니다</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== 원자재/실물자산 섹션 =====
function CommoditiesSection({ onChartOpen }: { onChartOpen: (name: string, symbol: string, type: string) => void }) {
  const { data, isLoading, refetch, isFetching } = useQuery<{ commodities: CommodityData[]; updatedAt: string }>({
    queryKey: ["/api/markets/etc/commodities"],
    staleTime: 60_000,
  });

  if (isLoading) return <SectionSkeleton />;

  const commodities = data?.commodities || [];

  // 카테고리 분류 (서버에서 category 필드 사용)
  const energy = commodities.filter(c => c.category === "energy");
  const metals = commodities.filter(c => c.category === "metals");
  const agriculture = commodities.filter(c => c.category === "agriculture");
  const others = commodities.filter(c => !["energy", "metals", "agriculture"].includes(c.category || ""));

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 주요 원자재 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {commodities.slice(0, 4).map((c, i) => (
          <Card key={i} className={`card-premium ${c.symbol ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`} onClick={() => c.symbol && onChartOpen(c.name, c.symbol, "commodity")}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 truncate">{c.name}</p>
              <p className="text-lg font-bold num">{fmtNum(c.value)}{c.unit ? ` ${c.unit}` : ""}</p>
              <ChangeIndicator value={c.change} rate={c.changeRate} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 카테고리별 테이블 */}
      {[
        { title: "⛽ 에너지", items: energy },
        { title: "🥇 귀금속", items: metals },
        { title: "🌾 농산물", items: agriculture },
        { title: "📦 기타", items: others },
      ].filter(g => g.items.length > 0).map(group => (
        <Card key={group.title} className="card-premium">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">{group.title}</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{data?.updatedAt}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="table-finance">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">품목</TableHead>
                  <TableHead className="text-right">현재가</TableHead>
                  <TableHead className="text-right">변동</TableHead>
                  <TableHead className="text-right">등락률</TableHead>
                  {group.items.some(c => c.high) && <TableHead className="text-right">고가</TableHead>}
                  {group.items.some(c => c.low) && <TableHead className="text-right">저가</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map((c, i) => (
                  <TableRow key={i} className={c.symbol ? "cursor-pointer hover:bg-muted/50" : ""} onClick={() => c.symbol && onChartOpen(c.name, c.symbol, "commodity")}>
                    <TableCell className={`font-medium text-sm ${c.symbol ? "text-primary hover:underline" : ""}`}>{c.name}</TableCell>
                    <TableCell className="text-right num font-semibold">{fmtNum(c.value)}{c.unit ? ` ${c.unit}` : ""}</TableCell>
                    <TableCell className="text-right">
                      <span className={`num ${c.change > 0 ? "num-rise" : c.change < 0 ? "num-fall" : "num-steady"}`}>
                        {c.change > 0 ? "▲" : c.change < 0 ? "▼" : ""} {fmtNum(Math.abs(c.change))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <ChangeIndicator value={c.change} rate={c.changeRate} />
                    </TableCell>
                    {group.items.some(x => x.high) && <TableCell className="text-right num text-xs text-muted-foreground">{c.high ? fmtNum(c.high) : "-"}</TableCell>}
                    {group.items.some(x => x.low) && <TableCell className="text-right num text-xs text-muted-foreground">{c.low ? fmtNum(c.low) : "-"}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {commodities.length === 0 && (
        <Card className="card-premium">
          <CardContent className="py-8 text-center text-muted-foreground">
            데이터를 불러올 수 없습니다
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===== 스켈레톤 =====
function SectionSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-card h-24" />
        ))}
      </div>
      <div className="skeleton-card h-64" />
    </div>
  );
}

