/**
 * ETF 상세 정보 팝업 다이얼로그
 * - 실시간ETF, 신규ETF, 관심(Core/Satellite) 등에서 공통으로 사용
 * - ETF 구성종목, 요약 정보, 차트, 기간별 수익률을 보여줌
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  AlertCircle,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { EtfPerformanceTable } from "./EtfPerformanceTable";

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

type SortField = "weight" | "changePercent" | null;
type SortDirection = "asc" | "desc";

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

interface EtfDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  etfCode: string;
  etfName?: string;
}

export function EtfDetailDialog({ open, onOpenChange, etfCode, etfName }: EtfDetailDialogProps) {
  const [chartType, setChartType] = useState<"candle" | "area">("candle");
  const [chartPeriod, setChartPeriod] = useState<"day" | "week" | "month" | "year">("day");
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { data: componentData, isLoading, error, refetch, isFetching } = useQuery<EtfComponentResult>({
    queryKey: ["/api/etf/components", etfCode],
    queryFn: async () => {
      const res = await fetch(`/api/etf/components/${etfCode}`, { credentials: "include" });
      if (!res.ok) throw new Error("ETF 구성종목 조회 실패");
      return res.json();
    },
    enabled: open && !!etfCode && /^[0-9A-Za-z]{6}$/.test(etfCode),
    staleTime: 1000 * 60 * 2,
  });

  const displayName = componentData?.etfName || etfName || etfCode;

  // 통계
  const upCount = componentData?.components.filter(c => c.changeSign === "1" || c.changeSign === "2").length || 0;
  const downCount = componentData?.components.filter(c => c.changeSign === "4" || c.changeSign === "5").length || 0;
  const flatCount = (componentData?.components.length || 0) - upCount - downCount;
  const totalWeight = componentData?.components.reduce((s, c) => s + c.weight, 0) || 0;

  // 정렬
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />;
    return sortDirection === "desc" ? <ArrowDown className="w-3 h-3 text-primary" /> : <ArrowUp className="w-3 h-3 text-primary" />;
  };

  const sortedComponents = [...(componentData?.components || [])].sort((a, b) => {
    if (!sortField) return 0;
    const dir = sortDirection === "desc" ? -1 : 1;
    if (sortField === "weight") return (a.weight - b.weight) * dir;
    if (sortField === "changePercent") {
      const aVal = parseFloat(a.changePercent || "0");
      const bVal = parseFloat(b.changePercent || "0");
      return (aVal - bVal) * dir;
    }
    return 0;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-2 sticky top-0 bg-background z-10 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              {displayName}
              <span className="text-xs font-mono text-muted-foreground">({etfCode})</span>
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                새로고침
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => window.open(`https://finance.naver.com/item/main.naver?code=${etfCode}`, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="w-3 h-3" />
                네이버
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* 로딩 */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">구성종목 및 실시간 시세를 조회하고 있습니다...</p>
            </div>
          )}

          {/* 에러 */}
          {error && !isLoading && (
            <div className="text-center py-12">
              <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-semibold">조회 실패</h3>
              <p className="text-sm text-muted-foreground mt-1">{(error as Error)?.message || "구성종목을 불러올 수 없습니다."}</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-4">재시도</Button>
            </div>
          )}

          {/* 결과 */}
          {componentData && !isLoading && (
            <>
              {/* ETF 정보 요약 */}
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold flex items-center gap-2">
                      {componentData.etfName}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{componentData.etfCode}</span>
                      <span>구성종목 {componentData.totalComponentCount}개</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {componentData.updatedAt}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex items-center gap-1 text-red-500 font-medium">
                      <TrendingUp className="w-3.5 h-3.5" />
                      상승 {upCount}
                    </span>
                    <span className="text-muted-foreground">보합 {flatCount}</span>
                    <span className="flex items-center gap-1 text-blue-500 font-medium">
                      <TrendingDown className="w-3.5 h-3.5" />
                      하락 {downCount}
                    </span>
                  </div>
                </div>

                {/* 비중 상위 5개 비주얼 바 */}
                {componentData.components.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">비중 상위 종목</p>
                    <div className="flex rounded-lg overflow-hidden h-5">
                      {componentData.components.slice(0, 5).map((comp, i) => {
                        const widthPct = totalWeight > 0 ? (comp.weight / totalWeight) * 100 : 20;
                        const colors = ["bg-primary", "bg-blue-400", "bg-emerald-400", "bg-amber-400", "bg-purple-400"];
                        return (
                          <div
                            key={comp.stockCode || i}
                            className={`${colors[i]} flex items-center justify-center text-white text-[9px] font-medium truncate px-0.5`}
                            style={{ width: `${widthPct}%`, minWidth: "36px" }}
                            title={`${comp.stockName} ${comp.weight.toFixed(1)}%`}
                          >
                            {comp.stockName.length > 5 ? comp.stockName.slice(0, 5) + ".." : comp.stockName}
                            {" "}{comp.weight.toFixed(1)}%
                          </div>
                        );
                      })}
                      {totalWeight > 0 && (
                        <div
                          className="bg-muted flex items-center justify-center text-muted-foreground text-[9px] font-medium"
                          style={{ width: `${Math.max(0, 100 - componentData.components.slice(0, 5).reduce((s, c) => s + (c.weight / totalWeight) * 100, 0))}%`, minWidth: "28px" }}
                        >
                          기타
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 구성종목 테이블 */}
              {componentData.components.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10">
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[36px] text-center">#</TableHead>
                          <TableHead>종목명</TableHead>
                          <TableHead className="text-right w-[70px]">
                            <button
                              onClick={() => handleSort("weight")}
                              className={`inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer select-none ${sortField === "weight" ? "text-primary font-semibold" : ""}`}
                            >
                              비중(%)
                              {getSortIcon("weight")}
                            </button>
                          </TableHead>
                          <TableHead className="text-right w-[90px]">현재가</TableHead>
                          <TableHead className="text-right w-[80px]">
                            <button
                              onClick={() => handleSort("changePercent")}
                              className={`inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer select-none ${sortField === "changePercent" ? "text-primary font-semibold" : ""}`}
                            >
                              등락률
                              {getSortIcon("changePercent")}
                            </button>
                          </TableHead>
                          <TableHead className="text-right w-[70px]">전일대비</TableHead>
                          <TableHead className="text-right w-[90px] hidden sm:table-cell">거래량</TableHead>
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
                              className="hover:bg-muted/30 transition-colors cursor-pointer"
                              onClick={() => window.open(`https://finance.naver.com/item/main.naver?code=${comp.stockCode}`, "_blank", "noopener,noreferrer")}
                            >
                              <TableCell className="text-center font-medium text-muted-foreground text-xs">{index + 1}</TableCell>
                              <TableCell>
                                <div className="text-sm font-medium leading-tight">{comp.stockName}</div>
                                <div className="text-[10px] text-muted-foreground font-mono">{comp.stockCode}</div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(comp.weight, 100)}%` }} />
                                  </div>
                                  <span className="text-xs font-medium tabular-nums w-10 text-right">{comp.weight.toFixed(2)}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-semibold text-sm">
                                {comp.price ? parseInt(comp.price).toLocaleString() : "-"}
                              </TableCell>
                              <TableCell className={`text-right tabular-nums font-medium text-xs ${changeColor}`}>
                                {comp.changePercent ? (
                                  <span className="flex items-center justify-end gap-0.5">
                                    {changeIcon}
                                    {prefix}{Math.abs(parseFloat(comp.changePercent)).toFixed(2)}%
                                  </span>
                                ) : "-"}
                              </TableCell>
                              <TableCell className={`text-right tabular-nums text-xs ${changeColor}`}>
                                {comp.change ? <span>{prefix}{Math.abs(parseInt(comp.change)).toLocaleString()}</span> : "-"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-xs text-muted-foreground hidden sm:table-cell">
                                {comp.volume ? parseInt(comp.volume).toLocaleString() : "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  구성종목 데이터를 찾을 수 없습니다.
                </div>
              )}

              {/* 차트 */}
              <div className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    {displayName} 차트
                  </h4>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5 border rounded-md p-0.5">
                      <Button
                        variant={chartType === "candle" ? "default" : "ghost"}
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => setChartType("candle")}
                      >
                        봉차트
                      </Button>
                      <Button
                        variant={chartType === "area" ? "default" : "ghost"}
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => setChartType("area")}
                      >
                        영역차트
                      </Button>
                    </div>
                    <div className="flex gap-0.5">
                      {(["day", "week", "month", "year"] as const).map((period) => (
                        <Button
                          key={period}
                          variant={chartPeriod === period ? "default" : "outline"}
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => setChartPeriod(period)}
                        >
                          {{ day: "일봉", week: "주봉", month: "월봉", year: "연봉" }[period]}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <img
                    key={`${etfCode}-${chartType}-${chartPeriod}`}
                    src={`https://ssl.pstatic.net/imgfinance/chart/item/${chartType}/${chartPeriod}/${etfCode}.png`}
                    alt={`${displayName} ${chartPeriod} 차트`}
                    className="max-w-full h-auto rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              </div>

              {/* 기간별 수익률 */}
              <div className="border rounded-lg p-3">
                <EtfPerformanceTable etfCode={etfCode} enabled={open} />
              </div>

              {/* 외부 링크 */}
              <div className="flex items-center justify-center gap-2 text-xs">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => window.open(`https://finance.naver.com/item/main.naver?code=${etfCode}`, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="w-3 h-3" />
                  네이버 금융
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => window.open(`https://finance.naver.com/item/fchart.naver?code=${etfCode}`, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="w-3 h-3" />
                  네이버 상세차트
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    // ISIN 코드 생성
                    const base = `KR7${etfCode}00`;
                    let numStr = "";
                    for (const ch of base) {
                      if (ch >= "A" && ch <= "Z") numStr += (ch.charCodeAt(0) - 55).toString();
                      else numStr += ch;
                    }
                    let sum = 0;
                    for (let i = numStr.length - 1; i >= 0; i--) {
                      const pos = numStr.length - i;
                      let n = parseInt(numStr[i]);
                      if (pos % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
                      sum += n;
                    }
                    const checkDigit = (10 - (sum % 10)) % 10;
                    const isin = base + checkDigit;
                    window.open(`https://www.funetf.co.kr/product/etf/view/${isin}`, "_blank", "noopener,noreferrer");
                  }}
                >
                  <ExternalLink className="w-3 h-3" />
                  FunETF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    const base = `KR7${etfCode}00`;
                    let numStr = "";
                    for (const ch of base) {
                      if (ch >= "A" && ch <= "Z") numStr += (ch.charCodeAt(0) - 55).toString();
                      else numStr += ch;
                    }
                    let sum = 0;
                    for (let i = numStr.length - 1; i >= 0; i--) {
                      const pos = numStr.length - i;
                      let n = parseInt(numStr[i]);
                      if (pos % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
                      sum += n;
                    }
                    const checkDigit = (10 - (sum % 10)) % 10;
                    const isin = base + checkDigit;
                    window.open(`https://www.etfcheck.co.kr/mobile/etpitem/${isin}/pdf`, "_blank", "noopener,noreferrer");
                  }}
                >
                  <ExternalLink className="w-3 h-3" />
                  ETF Check
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

