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
  Satellite,
  ShoppingCart,
  Tag,
  Edit,
  X,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  FileText,
  Users,
  User,
} from "lucide-react";

export type WatchlistListType = "core" | "satellite";

interface WatchlistEtf {
  id: number;
  etfCode: string;
  etfName: string;
  sector: string | null;
  memo: string | null;
  listType?: string | null;
  userId?: number | null;
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
  dividendYield: number | null;
}

// ===== 섹터 입력 컴포넌트 (기존 섹터 선택 + 직접 입력) =====
function SectorInput({
  value,
  onChange,
  existingSectors,
}: {
  value: string;
  onChange: (v: string) => void;
  existingSectors: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      {/* 기존 섹터 태그 버튼 */}
      {existingSectors.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {existingSectors.map((s) => (
            <button
              key={s}
              type="button"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                value === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              }`}
              onClick={() => onChange(s)}
            >
              <Tag className="w-3 h-3" />
              {s}
            </button>
          ))}
        </div>
      )}
      {/* 직접 입력 */}
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="섹터명 입력 또는 위에서 선택 (예: 반도체, AI, 배당)"
          className="text-sm flex-1"
        />
        {value && !existingSectors.includes(value) && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400 whitespace-nowrap shrink-0">
            새 섹터
          </span>
        )}
      </div>
    </div>
  );
}

// ===== ETF 테이블 컴포넌트 =====
function EtfTable({
  items,
  marketData,
  listType,
  showCheckbox,
  showManage,
  checkedIds,
  onToggleCheck,
  onToggleCheckAll,
  onEdit,
  onDelete,
  onMemoClick,
}: {
  items: WatchlistEtf[];
  marketData: Record<string, EtfMarketData>;
  listType: WatchlistListType;
  showCheckbox: boolean;
  showManage: boolean;
  checkedIds: Set<number>;
  onToggleCheck: (id: number) => void;
  onToggleCheckAll: (items: WatchlistEtf[]) => void;
  onEdit: (etf: WatchlistEtf) => void;
  onDelete: (etf: WatchlistEtf) => void;
  onMemoClick: (etf: WatchlistEtf) => void;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {showCheckbox && (
                <TableHead className="w-10 text-center">
                  <Checkbox
                    checked={items.length > 0 && items.every((i) => checkedIds.has(i.id))}
                    onCheckedChange={() => onToggleCheckAll(items)}
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
              {listType === "core" && <TableHead className="text-xs text-right">배당수익률</TableHead>}
              <TableHead className="text-xs text-center">메모</TableHead>
              {showManage && <TableHead className="text-xs text-right w-24">관리</TableHead>}
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
                  {showCheckbox && (
                    <TableCell className="text-center">
                      <Checkbox
                        checked={checkedIds.has(etf.id)}
                        onCheckedChange={() => onToggleCheck(etf.id)}
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
                  {listType === "core" && (
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      {md?.dividendYield != null ? (
                        <span className={`font-medium ${md.dividendYield > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                          {md.dividendYield.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-center">
                    {etf.memo ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="메모 보기"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMemoClick(etf);
                        }}
                      >
                        <FileText className="w-3.5 h-3.5 text-primary" />
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  {showManage && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="수정"
                          onClick={() => onEdit(etf)}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          title="삭제"
                          onClick={() => onDelete(etf)}
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
  );
}

interface WatchlistEtfProps {
  listType?: WatchlistListType;
}

export default function WatchlistEtfComponent({ listType = "core" }: WatchlistEtfProps) {
  const { isAdmin, isLoggedIn, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // listType에 따른 API 경로 및 라벨 설정
  const apiBase = listType === "satellite" ? "/api/satellite-etfs" : "/api/watchlist-etfs";
  const listTitle = listType === "satellite" ? "관심ETF(Satellite)" : "관심ETF(Core)";
  const TitleIcon = listType === "satellite" ? Satellite : Star;
  const iconColor = listType === "satellite" ? "text-blue-500" : "text-yellow-500";
  const isSatellite = listType === "satellite";

  // state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<"common" | "personal">("common"); // satellite용: 어디에 추가할지
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
  const [memoDialogOpen, setMemoDialogOpen] = useState(false);
  const [selectedMemoEtf, setSelectedMemoEtf] = useState<WatchlistEtf | null>(null);

  // ===== API 조회 =====

  // Core: 단일 목록 / Satellite: 공통 목록
  const { data: commonList = [], isLoading: isLoadingCommon } = useQuery<WatchlistEtf[]>({
    queryKey: isSatellite ? [apiBase, "common"] : [apiBase],
    queryFn: async () => {
      const url = isSatellite ? `${apiBase}?listType=common` : apiBase;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: isLoggedIn,
  });

  // Satellite: 개인 목록
  const { data: personalList = [], isLoading: isLoadingPersonal } = useQuery<WatchlistEtf[]>({
    queryKey: [apiBase, "personal"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}?listType=personal`, { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: isLoggedIn && isSatellite,
  });

  // 통합 목록 (core는 commonList만, satellite은 common+personal)
  const allItems = useMemo(() => {
    if (!isSatellite) return commonList;
    return [...commonList, ...personalList];
  }, [isSatellite, commonList, personalList]);

  // API: ETF 시세 정보 조회
  const { data: marketData = {}, isLoading: isMarketLoading, refetch: refetchMarket } = useQuery<Record<string, EtfMarketData>>({
    queryKey: [`${apiBase}/market-data`],
    enabled: isLoggedIn && allItems.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = isLoadingCommon || (isSatellite && isLoadingPersonal);

  // 섹터 목록 추출 (전체)
  const sectors = useMemo(() => {
    const sectorSet = new Set<string>();
    allItems.forEach((e) => { if (e.sector) sectorSet.add(e.sector); });
    return Array.from(sectorSet).sort();
  }, [allItems]);

  // 필터된 목록
  const filteredCommon = useMemo(() => {
    if (!filterSector) return commonList;
    return commonList.filter((e) => e.sector === filterSector);
  }, [commonList, filterSector]);

  const filteredPersonal = useMemo(() => {
    if (!filterSector) return personalList;
    return personalList.filter((e) => e.sector === filterSector);
  }, [personalList, filterSector]);

  // Core: 섹터별 그룹
  const groupedBySector = useMemo(() => {
    const list = isSatellite ? [] : filteredCommon;
    const groups = new Map<string, WatchlistEtf[]>();
    list.forEach((e) => {
      const key = e.sector || "기본";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredCommon, isSatellite]);

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

  // 공통관심 추가 mutation
  const addCommonMutation = useMutation({
    mutationFn: async (data: { etfCode: string; etfName: string; sector: string; memo: string }) => {
      const url = isSatellite ? `${apiBase}/common` : apiBase;
      const res = await apiRequest("POST", url, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: isSatellite ? [apiBase, "common"] : [apiBase] });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/market-data`] });
      toast({ title: "추가 완료", description: "공통관심 ETF가 추가되었습니다." });
      closeAddDialog();
    },
    onError: (err: Error) => {
      toast({ title: "추가 실패", description: err.message, variant: "destructive" });
    },
  });

  // 개인관심 추가 mutation (satellite only)
  const addPersonalMutation = useMutation({
    mutationFn: async (data: { etfCode: string; etfName: string; sector: string; memo: string }) => {
      const res = await apiRequest("POST", `${apiBase}/personal`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase, "personal"] });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/market-data`] });
      toast({ title: "추가 완료", description: "개인관심 ETF가 추가되었습니다." });
      closeAddDialog();
    },
    onError: (err: Error) => {
      toast({ title: "추가 실패", description: err.message, variant: "destructive" });
    },
  });

  // 수정 mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; sector?: string; memo?: string }) => {
      const res = await apiRequest("PUT", `${apiBase}/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase] });
      if (isSatellite) {
        queryClient.invalidateQueries({ queryKey: [apiBase, "common"] });
        queryClient.invalidateQueries({ queryKey: [apiBase, "personal"] });
      }
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
      await apiRequest("DELETE", `${apiBase}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase] });
      if (isSatellite) {
        queryClient.invalidateQueries({ queryKey: [apiBase, "common"] });
        queryClient.invalidateQueries({ queryKey: [apiBase, "personal"] });
      }
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
    const data = {
      etfCode: selectedEtf.code,
      etfName: selectedEtf.name,
      sector: sectorInput.trim() || "기본",
      memo: memoInput.trim(),
    };
    if (isSatellite && addTarget === "personal") {
      addPersonalMutation.mutate(data);
    } else {
      addCommonMutation.mutate(data);
    }
  }, [selectedEtf, sectorInput, memoInput, addTarget, isSatellite, addCommonMutation, addPersonalMutation]);

  const isAddPending = addCommonMutation.isPending || addPersonalMutation.isPending;

  // 체크 관련
  const handleToggleCheck = useCallback((id: number) => {
    setCheckedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const handleToggleCheckAll = useCallback((items: WatchlistEtf[]) => {
    setCheckedIds(prev => {
      const allChecked = items.every(i => prev.has(i.id));
      const newSet = new Set(prev);
      items.forEach(i => {
        if (allChecked) newSet.delete(i.id);
        else newSet.add(i.id);
      });
      return newSet;
    });
  }, []);

  // 체크된 ETF 매수하기 → 자동매매로 이동
  const handleBuyChecked = useCallback(() => {
    const selected = allItems.filter((e) => checkedIds.has(e.id));
    if (selected.length === 0) {
      toast({ title: "선택 필요", description: "매수할 ETF를 선택해주세요.", variant: "destructive" });
      return;
    }
    const first = selected[0];
    navigate(`/trading?code=${encodeURIComponent(first.etfCode)}&name=${encodeURIComponent(first.etfName)}`);
  }, [checkedIds, allItems, navigate, toast]);

  // 수정 핸들러
  const handleEdit = useCallback((etf: WatchlistEtf) => {
    setEditTarget(etf);
    setSectorInput(etf.sector || "기본");
    setMemoInput(etf.memo || "");
    setEditDialogOpen(true);
  }, []);

  // 삭제 핸들러
  const handleDelete = useCallback((etf: WatchlistEtf) => {
    if (confirm(`"${etf.etfName}" 을(를) 삭제하시겠습니까?`)) {
      deleteMutation.mutate(etf.id);
    }
  }, [deleteMutation]);

  // 메모 핸들러
  const handleMemoClick = useCallback((etf: WatchlistEtf) => {
    setSelectedMemoEtf(etf);
    setMemoDialogOpen(true);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ===== Core 타입: 기존 로직 유지 =====
  if (!isSatellite) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TitleIcon className={`w-5 h-5 ${iconColor}`} />
                {listTitle}
                <span className="text-sm font-normal text-muted-foreground">({commonList.length}개)</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                {commonList.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => refetchMarket()} disabled={isMarketLoading} className="gap-1.5 text-xs">
                    <RefreshCw className={`w-3.5 h-3.5 ${isMarketLoading ? "animate-spin" : ""}`} />
                    시세 갱신
                  </Button>
                )}
                {isAdmin && (
                  <Button size="sm" onClick={() => { setAddTarget("common"); setAddDialogOpen(true); }} className="gap-1.5">
                    <Plus className="w-4 h-4" />
                    관심ETF 추가
                  </Button>
                )}
                {checkedIds.size > 0 && (
                  <Button size="sm" onClick={handleBuyChecked} className="gap-1.5 bg-red-500 hover:bg-red-600 text-white">
                    <ShoppingCart className="w-4 h-4" />
                    매수 ({checkedIds.size})
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          {sectors.length > 1 && (
            <div className="px-6 pb-3">
              <div className="flex flex-wrap gap-1.5">
                <Button variant={filterSector === null ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setFilterSector(null)}>전체</Button>
                {sectors.map((sector) => (
                  <Button key={sector} variant={filterSector === sector ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1" onClick={() => setFilterSector(filterSector === sector ? null : sector)}>
                    <Tag className="w-3 h-3" />{sector}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <CardContent className="pt-0">
            {commonList.length === 0 ? (
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
                    <EtfTable
                      items={items}
                      marketData={marketData}
                      listType={listType}
                      showCheckbox={true}
                      showManage={isAdmin}
                      checkedIds={checkedIds}
                      onToggleCheck={handleToggleCheck}
                      onToggleCheckAll={handleToggleCheckAll}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onMemoClick={handleMemoClick}
                    />
                  </div>
                ))}

                {checkedIds.size > 0 && (
                  <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                    <span className="text-sm font-medium">{checkedIds.size}개 ETF 선택됨</span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setCheckedIds(new Set())} className="text-xs">
                        선택해제
                      </Button>
                      <Button size="sm" onClick={handleBuyChecked} className="gap-1.5 bg-red-500 hover:bg-red-600 text-white">
                        <ShoppingCart className="w-4 h-4" />선택 ETF 매수하기
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 다이얼로그들 */}
        {renderAddDialog()}
        {renderEditDialog()}
        {renderMemoDialog()}
      </div>
    );
  }

  // ===== Satellite 타입: 공통/개인 분리 UI =====
  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TitleIcon className={`w-5 h-5 ${iconColor}`} />
              {listTitle}
              <span className="text-sm font-normal text-muted-foreground">({allItems.length}개)</span>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {allItems.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => refetchMarket()} disabled={isMarketLoading} className="gap-1.5 text-xs">
                  <RefreshCw className={`w-3.5 h-3.5 ${isMarketLoading ? "animate-spin" : ""}`} />
                  시세 갱신
                </Button>
              )}
              {isAdmin ? (
                <>
                  <Button size="sm" variant="default" onClick={() => { setAddTarget("common"); setAddDialogOpen(true); }} className="gap-1.5">
                    <Users className="w-4 h-4" />
                    공통관심ETF 추가
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setAddTarget("personal"); setAddDialogOpen(true); }} className="gap-1.5">
                    <User className="w-4 h-4" />
                    개인관심ETF 추가
                  </Button>
                </>
              ) : isLoggedIn ? (
                <Button size="sm" variant="outline" onClick={() => { setAddTarget("personal"); setAddDialogOpen(true); }} className="gap-1.5">
                  <User className="w-4 h-4" />
                  개인관심ETF 등록
                </Button>
              ) : null}
              {checkedIds.size > 0 && (
                <Button size="sm" onClick={handleBuyChecked} className="gap-1.5 bg-red-500 hover:bg-red-600 text-white">
                  <ShoppingCart className="w-4 h-4" />
                  매수 ({checkedIds.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* 섹터 필터 */}
        {sectors.length > 1 && (
          <div className="px-6 pb-3">
            <div className="flex flex-wrap gap-1.5">
              <Button variant={filterSector === null ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setFilterSector(null)}>전체</Button>
              {sectors.map((sector) => (
                <Button key={sector} variant={filterSector === sector ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1" onClick={() => setFilterSector(filterSector === sector ? null : sector)}>
                  <Tag className="w-3 h-3" />{sector}
                </Button>
              ))}
            </div>
          </div>
        )}

        <CardContent className="pt-0 space-y-6">
          {/* ===== 공통관심 ETF 리스트 ===== */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold">공통관심 ETF</h3>
              <span className="text-xs text-muted-foreground">({filteredCommon.length}개)</span>
            </div>
            {filteredCommon.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground border rounded-lg">
                <Satellite className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">등록된 공통관심 ETF가 없습니다.</p>
              </div>
            ) : (
              <EtfTable
                items={filteredCommon}
                marketData={marketData}
                listType={listType}
                showCheckbox={true}
                showManage={isAdmin}
                checkedIds={checkedIds}
                onToggleCheck={handleToggleCheck}
                onToggleCheckAll={handleToggleCheckAll}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onMemoClick={handleMemoClick}
              />
            )}
          </div>

          {/* ===== 개인관심 ETF 리스트 ===== */}
          {isLoggedIn && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-green-500" />
                <h3 className="text-sm font-semibold">개인관심 ETF</h3>
                <span className="text-xs text-muted-foreground">({filteredPersonal.length}개)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">내 목록</span>
              </div>
              {filteredPersonal.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground border rounded-lg border-dashed">
                  <User className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">등록된 개인관심 ETF가 없습니다.</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() => { setAddTarget("personal"); setAddDialogOpen(true); }}
                  >
                    <Plus className="w-3 h-3 mr-1" /> 추가하기
                  </Button>
                </div>
              ) : (
                <EtfTable
                  items={filteredPersonal}
                  marketData={marketData}
                  listType={listType}
                  showCheckbox={true}
                  showManage={true}
                  checkedIds={checkedIds}
                  onToggleCheck={handleToggleCheck}
                  onToggleCheckAll={handleToggleCheckAll}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onMemoClick={handleMemoClick}
                />
              )}
            </div>
          )}

          {/* 매수 바 */}
          {checkedIds.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <span className="text-sm font-medium">{checkedIds.size}개 ETF 선택됨</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setCheckedIds(new Set())} className="text-xs">
                  선택해제
                </Button>
                <Button size="sm" onClick={handleBuyChecked} className="gap-1.5 bg-red-500 hover:bg-red-600 text-white">
                  <ShoppingCart className="w-4 h-4" />선택 ETF 매수하기
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 다이얼로그들 */}
      {renderAddDialog()}
      {renderEditDialog()}
      {renderMemoDialog()}
    </div>
  );

  // ===== 공통 다이얼로그 렌더 함수들 =====

  function renderAddDialog() {
    const titleLabel = isSatellite
      ? (addTarget === "common" ? "공통관심 ETF 추가" : "개인관심 ETF 추가")
      : "관심 ETF 추가";

    return (
      <Dialog open={addDialogOpen} onOpenChange={(open) => { if (!open) closeAddDialog(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {addTarget === "common" ? <Users className="w-5 h-5 text-blue-500" /> : <User className="w-5 h-5 text-green-500" />}
              {titleLabel}
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

            {/* 선택된 ETF */}
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

            {/* 섹터 */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">섹터 분류</label>
              <SectorInput value={sectorInput} onChange={setSectorInput} existingSectors={sectors} />
            </div>

            {/* 메모 */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">메모 (선택)</label>
              <Input value={memoInput} onChange={(e) => setMemoInput(e.target.value)} placeholder="간단한 메모..." className="text-sm" />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={closeAddDialog}>취소</Button>
            <Button onClick={handleAdd} disabled={!selectedEtf || isAddPending} className="gap-1.5">
              {isAddPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function renderEditDialog() {
    return (
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
                <SectorInput value={sectorInput} onChange={setSectorInput} existingSectors={sectors} />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">메모</label>
                <Input value={memoInput} onChange={(e) => setMemoInput(e.target.value)} placeholder="간단한 메모..." className="text-sm" />
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setEditTarget(null); }}>취소</Button>
            <Button
              onClick={() => {
                if (!editTarget) return;
                updateMutation.mutate({ id: editTarget.id, sector: sectorInput.trim() || "기본", memo: memoInput.trim() || undefined });
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
    );
  }

  function renderMemoDialog() {
    return (
      <Dialog open={memoDialogOpen} onOpenChange={(open) => { if (!open) { setMemoDialogOpen(false); setSelectedMemoEtf(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              메모
            </DialogTitle>
          </DialogHeader>
          {selectedMemoEtf && (
            <div className="space-y-3">
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-sm font-medium">{selectedMemoEtf.etfName}</p>
                <p className="text-xs text-muted-foreground font-mono">{selectedMemoEtf.etfCode}</p>
              </div>
              <div className="p-4 bg-background border rounded-lg">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedMemoEtf.memo}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMemoDialogOpen(false); setSelectedMemoEtf(null); }}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}
