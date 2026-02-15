import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Trash2, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus, Search, Globe, Users, User, ShoppingCart, Eye, Share2,
} from "lucide-react";
// StockDetailPanel is now shown in a new window via /stock-detail route

interface WatchlistStock {
  id: number;
  stockCode: string;
  stockName: string;
  market: string;
  exchange: string | null;
  sector: string | null;
  memo: string | null;
  listType: string | null;
  userId: number | null;
  isShared: boolean | null;
  sharedBy: string | null;
  createdAt: string;
}

interface RealtimeStock extends WatchlistStock {
  currentPrice: number;
  changeVal: number;
  changeRate: number;
  marketCap: string;
  volume: string;
}

// 종목 테이블 컴포넌트
function StockTable({
  stocks,
  realtimeData,
  canDelete,
  onDelete,
  getStockDetailUrl,
  checkedStocks,
  onToggleCheck,
  onShowDetail,
}: {
  stocks: WatchlistStock[];
  realtimeData: RealtimeStock[];
  canDelete: boolean;
  onDelete: (id: number, name: string) => void;
  getStockDetailUrl: (code: string, exchange: string | null) => string;
  checkedStocks: Set<string>;
  onToggleCheck: (code: string) => void;
  onShowDetail: (stock: WatchlistStock) => void;
}) {
  const hasRealtime = realtimeData.length > 0;

  const grouped = (hasRealtime ? realtimeData : stocks).reduce<Record<string, any[]>>((acc, stock) => {
    const key = stock.sector || "기본";
    if (!acc[key]) acc[key] = [];
    acc[key].push(stock);
    return acc;
  }, {});

  if (stocks.length === 0) return null;

  return (
    <>
      {Object.entries(grouped).map(([sectorName, items]) => (
        <div key={sectorName} className="mb-3">
          <div className="flex items-center gap-2 mb-1 px-1">
            <span className="text-xs font-medium text-muted-foreground">📁 {sectorName}</span>
            <span className="text-[10px] text-muted-foreground">({items.length}종목)</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30px]"></TableHead>
                  <TableHead className="w-[80px]">티커</TableHead>
                  <TableHead>종목명</TableHead>
                  <TableHead className="w-[70px] text-center">거래소</TableHead>
                  {hasRealtime ? (
                    <>
                      <TableHead className="text-right w-[100px]">현재가($)</TableHead>
                      <TableHead className="text-right w-[80px]">전일대비</TableHead>
                      <TableHead className="text-right w-[70px]">등락률</TableHead>
                      <TableHead className="text-right w-[90px]">거래량</TableHead>
                    </>
                  ) : (
                    <TableHead>메모</TableHead>
                  )}
                  {canDelete && <TableHead className="w-[40px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((stock: any) => {
                  const rt = stock as RealtimeStock;
                  const isRising = hasRealtime && rt.changeVal > 0;
                  const isFalling = hasRealtime && rt.changeVal < 0;
                  const isChecked = checkedStocks.has(stock.stockCode);
                  return (
                    <TableRow
                      key={stock.id}
                      className={`cursor-pointer hover:bg-muted/50 ${isChecked ? "bg-primary/5" : ""}`}
                      onClick={() => window.open(getStockDetailUrl(stock.stockCode, stock.exchange), "_blank", "noopener,noreferrer")}
                    >
                      <TableCell className="p-1 text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => onToggleCheck(stock.stockCode)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold">{stock.stockCode}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          {stock.stockName}
                          {stock.isShared && stock.sharedBy && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 shrink-0">
                              {stock.sharedBy.substring(0, 3)}***
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-primary hover:text-primary shrink-0"
                            onClick={(e) => { e.stopPropagation(); onShowDetail(stock); }}
                            title="상세보기"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          stock.exchange === "NASDAQ" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                          stock.exchange === "NYSE" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}>
                          {stock.exchange || "-"}
                        </span>
                      </TableCell>
                      {hasRealtime ? (
                        <>
                          <TableCell className="text-right font-mono">
                            {rt.currentPrice > 0 ? `$${rt.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                          </TableCell>
                          <TableCell className={`text-right font-mono ${isRising ? "text-red-500" : isFalling ? "text-blue-500" : ""}`}>
                            {rt.changeVal > 0 ? "+" : ""}{rt.changeVal !== 0 ? rt.changeVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${isRising ? "text-red-500" : isFalling ? "text-blue-500" : ""}`}>
                            <span className="flex items-center justify-end gap-0.5">
                              {isRising && <TrendingUp className="h-3 w-3" />}
                              {isFalling && <TrendingDown className="h-3 w-3" />}
                              {!isRising && !isFalling && <Minus className="h-3 w-3" />}
                              {rt.changeRate > 0 ? "+" : ""}{rt.changeRate.toFixed(2)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono">
                            {rt.volume && rt.volume !== "-" ? parseInt(rt.volume).toLocaleString() : "-"}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell className="text-xs text-muted-foreground">{stock.memo || "-"}</TableCell>
                      )}
                      {canDelete && (
                        <TableCell className="text-center p-0">
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); onDelete(stock.id, stock.stockName); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </>
  );
}

export default function OverseasStocks() {
  const { isAdmin, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addListType, setAddListType] = useState<"common" | "personal">("common");
  const [checkedStocks, setCheckedStocks] = useState<Set<string>>(new Set());
  const [stockCode, setStockCode] = useState("");
  const [stockName, setStockName] = useState("");
  const [exchange, setExchange] = useState("NASDAQ");
  const [sector, setSector] = useState("기본");
  const [memo, setMemo] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [searchCode, setSearchCode] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{ code: string; name: string; exchange: string; typeName: string; nationName: string }[]>([]);

  // 공통관심 목록
  const { data: commonStocks = [], isLoading: isCommonLoading } = useQuery<WatchlistStock[]>({
    queryKey: ["/api/watchlist-stocks", "overseas", "common"],
    queryFn: async () => {
      const res = await fetch("/api/watchlist-stocks?market=overseas&listType=common", { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  // 개인관심 목록
  const { data: personalStocks = [], isLoading: isPersonalLoading } = useQuery<WatchlistStock[]>({
    queryKey: ["/api/watchlist-stocks", "overseas", "personal"],
    queryFn: async () => {
      const res = await fetch("/api/watchlist-stocks?market=overseas&listType=personal", { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: isLoggedIn || isAdmin,
  });

  // 공통관심 실시간 시세
  const { data: commonRealtime = [], isLoading: isCommonRealtimeLoading, refetch: refetchCommonRealtime } = useQuery<RealtimeStock[]>({
    queryKey: ["/api/watchlist-stocks/overseas/realtime", "common"],
    queryFn: async () => {
      const res = await fetch("/api/watchlist-stocks/overseas/realtime?listType=common", { credentials: "include" });
      if (!res.ok) throw new Error("시세 조회 실패");
      return res.json();
    },
    enabled: commonStocks.length > 0,
    refetchInterval: 120000,
  });

  // 개인관심 실시간 시세
  const { data: personalRealtime = [], isLoading: isPersonalRealtimeLoading, refetch: refetchPersonalRealtime } = useQuery<RealtimeStock[]>({
    queryKey: ["/api/watchlist-stocks/overseas/realtime", "personal"],
    queryFn: async () => {
      const res = await fetch("/api/watchlist-stocks/overseas/realtime?listType=personal", { credentials: "include" });
      if (!res.ok) throw new Error("시세 조회 실패");
      return res.json();
    },
    enabled: personalStocks.length > 0 && (isLoggedIn || isAdmin),
    refetchInterval: 120000,
  });

  // 공유 관심 목록
  const { data: sharedStocks = [], isLoading: isSharedLoading } = useQuery<WatchlistStock[]>({
    queryKey: ["/api/watchlist-stocks", "overseas", "shared"],
    queryFn: async () => {
      const res = await fetch("/api/watchlist-stocks?market=overseas&listType=shared", { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  // 공유 관심 실시간 시세
  const { data: sharedRealtime = [], isLoading: isSharedRealtimeLoading, refetch: refetchSharedRealtime } = useQuery<RealtimeStock[]>({
    queryKey: ["/api/watchlist-stocks/overseas/realtime", "shared"],
    queryFn: async () => {
      const res = await fetch("/api/watchlist-stocks/overseas/realtime?listType=shared", { credentials: "include" });
      if (!res.ok) throw new Error("시세 조회 실패");
      return res.json();
    },
    enabled: sharedStocks.length > 0,
    refetchInterval: 120000,
  });

  // 종목 등록
  const addMutation = useMutation({
    mutationFn: async (data: { stockCode: string; stockName: string; market: string; exchange: string; sector: string; memo: string }) => {
      const endpoint = addListType === "common" ? "/api/watchlist-stocks/common" : "/api/watchlist-stocks/personal";
      const res = await apiRequest("POST", endpoint, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist-stocks"] });
      toast({ title: "등록 완료", description: `${addListType === "common" ? "공통" : "개인"} 관심종목이 등록되었습니다.` });
      setAddDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "등록 실패", description: err.message, variant: "destructive" });
    },
  });

  // 종목 삭제
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/watchlist-stocks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist-stocks"] });
      toast({ title: "삭제 완료", description: "관심종목이 삭제되었습니다." });
    },
    onError: (err: any) => {
      toast({ title: "삭제 실패", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setStockCode(""); setStockName(""); setExchange("NASDAQ"); setSector("기본"); setMemo(""); setIsShared(false); setSearchCode(""); setSearchResults([]);
  };

  // 해외 종목 검색 (복수 결과)
  const handleSearchStock = async () => {
    if (!searchCode.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const proxyRes = await fetch(`/api/stock/search-overseas?symbol=${encodeURIComponent(searchCode.trim().toUpperCase())}`, { credentials: "include" });
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (data.items && data.items.length > 0) {
          setSearchResults(data.items);
        } else {
          toast({ title: "검색 실패", description: "종목을 찾을 수 없습니다.", variant: "destructive" });
        }
      } else {
        toast({ title: "검색 실패", description: "종목을 찾을 수 없습니다.", variant: "destructive" });
      }
    } catch {
      toast({ title: "검색 실패", description: "서버 연결 오류", variant: "destructive" });
    } finally {
      setSearchLoading(false);
    }
  };

  // 검색 결과에서 종목 선택
  const handleSelectSearchResult = (item: { code: string; name: string; exchange: string }) => {
    setStockCode(item.code);
    setStockName(item.name);
    setExchange(item.exchange);
    setSearchResults([]);
    toast({ title: "종목 선택", description: `${item.name} (${item.code})` });
  };

  // 기존 섹터 목록
  const allStocks = [...commonStocks, ...personalStocks, ...sharedStocks];
  const existingSectors = Array.from(new Set(allStocks.map((s) => s.sector).filter(Boolean))) as string[];

  const handleAdd = () => {
    if (!stockCode.trim() || !stockName.trim()) {
      toast({ title: "입력 오류", description: "티커와 종목명을 입력해주세요.", variant: "destructive" });
      return;
    }
    const targetList = addListType === "common" ? commonStocks : personalStocks;
    if (targetList.some((s) => s.stockCode.toUpperCase() === stockCode.trim().toUpperCase())) {
      toast({ title: "중복 종목", description: "이미 등록된 종목입니다.", variant: "destructive" });
      return;
    }
    addMutation.mutate({
      stockCode: stockCode.trim().toUpperCase(),
      stockName: stockName.trim(),
      market: "overseas",
      exchange,
      sector: sector.trim() || "기본",
      memo: memo.trim(),
      ...(addListType === "personal" ? { isShared } : {}),
    } as any);
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`"${name}" 종목을 삭제하시겠습니까?`)) {
      deleteMutation.mutate(id);
    }
  };

  const openAddDialog = (type: "common" | "personal") => {
    setAddListType(type);
    resetForm();
    setAddDialogOpen(true);
  };

  // 네이버 해외주식 상세 링크 생성
  const getStockDetailUrl = (code: string, exchangeName: string | null) => {
    let prefix = "NAS";
    switch (exchangeName?.toUpperCase()) {
      case "NYSE": prefix = "NYS"; break;
      case "NASDAQ": prefix = "NAS"; break;
      case "AMEX": prefix = "AMS"; break;
      case "TSE": prefix = "TKS"; break;
      case "HKEX": prefix = "HKS"; break;
      case "SSE": prefix = "SHS"; break;
      default: prefix = "NAS";
    }
    return `https://stock.naver.com/world/stock/${prefix}${code}`;
  };

  const toggleCheck = (code: string) => {
    setCheckedStocks((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleBuySelected = () => {
    if (checkedStocks.size === 0) return;
    const firstCode = Array.from(checkedStocks)[0];
    const allStocksFlat = [...commonStocks, ...personalStocks];
    const stock = allStocksFlat.find((s) => s.stockCode === firstCode);
    if (stock) {
      navigate(`/trading?code=${stock.stockCode}&name=${encodeURIComponent(stock.stockName)}`);
    }
  };

  // 주식 검색 상태
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [stockSearchResults, setStockSearchResults] = useState<{code: string; name: string; exchange: string; typeName: string; nationCode?: string; nationName?: string}[]>([]);
  const [isStockSearching, setIsStockSearching] = useState(false);
  const stockSearchRef = useRef<ReturnType<typeof setTimeout>>();

  const handleStockSearch = async (query: string) => {
    setStockSearchQuery(query);
    if (stockSearchRef.current) clearTimeout(stockSearchRef.current);
    if (!query || query.length < 2) {
      setStockSearchResults([]);
      return;
    }
    stockSearchRef.current = setTimeout(async () => {
      setIsStockSearching(true);
      try {
        const res = await fetch(`/api/stock/search-autocomplete?query=${encodeURIComponent(query)}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          // 해외주식만 필터링 (nationCode가 KOR가 아닌 것)
          const overseas = (data.items || []).filter((item: any) => item.nationCode && item.nationCode !== "KOR");
          setStockSearchResults(overseas);
        }
      } catch { /* ignore */ }
      setIsStockSearching(false);
    }, 300);
  };

  const openStockDetail = (code: string, name: string, exch: string) => {
    const url = `/stock-detail?code=${code}&name=${encodeURIComponent(name)}&market=overseas&exchange=${exch || "NASDAQ"}`;
    window.open(url, `stock_${code}`, "width=1000,height=800,scrollbars=yes,resizable=yes");
  };

  const isAnyRealtimeLoading = isCommonRealtimeLoading || isPersonalRealtimeLoading || isSharedRealtimeLoading;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-500" />
          <h2 className="text-xl font-bold">해외 관심종목</h2>
          {checkedStocks.size > 0 && (
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs px-3 gap-1 bg-red-500 hover:bg-red-600 text-white ml-2"
              onClick={handleBuySelected}
            >
              <ShoppingCart className="w-3 h-3" />
              매수 ({checkedStocks.size})
            </Button>
          )}
          {checkedStocks.size > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setCheckedStocks(new Set())}>
              선택해제
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(commonStocks.length > 0 || personalStocks.length > 0 || sharedStocks.length > 0) && (
            <Button variant="outline" size="sm" onClick={() => { refetchCommonRealtime(); refetchPersonalRealtime(); refetchSharedRealtime(); }} disabled={isAnyRealtimeLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isAnyRealtimeLoading ? "animate-spin" : ""}`} />
              시세 갱신
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" variant="default" onClick={() => openAddDialog("common")} className="gap-1">
              <Users className="h-4 w-4" />
              공통관심 등록
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => openAddDialog("personal")} className="gap-1">
              <User className="h-4 w-4" />
              개인관심 등록
            </Button>
          )}
          {!isAdmin && isLoggedIn && (
            <Button size="sm" onClick={() => openAddDialog("personal")} className="gap-1">
              <Plus className="h-4 w-4" />
              관심종목 등록
            </Button>
          )}
        </div>
      </div>

      {/* 주식 검색 */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            해외 주식 검색
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={stockSearchQuery}
              onChange={(e) => handleStockSearch(e.target.value)}
              placeholder="종목명 또는 티커를 입력하세요 (예: Apple, AAPL, Tesla)"
              className="pl-9"
            />
            {isStockSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {stockSearchResults.length > 0 && (
            <div className="mt-2 border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr className="border-b">
                      <th className="text-left px-3 py-2 font-medium">종목명</th>
                      <th className="text-left px-3 py-2 font-medium">티커</th>
                      <th className="text-left px-3 py-2 font-medium">거래소</th>
                      <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">국가</th>
                      <th className="text-center px-3 py-2 font-medium">상세</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockSearchResults.map((item) => (
                      <tr key={`${item.code}-${item.exchange}`}
                        className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => openStockDetail(item.code, item.name, item.exchange)}>
                        <td className="px-3 py-2 font-medium">{item.name}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{item.code}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px] px-1.5">{item.exchange}</Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground hidden sm:table-cell">{item.nationName || "-"}</td>
                        <td className="text-center px-3 py-2">
                          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"
                            onClick={(e) => { e.stopPropagation(); openStockDetail(item.code, item.name, item.exchange); }}>
                            <Eye className="h-3 w-3" /> 상세
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {stockSearchQuery.length >= 2 && !isStockSearching && stockSearchResults.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-3">검색 결과가 없습니다.</p>
          )}
        </CardContent>
      </Card>

      {/* 로딩 */}
      {(isCommonLoading || isPersonalLoading || isSharedLoading) && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* 공통관심 종목 섹션 */}
      {!isCommonLoading && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              공통 관심종목
              <span className="text-xs text-muted-foreground font-normal">({commonStocks.length}종목)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {commonStocks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">등록된 공통 관심종목이 없습니다</p>
            ) : (
              <StockTable
                stocks={commonStocks}
                realtimeData={commonRealtime}
                canDelete={isAdmin}
                onDelete={handleDelete}
                getStockDetailUrl={getStockDetailUrl}
                checkedStocks={checkedStocks}
                onToggleCheck={toggleCheck}
                onShowDetail={(s) => {
                  const url = `/stock-detail?code=${s.stockCode}&name=${encodeURIComponent(s.stockName)}&market=overseas&exchange=${s.exchange || "NASDAQ"}`;
                  window.open(url, `stock_${s.stockCode}`, "width=1000,height=800,scrollbars=yes,resizable=yes");
                }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* 공유 관심종목 섹션 */}
      {!isSharedLoading && sharedStocks.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Share2 className="h-4 w-4 text-orange-500" />
              공유 관심종목
              <span className="text-xs text-muted-foreground font-normal">({sharedStocks.length}종목)</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-600">사용자 공유</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <StockTable
              stocks={sharedStocks}
              realtimeData={sharedRealtime}
              canDelete={false}
              onDelete={handleDelete}
              getStockDetailUrl={getStockDetailUrl}
              checkedStocks={checkedStocks}
              onToggleCheck={toggleCheck}
              onShowDetail={(s) => {
                const url = `/stock-detail?code=${s.stockCode}&name=${encodeURIComponent(s.stockName)}&market=overseas&exchange=${s.exchange || "NASDAQ"}`;
                window.open(url, `stock_${s.stockCode}`, "width=1000,height=800,scrollbars=yes,resizable=yes");
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* 개인관심 종목 섹션 */}
      {(isLoggedIn || isAdmin) && !isPersonalLoading && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-green-500" />
              개인 관심종목
              <span className="text-xs text-muted-foreground font-normal">({personalStocks.length}종목)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {personalStocks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">등록된 개인 관심종목이 없습니다</p>
            ) : (
              <StockTable
                stocks={personalStocks}
                realtimeData={personalRealtime}
                canDelete={true}
                onDelete={handleDelete}
                getStockDetailUrl={getStockDetailUrl}
                checkedStocks={checkedStocks}
                onToggleCheck={toggleCheck}
                onShowDetail={(s) => {
                  const url = `/stock-detail?code=${s.stockCode}&name=${encodeURIComponent(s.stockName)}&market=overseas&exchange=${s.exchange || "NASDAQ"}`;
                  window.open(url, `stock_${s.stockCode}`, "width=1000,height=800,scrollbars=yes,resizable=yes");
                }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* 관심종목 등록 다이얼로그 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {addListType === "common" ? (
                <><Users className="h-5 w-5 text-blue-500" /> 공통 관심종목 등록</>
              ) : (
                <><User className="h-5 w-5 text-green-500" /> 개인 관심종목 등록</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 티커 검색 */}
            <div className="space-y-1.5">
              <Label>종목 검색 (티커 또는 종목명)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="예: AAPL, Apple, TSLA"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchStock()}
                />
                <Button variant="outline" size="sm" onClick={handleSearchStock} disabled={searchLoading}>
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {/* 검색 결과 리스트 */}
              {searchResults.length > 0 && (
                <div className="border rounded-md max-h-48 overflow-y-auto bg-background shadow-sm">
                  {searchResults.map((item, idx) => (
                    <button
                      key={`${item.code}-${idx}`}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted/70 flex items-center justify-between gap-2 border-b last:border-b-0 transition-colors"
                      onClick={() => handleSelectSearchResult(item)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs text-muted-foreground shrink-0">{item.code}</span>
                        <span className="text-sm font-medium truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.nationName && <span className="text-[10px] text-muted-foreground">{item.nationName}</span>}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          item.exchange === "NASDAQ" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                          item.exchange === "NYSE" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}>{item.exchange}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>티커 *</Label>
                <Input value={stockCode} onChange={(e) => setStockCode(e.target.value.toUpperCase())} placeholder="AAPL" />
              </div>
              <div className="space-y-1.5">
                <Label>종목명 *</Label>
                <Input value={stockName} onChange={(e) => setStockName(e.target.value)} placeholder="Apple Inc." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>거래소</Label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={exchange} onChange={(e) => setExchange(e.target.value)}>
                  <option value="NASDAQ">NASDAQ</option>
                  <option value="NYSE">NYSE</option>
                  <option value="AMEX">AMEX</option>
                  <option value="TSE">TSE (도쿄)</option>
                  <option value="HKEX">HKEX (홍콩)</option>
                  <option value="SSE">SSE (상해)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>섹터</Label>
                <Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="섹터명 입력" />
                {existingSectors.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {existingSectors.map((s) => (
                      <button key={s} type="button"
                        className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                          sector === s ? "bg-primary text-primary-foreground border-primary" : "bg-muted hover:bg-muted/80 border-border"
                        }`}
                        onClick={() => setSector(s)}
                      >{s}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>메모 (선택)</Label>
              <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="관심 사유 등" />
            </div>

            {/* 개인관심 등록 시 공유 옵션 */}
            {addListType === "personal" && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-700">
                <Checkbox
                  id="isSharedOverseas"
                  checked={isShared}
                  onCheckedChange={(checked) => setIsShared(checked === true)}
                />
                <label htmlFor="isSharedOverseas" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <Share2 className="h-3.5 w-3.5 text-blue-500" />
                  <span className="font-medium">공유하기</span>
                  <span className="text-xs text-muted-foreground">(체크하면 모든 계정에 공유 관심종목으로 표시됩니다)</span>
                </label>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setAddDialogOpen(false); resetForm(); }}>취소</Button>
              <Button onClick={handleAdd} disabled={addMutation.isPending}>
                {addMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                등록
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
