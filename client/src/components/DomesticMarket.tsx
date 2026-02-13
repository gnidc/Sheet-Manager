import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  ShoppingCart,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";

// ===== 타입 정의 =====
interface IndexData {
  code: string;
  name: string;
  nowVal: number;
  changeVal: number;
  changeRate: number;
  quant: string;
  amount: string;
}

interface ChartPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
}

interface SectorData {
  name: string;
  code: string;
  changeRate: number;
  upCount: number;
  flatCount: number;
  downCount: number;
}

interface SectorStock {
  code: string;
  name: string;
  nowVal: number;
  changeVal: number;
  changeRate: number;
  volume: number;
  prevVolume: number;
  marketCap: number;
}

interface TopStock {
  code: string;
  name: string;
  nowVal: number;
  changeVal: number;
  changeRate: number;
  volume: number;
  prevVolume: number;
  amount: number;
  marketCap: number;
}

// ===== 지수 카드 컴포넌트 =====
function IndexCard({ index, chart }: { index: IndexData; chart: ChartPoint[] }) {
  const isUp = index.changeVal > 0;
  const isDown = index.changeVal < 0;
  const color = isUp ? "#ef4444" : isDown ? "#3b82f6" : "#6b7280";
  const bgColor = isUp ? "bg-red-50 dark:bg-red-950/20" : isDown ? "bg-blue-50 dark:bg-blue-950/20" : "bg-gray-50 dark:bg-gray-800/20";

  return (
    <Card className={`${bgColor} border-0 shadow-sm`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-muted-foreground">{index.name}</span>
          <span className="text-xs text-muted-foreground">{index.code}</span>
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-bold tabular-nums">
            {index.nowVal.toLocaleString(undefined, { minimumFractionDigits: index.nowVal < 1000 ? 2 : 0, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-sm font-semibold flex items-center gap-0.5`} style={{ color }}>
            {isUp ? <ArrowUpRight className="w-4 h-4" /> : isDown ? <ArrowDownRight className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
            {isUp ? "+" : ""}{index.changeVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {" "}({isUp ? "+" : ""}{index.changeRate.toFixed(2)}%)
          </span>
        </div>
        {/* 미니 차트 */}
        {chart.length > 0 && (
          <div className="h-[80px] -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${index.code}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={color}
                  strokeWidth={1.5}
                  fill={`url(#grad-${index.code})`}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
          <span>거래량 {index.quant}</span>
          <span>거래대금 {index.amount}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== 업종별 등락 바 컴포넌트 =====
function SectorHeatmap({
  sectors,
  selectedCode,
  onSelect,
}: {
  sectors: SectorData[];
  selectedCode: string | null;
  onSelect: (sector: SectorData) => void;
}) {
  const maxRate = Math.max(...sectors.map((s) => Math.abs(s.changeRate)), 1);

  return (
    <div className="space-y-1">
      {sectors.map((sector, i) => {
        const isUp = sector.changeRate > 0;
        const isDown = sector.changeRate < 0;
        const barWidth = Math.min(Math.abs(sector.changeRate) / maxRate * 100, 100);
        const color = isUp ? "bg-red-400 dark:bg-red-500" : isDown ? "bg-blue-400 dark:bg-blue-500" : "bg-gray-300 dark:bg-gray-600";
        const textColor = isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground";
        const isSelected = selectedCode === sector.code;

        return (
          <div
            key={i}
            className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded transition-colors cursor-pointer
              ${isSelected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/30"}`}
            onClick={() => onSelect(sector)}
          >
            <span className={`w-[90px] truncate font-medium shrink-0 ${isSelected ? "text-primary font-semibold" : ""}`}>{sector.name}</span>
            <div className="flex-1 flex items-center">
              {isDown && (
                <div className="flex-1 flex justify-end">
                  <div className={`h-4 rounded-l ${color} transition-all`} style={{ width: `${barWidth}%` }} />
                </div>
              )}
              <div className="w-px h-5 bg-border mx-0.5 shrink-0" />
              {(isUp || !isDown) && (
                <div className="flex-1">
                  <div className={`h-4 rounded-r ${color} transition-all`} style={{ width: isUp ? `${barWidth}%` : "0%" }} />
                </div>
              )}
            </div>
            <span className={`w-[52px] text-right font-medium tabular-nums shrink-0 ${textColor}`}>
              {isUp ? "+" : ""}{sector.changeRate.toFixed(2)}%
            </span>
            <span className="w-[50px] text-right text-muted-foreground tabular-nums shrink-0">
              <span className="text-red-400">{sector.upCount}</span>/<span className="text-blue-400">{sector.downCount}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ===== 메인 컴포넌트 =====
export default function DomesticMarket() {
  const [, navigate] = useLocation();
  const [topStockCategory, setTopStockCategory] = useState<"rise" | "fall" | "quant">("rise");
  const [topStockMarket, setTopStockMarket] = useState<"kospi" | "kosdaq">("kospi");
  const [selectedSector, setSelectedSector] = useState<SectorData | null>(null);
  const [checkedStocks, setCheckedStocks] = useState<Set<string>>(new Set());
  const [checkedTopStocks, setCheckedTopStocks] = useState<Set<string>>(new Set());

  // 1) 시장 지수
  const { data: indicesData, isFetching: isLoadingIndices, refetch: refetchIndices } = useQuery<{
    indices: IndexData[];
    charts: Record<string, ChartPoint[]>;
    updatedAt: string;
  }>({
    queryKey: ["/api/markets/domestic/indices"],
    queryFn: async () => {
      const res = await fetch("/api/markets/domestic/indices", { credentials: "include" });
      if (!res.ok) throw new Error("지수 조회 실패");
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  // 2) 업종별
  const { data: sectorsData, isFetching: isLoadingSectors, refetch: refetchSectors } = useQuery<{
    sectors: SectorData[];
    updatedAt: string;
  }>({
    queryKey: ["/api/markets/domestic/sectors"],
    queryFn: async () => {
      const res = await fetch("/api/markets/domestic/sectors", { credentials: "include" });
      if (!res.ok) throw new Error("업종별 조회 실패");
      return res.json();
    },
    staleTime: 3 * 60 * 1000,
  });

  // 3) 상위 종목
  const { data: topStocksData, isFetching: isLoadingTopStocks, refetch: refetchTopStocks } = useQuery<{
    stocks: TopStock[];
    category: string;
    market: string;
    updatedAt: string;
  }>({
    queryKey: ["/api/markets/domestic/top-stocks", topStockCategory, topStockMarket],
    queryFn: async () => {
      const res = await fetch(
        `/api/markets/domestic/top-stocks?category=${topStockCategory}&market=${topStockMarket}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("상위 종목 조회 실패");
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  // 4) 업종별 구성종목
  const { data: sectorStocksData, isFetching: isLoadingSectorStocks } = useQuery<{
    sectorName: string;
    sectorCode: string;
    stocks: SectorStock[];
    updatedAt: string;
  }>({
    queryKey: ["/api/markets/domestic/sector-stocks", selectedSector?.code],
    queryFn: async () => {
      const res = await fetch(`/api/markets/domestic/sector-stocks/${selectedSector?.code}`, { credentials: "include" });
      if (!res.ok) throw new Error("업종 구성종목 조회 실패");
      return res.json();
    },
    enabled: !!selectedSector?.code,
    staleTime: 60 * 1000,
  });

  const indices = indicesData?.indices || [];
  const charts = indicesData?.charts || {};
  const sectors = sectorsData?.sectors || [];
  const topStocks = topStocksData?.stocks || [];
  const sectorStocks = sectorStocksData?.stocks || [];

  // 업종 상승/하락 분리 (상위 10개만)
  const risingSectors = useMemo(() => sectors.filter((s) => s.changeRate > 0).slice(0, 10), [sectors]);
  const fallingSectors = useMemo(() => sectors.filter((s) => s.changeRate < 0).sort((a, b) => a.changeRate - b.changeRate).slice(0, 10), [sectors]);

  const handleSectorClick = (sector: SectorData) => {
    if (selectedSector?.code === sector.code) {
      setSelectedSector(null); // 토글: 같은 업종 다시 클릭하면 닫기
      setCheckedStocks(new Set());
    } else {
      setSelectedSector(sector);
      setCheckedStocks(new Set()); // 업종 변경 시 체크 초기화
    }
  };

  return (
    <div className="space-y-4">
      {/* ===== 1. 시장 지수 카드 ===== */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          🇰🇷 국내증시 대시보드
        </h2>
        <div className="flex items-center gap-2">
          {indicesData?.updatedAt && (
            <span className="text-xs text-muted-foreground">{indicesData.updatedAt}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { refetchIndices(); refetchSectors(); refetchTopStocks(); }}
            disabled={isLoadingIndices}
            className="h-7 w-7 p-0"
          >
            {isLoadingIndices ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {isLoadingIndices && indices.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {indices.map((idx) => (
            <IndexCard key={idx.code} index={idx} chart={charts[idx.code] || []} />
          ))}
        </div>
      )}

      {/* ===== 2. 업종별 등락 현황 ===== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              업종별 등락 현황
              <span className="text-xs font-normal text-muted-foreground">(상위 10개 업종 · 전체 {sectors.length}개)</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              {sectorsData?.updatedAt && (
                <span className="text-xs text-muted-foreground">{sectorsData.updatedAt}</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchSectors()}
                disabled={isLoadingSectors}
                className="h-7 w-7 p-0"
              >
                {isLoadingSectors ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />상승 {risingSectors.length}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />하락 {fallingSectors.length}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" />보합 {sectors.length - risingSectors.length - fallingSectors.length}</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoadingSectors && sectors.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : sectors.length > 0 ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">💡 업종을 클릭하면 주요 구성종목이 아래에 표시됩니다</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 상승 업종 */}
                <div>
                  <div className="text-xs font-medium text-red-500 mb-2 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> 상승 업종 TOP {risingSectors.length}
                  </div>
                  <SectorHeatmap sectors={risingSectors} selectedCode={selectedSector?.code || null} onSelect={handleSectorClick} />
                </div>
                {/* 하락 업종 */}
                <div>
                  <div className="text-xs font-medium text-blue-500 mb-2 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> 하락 업종 TOP {fallingSectors.length}
                  </div>
                  <SectorHeatmap sectors={fallingSectors} selectedCode={selectedSector?.code || null} onSelect={handleSectorClick} />
                </div>
              </div>

              {/* ===== 선택된 업종의 구성종목 ===== */}
              {selectedSector && (
                <div className="mt-2 border rounded-lg overflow-hidden bg-muted/20">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">📋 {selectedSector.name}</span>
                      <span className={`text-xs font-medium ${selectedSector.changeRate > 0 ? "text-red-500" : selectedSector.changeRate < 0 ? "text-blue-500" : "text-muted-foreground"}`}>
                        ({selectedSector.changeRate > 0 ? "+" : ""}{selectedSector.changeRate.toFixed(2)}%)
                      </span>
                      <span className="text-xs text-muted-foreground">구성종목</span>
                      {checkedStocks.size > 0 && (
                        <Button
                          variant="default"
                          size="sm"
                          className="h-6 text-xs px-3 gap-1 bg-red-500 hover:bg-red-600 text-white ml-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            // 선택된 첫번째 종목으로 자동매매 주문 화면 이동
                            const firstCode = Array.from(checkedStocks)[0];
                            const stock = sectorStocks.find(s => s.code === firstCode);
                            if (stock) {
                              navigate(`/trading?code=${stock.code}&name=${encodeURIComponent(stock.name)}`);
                            }
                          }}
                        >
                          <ShoppingCart className="w-3 h-3" />
                          매수 ({checkedStocks.size})
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {checkedStocks.size > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => setCheckedStocks(new Set())}
                        >
                          선택해제
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => { setSelectedSector(null); setCheckedStocks(new Set()); }}
                      >
                        ✕ 닫기
                      </Button>
                    </div>
                  </div>
                  {isLoadingSectorStocks ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="ml-2 text-sm text-muted-foreground">구성종목 로딩 중...</span>
                    </div>
                  ) : sectorStocks.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="w-[36px] text-center text-xs">
                              <Checkbox
                                checked={sectorStocks.slice(0, 15).every(s => checkedStocks.has(s.code)) && sectorStocks.slice(0, 15).length > 0}
                                onCheckedChange={(checked) => {
                                  const newSet = new Set(checkedStocks);
                                  sectorStocks.slice(0, 15).forEach(s => {
                                    if (checked) newSet.add(s.code);
                                    else newSet.delete(s.code);
                                  });
                                  setCheckedStocks(newSet);
                                }}
                                className="w-3.5 h-3.5"
                              />
                            </TableHead>
                            <TableHead className="text-xs">종목명</TableHead>
                            <TableHead className="text-right text-xs w-[85px]">현재가</TableHead>
                            <TableHead className="text-right text-xs w-[70px]">전일대비</TableHead>
                            <TableHead className="text-right text-xs w-[65px]">등락률</TableHead>
                            <TableHead className="text-right text-xs w-[90px] hidden sm:table-cell">거래량</TableHead>
                            <TableHead className="text-right text-xs w-[80px] hidden lg:table-cell">시가총액(억)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sectorStocks.slice(0, 15).map((stock, i) => {
                            const isUp = stock.changeVal > 0;
                            const isDown = stock.changeVal < 0;
                            const changeColor = isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground";
                            const isChecked = checkedStocks.has(stock.code);
                            return (
                              <TableRow
                                key={stock.code || i}
                                className={`hover:bg-muted/30 ${isChecked ? "bg-primary/5" : ""}`}
                              >
                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      const newSet = new Set(checkedStocks);
                                      if (checked) newSet.add(stock.code);
                                      else newSet.delete(stock.code);
                                      setCheckedStocks(newSet);
                                    }}
                                    className="w-3.5 h-3.5"
                                  />
                                </TableCell>
                                <TableCell
                                  className="cursor-pointer"
                                  onClick={() => {
                                    if (stock.code) window.open(`https://finance.naver.com/item/main.naver?code=${stock.code}`, "_blank");
                                  }}
                                >
                                  <div className="text-sm font-medium hover:text-primary hover:underline">{stock.name}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono">{stock.code}</div>
                                </TableCell>
                                <TableCell className="text-right text-sm font-semibold tabular-nums">
                                  {stock.nowVal.toLocaleString()}
                                </TableCell>
                                <TableCell className={`text-right text-xs tabular-nums ${changeColor}`}>
                                  {isUp ? "+" : ""}{stock.changeVal.toLocaleString()}
                                </TableCell>
                                <TableCell className={`text-right text-xs font-medium tabular-nums ${changeColor}`}>
                                  <span className="flex items-center justify-end gap-0.5">
                                    {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : null}
                                    {isUp ? "+" : ""}{stock.changeRate.toFixed(2)}%
                                  </span>
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums text-muted-foreground hidden sm:table-cell">
                                  {stock.volume.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums text-muted-foreground hidden lg:table-cell">
                                  {stock.marketCap.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-6">구성종목 데이터를 불러올 수 없습니다.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">업종 데이터를 불러올 수 없습니다.</p>
          )}
        </CardContent>
      </Card>

      {/* ===== 3. 상위 종목 ===== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                종목 순위
              </CardTitle>
              {checkedTopStocks.size > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-6 text-xs px-3 gap-1 bg-red-500 hover:bg-red-600 text-white"
                  onClick={() => {
                    const firstCode = Array.from(checkedTopStocks)[0];
                    const stock = topStocks.find(s => s.code === firstCode);
                    if (stock) {
                      navigate(`/trading?code=${stock.code}&name=${encodeURIComponent(stock.name)}`);
                    }
                  }}
                >
                  <ShoppingCart className="w-3 h-3" />
                  매수 ({checkedTopStocks.size})
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {checkedTopStocks.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => setCheckedTopStocks(new Set())}
                >
                  선택해제
                </Button>
              )}
              {topStocksData?.updatedAt && (
                <span className="text-xs text-muted-foreground">{topStocksData.updatedAt}</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchTopStocks()}
                disabled={isLoadingTopStocks}
                className="h-7 w-7 p-0"
              >
                {isLoadingTopStocks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
          {/* 필터 */}
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <div className="flex gap-1">
              {(
                [
                  { key: "rise", label: "상승률" },
                  { key: "fall", label: "하락률" },
                  { key: "quant", label: "거래량" },
                ] as const
              ).map(({ key, label }) => (
                <Button
                  key={key}
                  variant={topStockCategory === key ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setTopStockCategory(key); setCheckedTopStocks(new Set()); }}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="w-px h-5 bg-border" />
            <div className="flex gap-1">
              {(
                [
                  { key: "kospi", label: "코스피" },
                  { key: "kosdaq", label: "코스닥" },
                ] as const
              ).map(({ key, label }) => (
                <Button
                  key={key}
                  variant={topStockMarket === key ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setTopStockMarket(key); setCheckedTopStocks(new Set()); }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingTopStocks && topStocks.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : topStocks.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[36px] text-center text-xs">
                      <Checkbox
                        checked={topStocks.length > 0 && topStocks.every(s => checkedTopStocks.has(s.code))}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(checkedTopStocks);
                          topStocks.forEach(s => {
                            if (checked) newSet.add(s.code);
                            else newSet.delete(s.code);
                          });
                          setCheckedTopStocks(newSet);
                        }}
                        className="w-3.5 h-3.5"
                      />
                    </TableHead>
                    <TableHead className="text-xs">종목명</TableHead>
                    <TableHead className="text-right text-xs w-[85px]">현재가</TableHead>
                    <TableHead className="text-right text-xs w-[70px]">전일대비</TableHead>
                    <TableHead className="text-right text-xs w-[65px]">등락률</TableHead>
                    <TableHead className="text-right text-xs w-[90px] hidden sm:table-cell">거래량</TableHead>
                    <TableHead className="text-right text-xs w-[80px] hidden md:table-cell">거래대금(백만)</TableHead>
                    <TableHead className="text-right text-xs w-[80px] hidden lg:table-cell">시가총액(억)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topStocks.map((stock, i) => {
                    const isUp = stock.changeVal > 0;
                    const isDown = stock.changeVal < 0;
                    const changeColor = isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground";
                    const isTopChecked = checkedTopStocks.has(stock.code);
                    return (
                      <TableRow
                        key={stock.code || i}
                        className={`hover:bg-muted/30 ${isTopChecked ? "bg-primary/5" : ""}`}
                      >
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isTopChecked}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(checkedTopStocks);
                              if (checked) newSet.add(stock.code);
                              else newSet.delete(stock.code);
                              setCheckedTopStocks(newSet);
                            }}
                            className="w-3.5 h-3.5"
                          />
                        </TableCell>
                        <TableCell
                          className="cursor-pointer"
                          onClick={() => {
                            if (stock.code) window.open(`https://finance.naver.com/item/main.naver?code=${stock.code}`, "_blank");
                          }}
                        >
                          <div className="text-sm font-medium hover:text-primary hover:underline">{stock.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{stock.code}</div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums">
                          {stock.nowVal.toLocaleString()}
                        </TableCell>
                        <TableCell className={`text-right text-xs tabular-nums ${changeColor}`}>
                          {isUp ? "+" : ""}{stock.changeVal.toLocaleString()}
                        </TableCell>
                        <TableCell className={`text-right text-xs font-semibold tabular-nums ${changeColor}`}>
                          <span className="flex items-center justify-end gap-0.5">
                            {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : null}
                            {isUp ? "+" : ""}{stock.changeRate.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground hidden sm:table-cell">
                          {stock.volume.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground hidden md:table-cell">
                          {stock.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground hidden lg:table-cell">
                          {stock.marketCap.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">데이터를 불러올 수 없습니다.</p>
          )}
        </CardContent>
      </Card>

      {/* ===== 4. 외부 링크 바로가기 ===== */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-muted-foreground mr-1">📌 바로가기</span>
            {[
              { label: "코스피", url: "https://finance.naver.com/sise/sise_index.naver?code=KOSPI" },
              { label: "코스닥", url: "https://finance.naver.com/sise/sise_index.naver?code=KOSDAQ" },
              { label: "업종별", url: "https://finance.naver.com/sise/sise_group.naver?type=upjong" },
              { label: "투자자별", url: "https://finance.naver.com/sise/investorDealTrendDay.naver" },
              { label: "거래량 상위", url: "https://finance.naver.com/sise/sise_quant.naver" },
              { label: "시가총액", url: "https://finance.naver.com/sise/sise_market_sum.naver" },
            ].map(({ label, url }) => (
              <Button
                key={label}
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
              >
                {label}
                <ExternalLink className="w-2.5 h-2.5" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

