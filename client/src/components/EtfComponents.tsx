import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2,
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  AlertCircle,
  BarChart3,
  PieChart,
  ExternalLink,
  ArrowRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Flame,
  BrainCircuit,
  FileText,
  Play,
  X,
  Send,
} from "lucide-react";

type SortField = "weight" | "changePercent" | null;
type SortDirection = "asc" | "desc";

interface EtfComponentStock {
  stockCode: string;
  stockName: string;
  weight: number;
  quantity: number;
  evalAmount: number;
  price?: string;
  change?: string;
  changePercent?: string;
  changeSign?: string;
  volume?: string;
  high?: string;
  low?: string;
  open?: string;
}

interface EtfComponentResult {
  etfCode: string;
  etfName: string;
  nav?: string;
  marketCap?: string;
  components: EtfComponentStock[];
  totalComponentCount: number;
  updatedAt: string;
}

interface EtfSearchResult {
  id: number;
  name: string;
  code: string;
  mainCategory: string;
  subCategory: string;
  fee: string;
  yield: string;
}

interface TopGainerEtf {
  code: string;
  name: string;
  nowVal: number;
  changeVal: number;
  changeRate: number;
  risefall: string;
  quant: number;
  amount: number;
  marketCap: number;
  nav: number;
}

function getChangeColor(sign?: string): string {
  if (!sign) return "text-muted-foreground";
  if (sign === "1" || sign === "2") return "text-red-500";
  if (sign === "4" || sign === "5") return "text-blue-500";
  return "text-muted-foreground";
}

function getChangeIcon(sign?: string) {
  if (!sign) return <Minus className="w-3 h-3" />;
  if (sign === "1" || sign === "2") return <TrendingUp className="w-3 h-3" />;
  if (sign === "4" || sign === "5") return <TrendingDown className="w-3 h-3" />;
  return <Minus className="w-3 h-3" />;
}

function getChangePrefix(sign?: string): string {
  if (!sign) return "";
  if (sign === "1" || sign === "2") return "+";
  if (sign === "4" || sign === "5") return "-";
  return "";
}

export default function EtfComponents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEtfCode, setSelectedEtfCode] = useState("");
  const [searchMode, setSearchMode] = useState<"search" | "direct">("search");
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [chartPeriod, setChartPeriod] = useState<"day" | "week" | "month" | "year">("day");
  const [chartType, setChartType] = useState<"candle" | "area">("candle");
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [analysisPrompt, setAnalysisPrompt] = useState(
    `실시간 ETF 상승리스트, 네이버 실시간 뉴스(https://stock.naver.com/news), 네이버 마켓동향(https://stock.naver.com/market/stock/kr)을 참고하여 다음을 포함한 분석 보고서를 30줄 이상으로 요약 정리해줘:\n\n1. 오늘의 시장 개요 (코스피/코스닥 지수 동향)\n2. 주요 상승 섹터/테마 분석\n3. 뉴스·매크로 연관 분석\n4. 하락 섹터 동향\n5. 투자 시사점 및 주의사항`
  );
  const [analysisResult, setAnalysisResult] = useState<{
    analysis: string;
    analyzedAt: string;
    dataPoints?: { risingCount: number; fallingCount: number; newsCount: number; market: string };
  } | null>(null);
  const analysisSectionRef = useRef<HTMLDivElement>(null);

  // AI 분석 섹션으로 스크롤
  const scrollToAnalysis = useCallback(() => {
    setShowAnalysisPanel(true);
    setTimeout(() => {
      analysisSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  // ETF 트렌드 AI 분석
  const analyzeMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await fetch("/api/etf/analyze-trend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "분석 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
    },
  });

  // ETF 실시간 상승 상위 15개
  const { data: topGainersData, isFetching: isLoadingGainers, refetch: refetchGainers } = useQuery<{
    items: TopGainerEtf[];
    updatedAt: string;
  }>({
    queryKey: ["/api/etf/top-gainers"],
    queryFn: async () => {
      const res = await fetch("/api/etf/top-gainers?limit=15", { credentials: "include" });
      if (!res.ok) throw new Error("ETF 상승 데이터 조회 실패");
      return res.json();
    },
    staleTime: 60 * 1000, // 1분
    refetchInterval: 60 * 1000, // 1분마다 자동 갱신
  });

  // ETF 검색 (네이버 금융 전체 ETF 목록에서 실시간 검색)
  const { data: searchResults, isFetching: isSearching } = useQuery<{ results: EtfSearchResult[] }>({
    queryKey: ["/api/etf/search", searchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/etf/search?q=${encodeURIComponent(searchTerm.trim())}`, { credentials: "include" });
      if (!res.ok) return { results: [] };
      return res.json();
    },
    enabled: searchMode === "search" && searchTerm.trim().length >= 2 && !selectedEtfCode,
    staleTime: 60 * 1000,
  });

  // ETF 구성종목 조회
  const {
    data: componentData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<EtfComponentResult>({
    queryKey: ["/api/etf/components", selectedEtfCode],
    queryFn: async () => {
      const res = await fetch(`/api/etf/components/${selectedEtfCode}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "구성종목 조회 실패");
      }
      return res.json();
    },
    enabled: !!selectedEtfCode && /^[0-9A-Za-z]{6}$/.test(selectedEtfCode),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const handleSearch = () => {
    const trimmed = searchTerm.trim();
    if (/^[0-9A-Za-z]{6}$/.test(trimmed)) {
      setSelectedEtfCode(trimmed);
    } else if (combinedResults.length === 1) {
      handleSelectEtf(combinedResults[0].code);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSelectEtf = (code: string) => {
    setSelectedEtfCode(code);
    setSearchTerm(code);
  };

  // 검색 결과 결합
  const combinedResults = useMemo(() => {
    if (searchTerm.trim().length < 2) return [];
    const apiResults = (searchResults?.results || []).map((r: any) => ({
      code: r.code,
      name: r.name,
    }));
    return apiResults.slice(0, 20);
  }, [searchTerm, searchResults]);

  // 정렬 토글
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // 정렬된 구성종목
  const sortedComponents = useMemo(() => {
    if (!componentData?.components) return [];
    if (!sortField) return componentData.components;

    return [...componentData.components].sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (sortField === "weight") {
        valA = a.weight;
        valB = b.weight;
      } else if (sortField === "changePercent") {
        const getSignedPercent = (c: EtfComponentStock) => {
          if (!c.changePercent) return -Infinity;
          const pct = parseFloat(c.changePercent);
          if (c.changeSign === "4" || c.changeSign === "5") return -pct;
          return pct;
        };
        valA = getSignedPercent(a);
        valB = getSignedPercent(b);
      }

      if (valA === -Infinity && valB === -Infinity) return 0;
      if (valA === -Infinity) return 1;
      if (valB === -Infinity) return -1;

      return sortDirection === "desc" ? valB - valA : valA - valB;
    });
  }, [componentData?.components, sortField, sortDirection]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />;
    if (sortDirection === "desc") return <ArrowDown className="w-3 h-3 text-primary" />;
    return <ArrowUp className="w-3 h-3 text-primary" />;
  };

  const totalWeight = componentData?.components.reduce((sum, c) => sum + c.weight, 0) || 0;
  const upCount = componentData?.components.filter(c => c.changeSign === "1" || c.changeSign === "2").length || 0;
  const downCount = componentData?.components.filter(c => c.changeSign === "4" || c.changeSign === "5").length || 0;
  const flatCount = (componentData?.totalComponentCount || 0) - upCount - downCount;

  const topGainers = topGainersData?.items || [];

  return (
    <div className="space-y-6">
      {/* ===== 실시간 상승 ETF TOP 15 ===== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              실시간 상승 ETF TOP 15
            </CardTitle>
            <div className="flex items-center gap-2">
              {topGainersData?.updatedAt && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {topGainersData.updatedAt}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={scrollToAnalysis}
                disabled={topGainers.length === 0}
                className="h-7 text-xs gap-1"
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                AI 분석
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchGainers()}
                disabled={isLoadingGainers}
                className="h-7 w-7 p-0"
              >
                {isLoadingGainers ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            레버리지·인버스 제외 | <span className="text-blue-500">ETF명 클릭시 아래 구성종목 실시간 시세 Update됩니다.</span>
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingGainers && topGainers.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : topGainers.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              현재 상승 중인 ETF가 없습니다 (장 마감 또는 데이터 로딩 중)
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[36px] text-center">#</TableHead>
                    <TableHead>ETF명</TableHead>
                    <TableHead className="text-right w-[90px]">현재가</TableHead>
                    <TableHead className="text-right w-[80px]">등락률</TableHead>
                    <TableHead className="text-right w-[80px]">전일대비</TableHead>
                    <TableHead className="text-right w-[100px] hidden sm:table-cell">거래량</TableHead>
                    <TableHead className="text-right w-[90px] hidden md:table-cell">시가총액(억)</TableHead>
                    <TableHead className="text-right w-[80px] hidden md:table-cell">순자산(NAV)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topGainers.map((etf, index) => (
                    <TableRow
                      key={etf.code}
                      className={`cursor-pointer transition-colors hover:bg-primary/5 ${
                        selectedEtfCode === etf.code ? "bg-primary/10 border-l-2 border-l-primary" : ""
                      }`}
                      onClick={() => handleSelectEtf(etf.code)}
                    >
                      <TableCell className="text-center font-bold text-sm">
                        <span className={index < 3 ? "text-orange-500" : "text-muted-foreground"}>
                          {index + 1}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <div>
                            <div className="font-medium text-sm leading-tight">{etf.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{etf.code}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-sm">
                        {etf.nowVal.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-sm text-red-500">
                        <span className="flex items-center justify-end gap-0.5">
                          <TrendingUp className="w-3 h-3" />
                          +{etf.changeRate.toFixed(2)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-red-500">
                        +{Math.abs(etf.changeVal).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground hidden sm:table-cell">
                        {etf.quant.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground hidden md:table-cell">
                        {(etf.marketCap ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground hidden md:table-cell">
                        {(etf.nav ?? 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== 구성종목 실시간 시세 조회 ===== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <PieChart className="w-5 h-5 text-primary" />
            ETF 구성종목 실시간 시세
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            위 리스트에서 ETF를 클릭하거나, 직접 코드/이름을 검색하여 구성종목의 실시간 시세를 확인하세요
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 검색 입력 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSearchMode("search");
                  if (selectedEtfCode) setSelectedEtfCode("");
                }}
                onKeyDown={handleKeyDown}
                placeholder="ETF 코드 (예: 069500) 또는 이름 검색 (예: KODEX, TIGER, 반도체)"
                className="pl-9"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!searchTerm.trim()}
              className="gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              조회
            </Button>
            {selectedEtfCode && (
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-2"
              >
                {isFetching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                새로고침
              </Button>
            )}
          </div>

          {/* 검색 결과 드롭다운 */}
          {!selectedEtfCode && searchTerm.trim().length >= 2 && (
            <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              {isSearching && (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  ETF 검색 중...
                </div>
              )}
              {combinedResults.length > 0 ? (
                <div className="divide-y">
                  {combinedResults.map((item) => (
                    <button
                      key={item.code}
                      onClick={() => handleSelectEtf(item.code)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {item.code}
                        </span>
                        <span className="font-medium text-sm">{item.name}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ) : !isSearching ? (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                  검색 결과가 없습니다
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 로딩 */}
      {isLoading && selectedEtfCode && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">구성종목 및 실시간 시세를 조회하고 있습니다...</p>
          <p className="text-xs text-muted-foreground">네이버 금융에서 각 종목의 현재가를 가져옵니다</p>
        </div>
      )}

      {/* 에러 */}
      {error && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-semibold">조회 실패</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {(error as Error)?.message || "구성종목을 불러올 수 없습니다."}
            </p>
            <Button variant="outline" onClick={() => refetch()} className="mt-4">
              재시도
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 결과 표시 */}
      {componentData && !isLoading && (
        <>
          {/* ETF 정보 요약 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    {componentData.etfName}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="font-mono">{componentData.etfCode}</span>
                    <span>구성종목 {componentData.totalComponentCount}개</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {componentData.updatedAt}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex items-center gap-1 text-red-500 font-medium">
                      <TrendingUp className="w-4 h-4" />
                      상승 {upCount}
                    </span>
                    <span className="text-muted-foreground">보합 {flatCount}</span>
                    <span className="flex items-center gap-1 text-blue-500 font-medium">
                      <TrendingDown className="w-4 h-4" />
                      하락 {downCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* 비중 상위 5개 비주얼 바 */}
              {componentData.components.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">비중 상위 종목</p>
                  <div className="flex rounded-lg overflow-hidden h-6">
                    {componentData.components.slice(0, 5).map((comp, i) => {
                      const widthPct = totalWeight > 0 ? (comp.weight / totalWeight) * 100 : 20;
                      const colors = [
                        "bg-primary",
                        "bg-blue-400",
                        "bg-emerald-400",
                        "bg-amber-400",
                        "bg-purple-400",
                      ];
                      return (
                        <div
                          key={comp.stockCode || i}
                          className={`${colors[i]} flex items-center justify-center text-white text-[10px] font-medium truncate px-1`}
                          style={{ width: `${widthPct}%`, minWidth: "40px" }}
                          title={`${comp.stockName} ${comp.weight.toFixed(1)}%`}
                        >
                          {comp.stockName.length > 6 ? comp.stockName.slice(0, 6) + ".." : comp.stockName}
                          {" "}
                          {comp.weight.toFixed(1)}%
                        </div>
                      );
                    })}
                    {totalWeight > 0 && (
                      <div
                        className="bg-muted flex items-center justify-center text-muted-foreground text-[10px] font-medium"
                        style={{ width: `${Math.max(0, 100 - componentData.components.slice(0, 5).reduce((s, c) => s + (c.weight / totalWeight) * 100, 0))}%`, minWidth: "30px" }}
                      >
                        기타
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 구성종목 테이블 */}
          {componentData.components.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[40px] text-center">#</TableHead>
                        <TableHead>종목명</TableHead>
                        <TableHead className="text-right w-[80px]">
                          <button
                            onClick={() => handleSort("weight")}
                            className={`inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer select-none ${sortField === "weight" ? "text-primary font-semibold" : ""}`}
                          >
                            비중(%)
                            {getSortIcon("weight")}
                          </button>
                        </TableHead>
                        <TableHead className="text-right w-[100px]">현재가</TableHead>
                        <TableHead className="text-right w-[90px]">
                          <button
                            onClick={() => handleSort("changePercent")}
                            className={`inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer select-none ${sortField === "changePercent" ? "text-primary font-semibold" : ""}`}
                          >
                            등락률
                            {getSortIcon("changePercent")}
                          </button>
                        </TableHead>
                        <TableHead className="text-right w-[80px]">전일대비</TableHead>
                        <TableHead className="text-right w-[100px]">거래량</TableHead>
                        <TableHead className="text-right w-[80px]">시가</TableHead>
                        <TableHead className="text-right w-[80px]">고가</TableHead>
                        <TableHead className="text-right w-[80px]">저가</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedComponents.map((comp, index) => {
                        const changeColor = getChangeColor(comp.changeSign);
                        const changeIcon = getChangeIcon(comp.changeSign);
                        const prefix = getChangePrefix(comp.changeSign);

                        return (
                          <TableRow
                            key={comp.stockCode || index}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <TableCell className="text-center font-medium text-muted-foreground text-sm">
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-[120px]">
                                <div>
                                  <div className="font-medium text-sm leading-tight">{comp.stockName}</div>
                                  <div className="text-xs text-muted-foreground font-mono">{comp.stockCode}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: `${Math.min(comp.weight, 100)}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium tabular-nums w-12 text-right">
                                  {comp.weight.toFixed(2)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-semibold text-sm">
                              {comp.price ? parseInt(comp.price).toLocaleString() : "-"}
                            </TableCell>
                            <TableCell className={`text-right tabular-nums font-medium text-sm ${changeColor}`}>
                              {comp.changePercent ? (
                                <span className="flex items-center justify-end gap-0.5">
                                  {changeIcon}
                                  {prefix}{Math.abs(parseFloat(comp.changePercent)).toFixed(2)}%
                                </span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className={`text-right tabular-nums text-sm ${changeColor}`}>
                              {comp.change ? (
                                <span>
                                  {prefix}{Math.abs(parseInt(comp.change)).toLocaleString()}
                                </span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                              {comp.volume ? parseInt(comp.volume).toLocaleString() : "-"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                              {comp.open ? parseInt(comp.open).toLocaleString() : "-"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-red-400">
                              {comp.high ? parseInt(comp.high).toLocaleString() : "-"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-blue-400">
                              {comp.low ? parseInt(comp.low).toLocaleString() : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <PieChart className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold">구성종목 데이터를 찾을 수 없습니다</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  해당 ETF의 구성종목 정보를 가져올 수 없었습니다. ETF 코드를 확인해주세요.
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`https://www.etfcheck.co.kr/mobile/etpitem/${selectedEtfCode}/pdf`, "_blank")}
                    className="gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    etfcheck.co.kr에서 확인
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`https://finance.naver.com/item/coinfo.naver?code=${selectedEtfCode}`, "_blank")}
                    className="gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    네이버 금융에서 확인
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 실시간 차트 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  {componentData.etfName} 차트
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 border rounded-md p-0.5">
                    <Button
                      variant={chartType === "candle" ? "default" : "ghost"}
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => setChartType("candle")}
                    >
                      봉차트
                    </Button>
                    <Button
                      variant={chartType === "area" ? "default" : "ghost"}
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => setChartType("area")}
                    >
                      영역차트
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    {(["day", "week", "month", "year"] as const).map((period) => (
                      <Button
                        key={period}
                        variant={chartPeriod === period ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setChartPeriod(period)}
                      >
                        {{ day: "일봉", week: "주봉", month: "월봉", year: "연봉" }[period]}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex justify-center">
              <img
                key={`${selectedEtfCode}-${chartType}-${chartPeriod}`}
                src={`https://ssl.pstatic.net/imgfinance/chart/item/${chartType}/${chartPeriod}/${selectedEtfCode}.png`}
                alt={`${componentData.etfName} ${chartPeriod} 차트`}
                className="max-w-full h-auto rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* ===== AI 분석 섹션 ===== */}
      {showAnalysisPanel && (
        <div ref={analysisSectionRef} className="space-y-4">
          {/* 프롬프트 입력 영역 */}
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-primary" />
                  AI 트렌드 분석
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowAnalysisPanel(false); setAnalysisResult(null); }}
                  className="h-7 w-7 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                실시간 ETF 상승/하락 데이터 + 네이버 뉴스 + 시장 지표를 자동 수집하여 AI가 분석합니다.
                프롬프트를 수정하여 원하는 분석을 요청할 수 있습니다.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Textarea
                  value={analysisPrompt}
                  onChange={(e) => setAnalysisPrompt(e.target.value)}
                  placeholder="분석 요청 프롬프트를 입력하세요..."
                  className="min-h-[120px] text-sm pr-2 resize-y"
                  disabled={analyzeMutation.isPending}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">📈 ETF 상승/하락 데이터</span>
                  <span>+</span>
                  <span className="flex items-center gap-1">📰 실시간 뉴스</span>
                  <span>+</span>
                  <span className="flex items-center gap-1">📊 시장 지표</span>
                  <span className="text-muted-foreground/50">→ 자동 수집</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAnalysisPrompt(
                      `실시간 ETF 상승리스트, 네이버 실시간 뉴스(https://stock.naver.com/news), 네이버 마켓동향(https://stock.naver.com/market/stock/kr)을 참고하여 다음을 포함한 분석 보고서를 30줄 이상으로 요약 정리해줘:\n\n1. 오늘의 시장 개요 (코스피/코스닥 지수 동향)\n2. 주요 상승 섹터/테마 분석\n3. 뉴스·매크로 연관 분석\n4. 하락 섹터 동향\n5. 투자 시사점 및 주의사항`
                    )}
                    disabled={analyzeMutation.isPending}
                    className="h-8 text-xs"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    기본 프롬프트
                  </Button>
                  <Button
                    onClick={() => analyzeMutation.mutate(analysisPrompt)}
                    disabled={analyzeMutation.isPending || !analysisPrompt.trim()}
                    className="h-8 gap-1.5 px-4"
                  >
                    {analyzeMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        분석 중...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        실행
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 분석 진행 상태 */}
          {analyzeMutation.isPending && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">ETF 상승 트렌드를 AI가 분석하고 있습니다...</p>
                <p className="text-xs text-muted-foreground">상승/하락 ETF + 뉴스 + 매크로 데이터 수집 → AI 분석 중 (30초~1분 소요)</p>
              </CardContent>
            </Card>
          )}

          {/* 에러 표시 */}
          {analyzeMutation.isError && !analyzeMutation.isPending && (
            <Card className="border-destructive/50">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">분석 실패</p>
                  <p className="text-xs text-muted-foreground">{(analyzeMutation.error as Error)?.message}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => analyzeMutation.mutate(analysisPrompt)}
                  className="h-7 text-xs"
                >
                  다시 시도
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 분석 결과 표시 */}
          {analysisResult && !analyzeMutation.isPending && (
            <Card className="border-primary/20 bg-primary/[0.02]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    AI 트렌드 분석 보고서
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {analysisResult.analyzedAt}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAnalysisResult(null)}
                      className="h-7 text-xs"
                    >
                      닫기
                    </Button>
                  </div>
                </div>
                {analysisResult.dataPoints && (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                    <span>📈 상승 ETF {analysisResult.dataPoints.risingCount}개</span>
                    <span>📉 하락 ETF {analysisResult.dataPoints.fallingCount}개</span>
                    <span>📰 뉴스 {analysisResult.dataPoints.newsCount}건</span>
                    {analysisResult.dataPoints.market && <span>📊 {analysisResult.dataPoints.market}</span>}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                  {analysisResult.analysis.split("\n").map((line, i) => {
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
        </div>
      )}

      {componentData && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <p>데이터 출처: 네이버 금융 · FnGuide · 한국투자증권 API</p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(`https://www.etfcheck.co.kr/mobile/etpitem/${selectedEtfCode}/pdf`, "_blank")}
              className="text-xs gap-1 h-7"
            >
              <ExternalLink className="w-3 h-3" />
              etfcheck
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(`https://finance.naver.com/item/coinfo.naver?code=${selectedEtfCode}`, "_blank")}
              className="text-xs gap-1 h-7"
            >
              <ExternalLink className="w-3 h-3" />
              네이버금융
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
