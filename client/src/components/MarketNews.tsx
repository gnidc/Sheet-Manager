import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  Newspaper,
  ExternalLink,
  Clock,
  AlertCircle,
  Flame,
} from "lucide-react";

interface NewsItem {
  title: string;
  link: string;
  source: string;
  time: string;
  category: string;
}

interface MarketNewsResponse {
  news: NewsItem[];
  updatedAt: string;
  totalScraped: number;
}

export default function MarketNews() {
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<MarketNewsResponse>({
    queryKey: ["/api/news/market"],
    queryFn: async () => {
      const res = await fetch("/api/news/market", { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "뉴스 데이터를 불러올 수 없습니다");
      }
      return res.json();
    },
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">주요뉴스를 가져오고 있습니다...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          {error?.message || "뉴스를 불러올 수 없습니다."}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          재시도
        </Button>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          <h3 className="font-semibold text-sm">주요뉴스</h3>
          <span className="text-[11px] text-muted-foreground">(많이 본 뉴스)</span>
          {isFetching && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2">
          {data?.updatedAt && (
            <span className="text-[11px] text-muted-foreground hidden sm:flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {data.updatedAt}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-7 px-2 text-xs gap-1"
          >
            {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            새로고침
          </Button>
        </div>
      </div>

      {/* 뉴스 리스트 */}
      {data?.news && data.news.length > 0 ? (
        <div className="divide-y">
          {data.news.map((item, index) => {
            const isTop3 = index < 3;
            const isTop5 = index < 5;

            return (
              <a
                key={index}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors group"
              >
                {/* 순위 */}
                <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  isTop3
                    ? "bg-orange-500 text-white"
                    : isTop5
                    ? "bg-primary/70 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {index + 1}
                </span>

                {/* 제목 + 메타 */}
                <div className="flex-1 min-w-0">
                  <p className={`truncate group-hover:text-primary transition-colors ${
                    isTop3 ? "text-sm font-semibold" : "text-sm font-medium"
                  }`}>
                    {item.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {item.source && (
                      <span className="text-[11px] text-muted-foreground">{item.source}</span>
                    )}
                    {item.source && item.time && <span className="text-muted-foreground/40 text-[10px]">·</span>}
                    {item.time && (
                      <span className="text-[11px] text-muted-foreground">{item.time}</span>
                    )}
                  </div>
                </div>

                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0 group-hover:text-primary/60 transition-colors" />
              </a>
            );
          })}
        </div>
      ) : (
        <CardContent className="py-12 text-center">
          <Newspaper className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">뉴스가 없습니다</p>
          <p className="text-xs text-muted-foreground mt-1">잠시 후 다시 시도해주세요.</p>
        </CardContent>
      )}

      {/* 푸터 */}
      <div className="px-4 py-1.5 border-t bg-muted/20">
        <p className="text-[10px] text-muted-foreground text-center">
          출처: 네이버 금융 (많이 본 뉴스) · 실제 투자 판단은 직접 확인 후 결정해주세요
        </p>
      </div>
    </Card>
  );
}
