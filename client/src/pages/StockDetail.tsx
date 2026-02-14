import { useSearch } from "wouter";
import StockDetailPanel from "@/components/StockDetailPanel";
import { TrendingUp } from "lucide-react";

export default function StockDetail() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const stockCode = params.get("code") || "";
  const stockName = decodeURIComponent(params.get("name") || "");
  const market = (params.get("market") || "domestic") as "domestic" | "overseas";
  const exchange = params.get("exchange") || undefined;
  const isEtf = params.get("type") === "etf";

  if (!stockCode) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        종목 정보가 없습니다.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 간단한 헤더 */}
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm dark:bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="bg-primary/10 p-1.5 rounded-lg">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">종목 상세정보</span>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-5xl mx-auto">
        <StockDetailPanel
          stockCode={stockCode}
          stockName={stockName}
          market={market}
          exchange={exchange}
          isEtf={isEtf}
          onClose={() => window.close()}
        />
      </main>
    </div>
  );
}

