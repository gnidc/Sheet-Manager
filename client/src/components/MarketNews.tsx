import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Loader2,
  RefreshCw,
  Newspaper,
  ExternalLink,
  Clock,
  AlertCircle,
  TrendingUp,
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
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground">네이버 금융 주요뉴스를 가져오고 있습니다...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <p className="text-muted-foreground">
          {error?.message || "뉴스를 불러올 수 없습니다."}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          재시도
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              주요뉴스 (많이 본 뉴스)
            </CardTitle>
            <div className="flex items-center gap-3">
              {data?.updatedAt && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{data.updatedAt} 기준</span>
                </div>
              )}
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
                  <RefreshCw className="w-4 h-4" />
                )}
                새로고침
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            네이버 금융 많이 본 뉴스에서 중요도 순으로 정렬하여 보여드립니다
          </p>
        </CardHeader>
      </Card>

      {/* 뉴스 리스트 */}
      {data?.news && data.news.length > 0 ? (
        <div className="space-y-3">
          {data.news.map((item, index) => {
            const isTop3 = index < 3;
            const isTop5 = index < 5;

            return (
              <a
                key={index}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <Card className={`overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/30 ${isTop3 ? "border-l-4 border-l-orange-500" : isTop5 ? "border-l-4 border-l-primary/50" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* 순위 번호 */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        isTop3
                          ? "bg-orange-500 text-white"
                          : isTop5
                          ? "bg-primary/80 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {index + 1}
                      </div>

                      {/* 본문 */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <h3 className={`font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2 ${
                          isTop3 ? "text-base" : "text-sm"
                        }`}>
                          {item.title}
                        </h3>

                        <div className="flex items-center gap-2 flex-wrap">
                          {item.source && (
                            <span className="text-xs text-muted-foreground font-medium">{item.source}</span>
                          )}
                          {item.time && (
                            <span className="text-xs text-muted-foreground">
                              <Clock className="w-3 h-3 inline mr-0.5" />
                              {item.time}
                            </span>
                          )}
                        </div>
                      </div>

                      <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>
              </a>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Newspaper className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">뉴스가 없습니다</h3>
            <p className="text-sm text-muted-foreground mt-1">잠시 후 다시 시도해주세요.</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center py-2">
        데이터 출처: 네이버 금융 (많이 본 뉴스) | 실제 투자 판단은 직접 확인 후 결정해주세요
      </p>
    </div>
  );
}
