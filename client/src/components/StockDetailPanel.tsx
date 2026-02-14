import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
// Card imports removed - now rendered inside Dialog
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, TrendingUp, TrendingDown, Minus, BarChart3,
  FileText, Building2, MessageCircle, Send, Trash2, ExternalLink, Info,
  Sparkles, Copy, ZoomIn, ZoomOut, Newspaper,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, BarChart,
} from "recharts";

interface StockDetailPanelProps {
  stockCode: string;
  stockName: string;
  market: "domestic" | "overseas";
  exchange?: string | null;
  onClose: () => void;
}

// 차트 데이터 항목 타입
interface ChartDataItem {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma5?: number | null;
  ma20?: number | null;
  ma60?: number | null;
}

export default function StockDetailPanel({
  stockCode,
  stockName,
  market,
  exchange,
}: StockDetailPanelProps) {
  const { isLoggedIn, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("basic");
  const [commentText, setCommentText] = useState("");
  const [memoText, setMemoText] = useState("");
  const [memoSaved, setMemoSaved] = useState(true);
  // SEC 공시 AI 분석 관련 상태
  const [checkedDisclosures, setCheckedDisclosures] = useState<Set<number>>(new Set());
  const [disclosureAiLoading, setDisclosureAiLoading] = useState(false);
  const [disclosureAiResult, setDisclosureAiResult] = useState<string | null>(null);
  const [disclosureAiFontSize, setDisclosureAiFontSize] = useState(14);
  // 종합 AI 분석 관련 상태
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any | null>(null);
  const [aiAnalysisFontSize, setAiAnalysisFontSize] = useState(14);
  const [showAnalysisList, setShowAnalysisList] = useState(false);

  const isOverseas = market === "overseas";
  const detailUrl = isOverseas
    ? `/api/stock/detail/overseas/${stockCode}?exchange=${exchange || "NASDAQ"}`
    : `/api/stock/detail/${stockCode}`;
  const chartUrl = isOverseas
    ? `/api/stock/chart/overseas/${stockCode}?exchange=${exchange || "NASDAQ"}`
    : `/api/stock/chart/${stockCode}`;
  const financialsUrl = isOverseas
    ? `/api/stock/financials/overseas/${stockCode}?exchange=${exchange || "NASDAQ"}`
    : `/api/stock/financials/${stockCode}`;
  const disclosuresUrl = isOverseas
    ? `/api/stock/disclosures/overseas/${stockCode}`
    : `/api/stock/disclosures/${stockCode}`;
  const researchUrl = isOverseas
    ? `/api/stock/research-reports/overseas/${stockCode}?exchange=${exchange || "NASDAQ"}`
    : `/api/stock/research-reports/${stockCode}`;
  const newsUrl = isOverseas
    ? `/api/stock/news/overseas/${stockCode}?exchange=${exchange || "NASDAQ"}&pageSize=10`
    : `/api/stock/news/${stockCode}?pageSize=10`;

  // 기본정보
  const { data: detailData, isLoading: isDetailLoading } = useQuery<any>({
    queryKey: ["stock-detail", stockCode, market],
    queryFn: async () => {
      const res = await fetch(detailUrl, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: activeTab === "basic",
    staleTime: 60000,
  });

  // 차트
  const { data: chartData, isLoading: isChartLoading } = useQuery<{
    chartData: ChartDataItem[];
    volumeProfile: { price: number; volume: number }[];
  }>({
    queryKey: ["stock-chart", stockCode, market],
    queryFn: async () => {
      const res = await fetch(chartUrl, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: activeTab === "chart",
    staleTime: 120000,
  });

  // 실적
  const { data: financials, isLoading: isFinancialsLoading } = useQuery<any>({
    queryKey: ["stock-financials", stockCode, market],
    queryFn: async () => {
      const res = await fetch(financialsUrl, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: activeTab === "financials",
    staleTime: 300000,
  });

  // 공시
  const { data: disclosures, isLoading: isDisclosuresLoading } = useQuery<any>({
    queryKey: ["stock-disclosures", stockCode],
    queryFn: async () => {
      const res = await fetch(disclosuresUrl, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: activeTab === "disclosures",
    staleTime: 120000,
  });

  // 리서치
  const { data: research, isLoading: isResearchLoading } = useQuery<any>({
    queryKey: ["stock-research", stockCode, market],
    queryFn: async () => {
      const res = await fetch(researchUrl, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: activeTab === "research",
    staleTime: 120000,
  });

  // 뉴스
  const { data: newsData, isLoading: isNewsLoading } = useQuery<any>({
    queryKey: ["stock-news", stockCode, market],
    queryFn: async () => {
      const res = await fetch(newsUrl, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: activeTab === "news",
    staleTime: 120000,
  });

  // AI 종합분석 리스트
  const { data: aiAnalysesList, isLoading: isAiAnalysesLoading, refetch: refetchAiAnalyses } = useQuery<any>({
    queryKey: ["stock-ai-analyses", stockCode, market],
    queryFn: async () => {
      const res = await fetch(`/api/stock/ai-analyses?stockCode=${stockCode}&market=${market}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    staleTime: 30000,
  });

  // AI 종합분석 실행
  const runAiAnalysis = async () => {
    setAiAnalysisLoading(true);
    setAiAnalysisResult(null);
    try {
      const res = await fetch("/api/stock/ai-comprehensive-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stockCode, stockName, market, exchange }),
      });
      if (!res.ok) throw new Error("분석 실패");
      const data = await res.json();
      setAiAnalysisResult(data.analysis);
      refetchAiAnalyses();
      toast({ title: "AI 종합분석이 완료되었습니다" });
    } catch (err: any) {
      toast({ title: "AI 분석 실패: " + (err.message || "알 수 없는 오류"), variant: "destructive" });
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  // AI 분석 삭제
  const deleteAiAnalysis = async (id: number) => {
    try {
      await fetch(`/api/stock/ai-analyses/${id}`, { method: "DELETE", credentials: "include" });
      refetchAiAnalyses();
      if (aiAnalysisResult?.id === id) setAiAnalysisResult(null);
      toast({ title: "분석 결과가 삭제되었습니다" });
    } catch {
      toast({ title: "삭제 실패", variant: "destructive" });
    }
  };

  // 코멘트(메모) 불러오기
  const { data: comments = [], isLoading: isCommentsLoading } = useQuery<any[]>({
    queryKey: ["stock-comments", stockCode, market],
    queryFn: async () => {
      const res = await fetch(`/api/stock-comments/${stockCode}?market=${market}`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: activeTab === "comments",
    staleTime: 30000,
  });

  // 코멘트 데이터가 로드되면 메모 텍스트에 기존 내용을 채움
  useState(() => {});
  useMemo(() => {
    if (comments.length > 0 && activeTab === "comments" && memoText === "" && memoSaved) {
      // 기존 코멘트들을 하나의 메모로 합침 (시간순)
      const allMemo = comments
        .map((c: any) => {
          const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleString("ko-KR") : "";
          return `[${dateStr}] ${c.content}`;
        })
        .join("\n\n");
      setMemoText(allMemo);
    }
  }, [comments, activeTab]);

  // 메모 저장 (새 코멘트로 추가)
  const saveMemoMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/stock-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stockCode, stockName, market, content }),
      });
      if (!res.ok) throw new Error("저장 실패");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-comments", stockCode] });
      setMemoSaved(true);
      toast({ title: "메모가 저장되었습니다" });
    },
    onError: () => toast({ title: "메모 저장 실패", variant: "destructive" }),
  });

  // 코멘트 삭제
  const deleteCommentMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/stock-comments/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-comments", stockCode] });
      toast({ title: "메모가 삭제되었습니다" });
    },
    onError: () => toast({ title: "메모 삭제 실패", variant: "destructive" }),
  });

  // 차트 도메인 계산
  const chartDomain = useMemo(() => {
    if (!chartData?.chartData || chartData.chartData.length === 0) return [0, 100];
    const prices = chartData.chartData.flatMap((d) => [d.high, d.low]).filter(Boolean);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.05;
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [chartData]);

  // 최근 N일 차트 표시
  const displayChartData = useMemo(() => {
    if (!chartData?.chartData) return [];
    return chartData.chartData.slice(-90);
  }, [chartData]);

  return (
    <div className="w-full">
      <div className="py-3 px-4 pr-12 border-b sticky top-0 bg-background z-10">
        <div className="text-lg font-semibold flex items-center gap-2 flex-wrap">
          <BarChart3 className="h-5 w-5 text-primary shrink-0" />
          <span>{stockName}</span>
          <span className="text-sm text-muted-foreground font-mono">({stockCode})</span>
          {exchange && <span className="text-xs text-muted-foreground">{exchange}</span>}
          <Button
            size="sm"
            variant={aiAnalysisLoading ? "secondary" : "default"}
            className="ml-auto text-xs h-7 px-3"
            disabled={aiAnalysisLoading}
            onClick={runAiAnalysis}
          >
            {aiAnalysisLoading ? (
              <><Loader2 className="h-3 w-3 animate-spin mr-1" />AI 분석중...</>
            ) : (
              <><Sparkles className="h-3 w-3 mr-1" />AI 종합분석</>
            )}
          </Button>
        </div>
      </div>
      <div className="px-4 pb-4 pt-2">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="basic" className="flex-1 min-w-[60px] text-xs">
              <Info className="h-3 w-3 mr-1" />기본정보
            </TabsTrigger>
            <TabsTrigger value="chart" className="flex-1 min-w-[60px] text-xs">
              <BarChart3 className="h-3 w-3 mr-1" />차트
            </TabsTrigger>
            <TabsTrigger value="financials" className="flex-1 min-w-[60px] text-xs">
              <Building2 className="h-3 w-3 mr-1" />실적
            </TabsTrigger>
            <TabsTrigger value="disclosures" className="flex-1 min-w-[60px] text-xs">
              <FileText className="h-3 w-3 mr-1" />{isOverseas ? "SEC" : "공시"}
            </TabsTrigger>
            <TabsTrigger value="news" className="flex-1 min-w-[60px] text-xs">
              <Newspaper className="h-3 w-3 mr-1" />뉴스
            </TabsTrigger>
            <TabsTrigger value="research" className="flex-1 min-w-[60px] text-xs">
              <FileText className="h-3 w-3 mr-1" />리포트
            </TabsTrigger>
            <TabsTrigger value="comments" className="flex-1 min-w-[60px] text-xs">
              <MessageCircle className="h-3 w-3 mr-1" />메모
            </TabsTrigger>
          </TabsList>

          {/* 기본정보 */}
          <TabsContent value="basic" className="mt-3">
            {isDetailLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : detailData ? (
              <div className="space-y-4">
                {/* 현재가 */}
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-3xl font-bold">
                    {isOverseas ? "$" : ""}{Number(detailData.currentPrice?.toString().replace(/,/g, "")).toLocaleString()}
                  </span>
                  {(() => {
                    const cv = parseFloat(detailData.changeVal?.toString().replace(/,/g, "") || "0");
                    const cr = parseFloat(detailData.changeRate?.toString().replace(/,/g, "") || "0");
                    const isUp = cv > 0;
                    const isDown = cv < 0;
                    return (
                      <span className={`text-lg font-semibold flex items-center gap-1 ${isUp ? "text-red-500" : isDown ? "text-blue-500" : ""}`}>
                        {isUp && <TrendingUp className="h-4 w-4" />}
                        {isDown && <TrendingDown className="h-4 w-4" />}
                        {!isUp && !isDown && <Minus className="h-4 w-4" />}
                        {cv > 0 ? "+" : ""}{cv.toLocaleString()} ({cr > 0 ? "+" : ""}{cr.toFixed(2)}%)
                      </span>
                    );
                  })()}
                </div>

                {/* 기본정보 그리드 */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[
                    { label: "시가총액", value: detailData.marketCap },
                    { label: "PER", value: detailData.per },
                    { label: "PBR", value: detailData.pbr },
                    { label: "EPS", value: detailData.eps },
                    { label: "BPS", value: detailData.bps },
                    { label: "배당수익률", value: detailData.dividendYield },
                    { label: "52주 최고", value: detailData.highPrice52w },
                    { label: "52주 최저", value: detailData.lowPrice52w },
                    { label: "거래량", value: detailData.volume },
                    { label: "거래대금", value: detailData.tradingValue },
                    !isOverseas && { label: "외국인보유", value: detailData.foreignOwnership },
                    { label: "업종", value: detailData.sector },
                  ].filter(Boolean).map((item: any, idx) => (
                    <div key={idx} className="bg-muted/30 rounded-lg p-2.5">
                      <div className="text-[10px] text-muted-foreground mb-0.5">{item.label}</div>
                      <div className="text-sm font-medium">{item.value || "-"}</div>
                    </div>
                  ))}
                </div>

                {/* 기업설명 */}
                {detailData.description && (
                  <div className="bg-muted/20 rounded-lg p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">기업 개요</div>
                    <p className="text-sm leading-relaxed">{detailData.description}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">데이터를 불러올 수 없습니다.</p>
            )}
          </TabsContent>

          {/* 차트 */}
          <TabsContent value="chart" className="mt-3">
            {isChartLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : displayChartData.length > 0 ? (
              <div className="space-y-4">
                {/* 봉차트 + 이동평균선 */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-3 flex-wrap">
                    <span className="font-medium">📈 일봉차트 (최근 90일)</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-500 inline-block"></span>MA5</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block"></span>MA20</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 inline-block"></span>MA60</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500/60 inline-block rounded-sm"></span>상승</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500/80 inline-block rounded-sm"></span>하락</span>
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={displayChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => v.slice(5)}
                        interval={Math.floor(displayChartData.length / 8)}
                      />
                      <YAxis
                        domain={chartDomain}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => isOverseas ? `$${v}` : v >= 10000 ? `${(v/10000).toFixed(0)}만` : v.toLocaleString()}
                        width={55}
                      />
                      <Tooltip
                        contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                        formatter={(value: any, name: string) => {
                          const labels: Record<string, string> = {
                            close: "종가", ma5: "MA5", ma20: "MA20", ma60: "MA60",
                          };
                          const prefix = isOverseas ? "$" : "";
                          return [typeof value === "number" ? `${prefix}${value.toLocaleString()}` : value, labels[name] || name];
                        }}
                        labelFormatter={(label) => `📅 ${label}`}
                      />
                      {/* 봉차트 - 종가 바 */}
                      <Bar dataKey="close" barSize={5}>
                        {displayChartData.map((entry, index) => {
                          const isRising = entry.close >= entry.open;
                          return <Cell key={index} fill={isRising ? "#ef4444" : "#3b82f6"} fillOpacity={isRising ? 0.6 : 0.85} />;
                        })}
                      </Bar>
                      {/* 이동평균선 */}
                      <Line type="monotone" dataKey="ma5" stroke="#eab308" strokeWidth={1.5} dot={false} connectNulls />
                      <Line type="monotone" dataKey="ma20" stroke="#22c55e" strokeWidth={1.5} dot={false} connectNulls />
                      <Line type="monotone" dataKey="ma60" stroke="#a855f7" strokeWidth={1.5} dot={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* 거래량 차트 */}
                <div>
                  <div className="text-xs text-muted-foreground mb-1 font-medium">거래량</div>
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={displayChartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                      <XAxis dataKey="date" tick={false} />
                      <YAxis tick={{ fontSize: 9 }} width={55} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(0)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                      <Tooltip
                        contentStyle={{ fontSize: "11px" }}
                        formatter={(v: any) => [Number(v).toLocaleString(), "거래량"]}
                        labelFormatter={(l) => `📅 ${l}`}
                      />
                      <Bar dataKey="volume" barSize={3}>
                        {displayChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.close >= entry.open ? "#ef444480" : "#3b82f680"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 매물대 차트 */}
                {chartData?.volumeProfile && chartData.volumeProfile.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 font-medium">매물대 (가격대별 거래량)</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={chartData.volumeProfile}
                        layout="vertical"
                        margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 9 }}
                          tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)}
                        />
                        <YAxis
                          dataKey="price"
                          type="category"
                          tick={{ fontSize: 9 }}
                          width={60}
                          tickFormatter={(v) => isOverseas ? `$${v}` : v >= 10000 ? `${(v/10000).toFixed(0)}만` : v.toLocaleString()}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: "11px" }}
                          formatter={(v: any) => [Number(v).toLocaleString(), "거래량"]}
                          labelFormatter={(l) => `💰 ${isOverseas ? "$" : ""}${Number(l).toLocaleString()}`}
                        />
                        <Bar dataKey="volume" fill="#8b5cf6" fillOpacity={0.6} barSize={8} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">차트 데이터를 불러올 수 없습니다.</p>
            )}
          </TabsContent>

          {/* 실적 */}
          <TabsContent value="financials" className="mt-3">
            {isFinancialsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : financials ? (
              <div className="space-y-4">
                {/* Forward EPS/PER */}
                {(financials.forwardEps !== "-" || financials.forwardPer !== "-") && (
                  <div className="flex gap-4 p-3 bg-primary/5 rounded-lg">
                    <div>
                      <span className="text-xs text-muted-foreground">Forward EPS</span>
                      <div className="text-sm font-bold">{financials.forwardEps}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Forward PER</span>
                      <div className="text-sm font-bold">{financials.forwardPer}</div>
                    </div>
                  </div>
                )}

                {/* 연간 실적 */}
                {financials.annualData?.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-bold mb-2">📊 연간 실적</h4>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs w-[80px]">기간</TableHead>
                            <TableHead className="text-xs text-right">매출액</TableHead>
                            <TableHead className="text-xs text-right">영업이익</TableHead>
                            <TableHead className="text-xs text-right">순이익</TableHead>
                            <TableHead className="text-xs text-right">ROE</TableHead>
                            <TableHead className="text-xs text-right">EPS</TableHead>
                            <TableHead className="text-xs text-right">PER</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {financials.annualData.map((row: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="text-xs font-medium">{row.period}</TableCell>
                              <TableCell className="text-xs text-right">{row.revenue}</TableCell>
                              <TableCell className="text-xs text-right">{row.operatingProfit}</TableCell>
                              <TableCell className="text-xs text-right">{row.netIncome}</TableCell>
                              <TableCell className="text-xs text-right">{row.roe}</TableCell>
                              <TableCell className="text-xs text-right">{row.eps}</TableCell>
                              <TableCell className="text-xs text-right">{row.per}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">연간 실적 데이터가 없습니다.</p>
                )}

                {/* 분기 실적 */}
                {financials.quarterData?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold mb-2">📈 분기 실적</h4>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs w-[80px]">기간</TableHead>
                            <TableHead className="text-xs text-right">매출액</TableHead>
                            <TableHead className="text-xs text-right">영업이익</TableHead>
                            <TableHead className="text-xs text-right">순이익</TableHead>
                            <TableHead className="text-xs text-right">ROE</TableHead>
                            <TableHead className="text-xs text-right">EPS</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {financials.quarterData.map((row: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="text-xs font-medium">{row.period}</TableCell>
                              <TableCell className="text-xs text-right">{row.revenue}</TableCell>
                              <TableCell className="text-xs text-right">{row.operatingProfit}</TableCell>
                              <TableCell className="text-xs text-right">{row.netIncome}</TableCell>
                              <TableCell className="text-xs text-right">{row.roe}</TableCell>
                              <TableCell className="text-xs text-right">{row.eps}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">실적 데이터를 불러올 수 없습니다.</p>
            )}
          </TabsContent>

          {/* 공시자료 (국내: DART / 해외: SEC EDGAR) */}
          <TabsContent value="disclosures" className="mt-3">
            {isDisclosuresLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : disclosures?.disclosures?.length > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold">
                    {isOverseas ? "📄 SEC EDGAR Filings (8-K, 10-K, 10-Q)" : "📋 최근 공시/뉴스"}
                  </h4>
                  <div className="flex items-center gap-2">
                    {checkedDisclosures.size > 0 && (
                      <span className="text-[10px] text-muted-foreground">{checkedDisclosures.size}건 선택</span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-7 text-xs border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950"
                      disabled={checkedDisclosures.size === 0 || disclosureAiLoading}
                      onClick={async () => {
                        const selectedItems = disclosures.disclosures.filter((_: any, idx: number) => checkedDisclosures.has(idx));
                        setDisclosureAiLoading(true);
                        setDisclosureAiResult(null);
                        try {
                          const res = await fetch("/api/stock/disclosures/ai-analyze", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({ items: selectedItems, stockName, stockCode, market: market || "domestic" }),
                          });
                          if (!res.ok) throw new Error("AI 분석 실패");
                          const data = await res.json();
                          setDisclosureAiResult(data.analysis);
                        } catch (err: any) {
                          toast({ title: "AI 분석 실패", description: err.message, variant: "destructive" });
                        } finally {
                          setDisclosureAiLoading(false);
                        }
                      }}
                    >
                      {disclosureAiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      AI 분석
                    </Button>
                  </div>
                </div>
                {isOverseas ? (
                  <p className="text-xs text-muted-foreground mb-3">
                    미국 증권거래위원회(SEC)에 제출된 공시자료입니다. 8-K(중요사항), 10-K(연간보고서), 10-Q(분기보고서) 등을 포함합니다.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mb-3">
                    DART(전자공시시스템) 공시자료입니다. 체크박스로 선택 후 AI 분석 버튼을 클릭하면 투자자 관점에서 분석합니다.
                  </p>
                )}
                {disclosures.disclosures.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2.5 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                  >
                    <Checkbox
                      checked={checkedDisclosures.has(idx)}
                      onCheckedChange={(checked) => {
                        setCheckedDisclosures(prev => {
                          const next = new Set(prev);
                          if (checked) next.add(idx);
                          else next.delete(idx);
                          return next;
                        });
                      }}
                      className="mt-1 shrink-0"
                    />
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium line-clamp-2">{item.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {item.formType && isOverseas && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                item.formType === "8-K" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                item.formType === "10-K" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                item.formType === "10-Q" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                "bg-muted text-muted-foreground"
                              }`}>{item.formType}</span>
                            )}
                            {item.source && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{item.source}</span>
                            )}
                            <span className="text-[10px] text-muted-foreground">{item.date}</span>
                          </div>
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </a>
                  </div>
                ))}

                {/* AI 분석 결과 */}
                {disclosureAiLoading && (
                  <div className="flex items-center justify-center py-6 gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
                    <span className="text-sm text-muted-foreground">{isOverseas ? "SEC 공시자료" : "DART 공시자료"} AI 분석 중...</span>
                  </div>
                )}
                {disclosureAiResult && (
                  <div className="mt-4 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <div className="flex items-center justify-between px-4 py-2 bg-purple-50 dark:bg-purple-950/30 rounded-t-lg">
                      <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" /> 공시자료 AI 분석 결과
                      </span>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setDisclosureAiFontSize(s => Math.max(10, s - 1))}>
                          <ZoomOut className="h-3 w-3" />
                        </Button>
                        <span className="text-[10px] text-muted-foreground w-6 text-center">{disclosureAiFontSize}</span>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setDisclosureAiFontSize(s => Math.min(20, s + 1))}>
                          <ZoomIn className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                          navigator.clipboard.writeText(disclosureAiResult);
                          toast({ title: "클립보드에 복사되었습니다" });
                        }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div
                      className="p-4 max-h-[500px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none"
                      style={{ fontSize: `${disclosureAiFontSize}px` }}
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(disclosureAiResult) }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isOverseas ? "SEC 공시자료가 없습니다." : "공시자료가 없습니다."}
              </p>
            )}
          </TabsContent>

          {/* 뉴스 */}
          <TabsContent value="news" className="mt-3">
            {isNewsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : newsData?.news?.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-2">
                  📰 {stockName} 관련 최신 뉴스 {newsData.news.length}건
                </p>
                {newsData.news.map((item: any, idx: number) => {
                  const dt = item.datetime;
                  const formattedDate = dt ? `${dt.slice(0,4)}.${dt.slice(4,6)}.${dt.slice(6,8)} ${dt.slice(8,10)}:${dt.slice(10,12)}` : "";
                  return (
                    <div key={idx} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-3">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="w-20 h-14 object-cover rounded flex-shrink-0 mt-0.5"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-600 hover:underline line-clamp-2 block"
                            dangerouslySetInnerHTML={{ __html: item.title }}
                          />
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {item.summary?.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              {item.source}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formattedDate}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">관련 뉴스가 없습니다.</p>
            )}
          </TabsContent>

          {/* 리서치 리포트 */}
          <TabsContent value="research" className="mt-3">
            {isResearchLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : research?.reports?.length > 0 ? (
              <div className="space-y-1">
                <h4 className="text-sm font-bold mb-2">📑 종목 리서치 리포트</h4>
                {research.reports.map((item: any, idx: number) => (
                  <a
                    key={idx}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2.5 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium line-clamp-2">{item.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {item.source && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">{item.source}</span>
                          )}
                          {item.targetPrice && item.targetPrice !== "-" && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">목표가 {item.targetPrice}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground">{item.date}</span>
                        </div>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">리서치 리포트가 없습니다.</p>
            )}
          </TabsContent>

          {/* 메모장 */}
          <TabsContent value="comments" className="mt-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold">📝 종목 메모</h4>
                <div className="flex items-center gap-1.5">
                  {!memoSaved && (
                    <span className="text-[10px] text-amber-500 font-medium">● 수정됨</span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => {
                      if (!memoText.trim()) {
                        toast({ title: "메모 내용을 입력해주세요", variant: "destructive" });
                        return;
                      }
                      saveMemoMutation.mutate(memoText.trim());
                    }}
                    disabled={saveMemoMutation.isPending || memoSaved}
                  >
                    {saveMemoMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    저장
                  </Button>
                  {memoText && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        navigator.clipboard.writeText(memoText);
                        toast({ title: "메모를 클립보드에 복사했습니다" });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                종목에 대한 투자 메모, 분석 노트, 매매 전략 등을 자유롭게 기록하세요.
              </p>

              {/* 메모 입력 영역 */}
              {isCommentsLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <Textarea
                  placeholder={`${stockName}(${stockCode}) 종목에 대한 메모를 작성하세요...\n\n예시:\n- 투자 포인트 / 리스크 요인\n- 목표가 / 손절가\n- 실적 전망 / 업황 분석\n- 매수/매도 기록`}
                  value={memoText}
                  onChange={(e) => {
                    setMemoText(e.target.value);
                    setMemoSaved(false);
                  }}
                  rows={15}
                  className="text-sm font-mono resize-y min-h-[250px]"
                />
              )}

              {/* 기존 메모 이력 */}
              {comments.length > 0 && (
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-semibold text-muted-foreground">📋 저장된 메모 이력</h5>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {comments.map((comment: any) => (
                      <div key={comment.id} className="p-2.5 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              {comment.userName || "사용자"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(comment.createdAt).toLocaleString("ko-KR")}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              title="메모에 불러오기"
                              onClick={() => {
                                setMemoText(comment.content);
                                setMemoSaved(false);
                                toast({ title: "메모를 불러왔습니다" });
                              }}
                            >
                              <FileText className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-destructive"
                              onClick={() => {
                                if (confirm("이 메모를 삭제하시겠습니까?")) {
                                  deleteCommentMutation.mutate(comment.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs whitespace-pre-wrap text-muted-foreground line-clamp-3">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* AI 종합분석 결과 (현재) */}
        {(aiAnalysisResult || aiAnalysisLoading) && (
          <div className="mt-4 border rounded-lg p-4 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-1">
                <Sparkles className="h-4 w-4 text-purple-500" />
                AI 종합분석 결과
                {aiAnalysisResult?.rating && (
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${
                    aiAnalysisResult.rating === "강력매수" ? "bg-red-100 text-red-700" :
                    aiAnalysisResult.rating === "매수" ? "bg-orange-100 text-orange-700" :
                    aiAnalysisResult.rating === "중립" ? "bg-gray-100 text-gray-700" :
                    aiAnalysisResult.rating === "매도" ? "bg-blue-100 text-blue-700" :
                    "bg-blue-200 text-blue-800"
                  }`}>{aiAnalysisResult.rating}</span>
                )}
              </h3>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAiAnalysisFontSize(s => Math.max(10, s - 1))}>
                  <ZoomOut className="h-3 w-3" />
                </Button>
                <span className="text-[10px] text-muted-foreground">{aiAnalysisFontSize}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAiAnalysisFontSize(s => Math.min(24, s + 1))}>
                  <ZoomIn className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                  const text = aiAnalysisResult?.analysisResult || "";
                  navigator.clipboard.writeText(text);
                  toast({ title: "분석 결과가 복사되었습니다" });
                }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {aiAnalysisLoading ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
                <span className="text-sm text-muted-foreground">AI가 종합분석 리포트를 작성 중입니다...</span>
              </div>
            ) : aiAnalysisResult?.analysisResult ? (
              <div
                className="prose prose-sm max-w-none"
                style={{ fontSize: `${aiAnalysisFontSize}px`, lineHeight: "1.7" }}
                dangerouslySetInnerHTML={{ __html: markdownToHtml(aiAnalysisResult.analysisResult) }}
              />
            ) : null}
            {aiAnalysisResult?.summary && (
              <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded text-sm font-medium">
                💡 {aiAnalysisResult.summary}
              </div>
            )}
          </div>
        )}

        {/* AI 분석 히스토리 리스트 */}
        <div className="mt-4">
          <button
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowAnalysisList(!showAnalysisList)}
          >
            <FileText className="h-3 w-3" />
            이전 AI 분석 리포트 ({aiAnalysesList?.analyses?.length || 0}건)
            <span className="text-[10px]">{showAnalysisList ? "▲" : "▼"}</span>
          </button>

          {showAnalysisList && (
            <div className="mt-2 space-y-2">
              {isAiAnalysesLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : aiAnalysesList?.analyses?.length > 0 ? (
                aiAnalysesList.analyses.map((item: any) => (
                  <div key={item.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString("ko-KR")}
                        </span>
                        {item.rating && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.rating === "강력매수" ? "bg-red-100 text-red-700" :
                            item.rating === "매수" ? "bg-orange-100 text-orange-700" :
                            item.rating === "중립" ? "bg-gray-100 text-gray-700" :
                            item.rating === "매도" ? "bg-blue-100 text-blue-700" :
                            "bg-blue-200 text-blue-800"
                          }`}>{item.rating}</span>
                        )}
                        {item.summary && (
                          <span className="text-xs truncate">{item.summary}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost" size="sm" className="h-6 text-[10px] px-2"
                          onClick={() => {
                            setAiAnalysisResult(item);
                            setShowAnalysisList(false);
                          }}
                        >
                          보기
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                          onClick={() => {
                            if (confirm("이 분석 결과를 삭제하시겠습니까?")) deleteAiAnalysis(item.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-2">아직 분석 기록이 없습니다.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 간단한 Markdown → HTML 변환
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.*$)/gm, '<h3 class="text-base font-bold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-lg font-bold mt-5 mb-2">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

