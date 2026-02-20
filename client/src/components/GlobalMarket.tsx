/**
 * 해외증시 대시보드
 * - 주요 해외 지수 (미국, 일본, 중국, 유럽) + 미니 차트
 * - 미국 시가총액 상위 종목
 * - 오늘의 환율 현황
 * - 글로벌 뉴스
 * 
 * 참고: https://stock.naver.com/market/stock/usa
 */

// GlobalMarket - 해외증시 대시보드
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2,
  RefreshCw,
  Minus,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Globe,
  DollarSign,
  Newspaper,
} from "lucide-react";
// ===== 타입 =====
interface GlobalIndex {
  code: string;
  name: string;
  market: string;
  nowVal: number;
  changeVal: number;
  changeRate: number;
  quant: string;
  amount: string;
  marketStatus?: string;
  chartImageUrl?: string;
  tradedAt?: string;
}

interface GlobalStock {
  code: string;
  name: string;
  nameEn: string;
  nowVal: number;
  changeVal: number;
  changeRate: number;
  volume: number;
  marketCap: string;
}

interface ExchangeRate {
  name: string;
  value: number;
  change: number;
  changeRate: number;
}

interface GlobalNews {
  title: string;
  url: string;
  date: string;
}

// ===== 지수 카드 =====
function GlobalIndexCard({ index }: { index: GlobalIndex }) {
  const isUp = index.changeVal > 0;
  const isDown = index.changeVal < 0;
  const color = isUp ? "#ef4444" : isDown ? "#3b82f6" : "#6b7280";
  const bgColor = isUp ? "bg-red-50 dark:bg-red-950/20" : isDown ? "bg-blue-50 dark:bg-blue-950/20" : "bg-gray-50 dark:bg-gray-800/20";

  const marketFlags: Record<string, string> = {
    us: "🇺🇸",
    jp: "🇯🇵",
    cn: "🇨🇳",
    eu: "🇪🇺",
  };

  const formatTradedAt = (tradedAt: string) => {
    if (!tradedAt) return "";
    try {
      const d = new Date(tradedAt);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} 기준`;
    } catch {
      return "";
    }
  };

  return (
    <Card className={`${bgColor} border-0 shadow-sm`}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            {marketFlags[index.market] || "🌐"} {index.name}
          </span>
          {index.marketStatus && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {index.marketStatus}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xl sm:text-2xl font-bold tabular-nums">
            {index.nowVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-sm font-semibold flex items-center gap-0.5" style={{ color }}>
            {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : isDown ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            {Math.abs(index.changeVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {" "}{isUp ? "+" : ""}{index.changeRate.toFixed(2)}%
          </span>
        </div>
        {index.chartImageUrl && (
          <div className="mt-1 -mx-1 rounded overflow-hidden bg-white">
            <img
              src={index.chartImageUrl}
              alt={`${index.name} 차트`}
              className="w-full h-auto"
              loading="lazy"
            />
          </div>
        )}
        {index.tradedAt && (
          <div className="text-[10px] text-muted-foreground text-center mt-1">
            {formatTradedAt(index.tradedAt)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===== 환율 카드 =====
function ExchangeRateCard({ rate }: { rate: ExchangeRate }) {
  const isUp = rate.change > 0;
  const isDown = rate.change < 0;
  const color = isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground";

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
      <span className="text-sm font-medium truncate flex-1">{rate.name}</span>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-bold tabular-nums">{rate.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <span className={`text-xs font-medium tabular-nums flex items-center gap-0.5 w-[80px] justify-end ${color}`}>
          {isUp ? <ArrowUpRight className="w-3 h-3" /> : isDown ? <ArrowDownRight className="w-3 h-3" /> : null}
          {isUp ? "+" : ""}{rate.change.toFixed(2)}
          <span className="text-[10px] opacity-70">({isUp ? "+" : ""}{rate.changeRate.toFixed(2)}%)</span>
        </span>
      </div>
    </div>
  );
}

// ===== 메인 컴포넌트 =====
export default function GlobalMarket() {
  // 1) 주요 해외 지수
  const { data: indicesData, isLoading: isLoadingIndices, refetch: refetchIndices } = useQuery<{
    indices: GlobalIndex[];
    updatedAt: string;
  }>({
    queryKey: ["/api/markets/global/indices"],
    queryFn: async () => {
      const res = await fetch("/api/markets/global/indices");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });

  const indices = indicesData?.indices || [];

  // 2) 미국 종목 순위
  const { data: topStocksData, isLoading: isLoadingStocks, refetch: refetchStocks } = useQuery<{
    stocks: GlobalStock[];
    updatedAt: string;
  }>({
    queryKey: ["/api/markets/global/top-stocks"],
    queryFn: async () => {
      const res = await fetch("/api/markets/global/top-stocks?category=marketCap&market=NASDAQ");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 120000,
  });

  const topStocks = topStocksData?.stocks || [];

  // 3) 환율 현황
  const { data: ratesData, isLoading: isLoadingRates, refetch: refetchRates } = useQuery<{
    rates: ExchangeRate[];
    updatedAt: string;
  }>({
    queryKey: ["/api/markets/global/exchange-rates"],
    queryFn: async () => {
      const res = await fetch("/api/markets/global/exchange-rates");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 300000,
  });

  const rates = ratesData?.rates || [];

  // 4) 글로벌 뉴스
  const { data: newsData, isLoading: isLoadingNews } = useQuery<{
    news: GlobalNews[];
    updatedAt: string;
  }>({
    queryKey: ["/api/markets/global/news"],
    queryFn: async () => {
      const res = await fetch("/api/markets/global/news");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 300000,
  });

  const news = newsData?.news || [];

  // 미국 지수 (차트 있는 것만 상단)
  const usIndices = indices.filter(idx => idx.market === "us");
  const otherIndices = indices.filter(idx => idx.market !== "us");

  return (
    <div className="space-y-6">
      {/* ===== 제목 ===== */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">해외증시</h2>
          {indicesData?.updatedAt && (
            <span className="text-xs text-muted-foreground ml-2">{indicesData.updatedAt} 기준</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { refetchIndices(); refetchStocks(); refetchRates(); }}
          disabled={isLoadingIndices}
          className="h-7 w-7 p-0"
        >
          {isLoadingIndices ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* ===== 1. 미국 주요 지수 (차트 포함) ===== */}
      {isLoadingIndices && indices.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* 미국 지수 카드 (차트 포함) */}
          <div>
            <div className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              🇺🇸 미국 주요 지수
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {usIndices.map((idx) => (
                <GlobalIndexCard key={idx.code} index={idx} />
              ))}
            </div>
          </div>

          {/* 기타 글로벌 지수 */}
          {otherIndices.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                🌐 글로벌 지수
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {otherIndices.map((idx) => (
                  <GlobalIndexCard key={idx.code} index={idx} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== 2. 미국 시가총액 상위 종목 ===== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              미국 시가총액 상위 종목
            </CardTitle>
            <div className="flex items-center gap-2">
              {topStocksData?.updatedAt && (
                <span className="text-xs text-muted-foreground">{topStocksData.updatedAt}</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchStocks()}
                disabled={isLoadingStocks}
                className="h-7 w-7 p-0"
              >
                {isLoadingStocks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoadingStocks && topStocks.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : topStocks.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs w-[40px]">#</TableHead>
                    <TableHead className="text-xs">종목명</TableHead>
                    <TableHead className="text-right text-xs w-[90px]">현재가($)</TableHead>
                    <TableHead className="text-right text-xs w-[70px]">전일대비</TableHead>
                    <TableHead className="text-right text-xs w-[65px]">등락률</TableHead>
                    <TableHead className="text-right text-xs w-[100px] hidden sm:table-cell">거래량</TableHead>
                    <TableHead className="text-right text-xs w-[100px] hidden md:table-cell">시가총액</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topStocks.map((stock, i) => {
                    const isUp = stock.changeVal > 0;
                    const isDown = stock.changeVal < 0;
                    const changeColor = isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground";
                    return (
                      <TableRow key={stock.code || i} className="hover:bg-muted/30">
                        <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <a
                              href={stock.code ? `https://stock.naver.com/worldstock/stock/${stock.code}.O/price` : "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary hover:underline"
                            >
                              <div className="text-sm font-medium">{stock.name}</div>
                              {stock.nameEn && stock.nameEn !== stock.name && (
                                <div className="text-[10px] text-muted-foreground">{stock.nameEn}</div>
                              )}
                            </a>
                            <button
                              className="inline-flex items-center px-1 py-0 text-[9px] text-red-500 hover:text-red-700 border border-red-300 hover:border-red-500 rounded shrink-0 leading-tight"
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = `/stock-detail?code=${stock.code}&name=${encodeURIComponent(stock.name)}&market=overseas&exchange=NASDAQ`;
                                window.open(url, `stock_${stock.code}`, "width=1000,height=800,scrollbars=yes,resizable=yes");
                              }}
                              title="상세보기"
                            >
                              상세
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums">
                          ${stock.nowVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className={`text-right text-xs tabular-nums ${changeColor}`}>
                          {isUp ? "+" : ""}{stock.changeVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className={`text-right text-xs font-semibold tabular-nums ${changeColor}`}>
                          {isUp ? "+" : ""}{stock.changeRate.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground hidden sm:table-cell">
                          {stock.volume > 0 ? stock.volume.toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground hidden md:table-cell">
                          {stock.marketCap || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">종목 데이터를 불러올 수 없습니다</div>
          )}
        </CardContent>
      </Card>

      {/* ===== 하단: 환율 + 뉴스 2열 레이아웃 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 환율 현황 */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                오늘의 환율 현황
              </CardTitle>
              <div className="flex items-center gap-2">
                {ratesData?.updatedAt && (
                  <span className="text-xs text-muted-foreground">{ratesData.updatedAt}</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchRates()}
                  disabled={isLoadingRates}
                  className="h-7 w-7 p-0"
                >
                  {isLoadingRates ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingRates && rates.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : rates.length > 0 ? (
              <div className="divide-y">
                {rates.map((rate, i) => (
                  <ExchangeRateCard key={i} rate={rate} />
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">환율 데이터를 불러올 수 없습니다</div>
            )}
          </CardContent>
        </Card>

        {/* 글로벌 뉴스 */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-orange-500" />
                최신 글로벌 뉴스
              </CardTitle>
              {newsData?.updatedAt && (
                <span className="text-xs text-muted-foreground">{newsData.updatedAt}</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingNews && news.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : news.length > 0 ? (
              <div className="space-y-0.5">
                {news.map((item, i) => (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 py-2 px-2 rounded hover:bg-muted/40 transition-colors group"
                  >
                    <span className="text-xs text-muted-foreground font-mono mt-0.5 shrink-0 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground group-hover:text-primary line-clamp-2 leading-snug">
                        {item.title}
                      </p>
                      {item.date && (
                        <span className="text-[10px] text-muted-foreground mt-0.5 block">{item.date}</span>
                      )}
                    </div>
                    <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-1" />
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">뉴스를 불러올 수 없습니다</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

