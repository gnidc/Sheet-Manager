import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
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

// 인기 ETF 목록 (빠른 선택용)
const POPULAR_ETFS = [
  { code: "069500", name: "KODEX 200" },
  { code: "229200", name: "KODEX 코스닥150" },
  { code: "102110", name: "TIGER 200" },
  { code: "371460", name: "TIGER S&P500" },
  { code: "381170", name: "TIGER 미국나스닥100" },
  { code: "379810", name: "KODEX 미국S&P500TR" },
  { code: "133690", name: "TIGER 미국나스닥100" },
  { code: "305720", name: "KODEX 2차전지산업" },
  { code: "091160", name: "KODEX 반도체" },
  { code: "091180", name: "TIGER 반도체" },
  { code: "364690", name: "KODEX Fn반도체" },
  { code: "466920", name: "TIGER 미국테크TOP10" },
];

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
    enabled: !!selectedEtfCode && /^\d{6}$/.test(selectedEtfCode),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const handleSearch = () => {
    const trimmed = searchTerm.trim();
    if (/^\d{6}$/.test(trimmed)) {
      setSelectedEtfCode(trimmed);
    } else if (combinedResults.length === 1) {
      // 검색 결과가 1개이면 자동 선택
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

  // 검색 결과와 인기 ETF 결합
  const combinedResults = useMemo(() => {
    if (searchTerm.trim().length < 2) return [];
    const term = searchTerm.trim().toLowerCase();

    // API 검색 결과 (전체 거래소 ETF에서 검색)
    const apiResults = (searchResults?.results || []).map((r: any) => ({
      code: r.code,
      name: r.name,
    }));

    // 인기 ETF 중 매칭되는 항목 (API 결과에 없는 것만)
    const popularMatches = POPULAR_ETFS.filter(
      e =>
        (e.code.includes(term) || e.name.toLowerCase().includes(term)) &&
        !apiResults.some((r: any) => r.code === e.code)
    );

    // 인기 ETF 매칭 결과를 먼저, 그 뒤에 API 결과
    return [...popularMatches, ...apiResults].slice(0, 20);
  }, [searchTerm, searchResults]);

  // 정렬 토글 핸들러: 클릭할 때마다 내림차순 ↔ 오름차순 토글
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // 같은 필드 클릭: 방향 토글
      setSortDirection(prev => prev === "desc" ? "asc" : "desc");
    } else {
      // 새 필드: 내림차순(높은 값 먼저)부터 시작
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // 정렬된 구성종목 리스트
  const sortedComponents = useMemo(() => {
    if (!componentData?.components) return [];
    if (!sortField) return componentData.components; // 기본 순서 (비중 내림차순)

    return [...componentData.components].sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (sortField === "weight") {
        valA = a.weight;
        valB = b.weight;
      } else if (sortField === "changePercent") {
        // 등락률을 부호 포함 숫자로 변환
        // changeSign: 1,2 = 상승(+), 4,5 = 하락(-), 3 = 보합(0)
        const getSignedPercent = (c: EtfComponentStock) => {
          if (!c.changePercent) return -Infinity; // 데이터 없는 항목은 항상 맨 뒤
          const pct = parseFloat(c.changePercent);
          if (c.changeSign === "4" || c.changeSign === "5") return -pct;
          return pct;
        };
        valA = getSignedPercent(a);
        valB = getSignedPercent(b);
      }

      // -Infinity 항목은 항상 맨 뒤로 (정렬 방향 무관)
      if (valA === -Infinity && valB === -Infinity) return 0;
      if (valA === -Infinity) return 1;
      if (valB === -Infinity) return -1;

      return sortDirection === "desc" ? valB - valA : valA - valB;
    });
  }, [componentData?.components, sortField, sortDirection]);

  // 정렬 아이콘 렌더링
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />;
    if (sortDirection === "desc") return <ArrowDown className="w-3 h-3 text-primary" />;
    return <ArrowUp className="w-3 h-3 text-primary" />;
  };

  // 비중 상위 종목의 비중 합계
  const totalWeight = componentData?.components.reduce((sum, c) => sum + c.weight, 0) || 0;
  // 상승/하락 종목 수
  const upCount = componentData?.components.filter(c => c.changeSign === "1" || c.changeSign === "2").length || 0;
  const downCount = componentData?.components.filter(c => c.changeSign === "4" || c.changeSign === "5").length || 0;
  const flatCount = (componentData?.totalComponentCount || 0) - upCount - downCount;

  return (
    <div className="space-y-6">
      {/* 검색 영역 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <PieChart className="w-5 h-5 text-primary" />
            ETF 구성종목 실시간 시세
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            ETF 코드 또는 이름을 검색하여 구성종목의 실시간 시세를 확인하세요
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
                  // 검색어 변경 시 선택 해제 (새로운 검색 가능)
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

          {/* 인기 ETF 빠른 선택 */}
          {!selectedEtfCode && searchTerm.length < 2 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">인기 ETF 빠른 검색</p>
              <div className="flex flex-wrap gap-2">
                {POPULAR_ETFS.map((etf) => (
                  <Button
                    key={etf.code}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectEtf(etf.code)}
                    className="text-xs gap-1.5 h-8"
                  >
                    <span className="font-mono text-muted-foreground">{etf.code}</span>
                    <span>{etf.name}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 로딩 */}
      {isLoading && selectedEtfCode && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">구성종목 및 실시간 시세를 조회하고 있습니다...</p>
          <p className="text-xs text-muted-foreground">KIS API에서 각 종목의 현재가를 가져옵니다 (약 10~20초)</p>
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
                  {/* 상승/하락 요약 */}
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

          {/* 하단 안내 */}
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
        </>
      )}
    </div>
  );
}

