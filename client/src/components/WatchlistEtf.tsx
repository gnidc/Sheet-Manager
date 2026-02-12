import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Plus,
  Search,
  Trash2,
  Star,
  ShoppingCart,
  Tag,
  Edit,
  X,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface WatchlistEtf {
  id: number;
  etfCode: string;
  etfName: string;
  sector: string | null;
  memo: string | null;
  createdAt: string;
}

interface EtfSearchResult {
  code: string;
  name: string;
}

interface EtfMarketData {
  currentPrice: number;
  changeVal: number;
  changeRate: number;
  marketCap: number;
  nav: number;
  listingDate: string;
  expense: string;
}

// ===== 섹터 입력 컴포넌트 (한글 IME 안정성) =====
function SectorInput({
  value,
  onChange,
  existingSectors,
}: {
  value: string;
  onChange: (v: string) => void;
  existingSectors: string[];
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = existingSectors.filter(
    (s) => s !== value && s.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder="섹터명 입력 (예: 반도체, AI, 배당 등)"
        className="text-sm"
      />
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                setShowSuggestions(false);
              }}
            >
              <Tag className="w-3 h-3 inline mr-2 text-muted-foreground" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WatchlistEtfComponent() {
  const { isAdmin, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WatchlistEtf | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<EtfSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedEtf, setSelectedEtf] = useState<EtfSearchResult | null>(null);
  const [sectorInput, setSectorInput] = useState("기본");
  const [memoInput, setMemoInput] = useState("");
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [filterSector, setFilterSector] = useState<string | null>(null);

  // API: 관심 ETF 목록 조회
  const { data: watchlist = [], isLoading } = useQuery<WatchlistEtf[]>({
    queryKey: ["/api/watchlist-etfs"],
    enabled: isLoggedIn,
  });

  // API: 관심 ETF 시세 정보 조회
  const { data: marketData = {}, isLoading: isMarketLoading, refetch: refetchMarket } = useQuery<Record<string, EtfMarketData>>({
    queryKey: ["/api/watchlist-etfs/market-data"],
    enabled: isLoggedIn && watchlist.length > 0,
    staleTime: 5 * 60 * 1000, // 5분 캐시
  });

  // 섹터 목록 추출
  const sectors = useMemo(() => {
    const sectorSet = new Set<string>();
    watchlist.forEach((e) => { if (e.sector) sectorSet.add(e.sector); });
    return Array.from(sectorSet).sort();
  }, [watchlist]);

  // 필터된 목록
  const filteredList = useMemo(() => {
    if (!filterSector) return watchlist;
    return watchlist.filter((e) => e.sector === filterSector);
  }, [watchlist, filterSector]);

  // 섹터별 그룹
  const groupedBySector = useMemo(() => {
    const groups = new Map<string, WatchlistEtf[]>();
    filteredList.forEach((e) => {
      const key = e.sector || "기본";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredList]);

  // ETF 검색
  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim() || searchTerm.trim().length < 2) {
      toast({ title: "검색어 오류", description: "2자 이상 입력해주세요.", variant: "destructive" });
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/etf/search?q=${encodeURIComponent(searchTerm.trim())}`, { credentials: "include" });
      if (!res.ok) throw new Error("검색 실패");
      const data = await res.json();
      setSearchResults(data.results || []);
      if ((data.results || []).length === 0) {
        toast({ title: "검색 결과 없음", description: `"${searchTerm}" 관련 ETF를 찾을 수 없습니다.` });
      }
    } catch (err: any) {
      toast({ title: "검색 실패", description: err.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm, toast]);

  // 추가 mutation
  const addMutation = useMutation({
    mutationFn: async (data: { etfCode: string; etfName: string; sector: string; memo: string }) => {
      const res = await apiRequest("POST", "/api/watchlist-etfs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist-etfs"] });
      toast({ title: "추가 완료", description: "관심 ETF가 추가되었습니다." });
      closeAddDialog();
    },
    onError: (err: Error) => {
      toast({ title: "추가 실패", description: err.message, variant: "destructive" });
    },
  });

  // 수정 mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; sector?: string; memo?: string }) => {
      const res = await apiRequest("PUT", `/api/watchlist-etfs/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist-etfs"] });
      toast({ title: "수정 완료" });
      setEditDialogOpen(false);
      setEditTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "수정 실패", description: err.message, variant: "destructive" });
    },
  });

  // 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/watchlist-etfs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist-etfs"] });
      toast({ title: "삭제 완료" });
    },
    onError: (err: Error) => {
      toast({ title: "삭제 실패", description: err.message, variant: "destructive" });
    },
  });

  // 다이얼로그 닫기
  const closeAddDialog = useCallback(() => {
    setAddDialogOpen(false);
    setSearchTerm("");
    setSearchResults([]);
    setSelectedEtf(null);
    setSectorInput("기본");
    setMemoInput("");
  }, []);

  // 추가 제출
  const handleAdd = useCallback(() => {
    if (!selectedEtf) return;
    addMutation.mutate({
      etfCode: selectedEtf.code,
      etfName: selectedEtf.name,
      sector: sectorInput.trim() || "기본",
      memo: memoInput.trim(),
    });
  }, [selectedEtf, sectorInput, memoInput, addMutation]);

  // 체크된 ETF 매수하기 → 자동매매로 이동
  const handleBuyChecked = useCallback(() => {
    const selected = watchlist.filter((e) => checkedIds.has(e.id));
    if (selected.length === 0) {
      toast({ title: "선택 필요", description: "매수할 ETF를 선택해주세요.", variant: "destructive" });
      return;
    }
    // 첫 번째 선택된 ETF로 자동매매 이동
    const first = selected[0];
    navigate(`/trading?code=${encodeURIComponent(first.etfCode)}&name=${encodeURIComponent(first.etfName)}`);
  }, [checkedIds, watchlist, navigate, toast]);

  // 전체 체크/해제
  const handleToggleAll = useCallback(() => {
    if (checkedIds.size === filteredList.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filteredList.map((e) => e.id)));
    }
  }, [checkedIds, filteredList]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              관심(추천) ETF
              <span className="text-sm font-normal text-muted-foreground">({watchlist.length}개)</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              {watchlist.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchMarket()}
                  disabled={isMarketLoading}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isMarketLoading ? "animate-spin" : ""}`} />
                  시세 갱신
                </Button>
              )}
              {isAdmin && (
                <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  관심ETF 추가
                </Button>
              )}
              {!isAdmin && checkedIds.size > 0 && (
                <Button size="sm" onClick={handleBuyChecked} className="gap-1.5 bg-red-500 hover:bg-red-600 text-white">
                  <ShoppingCart className="w-4 h-4" />
                  매수 ({checkedIds.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* 섹터 필터 탭 */}
        {sectors.length > 1 && (
          <div className="px-6 pb-3">
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={filterSector === null ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFilterSector(null)}
              >
                전체
              </Button>
              {sectors.map((sector) => (
                <Button
                  key={sector}
                  variant={filterSector === sector ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setFilterSector(filterSector === sector ? null : sector)}
                >
                  <Tag className="w-3 h-3" />
                  {sector}
                </Button>
              ))}
            </div>
          </div>
        )}

        <CardContent className="pt-0">
          {watchlist.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Star className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">{isAdmin ? "관심 ETF를 추가해주세요." : "아직 등록된 관심 ETF가 없습니다."}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedBySector.map(([sector, items]) => (
                <div key={sector}>
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm font-semibold text-primary">{sector}</span>
                    <span className="text-xs text-muted-foreground">({items.length})</span>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          {!isAdmin && (
                            <TableHead className="w-10 text-center">
                              <Checkbox
                                checked={items.every((i) => checkedIds.has(i.id))}
                                onCheckedChange={() => {
                                  const allChecked = items.every((i) => checkedIds.has(i.id));
                                  const newSet = new Set(checkedIds);
                                  items.forEach((i) => {
                                    if (allChecked) newSet.delete(i.id);
                                    else newSet.add(i.id);
                                  });
                                  setCheckedIds(newSet);
                                }}
                              />
                            </TableHead>
                          )}
                          <TableHead className="text-xs">코드</TableHead>
                          <TableHead className="text-xs">ETF명</TableHead>
                          <TableHead className="text-xs text-right">현재가</TableHead>
                          <TableHead className="text-xs text-right">등락률</TableHead>
                          <TableHead className="text-xs text-right">시가총액</TableHead>
                          <TableHead className="text-xs text-right">상장일</TableHead>
                          <TableHead className="text-xs text-right">총보수</TableHead>
                          <TableHead className="text-xs">메모</TableHead>
                          {isAdmin && <TableHead className="text-xs text-right w-24">관리</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((etf) => {
                          const md = marketData[etf.etfCode];
                          const changeRate = md?.changeRate || 0;
                          const isUp = changeRate > 0;
                          const isDown = changeRate < 0;
                          return (
                          <TableRow key={etf.id} className="hover:bg-muted/30">
                            {!isAdmin && (
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={checkedIds.has(etf.id)}
                                  onCheckedChange={() => {
                                    const newSet = new Set(checkedIds);
                                    if (newSet.has(etf.id)) newSet.delete(etf.id);
                                    else newSet.add(etf.id);
                                    setCheckedIds(newSet);
                                  }}
                                />
                              </TableCell>
                            )}
                            <TableCell className="text-xs font-mono text-muted-foreground">{etf.etfCode}</TableCell>
                            <TableCell className="text-sm font-medium whitespace-nowrap">{etf.etfName}</TableCell>
                            <TableCell className="text-right text-sm font-medium whitespace-nowrap">
                              {md ? (
                                <span className={isUp ? "text-red-500" : isDown ? "text-blue-500" : ""}>
                                  {md.currentPrice.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs whitespace-nowrap">
                              {md ? (
                                <span className={`inline-flex items-center gap-0.5 font-medium ${isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-muted-foreground"}`}>
                                  {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : null}
                                  {isUp ? "+" : ""}{changeRate.toFixed(2)}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                              {md && md.marketCap > 0 ? `${md.marketCap.toLocaleString()}억` : "-"}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                              {md?.listingDate || "-"}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                              {md?.expense || "-"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                              {etf.memo || "-"}
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="수정"
                                    onClick={() => {
                                      setEditTarget(etf);
                                      setSectorInput(etf.sector || "기본");
                                      setMemoInput(etf.memo || "");
                                      setEditDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    title="삭제"
                                    onClick={() => {
                                      if (confirm(`"${etf.etfName}" 을(를) 삭제하시겠습니까?`)) {
                                        deleteMutation.mutate(etf.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </div>
                  </div>
                </div>
              ))}

              {/* 일반 사용자: 매수 버튼 (하단 고정) */}
              {!isAdmin && checkedIds.size > 0 && (
                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  <span className="text-sm font-medium">
                    {checkedIds.size}개 ETF 선택됨
                  </span>
                  <Button size="sm" onClick={handleBuyChecked} className="gap-1.5 bg-red-500 hover:bg-red-600 text-white">
                    <ShoppingCart className="w-4 h-4" />
                    선택 ETF 매수하기
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== 관심ETF 추가 다이얼로그 ===== */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { if (!open) closeAddDialog(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              관심 ETF 추가
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* ETF 검색 */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">ETF 검색</label>
              <div className="flex gap-2">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                  placeholder="ETF 이름 또는 코드 입력..."
                  className="flex-1 text-sm"
                />
                <Button onClick={handleSearch} disabled={isSearching} size="sm" className="gap-1">
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  검색
                </Button>
              </div>
            </div>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                {searchResults.map((etf) => (
                  <button
                    key={etf.code}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between border-b last:border-b-0 ${
                      selectedEtf?.code === etf.code ? "bg-primary/10 text-primary font-medium" : ""
                    }`}
                    onClick={() => setSelectedEtf(etf)}
                  >
                    <span>{etf.name}</span>
                    <span className="text-xs font-mono text-muted-foreground">{etf.code}</span>
                  </button>
                ))}
              </div>
            )}

            {/* 선택된 ETF 표시 */}
            {selectedEtf && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{selectedEtf.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedEtf.code}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedEtf(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* 섹터 입력 */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">섹터 분류</label>
              <SectorInput
                value={sectorInput}
                onChange={setSectorInput}
                existingSectors={sectors}
              />
            </div>

            {/* 메모 */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">메모 (선택)</label>
              <Input
                value={memoInput}
                onChange={(e) => setMemoInput(e.target.value)}
                placeholder="간단한 메모..."
                className="text-sm"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={closeAddDialog}>취소</Button>
            <Button
              onClick={handleAdd}
              disabled={!selectedEtf || addMutation.isPending}
              className="gap-1.5"
            >
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 수정 다이얼로그 ===== */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) { setEditDialogOpen(false); setEditTarget(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              관심 ETF 수정
            </DialogTitle>
          </DialogHeader>

          {editTarget && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-sm font-medium">{editTarget.etfName}</p>
                <p className="text-xs text-muted-foreground font-mono">{editTarget.etfCode}</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">섹터 분류</label>
                <SectorInput
                  value={sectorInput}
                  onChange={setSectorInput}
                  existingSectors={sectors}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">메모</label>
                <Input
                  value={memoInput}
                  onChange={(e) => setMemoInput(e.target.value)}
                  placeholder="간단한 메모..."
                  className="text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setEditTarget(null); }}>취소</Button>
            <Button
              onClick={() => {
                if (!editTarget) return;
                updateMutation.mutate({
                  id: editTarget.id,
                  sector: sectorInput.trim() || "기본",
                  memo: memoInput.trim() || undefined,
                });
              }}
              disabled={updateMutation.isPending}
              className="gap-1.5"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit className="w-4 h-4" />}
              수정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

