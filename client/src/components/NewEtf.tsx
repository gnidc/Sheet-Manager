import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2, Search, Plus, Pencil, Trash2, X, ExternalLink, Save,
  TrendingUp, TrendingDown, Minus, Link as LinkIcon, FileText,
  ChevronDown, ChevronUp, BarChart3, PieChart, RefreshCw,
} from "lucide-react";

// ========== Types ==========
interface SavedEtf {
  id: number;
  userId: number | null;
  etfCode: string;
  etfName: string;
  category: string | null;
  assetManager: string | null;
  listingDate: string | null;
  totalAsset: string | null;
  expense: string | null;
  benchmark: string | null;
  recentPrice: string | null;
  recentChange: string | null;
  portfolioData: string | null;
  comment: string | null;
  relatedLinks: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EtfSearchResult {
  code: string;
  name: string;
}

interface PortfolioItem {
  stockCode: string;
  name: string;
  weight: number;
  quantity: number;
  price: string;
  change: string;
  changePercent: string;
  changeSign: string;
  volume: string;
}

interface EtfDetailInfo {
  etfCode: string;
  etfName: string;
  category: string;
  assetManager: string;
  listingDate: string;
  totalAsset: string;
  expense: string;
  benchmark: string;
  recentPrice: string;
  recentChange: string;
  portfolioData: PortfolioItem[];
}

interface RelatedLink {
  title: string;
  url: string;
}

// ========== Main Component ==========
export default function NewEtf() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedEtf, setSelectedEtf] = useState<SavedEtf | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [commentEtf, setCommentEtf] = useState<SavedEtf | null>(null);

  // 저장된 ETF 목록 조회
  const { data: savedEtfs, isLoading } = useQuery<SavedEtf[]>({
    queryKey: ["/api/saved-etfs"],
  });

  // 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/saved-etfs/${id}`);
    },
    onSuccess: () => {
      toast({ title: "삭제 완료", description: "ETF가 삭제되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-etfs"] });
    },
    onError: (error: Error) => {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    },
  });

  // 선택된 항목 일괄 삭제
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast({ title: "알림", description: "삭제할 ETF를 선택해주세요.", variant: "destructive" });
      return;
    }
    if (!confirm(`${selectedIds.size}개의 ETF를 삭제하시겠습니까?`)) return;
    for (const id of Array.from(selectedIds)) {
      await deleteMutation.mutateAsync(id);
    }
    setSelectedIds(new Set());
  };

  // ETF 클릭 → 상세보기
  const handleEtfClick = (etf: SavedEtf) => {
    setSelectedEtf(etf);
    setIsEditing(false);
    setDetailDialogOpen(true);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* 상단 버튼 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          {isAdmin ? "신규ETF 관리" : "ETF 리스트"}
        </h2>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setRegisterDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              신규등록
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (selectedIds.size === 1) {
                  const id = Array.from(selectedIds)[0];
                  const etf = savedEtfs?.find(e => e.id === id);
                  if (etf) {
                    setSelectedEtf(etf);
                    setIsEditing(true);
                    setDetailDialogOpen(true);
                  }
                } else {
                  toast({ title: "알림", description: "변경할 ETF 1개를 선택해주세요.", variant: "destructive" });
                }
              }}
            >
              <Pencil className="w-4 h-4 mr-1" />
              변경등록
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              삭제
            </Button>
          </div>
        )}
      </div>

      {/* ETF 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : !savedEtfs || savedEtfs.length === 0 ? (
        <Card>
          <CardContent className="p-16 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-lg font-semibold mb-2">등록된 ETF가 없습니다</h3>
            {isAdmin ? (
              <>
                <p className="text-muted-foreground mb-4">신규등록 버튼을 클릭하여 ETF를 추가해보세요.</p>
                <Button onClick={() => setRegisterDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  첫 ETF 등록하기
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground mb-4">관리자가 등록한 ETF가 표시됩니다.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && (
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedIds.size === savedEtfs.length && savedEtfs.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(new Set(savedEtfs.map(e => e.id)));
                            } else {
                              setSelectedIds(new Set());
                            }
                          }}
                        />
                      </TableHead>
                    )}
                    <TableHead>ETF코드</TableHead>
                    <TableHead>ETF명</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead className="text-right">시가총액</TableHead>
                    <TableHead className="text-right">총보수</TableHead>
                    <TableHead className="text-right">현재가</TableHead>
                    <TableHead className="text-right">등락률</TableHead>
                    <TableHead className="text-center">코멘트</TableHead>
                    <TableHead>상장일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedEtfs.map((etf) => {
                    const change = parseFloat(etf.recentChange || "0");
                    return (
                      <TableRow
                        key={etf.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleEtfClick(etf)}
                      >
                        {isAdmin && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="rounded"
                              checked={selectedIds.has(etf.id)}
                              onChange={() => toggleSelect(etf.id)}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-sm">{etf.etfCode}</TableCell>
                        <TableCell className="font-medium">{etf.etfName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{etf.category || "-"}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">{etf.totalAsset || "-"}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">{etf.expense || "-"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {etf.recentPrice ? Number(etf.recentPrice).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className={`text-right font-bold text-sm ${change > 0 ? "text-red-500" : change < 0 ? "text-blue-500" : "text-gray-500"}`}>
                          {change > 0 ? "+" : ""}{change ? change.toFixed(2) + "%" : "-"}
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          {etf.comment ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              onClick={() => setCommentEtf(etf)}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              보기
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {etf.listingDate || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 코멘트 보기 다이얼로그 */}
      <Dialog open={!!commentEtf} onOpenChange={() => setCommentEtf(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              {commentEtf?.etfName} 코멘트
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto p-1">
            {commentEtf?.comment || "코멘트가 없습니다."}
          </div>
        </DialogContent>
      </Dialog>

      {/* 신규등록 팝업 */}
      <RegisterDialog
        open={registerDialogOpen}
        onClose={() => setRegisterDialogOpen(false)}
      />

      {/* 상세보기/수정 팝업 */}
      {selectedEtf && (
        <DetailDialog
          open={detailDialogOpen}
          onClose={() => {
            setDetailDialogOpen(false);
            setSelectedEtf(null);
            setIsEditing(false);
          }}
          etf={selectedEtf}
          initialEditing={isEditing}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

// ========== 신규등록 다이얼로그 ==========
function RegisterDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EtfSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCode, setSelectedCode] = useState("");
  const [etfDetail, setEtfDetail] = useState<EtfDetailInfo | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [comment, setComment] = useState("");
  const [relatedLinks, setRelatedLinks] = useState<RelatedLink[]>([{ title: "", url: "" }]);
  const [step, setStep] = useState<"search" | "detail">("search");

  // 초기화
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedCode("");
      setEtfDetail(null);
      setComment("");
      setRelatedLinks([{ title: "", url: "" }]);
      setStep("search");
    }
  }, [open]);

  // ETF 검색
  const handleSearch = async () => {
    if (searchQuery.length < 2) {
      toast({ title: "알림", description: "검색어를 2자 이상 입력해주세요.", variant: "destructive" });
      return;
    }
    setSearching(true);
    try {
      const res = await apiRequest("GET", `/api/etf/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
      if ((data.results || []).length === 0) {
        toast({ title: "알림", description: "검색 결과가 없습니다." });
      }
    } catch (error: any) {
      toast({ title: "검색 실패", description: error.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  // ETF 선택 → 상세 정보 불러오기
  const handleSelectEtf = async (code: string) => {
    setSelectedCode(code);
    setLoadingDetail(true);
    try {
      const res = await apiRequest("GET", `/api/etf/detail-info/${code}`);
      const detail = await res.json();
      setEtfDetail(detail);
      setStep("detail");
    } catch (error: any) {
      toast({ title: "정보 조회 실패", description: error.message, variant: "destructive" });
    } finally {
      setLoadingDetail(false);
    }
  };

  // 저장
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/saved-etfs", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "등록 완료", description: "ETF가 성공적으로 등록되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-etfs"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "등록 실패", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!etfDetail) return;
    const validLinks = relatedLinks.filter(l => l.title.trim() || l.url.trim());
    saveMutation.mutate({
      etfCode: etfDetail.etfCode,
      etfName: etfDetail.etfName,
      category: etfDetail.category || null,
      assetManager: etfDetail.assetManager || null,
      listingDate: etfDetail.listingDate || null,
      totalAsset: etfDetail.totalAsset || null,
      expense: etfDetail.expense || null,
      benchmark: etfDetail.benchmark || null,
      recentPrice: etfDetail.recentPrice || null,
      recentChange: etfDetail.recentChange || null,
      portfolioData: etfDetail.portfolioData?.length > 0 ? JSON.stringify(etfDetail.portfolioData) : null,
      comment: comment || null,
      relatedLinks: validLinks.length > 0 ? JSON.stringify(validLinks) : null,
    });
  };

  const addLinkRow = () => setRelatedLinks(prev => [...prev, { title: "", url: "" }]);
  const removeLinkRow = (idx: number) => setRelatedLinks(prev => prev.filter((_, i) => i !== idx));
  const updateLink = (idx: number, field: "title" | "url", value: string) => {
    setRelatedLinks(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-500" />
            ETF 신규등록
          </DialogTitle>
        </DialogHeader>

        {step === "search" ? (
          <div className="space-y-4">
            {/* 검색창 */}
            <div className="flex gap-2">
              <Input
                placeholder="ETF 이름 또는 코드로 검색 (예: KODEX, 반도체, 069500)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="ml-1">검색</span>
              </Button>
            </div>

            {/* 검색 결과 */}
            {loadingDetail ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-sm text-muted-foreground">ETF 정보를 수집하고 있습니다...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">코드</TableHead>
                      <TableHead>ETF명</TableHead>
                      <TableHead className="w-20">선택</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((r) => (
                      <TableRow key={r.code} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-sm">{r.code}</TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSelectEtf(r.code)}
                          >
                            선택
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : searchQuery && !searching ? (
              <div className="text-center py-8 text-muted-foreground">
                검색 결과가 없습니다. 다른 키워드로 검색해보세요.
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>ETF 이름 또는 코드를 입력하여 검색하세요.</p>
              </div>
            )}
          </div>
        ) : etfDetail ? (
          <div className="space-y-6">
            {/* 뒤로가기 버튼 */}
            <Button variant="ghost" size="sm" onClick={() => setStep("search")}>
              ← 다시 검색
            </Button>

            {/* ETF 개요 표 */}
            <EtfOverviewTable detail={etfDetail} />

            {/* 포트폴리오 구성현황 */}
            <PortfolioSection portfolioData={etfDetail.portfolioData} />

            {/* 실시간 차트 */}
            <ChartSection etfCode={etfDetail.etfCode} etfName={etfDetail.etfName} />

            {/* Comment 섹션 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-orange-500" />
                  Comment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="개인적인 코멘트를 입력하세요 (투자 메모, 분석 내용 등)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>

            {/* 관련문서 링크 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-purple-500" />
                  관련문서
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {relatedLinks.map((link, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      placeholder="제목"
                      value={link.title}
                      onChange={(e) => updateLink(idx, "title", e.target.value)}
                      className="w-1/3"
                    />
                    <Input
                      placeholder="URL (https://...)"
                      value={link.url}
                      onChange={(e) => updateLink(idx, "url", e.target.value)}
                      className="flex-1"
                    />
                    {relatedLinks.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeLinkRow(idx)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addLinkRow}>
                  <Plus className="w-3 h-3 mr-1" /> 링크 추가
                </Button>
              </CardContent>
            </Card>

            {/* 저장 */}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>취소</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                저장
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ========== 상세보기/수정 다이얼로그 ==========
function DetailDialog({ open, onClose, etf, initialEditing, isAdmin }: { open: boolean; onClose: () => void; etf: SavedEtf; initialEditing: boolean; isAdmin: boolean }) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [comment, setComment] = useState(etf.comment || "");
  const [relatedLinks, setRelatedLinks] = useState<RelatedLink[]>(() => {
    try { return etf.relatedLinks ? JSON.parse(etf.relatedLinks) : [{ title: "", url: "" }]; }
    catch { return [{ title: "", url: "" }]; }
  });

  useEffect(() => {
    setIsEditing(initialEditing);
    setComment(etf.comment || "");
    try { setRelatedLinks(etf.relatedLinks ? JSON.parse(etf.relatedLinks) : [{ title: "", url: "" }]); }
    catch { setRelatedLinks([{ title: "", url: "" }]); }
  }, [etf, initialEditing]);

  const portfolioData: PortfolioItem[] = (() => {
    try {
      const raw = etf.portfolioData ? JSON.parse(etf.portfolioData) : [];
      // 이전 형식(name+weight만) 호환
      return raw.map((item: any) => ({
        stockCode: item.stockCode || "",
        name: item.name || item.stockName || "",
        weight: item.weight || 0,
        quantity: item.quantity || 0,
        price: item.price || "",
        change: item.change || "",
        changePercent: item.changePercent || "",
        changeSign: item.changeSign || "",
        volume: item.volume || "",
      }));
    }
    catch { return []; }
  })();

  // 수정 mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/saved-etfs/${etf.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "수정 완료", description: "ETF 정보가 수정되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-etfs"] });
      setIsEditing(false);
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "수정 실패", description: error.message, variant: "destructive" });
    },
  });

  // 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/saved-etfs/${etf.id}`);
    },
    onSuccess: () => {
      toast({ title: "삭제 완료", description: "ETF가 삭제되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-etfs"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    },
  });

  // 정보 새로고침
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await apiRequest("GET", `/api/etf/detail-info/${etf.etfCode}`);
      const detail = await res.json();
      await updateMutation.mutateAsync({
        recentPrice: detail.recentPrice || etf.recentPrice,
        recentChange: detail.recentChange || etf.recentChange,
        totalAsset: detail.totalAsset || etf.totalAsset,
        portfolioData: detail.portfolioData?.length > 0 ? JSON.stringify(detail.portfolioData) : etf.portfolioData,
      });
      toast({ title: "새로고침 완료", description: "최신 정보로 업데이트되었습니다." });
    } catch (err: any) {
      toast({ title: "새로고침 실패", description: err.message, variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSave = () => {
    const validLinks = relatedLinks.filter(l => l.title.trim() || l.url.trim());
    updateMutation.mutate({
      comment: comment || null,
      relatedLinks: validLinks.length > 0 ? JSON.stringify(validLinks) : null,
    });
  };

  const handleDelete = () => {
    if (confirm("이 ETF를 삭제하시겠습니까?")) {
      deleteMutation.mutate();
    }
  };

  const addLinkRow = () => setRelatedLinks(prev => [...prev, { title: "", url: "" }]);
  const removeLinkRow = (idx: number) => setRelatedLinks(prev => prev.filter((_, i) => i !== idx));
  const updateLink = (idx: number, field: "title" | "url", value: string) => {
    setRelatedLinks(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const detailForTable: EtfDetailInfo = {
    etfCode: etf.etfCode,
    etfName: etf.etfName,
    category: etf.category || "",
    assetManager: etf.assetManager || "",
    listingDate: etf.listingDate || "",
    totalAsset: etf.totalAsset || "",
    expense: etf.expense || "",
    benchmark: etf.benchmark || "",
    recentPrice: etf.recentPrice || "",
    recentChange: etf.recentChange || "",
    portfolioData,
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            {etf.etfName} ({etf.etfCode})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 상단 액션 버튼 */}
          <div className="flex gap-2 justify-end">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                정보 새로고침
              </Button>
            )}
            {isAdmin && !isEditing && (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil className="w-4 h-4 mr-1" />
                  수정
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMutation.isPending}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  삭제
                </Button>
              </>
            )}
            {isAdmin && isEditing && (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  취소
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  저장
                </Button>
              </>
            )}
          </div>

          {/* ETF 개요 표 */}
          <EtfOverviewTable detail={detailForTable} />

          {/* 포트폴리오 구성현황 */}
          <PortfolioSection portfolioData={portfolioData} />

          {/* 실시간 차트 */}
          <ChartSection etfCode={etf.etfCode} etfName={etf.etfName} />

          {/* Comment 섹션 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                Comment
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isAdmin && isEditing ? (
                <Textarea
                  placeholder="개인적인 코멘트를 입력하세요"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                />
              ) : (
                <div className="whitespace-pre-wrap text-sm min-h-[40px]">
                  {etf.comment || <span className="text-muted-foreground italic">코멘트 없음</span>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 관련문서 링크 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-purple-500" />
                관련문서
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isAdmin && isEditing ? (
                <div className="space-y-2">
                  {relatedLinks.map((link, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        placeholder="제목"
                        value={link.title}
                        onChange={(e) => updateLink(idx, "title", e.target.value)}
                        className="w-1/3"
                      />
                      <Input
                        placeholder="URL (https://...)"
                        value={link.url}
                        onChange={(e) => updateLink(idx, "url", e.target.value)}
                        className="flex-1"
                      />
                      {relatedLinks.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeLinkRow(idx)}>
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addLinkRow}>
                    <Plus className="w-3 h-3 mr-1" /> 링크 추가
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(() => {
                    let links: RelatedLink[] = [];
                    try { links = etf.relatedLinks ? JSON.parse(etf.relatedLinks) : []; }
                    catch { links = []; }
                    return links.filter(l => l.url).length > 0 ? (
                      links.filter(l => l.url).map((link, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <ExternalLink className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline truncate"
                          >
                            {link.title || link.url}
                          </a>
                        </div>
                      ))
                    ) : (
                      <span className="text-muted-foreground italic text-sm">관련문서 없음</span>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ========== ETF 개요 표 ==========
function EtfOverviewTable({ detail }: { detail: EtfDetailInfo }) {
  const change = parseFloat(detail.recentChange || "0");
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-500" />
          ETF 개요
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
          <InfoRow label="ETF코드" value={detail.etfCode} />
          <InfoRow label="ETF명" value={detail.etfName} bold />
          <InfoRow label="카테고리" value={detail.category || "-"} />
          <InfoRow label="운용사" value={detail.assetManager || "-"} />
          <InfoRow label="상장일" value={detail.listingDate || "-"} />
          <InfoRow label="순자산총액" value={detail.totalAsset || "-"} />
          <InfoRow label="총보수" value={detail.expense || "-"} />
          <InfoRow label="기초지수" value={detail.benchmark || "-"} />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">현재가</span>
            <span className="font-bold text-lg">
              {detail.recentPrice ? Number(detail.recentPrice).toLocaleString() + "원" : "-"}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">등락률</span>
            <span className={`font-bold text-lg flex items-center gap-1 ${
              change > 0 ? "text-red-500" : change < 0 ? "text-blue-500" : "text-gray-500"
            }`}>
              {change > 0 ? <TrendingUp className="w-4 h-4" /> : change < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
              {change > 0 ? "+" : ""}{change ? change.toFixed(2) + "%" : "-"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm ${bold ? "font-bold" : ""}`}>{value}</span>
    </div>
  );
}

// ========== 포트폴리오 구성현황 (실시간 시세 포함) ==========
function PortfolioSection({ portfolioData }: { portfolioData: PortfolioItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const [sortField, setSortField] = useState<"weight" | "changePercent">("weight");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (field: "weight" | "changePercent") => {
    if (sortField === field) {
      setSortDir(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  if (!portfolioData || portfolioData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <PieChart className="w-4 h-4 text-green-500" />
            포트폴리오 구성현황
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">포트폴리오 정보가 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...portfolioData].sort((a, b) => {
    let valA: number, valB: number;
    if (sortField === "changePercent") {
      valA = parseFloat(a.changePercent) || 0;
      valB = parseFloat(b.changePercent) || 0;
    } else {
      valA = a.weight;
      valB = b.weight;
    }
    return sortDir === "desc" ? valB - valA : valA - valB;
  });
  const displayed = expanded ? sorted : sorted.slice(0, 15);
  const hasPriceData = portfolioData.some(p => p.price && p.price !== "0");
  const sortArrow = (field: "weight" | "changePercent") =>
    sortField === field ? (sortDir === "desc" ? " ▼" : " ▲") : "";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <PieChart className="w-4 h-4 text-green-500" />
          포트폴리오 구성현황 ({portfolioData.length}종목)
          {hasPriceData && <span className="text-xs text-blue-500 font-normal ml-2">실시간 시세 포함</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-center p-1.5 w-8">#</th>
                <th className="text-left p-1.5">종목명</th>
                <th className="text-left p-1.5 w-16">코드</th>
                <th
                  className="text-right p-1.5 w-16 cursor-pointer hover:text-blue-500 select-none"
                  onClick={() => handleSort("weight")}
                >
                  비중{sortArrow("weight")}
                </th>
                {hasPriceData && (
                  <>
                    <th className="text-right p-1.5 w-20">현재가</th>
                    <th
                      className="text-right p-1.5 w-16 cursor-pointer hover:text-blue-500 select-none"
                      onClick={() => handleSort("changePercent")}
                    >
                      등락률{sortArrow("changePercent")}
                    </th>
                    <th className="text-right p-1.5 w-20">거래량</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {displayed.map((item, idx) => {
                const cp = parseFloat(item.changePercent) || 0;
                const sign = item.changeSign;
                const isUp = sign === "2" || sign === "1" || cp > 0;
                const isDown = sign === "4" || sign === "5" || cp < 0;
                const colorClass = isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-gray-500";

                return (
                  <tr key={idx} className="border-b hover:bg-muted/30">
                    <td className="text-center p-1.5 text-muted-foreground">{idx + 1}</td>
                    <td className="p-1.5 font-medium truncate max-w-[160px]">{item.name}</td>
                    <td className="p-1.5 text-muted-foreground font-mono">{item.stockCode || "-"}</td>
                    <td className="text-right p-1.5 font-mono">{item.weight.toFixed(2)}%</td>
                    {hasPriceData && (
                      <>
                        <td className="text-right p-1.5 font-mono">
                          {item.price ? Number(item.price).toLocaleString() : "-"}
                        </td>
                        <td className={`text-right p-1.5 font-mono font-semibold ${colorClass}`}>
                          {cp !== 0 ? `${cp > 0 ? "+" : ""}${cp.toFixed(2)}%` : "-"}
                        </td>
                        <td className="text-right p-1.5 font-mono text-muted-foreground">
                          {item.volume ? Number(item.volume).toLocaleString() : "-"}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sorted.length > 15 && (
          <div className="p-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setExpanded(!expanded)}>
              {expanded ? (
                <><ChevronUp className="w-4 h-4 mr-1" /> 접기</>
              ) : (
                <><ChevronDown className="w-4 h-4 mr-1" /> 나머지 {sorted.length - 15}종목 더보기</>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ========== 실시간 차트 ==========
function ChartSection({ etfCode, etfName }: { etfCode: string; etfName: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-500" />
          실시간 차트
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-white rounded-lg overflow-hidden border">
          <iframe
            src={`https://ssl.pstatic.net/imgfinance/chart/item/candle/day/${etfCode}.png?sidcode=${Date.now()}`}
            className="hidden"
          />
          <img
            src={`https://ssl.pstatic.net/imgfinance/chart/item/candle/day/${etfCode}.png?sidcode=${Date.now()}`}
            alt={`${etfName} 일봉 차트`}
            className="w-full h-auto"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
            }}
          />
          <div className="hidden text-center py-8 text-muted-foreground text-sm">
            차트를 불러올 수 없습니다.
          </div>
        </div>
        <div className="flex gap-2 mt-2 justify-center">
          <Button variant="ghost" size="sm" asChild>
            <a href={`https://finance.naver.com/item/fchart.naver?code=${etfCode}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 mr-1" />
              네이버 상세차트
            </a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={`https://www.funetf.co.kr/product/etf/view/${etfCode}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 mr-1" />
              FunETF 상세
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

