import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Trash2, Loader2, Search, Sparkles, Brain, Rocket, Copy, ZoomIn, ZoomOut, ExternalLink, Users, User,
} from "lucide-react";

interface TenbaggerStock {
  id: number;
  stockCode: string;
  stockName: string;
  market: string | null;
  exchange: string | null;
  sector: string | null;
  memo: string | null;
  targetPrice: string | null;
  buyPrice: string | null;
  reason: string | null;
  aiAnalysis: string | null;
  aiAnalyzedAt: string | null;
  listType: string | null;
  userId: number | null;
  createdAt: string;
}

export default function TenBaggerStocks() {
  const { isAdmin, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addListType, setAddListType] = useState<"common" | "personal">("common");
  const [stockCode, setStockCode] = useState("");
  const [stockName, setStockName] = useState("");
  const [market, setMarket] = useState<"domestic" | "overseas">("domestic");
  const [exchange, setExchange] = useState("KOSPI");
  const [sector, setSector] = useState("");
  const [memo, setMemo] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [reason, setReason] = useState("");
  const [searchCode, setSearchCode] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{ code: string; name: string; exchange: string; typeName: string }[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [analysisAll, setAnalysisAll] = useState<string | null>(null);
  const [analysisAllLoading, setAnalysisAllLoading] = useState(false);
  const [fontSize, setFontSize] = useState(14);

  // 공통관심 목록
  const { data: commonStocks = [], isLoading: isCommonLoading } = useQuery<TenbaggerStock[]>({
    queryKey: ["/api/tenbagger-stocks", "common"],
    queryFn: async () => {
      const res = await fetch("/api/tenbagger-stocks?listType=common", { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  // 개인관심 목록
  const { data: personalStocks = [], isLoading: isPersonalLoading } = useQuery<TenbaggerStock[]>({
    queryKey: ["/api/tenbagger-stocks", "personal"],
    queryFn: async () => {
      const res = await fetch("/api/tenbagger-stocks?listType=personal", { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: isLoggedIn || isAdmin,
  });

  const allStocks = [...commonStocks, ...personalStocks];

  // 종목 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tenbagger-stocks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenbagger-stocks"] });
      toast({ title: "종목이 삭제되었습니다" });
    },
  });

  // 개별 AI 분석
  const analyzeMutation = useMutation({
    mutationFn: (id: number) => {
      setAnalyzingId(id);
      return apiRequest("POST", `/api/tenbagger-stocks/${id}/ai-analyze`).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenbagger-stocks"] });
      toast({ title: "AI 분석이 완료되었습니다" });
      setAnalyzingId(null);
    },
    onError: (err: any) => {
      toast({ title: "AI 분석 실패", description: err.message, variant: "destructive" });
      setAnalyzingId(null);
    },
  });

  const resetForm = () => {
    setStockCode("");
    setStockName("");
    setMarket("domestic");
    setExchange("KOSPI");
    setSector("");
    setMemo("");
    setTargetPrice("");
    setBuyPrice("");
    setReason("");
    setSearchCode("");
    setSearchResults([]);
  };

  const openAddDialog = (listType: "common" | "personal") => {
    setAddListType(listType);
    resetForm();
    setAddDialogOpen(true);
  };

  // 종목 검색
  const handleSearch = async () => {
    if (!searchCode.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/stock/search-autocomplete?query=${encodeURIComponent(searchCode.trim())}`);
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch {
      toast({ title: "검색 실패", variant: "destructive" });
    } finally {
      setSearchLoading(false);
    }
  };

  // 검색 결과 선택
  const selectSearchResult = (item: { code: string; name: string; exchange: string; typeName: string }) => {
    setStockCode(item.code);
    setStockName(item.name);
    const isOverseas = ["NYSE", "NASDAQ", "AMEX", "HKEX", "SHG", "SHE", "TYO"].includes(item.exchange);
    setMarket(isOverseas ? "overseas" : "domestic");
    setExchange(item.exchange);
    setSearchResults([]);
    setSearchCode("");
  };

  // 종합 AI 분석
  const handleAnalyzeAll = async () => {
    setAnalysisAllLoading(true);
    setAnalysisAll(null);
    try {
      const res = await apiRequest("POST", "/api/tenbagger-stocks/ai-analyze-all");
      const data = await res.json();
      setAnalysisAll(data.analysis);
    } catch (err: any) {
      toast({ title: "종합 분석 실패", description: err.message, variant: "destructive" });
    } finally {
      setAnalysisAllLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "클립보드에 복사되었습니다" });
  };

  const handleSubmit = () => {
    if (!stockCode || !stockName) {
      toast({ title: "종목코드와 종목명을 입력해주세요", variant: "destructive" });
      return;
    }
    const endpoint = addListType === "common" ? "/api/tenbagger-stocks/common" : "/api/tenbagger-stocks/personal";
    apiRequest("POST", endpoint, {
      stockCode, stockName, market, exchange,
      sector: sector || "기본",
      memo: memo || null,
      targetPrice: targetPrice || null,
      buyPrice: buyPrice || null,
      reason: reason || null,
    }).then(r => r.json()).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenbagger-stocks"] });
      toast({ title: `${addListType === "common" ? "공통" : "개인"} 10X 종목이 등록되었습니다` });
      setAddDialogOpen(false);
      resetForm();
    }).catch((err: any) => {
      toast({ title: "등록 실패", description: err.message, variant: "destructive" });
    });
  };

  // 종목 테이블 렌더 함수
  const renderStockTable = (stocks: TenbaggerStock[], canDelete: boolean, label: string) => {
    if (stocks.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-6">
          등록된 {label} 10X 종목이 없습니다
        </p>
      );
    }
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs w-[80px]">코드</TableHead>
              <TableHead className="text-xs">종목명</TableHead>
              <TableHead className="text-xs w-[70px]">시장</TableHead>
              <TableHead className="text-xs w-[80px]">매수가</TableHead>
              <TableHead className="text-xs w-[80px]">목표가</TableHead>
              <TableHead className="text-xs w-[80px]">섹터</TableHead>
              <TableHead className="text-xs w-[70px]">AI분석</TableHead>
              <TableHead className="text-xs w-[60px]">상세</TableHead>
              {canDelete && <TableHead className="text-xs w-[50px]">삭제</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {stocks.map((stock) => (
              <>
                <TableRow key={stock.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setExpandedId(expandedId === stock.id ? null : stock.id)}>
                  <TableCell className="text-xs font-mono">{stock.stockCode}</TableCell>
                  <TableCell className="text-xs font-medium">
                    <div className="flex items-center gap-1.5">
                      {stock.stockName}
                      {stock.aiAnalysis && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-purple-300 text-purple-600">AI</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="secondary" className="text-[10px]">
                      {stock.exchange || (stock.market === "overseas" ? "해외" : "국내")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-right">{stock.buyPrice || "-"}</TableCell>
                  <TableCell className="text-xs text-right font-medium text-red-600">{stock.targetPrice || "-"}</TableCell>
                  <TableCell className="text-xs">{stock.sector || "-"}</TableCell>
                  <TableCell>
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-purple-500 hover:text-purple-700"
                        onClick={(e) => { e.stopPropagation(); analyzeMutation.mutate(stock.id); }}
                        disabled={analyzingId === stock.id}
                      >
                        {analyzingId === stock.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    {!isAdmin && stock.aiAnalysis && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 border-green-300 text-green-600">완료</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = `/stock-detail?code=${stock.stockCode}&name=${encodeURIComponent(stock.stockName)}&market=${stock.market || "domestic"}&exchange=${stock.exchange || "KOSPI"}`;
                        window.open(url, `stock_${stock.stockCode}`, "width=1000,height=800,scrollbars=yes,resizable=yes");
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                  {canDelete && (
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        onClick={(e) => { e.stopPropagation(); if (confirm("삭제하시겠습니까?")) deleteMutation.mutate(stock.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>

                {/* 확장 영역: 메모, 사유, AI분석 */}
                {expandedId === stock.id && (
                  <TableRow key={`detail-${stock.id}`}>
                    <TableCell colSpan={canDelete ? 9 : 8} className="bg-muted/20 p-4">
                      <div className="space-y-3">
                        {stock.reason && (
                          <div>
                            <span className="text-xs font-semibold text-muted-foreground">📌 선정 사유</span>
                            <p className="text-sm mt-1">{stock.reason}</p>
                          </div>
                        )}
                        {stock.memo && (
                          <div>
                            <span className="text-xs font-semibold text-muted-foreground">📝 메모</span>
                            <p className="text-sm mt-1">{stock.memo}</p>
                          </div>
                        )}
                        {stock.aiAnalysis ? (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-purple-600 flex items-center gap-1">
                                <Sparkles className="h-3.5 w-3.5" /> AI 분석 결과
                                {stock.aiAnalyzedAt && (
                                  <span className="text-[10px] text-muted-foreground font-normal ml-2">
                                    {new Date(stock.aiAnalyzedAt).toLocaleString("ko-KR")}
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setFontSize(s => Math.max(10, s - 1))}>
                                  <ZoomOut className="h-3 w-3" />
                                </Button>
                                <span className="text-[10px] text-muted-foreground w-6 text-center">{fontSize}</span>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setFontSize(s => Math.min(20, s + 1))}>
                                  <ZoomIn className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleCopy(stock.aiAnalysis!)}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 max-h-[500px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none" style={{ fontSize: `${fontSize}px` }}>
                              <div dangerouslySetInnerHTML={{ __html: markdownToHtml(stock.aiAnalysis) }} />
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">AI 분석 결과가 없습니다. {isAdmin && "AI분석 버튼을 클릭하세요."}</p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 안내문 */}
      <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 dark:border-amber-800">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-full shrink-0">
              <Rocket className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                🚀 10 Bagger란?
              </h3>
              <p className="text-sm text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                텐배거(Ten-bagger)는 매수가 대비 <strong className="text-red-600 dark:text-red-400">10배(1,000%)</strong> 이상의 수익률을 기록한 주식 종목을 의미하며, 
                전설적인 투자자 <strong>피터 린치(Peter Lynch)</strong>가 자신의 저서에서 처음 사용한 용어입니다. 
                주로 <strong>중소형 성장주, 혁신 기술주, 또는 턴어라운드(실적 호전) 기업</strong>에서 나타나며, 
                장기 투자를 통해 대박 수익을 내는 종목을 뜻합니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 등록/AI분석 버튼 영역 */}
      <div className="flex items-center gap-2 flex-wrap">
        {isAdmin && (
          <>
            <Button size="sm" variant="default" onClick={() => openAddDialog("common")} className="gap-1.5">
              <Users className="h-4 w-4" /> 공통관심 등록
            </Button>
            <Button size="sm" variant="outline" onClick={() => openAddDialog("personal")} className="gap-1.5">
              <User className="h-4 w-4" /> 개인관심 등록
            </Button>
          </>
        )}
        {!isAdmin && isLoggedIn && (
          <Button size="sm" onClick={() => openAddDialog("personal")} className="gap-1.5">
            <Plus className="h-4 w-4" /> 관심종목 등록
          </Button>
        )}
        {isAdmin && allStocks.length > 0 && (
          <Button size="sm" variant="outline" onClick={handleAnalyzeAll} disabled={analysisAllLoading} className="gap-1.5 border-purple-300 text-purple-600 hover:bg-purple-50">
            {analysisAllLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            종합 AI 분석
          </Button>
        )}
        <span className="text-sm text-muted-foreground ml-auto">
          공통: <strong>{commonStocks.length}</strong> · 개인: <strong>{personalStocks.length}</strong>
        </span>
      </div>

      {/* 로딩 */}
      {(isCommonLoading || isPersonalLoading) && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* 공통관심 10X 종목 섹션 */}
      {!isCommonLoading && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              공통 10X 관심종목
              <span className="text-xs text-muted-foreground font-normal">({commonStocks.length}종목)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {renderStockTable(commonStocks, isAdmin, "공통")}
          </CardContent>
        </Card>
      )}

      {/* 개인관심 10X 종목 섹션 */}
      {(isLoggedIn || isAdmin) && !isPersonalLoading && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-green-500" />
              개인 10X 관심종목
              <span className="text-xs text-muted-foreground font-normal">({personalStocks.length}종목)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {renderStockTable(personalStocks, true, "개인")}
          </CardContent>
        </Card>
      )}

      {/* 종합 AI 분석 결과 */}
      {analysisAll && (
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <Brain className="h-4 w-4" /> 종합 AI 분석 보고서
              </span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setFontSize(s => Math.max(10, s - 1))}>
                  <ZoomOut className="h-3 w-3" />
                </Button>
                <span className="text-[10px] text-muted-foreground w-6 text-center">{fontSize}</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setFontSize(s => Math.min(20, s + 1))}>
                  <ZoomIn className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleCopy(analysisAll)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 max-h-[600px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none" style={{ fontSize: `${fontSize}px` }}>
              <div dangerouslySetInnerHTML={{ __html: markdownToHtml(analysisAll) }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 종목 등록 다이얼로그 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {addListType === "common" ? (
                <><Users className="h-5 w-5 text-blue-500" /> 공통 10X 종목 등록</>
              ) : (
                <><User className="h-5 w-5 text-green-500" /> 개인 10X 종목 등록</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 종목 검색 */}
            <div>
              <Label className="text-xs">종목 검색</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="종목명 또는 코드"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="text-sm"
                />
                <Button size="sm" onClick={handleSearch} disabled={searchLoading} className="shrink-0">
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {searchResults.length > 0 && (
                <div className="border rounded-md mt-2 max-h-40 overflow-y-auto bg-white dark:bg-slate-900">
                  {searchResults.map((item, i) => (
                    <button key={i} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 flex justify-between items-center border-b last:border-b-0"
                      onClick={() => selectSearchResult(item)}
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground">{item.code} · {item.exchange}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">종목코드</Label>
                <Input value={stockCode} onChange={(e) => setStockCode(e.target.value)} className="text-sm mt-1" placeholder="005930" />
              </div>
              <div>
                <Label className="text-xs">종목명</Label>
                <Input value={stockName} onChange={(e) => setStockName(e.target.value)} className="text-sm mt-1" placeholder="삼성전자" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">시장</Label>
                <select value={market} onChange={(e) => setMarket(e.target.value as any)}
                  className="w-full h-9 px-3 text-sm border rounded-md mt-1 bg-background">
                  <option value="domestic">국내</option>
                  <option value="overseas">해외</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">거래소</Label>
                <Input value={exchange} onChange={(e) => setExchange(e.target.value)} className="text-sm mt-1" placeholder="KOSPI" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">매수가</Label>
                <Input value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} className="text-sm mt-1" placeholder="50,000" />
              </div>
              <div>
                <Label className="text-xs">목표가 (10X)</Label>
                <Input value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} className="text-sm mt-1" placeholder="500,000" />
              </div>
            </div>

            <div>
              <Label className="text-xs">섹터</Label>
              <Input value={sector} onChange={(e) => setSector(e.target.value)} className="text-sm mt-1" placeholder="AI, 반도체, 바이오 등" />
            </div>

            <div>
              <Label className="text-xs">선정 사유</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="text-sm mt-1 h-20" placeholder="10X 후보 선정 사유를 입력하세요..." />
            </div>

            <div>
              <Label className="text-xs">메모</Label>
              <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} className="text-sm mt-1 h-16" placeholder="추가 메모 (선택)" />
            </div>

            <Button onClick={handleSubmit} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              등록
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 간단한 Markdown → HTML 변환
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.*$)/gm, '<h3 class="text-base font-bold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-lg font-bold mt-5 mb-2">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}
