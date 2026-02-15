/**
 * MarketCalendar - 증시 캘린더 (경제일정, IPO, 외부 링크)
 * - Investing.com 기반 경제지표 발표 일정
 * - 38.co.kr 기반 IPO 일정
 * - 외부 링크 바로가기
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, Calendar, RefreshCw, Star, Globe, TrendingUp, BarChart3, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CalendarEvent {
  date: string;
  time: string;
  country: string;
  event: string;
  importance: number;
  actual: string;
  forecast: string;
  previous: string;
}

interface IpoItem {
  name: string;
  schedule: string;
  price: string;
  exchange: string;
  url: string;
}

interface DividendStock {
  code: string;
  name: string;
  market: string;
  closePrice: string;
  change: string;
  changeRate: string;
  changeSign: string;
  eps: string;
  per: string;
  bps: string;
  pbr: string;
  dps: string;
  dividendYield: string;
}

// 국가별 플래그 이모지
const countryFlags: Record<string, string> = {
  "한국": "🇰🇷",
  "미국": "🇺🇸",
  "일본": "🇯🇵",
  "중국": "🇨🇳",
  "영국": "🇬🇧",
  "독일": "🇩🇪",
  "EU": "🇪🇺",
  "프랑스": "🇫🇷",
  "유럽연합": "🇪🇺",
};

// 중요도 별 표시
function ImportanceStars({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i <= level ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
        />
      ))}
    </span>
  );
}

export default function MarketCalendar() {
  const [activeTab, setActiveTab] = useState("economic");

  // 경제 캘린더 데이터
  const { data: calendarData, isLoading: isLoadingCalendar, refetch: refetchCalendar } = useQuery<{
    events: Record<string, CalendarEvent[]>;
    totalEvents: number;
    dateRange: { from: string; to: string };
    updatedAt: string;
  }>({
    queryKey: ["/api/markets/economic-calendar"],
    queryFn: async () => {
      const res = await fetch("/api/markets/economic-calendar?days=14");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 600000, // 10분
  });

  // IPO 일정 데이터
  const { data: ipoData, isLoading: isLoadingIpo, refetch: refetchIpo } = useQuery<{
    ipos: IpoItem[];
    updatedAt: string;
  }>({
    queryKey: ["/api/markets/ipo-schedule"],
    queryFn: async () => {
      const res = await fetch("/api/markets/ipo-schedule");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 600000,
  });

  // 배당 데이터
  const { data: dividendData, isLoading: isLoadingDividend, refetch: refetchDividend } = useQuery<{
    stocks: DividendStock[];
    tradingDate: string;
    totalCount: number;
    updatedAt: string;
  }>({
    queryKey: ["/api/markets/dividend-calendar"],
    queryFn: async () => {
      const res = await fetch("/api/markets/dividend-calendar");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 600000,
  });

  const events = calendarData?.events || {};
  const ipos = ipoData?.ipos || [];
  const dividendStocks = dividendData?.stocks || [];
  const dateEntries = Object.entries(events);

  const quickLinks = [
    { label: "Investing.com 경제캘린더", url: "https://kr.investing.com/economic-calendar/", icon: "📊" },
    { label: "네이버 해외증시", url: "https://finance.naver.com/world/", icon: "🌍" },
    { label: "38커뮤니케이션 IPO", url: "https://www.38.co.kr/html/fund/index.htm?o=k", icon: "📋" },
    { label: "KRX 배당정보", url: "https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201030104", icon: "💰" },
    { label: "KRX 한국거래소", url: "https://kind.krx.co.kr/main.do", icon: "🏛️" },
    { label: "네이버 시장지표", url: "https://finance.naver.com/marketindex/", icon: "📈" },
    { label: "FRED 경제데이터", url: "https://fred.stlouisfed.org/", icon: "🇺🇸" },
  ];

  return (
    <div className="space-y-4">
      {/* 제목 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          📅 증시캘린더
        </h2>
        <div className="flex items-center gap-2">
          {calendarData?.updatedAt && (
            <span className="text-xs text-muted-foreground">{calendarData.updatedAt}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => { refetchCalendar(); refetchIpo(); refetchDividend(); }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* 바로가기 링크 */}
      <div>
        <div className="p-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-muted-foreground mr-1">📌 바로가기</span>
            {quickLinks.map(({ label, url, icon }) => (
              <Button
                key={label}
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
              >
                {icon} {label}
                <ExternalLink className="w-2.5 h-2.5" />
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* 탭 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="economic" className="text-xs py-1.5 gap-1">
            <Globe className="w-3.5 h-3.5" />
            경제지표
          </TabsTrigger>
          <TabsTrigger value="dividend" className="text-xs py-1.5 gap-1">
            <DollarSign className="w-3.5 h-3.5" />
            배당일정
          </TabsTrigger>
          <TabsTrigger value="ipo" className="text-xs py-1.5 gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            IPO 일정
          </TabsTrigger>
        </TabsList>

        {/* 경제지표 일정 */}
        <TabsContent value="economic">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  주요 경제지표 발표 일정
                  <span className="text-xs text-muted-foreground font-normal">
                    (향후 2주, 한국·미국·일본·중국·유럽)
                  </span>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoadingCalendar ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : dateEntries.length > 0 ? (
                <div className="space-y-3">
                  {dateEntries.map(([date, dayEvents]) => (
                    <div key={date}>
                      {/* 날짜 헤더 */}
                      <div className="flex items-center gap-2 mb-1.5 sticky top-0 bg-background py-1">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        <span className="text-sm font-semibold text-primary">{date}</span>
                        <Badge variant="secondary" className="text-[10px] h-4">
                          {dayEvents.length}건
                        </Badge>
                      </div>

                      {/* 이벤트 목록 */}
                      <div className="space-y-0.5 ml-1">
                        {dayEvents.map((ev, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/40 transition-colors text-xs"
                          >
                            {/* 시간 */}
                            <span className="w-14 shrink-0 text-muted-foreground font-mono text-right">
                              {ev.time || "-"}
                            </span>
                            {/* 국가 */}
                            <span className="w-8 shrink-0 text-center" title={ev.country}>
                              {countryFlags[ev.country] || "🌐"}
                            </span>
                            {/* 중요도 */}
                            <span className="w-12 shrink-0">
                              <ImportanceStars level={ev.importance} />
                            </span>
                            {/* 이벤트명 */}
                            <span className="flex-1 min-w-0 truncate font-medium">
                              {ev.event}
                            </span>
                            {/* 실제/예상/이전 */}
                            {(ev.actual || ev.forecast || ev.previous) && (
                              <div className="flex gap-2 shrink-0 text-[10px] text-muted-foreground">
                                {ev.actual && <span className="text-green-600 font-semibold">{ev.actual}</span>}
                                {ev.forecast && <span>예상: {ev.forecast}</span>}
                                {ev.previous && <span>이전: {ev.previous}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  경제지표 일정이 없습니다.
                </div>
              )}

              {calendarData?.totalEvents !== undefined && (
                <div className="mt-3 pt-2 border-t text-xs text-muted-foreground text-center">
                  총 {calendarData.totalEvents}건의 일정 ({calendarData.dateRange?.from} ~ {calendarData.dateRange?.to})
                  <span className="ml-2">출처: Investing.com</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 배당일정 */}
        <TabsContent value="dividend">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-amber-500" />
                  고배당주 TOP 50
                  <span className="text-xs text-muted-foreground font-normal">(배당수익률 기준)</span>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => window.open("https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201030104", "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="w-3 h-3" />
                  KRX
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoadingDividend ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : dividendStocks.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-1.5 px-1 w-8">#</th>
                        <th className="text-left py-1.5 px-1">종목명</th>
                        <th className="text-right py-1.5 px-1">현재가</th>
                        <th className="text-right py-1.5 px-1">등락률</th>
                        <th className="text-right py-1.5 px-1 text-amber-600 font-semibold">배당수익률</th>
                        <th className="text-right py-1.5 px-1">주당배당금</th>
                        <th className="text-right py-1.5 px-1">PER</th>
                        <th className="text-right py-1.5 px-1">PBR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dividendStocks.map((stock, i) => {
                        const changeVal = parseFloat(stock.changeRate);
                        const isUp = changeVal > 0;
                        const isDown = changeVal < 0;
                        return (
                          <tr
                            key={stock.code}
                            className="border-b border-muted/30 hover:bg-muted/40 cursor-pointer transition-colors"
                            onClick={() => window.open(`https://finance.naver.com/item/main.naver?code=${stock.code}`, "_blank", "noopener,noreferrer")}
                          >
                            <td className="py-1.5 px-1 text-muted-foreground font-mono">{i + 1}</td>
                            <td className="py-1.5 px-1">
                              <div className="font-medium">{stock.name}</div>
                              <div className="text-[10px] text-muted-foreground">{stock.market}</div>
                            </td>
                            <td className="py-1.5 px-1 text-right font-mono">
                              {parseInt(stock.closePrice).toLocaleString()}
                            </td>
                            <td className={`py-1.5 px-1 text-right font-mono ${isUp ? "text-red-500" : isDown ? "text-blue-500" : ""}`}>
                              {isUp ? "+" : ""}{stock.changeRate}%
                            </td>
                            <td className="py-1.5 px-1 text-right font-semibold text-amber-600 font-mono">
                              {stock.dividendYield}%
                            </td>
                            <td className="py-1.5 px-1 text-right font-mono">
                              {parseInt(stock.dps).toLocaleString()}원
                            </td>
                            <td className="py-1.5 px-1 text-right text-muted-foreground font-mono">
                              {stock.per}
                            </td>
                            <td className="py-1.5 px-1 text-right text-muted-foreground font-mono">
                              {stock.pbr}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  배당 데이터를 불러올 수 없습니다.
                </div>
              )}

              {dividendData && (
                <div className="mt-3 pt-2 border-t text-xs text-muted-foreground text-center">
                  기준일: {dividendData.tradingDate?.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")}
                  {dividendData.totalCount > 0 && <span className="ml-2">배당 지급 종목: {dividendData.totalCount}개</span>}
                  <span className="ml-2">출처: KRX 한국거래소</span>
                </div>
              )}

              {/* 배당 안내 */}
              <div className="mt-3 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">📌 배당 참고 사항</p>
                <p>• 한국 주식의 연간 배당기준일은 대부분 <strong>12월 말</strong>입니다.</p>
                <p>• 배당을 받으려면 <strong>배당기준일 2영업일 전(배당락일 전날)</strong>까지 매수해야 합니다.</p>
                <p>• 분기배당/반기배당 종목은 3월, 6월, 9월 말에도 배당기준일이 있습니다.</p>
                <p>• 종목 클릭 시 네이버 증권 상세 페이지로 이동합니다.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IPO 일정 */}
        <TabsContent value="ipo">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  IPO 일정
                  <span className="text-xs text-muted-foreground font-normal">(38커뮤니케이션 기준)</span>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => window.open("https://www.38.co.kr/html/fund/index.htm?o=k", "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="w-3 h-3" />
                  더보기
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoadingIpo ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : ipos.length > 0 ? (
                <div className="space-y-1">
                  {ipos.map((ipo, i) => (
                    <a
                      key={i}
                      href={ipo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/40 transition-colors group"
                    >
                      <span className="text-xs text-muted-foreground font-mono w-5 text-right shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium group-hover:text-primary">{ipo.name}</span>
                        {ipo.schedule && (
                          <span className="text-xs text-muted-foreground ml-2">{ipo.schedule}</span>
                        )}
                      </div>
                      {ipo.price && (
                        <span className="text-xs text-muted-foreground shrink-0">{ipo.price}</span>
                      )}
                      {ipo.exchange && (
                        <Badge variant="outline" className="text-[10px] h-4 shrink-0">{ipo.exchange}</Badge>
                      )}
                      <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  IPO 일정 데이터를 불러올 수 없습니다.
                </div>
              )}

              {ipoData?.updatedAt && (
                <div className="mt-3 pt-2 border-t text-xs text-muted-foreground text-center">
                  업데이트: {ipoData.updatedAt}
                  <span className="ml-2">출처: 38커뮤니케이션</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

