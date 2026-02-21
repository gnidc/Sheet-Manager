import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Loader2,
  RefreshCw,
  FileText,
  ExternalLink,
  Clock,
  AlertCircle,
  Download,
  Building2,
  Star,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Save,
  Copy,
  Check,
  Plus,
  Minus,
  BookOpen,
  Trash2,
  X,
  Settings,
  Upload,
} from "lucide-react";

interface ResearchItem {
  title: string;
  link: string;
  source: string;
  date: string;
  file: string;
  readCount?: string;
  category?: string;
  analyst?: string;
}

interface ResearchResponse {
  popular: ResearchItem[];
  strategy: ResearchItem[];
  research: ResearchItem[];
  updatedAt: string;
  total: number;
}

interface AiReport {
  id: string;
  analysis: string;
  analyzedAt: string;
  savedAt: string;
  items: Array<{ title: string; source: string; date: string }>;
}

export default function ResearchList() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [checkedPopularItems, setCheckedPopularItems] = useState<Set<number>>(new Set());
  const [checkedStrategyItems, setCheckedStrategyItems] = useState<Set<number>>(new Set());
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set()); // legacy compat
  const [checkedKeyItems, setCheckedKeyItems] = useState<Set<number>>(new Set());
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiAnalyzedAt, setAiAnalyzedAt] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [analysisFontSize, setAnalysisFontSize] = useState(14);
  const [copied, setCopied] = useState(false);
  const [viewingReport, setViewingReport] = useState<AiReport | null>(null);
  const [reportFontSize, setReportFontSize] = useState(14);
  const [reportCopied, setReportCopied] = useState(false);
  // AI 분석 시 사용된 항목 추적
  const [lastAnalyzedItems, setLastAnalyzedItems] = useState<ResearchItem[]>([]);
  // Notion 연동
  const [showNotionSettings, setShowNotionSettings] = useState(false);
  const [notionApiKey, setNotionApiKey] = useState("");
  const [notionDbId, setNotionDbId] = useState("");

  // 전체 리서치 조회
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<ResearchResponse>({
    queryKey: ["/api/news/research"],
    queryFn: async () => {
      const res = await fetch("/api/news/research", { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "리서치 데이터를 불러올 수 없습니다");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // 주요 리서치 서버에서 조회 (모든 유저)
  const {
    data: keyResearchData,
    refetch: refetchKeyResearch,
  } = useQuery<{ items: ResearchItem[] }>({
    queryKey: ["/api/research/key-research"],
    queryFn: async () => {
      const res = await fetch("/api/research/key-research", { credentials: "include" });
      if (!res.ok) return { items: [] };
      return res.json();
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const keyResearchItems = keyResearchData?.items || [];

  // 주요 리서치 서버 저장 뮤테이션 (admin)
  const saveKeyResearchMutation = useMutation({
    mutationFn: async (items: ResearchItem[]) => {
      const res = await fetch("/api/research/key-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "저장 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      refetchKeyResearch();
      toast({ title: "주요 리서치 추가", description: `${data.added}건이 추가되었습니다.` });
    },
    onError: (error: Error) => {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    },
  });

  // 주요 리서치 전체 교체 뮤테이션 (삭제/초기화용)
  const updateKeyResearchMutation = useMutation({
    mutationFn: async (items: ResearchItem[]) => {
      const res = await fetch("/api/research/key-research", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "업데이트 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchKeyResearch();
    },
    onError: (error: Error) => {
      toast({ title: "업데이트 실패", description: error.message, variant: "destructive" });
    },
  });

  // AI 분석 뮤테이션
  const aiMutation = useMutation({
    mutationFn: async (items: ResearchItem[]) => {
      const res = await fetch("/api/research/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "AI 분석 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setAiAnalysis(data.analysis);
      setAiAnalyzedAt(data.analyzedAt);
      setShowAnalysis(true);
      toast({ title: "AI 분석 완료", description: "주요 리서치 분석이 생성되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "AI 분석 실패", description: error.message, variant: "destructive" });
    },
  });

  // AI 보고서 조회 (모든 유저)
  const {
    data: reportsData,
    refetch: refetchReports,
  } = useQuery<{ reports: AiReport[] }>({
    queryKey: ["/api/research/ai-reports"],
    queryFn: async () => {
      const res = await fetch("/api/research/ai-reports", { credentials: "include" });
      if (!res.ok) return { reports: [] };
      return res.json();
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const savedReports = reportsData?.reports || [];

  // AI 보고서 저장 뮤테이션 (admin)
  const saveReportMutation = useMutation({
    mutationFn: async (payload: { analysis: string; analyzedAt: string; items: ResearchItem[] }) => {
      const res = await fetch("/api/research/ai-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "보고서 저장 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchReports();
      toast({ title: "보고서 저장 완료", description: "AI 분석 보고서가 저장되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    },
  });

  // Notion 설정 조회 (리서치용)
  const { data: notionConfigData, refetch: refetchNotionConfig } = useQuery<{ configured: boolean; apiKey?: string; databaseId?: string }>({
    queryKey: ["/api/user/notion-config", "research"],
    queryFn: async () => {
      const res = await fetch("/api/user/notion-config?purpose=research", { credentials: "include" });
      if (!res.ok) return { configured: false };
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  // Notion 설정 저장 뮤테이션
  const saveNotionConfigMutation = useMutation({
    mutationFn: async ({ apiKey, databaseId }: { apiKey: string; databaseId: string }) => {
      const res = await fetch("/api/user/notion-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ apiKey, databaseId, purpose: "research" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "설정 저장 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchNotionConfig();
      setShowNotionSettings(false);
      toast({ title: "Notion 설정 저장 완료" });
    },
    onError: (error: Error) => {
      toast({ title: "설정 저장 실패", description: error.message, variant: "destructive" });
    },
  });

  // Notion 내보내기 뮤테이션
  const notionExportMutation = useMutation({
    mutationFn: async (items: ResearchItem[]) => {
      const res = await fetch("/api/research/export-notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Notion 내보내기 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const desc = data.errors?.length
        ? `${data.message}\n오류: ${data.errors[0]}`
        : data.message;
      toast({
        title: data.success ? "Notion 내보내기" : "Notion 내보내기 실패",
        description: desc,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Notion 내보내기 실패", description: error.message, variant: "destructive" });
    },
  });

  // AI 보고서 삭제 뮤테이션 (admin)
  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/research/ai-reports/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("삭제 실패");
      return res.json();
    },
    onSuccess: () => {
      refetchReports();
      toast({ title: "삭제 완료", description: "보고서가 삭제되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    },
  });

  // 주요 리서치로 추가 (서버 저장) - 인기 리포트에서
  const handleAddPopularToKeyResearch = () => {
    const popularList = data?.popular || [];
    if (checkedPopularItems.size === 0) return;
    const newItems = Array.from(checkedPopularItems)
      .map(idx => popularList[idx])
      .filter(item => item && !keyResearchItems.some(k => k.title === item.title && k.source === item.source));
    if (newItems.length === 0) {
      toast({ title: "알림", description: "이미 추가된 항목입니다." });
      return;
    }
    saveKeyResearchMutation.mutate(newItems);
    setCheckedPopularItems(new Set());
  };

  // 주요 리서치로 추가 (서버 저장) - 투자전략에서
  const handleAddStrategyToKeyResearch = () => {
    const strategyList = data?.strategy || [];
    if (checkedStrategyItems.size === 0) return;
    const newItems = Array.from(checkedStrategyItems)
      .map(idx => strategyList[idx])
      .filter(item => item && !keyResearchItems.some(k => k.title === item.title && k.source === item.source));
    if (newItems.length === 0) {
      toast({ title: "알림", description: "이미 추가된 항목입니다." });
      return;
    }
    saveKeyResearchMutation.mutate(newItems);
    setCheckedStrategyItems(new Set());
  };

  // 주요 리서치에서 제거 (서버 업데이트)
  const handleRemoveFromKeyResearch = (indices: number[]) => {
    const remaining = keyResearchItems.filter((_, i) => !indices.includes(i));
    updateKeyResearchMutation.mutate(remaining);
    setCheckedKeyItems(new Set());
  };

  // 주요 리서치 전체 초기화 (서버 업데이트)
  const handleClearKeyResearch = () => {
    updateKeyResearchMutation.mutate([]);
    setCheckedKeyItems(new Set());
    setAiAnalysis(null);
  };

  // AI 분석 실행
  const handleAiAnalyze = () => {
    if (checkedKeyItems.size === 0) {
      toast({ title: "알림", description: "분석할 리서치를 선택해주세요.", variant: "destructive" });
      return;
    }
    const selectedItems = Array.from(checkedKeyItems).map(idx => keyResearchItems[idx]).filter(Boolean);
    setLastAnalyzedItems(selectedItems);
    aiMutation.mutate(selectedItems);
  };

  // Notion으로 내보내기
  const handleExportToNotion = () => {
    if (!notionConfigData?.configured) {
      setShowNotionSettings(true);
      return;
    }
    if (checkedKeyItems.size === 0) {
      notionExportMutation.mutate(keyResearchItems);
    } else {
      const selectedItems = Array.from(checkedKeyItems).map(idx => keyResearchItems[idx]).filter(Boolean);
      notionExportMutation.mutate(selectedItems);
    }
  };

  // AI 분석 보고서 저장
  const handleSaveReport = () => {
    if (!aiAnalysis || !aiAnalyzedAt) return;
    saveReportMutation.mutate({
      analysis: aiAnalysis,
      analyzedAt: aiAnalyzedAt,
      items: lastAnalyzedItems,
    });
  };

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground">증권사 리서치 리포트를 가져오고 있습니다...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <p className="text-muted-foreground">
          {error?.message || "리서치를 불러올 수 없습니다."}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          재시도
        </Button>
      </div>
    );
  }

  const popularList = data?.popular || [];
  const strategyList = data?.strategy || [];

  // 리서치 테이블 렌더링 헬퍼
  const renderResearchTable = (
    items: ResearchItem[],
    checked: Set<number>,
    setChecked: React.Dispatch<React.SetStateAction<Set<number>>>,
    onSave: () => void,
    bgColor: string = "bg-muted/50",
    showCategory: boolean = false,
    showReadCount: boolean = false,
    showFileIcon: boolean = false, // 투자전략 리포트: file 아이콘 + finance.naver.com 링크
  ) => (
    <CardContent className="p-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className={bgColor}>
              {isAdmin && (
                <TableHead className="w-[40px] text-center">
                  <Checkbox
                    checked={items.length > 0 && items.every((_, i) => checked.has(i))}
                    onCheckedChange={(ch) => {
                      if (ch) setChecked(new Set(items.map((_, i) => i)));
                      else setChecked(new Set());
                    }}
                    className="w-3.5 h-3.5"
                  />
                </TableHead>
              )}
              <TableHead className="text-xs">제목</TableHead>
              {showCategory && <TableHead className="w-[80px] text-xs">카테고리</TableHead>}
              <TableHead className="w-[100px] text-xs">증권사</TableHead>
              <TableHead className="w-[85px] text-center text-xs">날짜</TableHead>
              {showReadCount && <TableHead className="w-[60px] text-center text-xs">조회</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => {
              const isChecked = checked.has(index);
              const isAlreadyKey = keyResearchItems.some(k => k.title === item.title && k.source === item.source);
              // finance.naver.com 링크가 있으면 우선 사용
              const clickLink = (showFileIcon && item.file) ? item.file : item.link;
              return (
                <TableRow
                  key={index}
                  className={`hover:bg-muted/30 group ${isChecked ? "bg-amber-50/50 dark:bg-amber-950/10" : ""} ${isAlreadyKey ? "opacity-60" : ""}`}
                >
                  {isAdmin && (
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(ch) => {
                          const s = new Set(checked);
                          if (ch) s.add(index); else s.delete(index);
                          setChecked(s);
                        }}
                        className="w-3.5 h-3.5"
                      />
                    </TableCell>
                  )}
                  <TableCell
                    className="cursor-pointer"
                    onClick={() => { if (clickLink) window.open(clickLink, "_blank", "noopener,noreferrer"); }}
                  >
                    <div className="flex items-center gap-2">
                      {isAlreadyKey && <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />}
                      {showFileIcon && (
                        <FileText className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      )}
                      <span className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                        {item.title}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </TableCell>
                  {showCategory && (
                    <TableCell>
                      <StatusBadge variant="outline" className="text-xs">
                        {item.category || "-"}
                      </StatusBadge>
                    </TableCell>
                  )}
                  <TableCell>
                    <StatusBadge variant="outline" className="text-xs">
                      {item.source || "-"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {item.date || "-"}
                  </TableCell>
                  {showReadCount && (
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {item.readCount ? Number(item.readCount).toLocaleString() : "-"}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-500" />
                증권사 리서치 리포트
              </CardTitle>
              {keyResearchItems.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => {
                    document.getElementById("key-research-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  주요 리서치로 바로가기
                </Button>
              )}
            </div>
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
            네이버 증권 리서치 리포트 (stock.naver.com){isAdmin && <> | 체크 후 <span className="text-primary font-medium">💾 저장</span> 버튼으로 주요 리서치에 등록</>}
          </p>
        </CardHeader>
      </Card>

      {/* 섹션 1: 요즘 많이 보는 리포트 */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold flex items-center gap-1.5">
              🔥 요즘 많이 보는 리포트
              <span className="text-xs font-normal text-muted-foreground">({popularList.length}건)</span>
            </span>
            {isAdmin && checkedPopularItems.size > 0 && (
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={handleAddPopularToKeyResearch}
              >
                <Save className="w-3 h-3" />
                저장 ({checkedPopularItems.size})
              </Button>
            )}
          </div>
        </CardHeader>
        {popularList.length > 0 ? (
          renderResearchTable(
            popularList,
            checkedPopularItems,
            setCheckedPopularItems,
            handleAddPopularToKeyResearch,
            "bg-orange-50/50 dark:bg-orange-950/10",
            true, // showCategory
            true, // showReadCount
          )
        ) : (
          <CardContent className="py-8 text-center">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">인기 리포트를 불러올 수 없습니다.</p>
          </CardContent>
        )}
      </Card>

      {/* 섹션 2: 투자전략 최신 리포트 */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold flex items-center gap-1.5">
              📋 투자전략 최신 리포트
              <span className="text-xs font-normal text-muted-foreground">({strategyList.length}건)</span>
            </span>
            {isAdmin && checkedStrategyItems.size > 0 && (
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={handleAddStrategyToKeyResearch}
              >
                <Save className="w-3 h-3" />
                저장 ({checkedStrategyItems.size})
              </Button>
            )}
          </div>
        </CardHeader>
        {strategyList.length > 0 ? (
          renderResearchTable(
            strategyList,
            checkedStrategyItems,
            setCheckedStrategyItems,
            handleAddStrategyToKeyResearch,
            "bg-blue-50/50 dark:bg-blue-950/10",
            false, // showCategory (all same)
            true,  // showReadCount
            true,  // showFileIcon: finance.naver.com 링크 + 파일 아이콘
          )
        ) : (
          <CardContent className="py-8 text-center">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">투자전략 리포트를 불러올 수 없습니다.</p>
          </CardContent>
        )}
      </Card>

      {/* ===== 주요 리서치 섹션 (리스트는 모두 보임, 관리 기능은 admin 전용) ===== */}
      {keyResearchItems.length > 0 && (
        <Card id="key-research-section" className="border-amber-300 dark:border-amber-700">
          <CardHeader className="pb-2 pt-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  주요 리서치
                  <span className="text-xs font-normal text-muted-foreground">({keyResearchItems.length}건)</span>
                </CardTitle>
                {isAdmin && checkedKeyItems.size > 0 && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs gap-1 bg-indigo-500 hover:bg-indigo-600 text-white"
                      onClick={handleAiAnalyze}
                      disabled={aiMutation.isPending}
                    >
                      {aiMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      AI 분석 ({checkedKeyItems.size})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => handleRemoveFromKeyResearch(Array.from(checkedKeyItems))}
                    >
                      제거 ({checkedKeyItems.size})
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleExportToNotion}
                  disabled={notionExportMutation.isPending}
                >
                  {notionExportMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3" />
                  )}
                  Notion {checkedKeyItems.size > 0 ? `(${checkedKeyItems.size})` : `(전체)`}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground"
                  onClick={() => setShowNotionSettings(true)}
                  title="Notion 설정"
                >
                  <Settings className="w-3.5 h-3.5" />
                </Button>
                {checkedKeyItems.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setCheckedKeyItems(new Set())}
                  >
                    선택해제
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={handleClearKeyResearch}
                  >
                    전체 초기화
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-amber-50/50 dark:bg-amber-950/10">
                    <TableHead className="w-[40px] text-center">
                      <Checkbox
                        checked={keyResearchItems.length > 0 && keyResearchItems.every((_, i) => checkedKeyItems.has(i))}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setCheckedKeyItems(new Set(keyResearchItems.map((_, i) => i)));
                          } else {
                            setCheckedKeyItems(new Set());
                          }
                        }}
                        className="w-3.5 h-3.5"
                      />
                    </TableHead>
                    <TableHead className="text-xs">제목</TableHead>
                    <TableHead className="w-[100px] text-xs">증권사</TableHead>
                    <TableHead className="w-[85px] text-center text-xs">날짜</TableHead>
                    <TableHead className="w-[65px] text-center text-xs">PDF</TableHead>
                    <TableHead className="w-[90px] text-center text-xs">AI분석</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keyResearchItems.map((item, index) => {
                    const isChecked = checkedKeyItems.has(index);
                    // 해당 항목과 관련된 저장된 AI 보고서 찾기
                    const matchedReport = savedReports.find(r =>
                      r.items.some((ri: any) => ri.title === item.title && ri.source === item.source)
                    );
                    return (
                      <TableRow
                        key={index}
                        className={`hover:bg-muted/30 group ${isChecked ? "bg-indigo-50/50 dark:bg-indigo-950/10" : ""}`}
                      >
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                const newSet = new Set(checkedKeyItems);
                                if (checked) newSet.add(index);
                                else newSet.delete(index);
                                setCheckedKeyItems(newSet);
                              }}
                              className="w-3.5 h-3.5"
                            />
                          </TableCell>
                        <TableCell
                          className="cursor-pointer"
                          onClick={() => {
                            if (item.link) window.open(item.link, "_blank", "noopener,noreferrer");
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                            <span className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                              {item.title}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant="outline" className="text-xs">
                            {item.source || "-"}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {item.date || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.file ? (
                            <a
                              href={item.file}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            >
                              <Download className="w-3 h-3" />
                              PDF
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          {matchedReport ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50 px-2"
                              onClick={() => { setViewingReport(matchedReport); setReportFontSize(14); }}
                            >
                              <BookOpen className="w-3 h-3" />
                              AI분석결과
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
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

      {/* ===== AI 분석 결과 (admin 전용) ===== */}
      {isAdmin && aiAnalysis && (
        <Card className="border-indigo-300 dark:border-indigo-700">
          <CardHeader className="pb-2 pt-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                AI 분석 결과
                {aiAnalyzedAt && (
                  <span className="text-xs font-normal text-muted-foreground">({aiAnalyzedAt})</span>
                )}
              </CardTitle>
              <div className="flex items-center gap-1.5">
                {/* 폰트 크기 조절 */}
                <div className="flex items-center gap-0.5 border rounded-md px-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setAnalysisFontSize(prev => Math.max(10, prev - 2))}
                    disabled={analysisFontSize <= 10}
                    title="글자 축소"
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="text-xs text-muted-foreground w-6 text-center">{analysisFontSize}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setAnalysisFontSize(prev => Math.min(24, prev + 2))}
                    disabled={analysisFontSize >= 24}
                    title="글자 확대"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                {/* 저장 버튼 (admin) */}
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleSaveReport}
                  disabled={saveReportMutation.isPending}
                >
                  {saveReportMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  저장
                </Button>
                {/* 복사 버튼 */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(aiAnalysis).then(() => {
                      setCopied(true);
                      toast({ title: "복사 완료", description: "AI 분석 결과가 클립보드에 복사되었습니다." });
                      setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                >
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {copied ? "복사됨" : "복사"}
                </Button>
                {/* 접기/펼치기 */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowAnalysis(!showAnalysis)}
                >
                  {showAnalysis ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showAnalysis ? "접기" : "펼치기"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => { setAiAnalysis(null); setAiAnalyzedAt(null); }}
                >
                  닫기
                </Button>
              </div>
            </div>
          </CardHeader>
          {showAnalysis && (
            <CardContent className="pt-0">
              <div
                className="prose dark:prose-invert max-w-none bg-muted/20 rounded-lg p-4 leading-relaxed whitespace-pre-wrap"
                style={{ fontSize: `${analysisFontSize}px` }}
              >
                {aiAnalysis}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* AI 분석 중 로딩 (admin 전용) */}
      {isAdmin && aiMutation.isPending && (
        <Card className="border-indigo-300 dark:border-indigo-700">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm text-muted-foreground">주요 리서치를 AI로 분석하고 있습니다...</p>
              <p className="text-xs text-muted-foreground">잠시만 기다려주세요 (30초~1분 소요)</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== 저장된 AI 보고서 리스트 (비활성화 - 주요 리서치 항목 옆 리포트 버튼으로 대체) ===== */}
      {false && savedReports.length > 0 && (
        <Card className="border-green-300 dark:border-green-700">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-green-600" />
              AI 분석 보고서
              <span className="text-xs font-normal text-muted-foreground">({savedReports.length}건)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-green-50/50 dark:bg-green-950/10">
                    <TableHead className="text-xs">분석 대상 리서치</TableHead>
                    <TableHead className="w-[100px] text-center text-xs">분석일시</TableHead>
                    <TableHead className="w-[100px] text-center text-xs">저장일시</TableHead>
                    <TableHead className="w-[120px] text-center text-xs">보고서</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedReports.map((report) => (
                    <TableRow key={report.id} className="hover:bg-muted/30 group">
                      <TableCell>
                        <div className="space-y-0.5">
                          {report.items.slice(0, 3).map((item, i) => (
                            <div key={i} className="text-xs text-muted-foreground truncate max-w-[400px]">
                              <span className="text-foreground font-medium">[{item.source}]</span> {item.title}
                            </div>
                          ))}
                          {report.items.length > 3 && (
                            <span className="text-xs text-muted-foreground">외 {report.items.length - 3}건...</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground whitespace-nowrap">
                        {report.analyzedAt}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground whitespace-nowrap">
                        {report.savedAt}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50"
                            onClick={() => { setViewingReport(report); setReportFontSize(14); }}
                          >
                            <BookOpen className="w-3 h-3" />
                            리포트
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteReportMutation.mutate(report.id)}
                              title="삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== 리포트 보기 (팝업/인라인) ===== */}
      {viewingReport && (
        <Card className="border-green-400 dark:border-green-600 shadow-lg">
          <CardHeader className="pb-2 pt-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-green-600" />
                AI 분석 보고서
                <span className="text-xs font-normal text-muted-foreground">({viewingReport.analyzedAt})</span>
              </CardTitle>
              <div className="flex items-center gap-1.5">
                {/* 폰트 크기 조절 */}
                <div className="flex items-center gap-0.5 border rounded-md px-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setReportFontSize(prev => Math.max(10, prev - 2))}
                    disabled={reportFontSize <= 10}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="text-xs text-muted-foreground w-6 text-center">{reportFontSize}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setReportFontSize(prev => Math.min(24, prev + 2))}
                    disabled={reportFontSize >= 24}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                {/* 복사 버튼 */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(viewingReport.analysis).then(() => {
                      setReportCopied(true);
                      toast({ title: "복사 완료", description: "보고서가 클립보드에 복사되었습니다." });
                      setTimeout(() => setReportCopied(false), 2000);
                    });
                  }}
                >
                  {reportCopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {reportCopied ? "복사됨" : "복사"}
                </Button>
                {/* 닫기 */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setViewingReport(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {/* 분석 대상 항목 */}
            <div className="mt-2 p-2 bg-muted/30 rounded-md">
              <p className="text-xs font-medium text-muted-foreground mb-1">📋 분석 대상 ({viewingReport.items.length}건)</p>
              {viewingReport.items.map((item, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {i + 1}. <span className="text-foreground">[{item.source}]</span> {item.title} <span className="text-muted-foreground">({item.date})</span>
                </p>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div
              className="prose dark:prose-invert max-w-none bg-muted/20 rounded-lg p-4 leading-relaxed whitespace-pre-wrap"
              style={{ fontSize: `${reportFontSize}px` }}
            >
              {viewingReport.analysis}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center py-2">
        데이터 출처: 네이버 증권 (stock.naver.com/research) | 리포트 원문은 해당 증권사에 저작권이 있습니다
      </p>

      {/* Notion 설정 다이얼로그 */}
      <Dialog open={showNotionSettings} onOpenChange={setShowNotionSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-4 h-4" /> Notion 연동 설정
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {notionConfigData?.configured && (
              <div className="text-xs p-2 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
                현재 설정됨: API Key {notionConfigData.apiKey} / DB {notionConfigData.databaseId?.slice(0, 8)}...
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                1. <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="text-primary underline">Notion Integrations</a>에서 Internal Integration을 생성하고 API Key를 복사하세요.
              </p>
              <p className="text-xs text-muted-foreground">
                2. Notion에서 데이터베이스를 생성하고 (제목, 증권사, 날짜, 링크, PDF 속성), Integration을 연결하세요.
              </p>
              <p className="text-xs text-muted-foreground">
                3. 데이터베이스 URL에서 ID를 복사하세요. (notion.so/<b>DATABASE_ID</b>?v=...)
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Notion API Key (Internal Integration Token)</label>
              <Input
                type="password"
                placeholder="ntn_xxxxx..."
                value={notionApiKey}
                onChange={(e) => setNotionApiKey(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Notion Database ID</label>
              <Input
                placeholder="32자리 영숫자 또는 하이픈 포함 ID"
                value={notionDbId}
                onChange={(e) => setNotionDbId(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNotionSettings(false)}
            >
              취소
            </Button>
            <Button
              size="sm"
              onClick={() => saveNotionConfigMutation.mutate({ apiKey: notionApiKey, databaseId: notionDbId })}
              disabled={!notionApiKey || !notionDbId || saveNotionConfigMutation.isPending}
            >
              {saveNotionConfigMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
