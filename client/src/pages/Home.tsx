import { useState, Suspense, lazy } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, ExternalLink, TrendingUp, Globe, Loader2, Star, Newspaper, Youtube, FileText, Link as LinkIcon, Trash2, Pencil, Scale, Zap, ChevronDown, Calendar, Home as HomeIcon, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { LoginDialog } from "@/components/LoginDialog";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DailyStrategy = lazy(() => import("@/components/DailyStrategy"));
const MarketNews = lazy(() => import("@/components/MarketNews"));
const ResearchList = lazy(() => import("@/components/ResearchList"));
const BookmarksComp = lazy(() => import("@/components/Bookmarks"));
const EtfComponents = lazy(() => import("@/components/EtfComponents"));

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Home() {
  const [activeTab, setActiveTab] = useState("home");
  
  const { toast } = useToast();
  const { isAdmin, isLoggedIn } = useAuth();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header / Hero */}
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">Life Fitness ETF (투자와 함께 하는 삶)</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Advanced ETF Analytics Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {(isAdmin || isLoggedIn) && (
                <Link href="/trading">
                  <Button variant="outline" className="gap-2 border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950">
                    <Zap className="w-4 h-4" />
                    <span className="hidden sm:inline">자동매매</span>
                  </Button>
                </Link>
              )}
              <LoginDialog />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-7 max-w-5xl mx-auto">
            <TabsTrigger value="home" className="gap-2">
              <HomeIcon className="h-4 w-4" />
              홈
            </TabsTrigger>
            {/* AI 드롭다운 메뉴 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Bot className="h-3.5 w-3.5" />
                  AI
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[140px]">
                <DropdownMenuItem
                  onClick={() => window.open("https://gemini.google.com/", "_blank", "noopener,noreferrer")}
                  className="gap-2 cursor-pointer"
                >
                  ✨ Gemini
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.open("https://grok.com/", "_blank", "noopener,noreferrer")}
                  className="gap-2 cursor-pointer"
                >
                  🤖 Grok
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.open("https://openai.com/ko-KR/", "_blank", "noopener,noreferrer")}
                  className="gap-2 cursor-pointer"
                >
                  🧠 Open AI
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* ETF정보 드롭다운 메뉴 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 gap-1 ${
                    activeTab === "etf-components"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Scale className="h-3.5 w-3.5" />
                  ETF정보
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[140px]">
                <DropdownMenuItem
                  onClick={() => setActiveTab("etf-components")}
                  className="gap-2 cursor-pointer"
                >
                  📊 구성종목 시세
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.open("https://www.funetf.co.kr/product/etf/filter", "_blank", "noopener,noreferrer")}
                  className="gap-2 cursor-pointer"
                >
                  🔍 ETF검색
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.open("https://www.funetf.co.kr/product/comparison/etf", "_blank", "noopener,noreferrer")}
                  className="gap-2 cursor-pointer"
                >
                  ⚖️ ETF비교
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Markets 드롭다운 메뉴 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 gap-1 ${
                    activeTab.startsWith("markets-")
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Markets
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[120px]">
                <DropdownMenuItem onClick={() => setActiveTab("markets-news")} className="gap-2 cursor-pointer">
                  📰 주요뉴스
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("markets-research")} className="gap-2 cursor-pointer">
                  📊 리서치
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* 투자전략 드롭다운 메뉴 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 gap-1 ${
                    activeTab.startsWith("strategy-")
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  투자전략
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[120px]">
                <DropdownMenuItem onClick={() => setActiveTab("strategy-daily")} className="gap-2 cursor-pointer">
                  📋 일일 보고서
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("strategy-weekly")} className="gap-2 cursor-pointer">
                  📊 주간 보고서
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("strategy-monthly")} className="gap-2 cursor-pointer">
                  📈 월간 보고서
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("strategy-yearly")} className="gap-2 cursor-pointer">
                  📉 연간 보고서
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <TabsTrigger value="etf-trends" className="gap-2">
              <Newspaper className="h-4 w-4" />
              ETF 동향
            </TabsTrigger>
            <TabsTrigger value="bookmarks" className="gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              즐겨찾기
            </TabsTrigger>
          </TabsList>

          <TabsContent value="home">
            <HomeEmbed />
          </TabsContent>

          <TabsContent value="etf-components">
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            }>
              <EtfComponents />
            </Suspense>
          </TabsContent>

          <TabsContent value="markets-news">
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            }>
              <MarketNews />
            </Suspense>
          </TabsContent>

          <TabsContent value="markets-research">
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            }>
              <ResearchList />
            </Suspense>
          </TabsContent>

          {/* 투자전략 보고서 - 일일/주간/월간/연간 */}
          {(["daily", "weekly", "monthly", "yearly"] as const).map((period) => (
            <TabsContent key={period} value={`strategy-${period}`}>
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              }>
                <DailyStrategy period={period} />
              </Suspense>
            </TabsContent>
          ))}

          <TabsContent value="etf-trends">
            <EtfTrendsSection isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="bookmarks">
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            }>
              <BookmarksComp />
            </Suspense>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ===== 홈 탭: 네이버 카페 전체글보기 =====
const CAFE_URL = "https://cafe.naver.com/lifefit";

interface CafeArticle {
  articleId: number;
  subject: string;
  writerNickname: string;
  menuName: string;
  readCount: number;
  commentCount: number;
  likeItCount: number;
  representImage: string | null;
  writeDateTimestamp: number;
  newArticle: boolean;
  attachImage: boolean;
  attachMovie: boolean;
  attachFile: boolean;
  openArticle: boolean;
}

function HomeEmbed() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery<{
    articles: CafeArticle[];
    page: number;
    perPage: number;
    totalArticles: number;
  }>({
    queryKey: ["/api/cafe/articles", page],
    queryFn: async () => {
      const res = await fetch(`/api/cafe/articles?page=${page}&perPage=20`);
      if (!res.ok) throw new Error("카페 글 목록을 불러올 수 없습니다.");
      return res.json();
    },
    staleTime: 2 * 60 * 1000, // 2분
  });

  const articles = data?.articles || [];
  const totalArticles = data?.totalArticles || 0;
  const totalPages = Math.ceil(totalArticles / 20);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
  };

  const openArticle = (articleId: number) => {
    window.open(
      `https://cafe.naver.com/lifefit/${articleId}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">카페 글 목록 로딩 중...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <img
            src="https://ssl.pstatic.net/static/cafe/cafe_pc/default/cafe_logo_img.png"
            alt="카페"
            className="w-5 h-5"
          />
          <h3 className="font-semibold text-sm">Life Fitness 전체글보기</h3>
          <span className="text-xs text-muted-foreground">({totalArticles})</span>
          {isFetching && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(CAFE_URL, "_blank", "noopener,noreferrer")}
          className="gap-1.5 text-xs h-7"
        >
          <ExternalLink className="w-3 h-3" />
          카페 열기
        </Button>
      </div>

      {/* 글 목록 */}
      <div className="divide-y">
        {articles.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            게시글이 없습니다.
          </div>
        ) : (
          articles.map((article) => (
            <button
              key={article.articleId}
              onClick={() => openArticle(article.articleId)}
              className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex gap-3"
            >
              {/* 썸네일 */}
              {article.representImage && (
                <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-muted">
                  <img
                    src={article.representImage}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              {/* 본문 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium truncate max-w-[80px]">
                    {article.menuName}
                  </span>
                  {article.newArticle && (
                    <span className="text-[10px] px-1 py-0.5 rounded bg-red-500 text-white font-bold">N</span>
                  )}
                </div>
                <h4 className="text-sm font-medium line-clamp-1 mb-1">
                  {article.subject}
                </h4>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{article.writerNickname}</span>
                  <span className="opacity-40">|</span>
                  <span>{formatDate(article.writeDateTimestamp)}</span>
                  <span className="opacity-40">|</span>
                  <span>조회 {article.readCount}</span>
                  {article.commentCount > 0 && (
                    <>
                      <span className="opacity-40">|</span>
                      <span className="text-primary">댓글 {article.commentCount}</span>
                    </>
                  )}
                  {article.likeItCount > 0 && (
                    <>
                      <span className="opacity-40">|</span>
                      <span className="text-red-400">♥ {article.likeItCount}</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 py-3 border-t bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage(1)}
            className="h-8 w-8 p-0 text-xs"
          >
            «
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="h-8 w-8 p-0 text-xs"
          >
            ‹
          </Button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
            const p = startPage + i;
            if (p > totalPages) return null;
            return (
              <Button
                key={p}
                variant={p === page ? "default" : "ghost"}
                size="sm"
                onClick={() => setPage(p)}
                disabled={isFetching}
                className="h-8 w-8 p-0 text-xs"
              >
                {p}
              </Button>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages || isFetching}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="h-8 w-8 p-0 text-xs"
          >
            ›
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages || isFetching}
            onClick={() => setPage(totalPages)}
            className="h-8 w-8 p-0 text-xs"
          >
            »
          </Button>
        </div>
      )}
    </Card>
  );
}

interface EtfTrend {
  id: number;
  url: string;
  title: string;
  comment: string | null;
  thumbnail: string | null;
  sourceType: string;
  createdAt: string;
}

function EtfTrendsSection({ isAdmin }: { isAdmin: boolean }) {
  const [urlInput, setUrlInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [editingTrend, setEditingTrend] = useState<EtfTrend | null>(null);
  const [editComment, setEditComment] = useState("");
  const { toast } = useToast();
  
  const { data: trends, isLoading } = useQuery<EtfTrend[]>({ 
    queryKey: ["/api/etf-trends"] 
  });

  const createTrend = useMutation({
    mutationFn: async ({ url, comment }: { url: string; comment: string }) => {
      return apiRequest("POST", "/api/etf-trends", { url, comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/etf-trends"] });
      setUrlInput("");
      setCommentInput("");
      toast({ title: "성공", description: "ETF 동향이 추가되었습니다." });
    },
    onError: (error: any) => {
      toast({ 
        title: "오류", 
        description: error.message || "동향 추가에 실패했습니다.", 
        variant: "destructive" 
      });
    }
  });

  const updateTrend = useMutation({
    mutationFn: async ({ id, comment }: { id: number; comment: string }) => {
      return apiRequest("PATCH", `/api/etf-trends/${id}`, { comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/etf-trends"] });
      setEditingTrend(null);
      setEditComment("");
      toast({ title: "수정됨", description: "코멘트가 수정되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "수정에 실패했습니다.", variant: "destructive" });
    }
  });

  const deleteTrend = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/etf-trends/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/etf-trends"] });
      toast({ title: "삭제됨", description: "동향이 삭제되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
    }
  });

  const handleEdit = (trend: EtfTrend) => {
    setEditingTrend(trend);
    setEditComment(trend.comment || "");
  };

  const handleSaveEdit = () => {
    if (editingTrend) {
      updateTrend.mutate({ id: editingTrend.id, comment: editComment });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    createTrend.mutate({ url: urlInput.trim(), comment: commentInput.trim() });
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case "youtube":
        return <Youtube className="w-4 h-4 text-red-500" />;
      case "blog":
        return <FileText className="w-4 h-4 text-green-500" />;
      default:
        return <LinkIcon className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSourceLabel = (sourceType: string) => {
    switch (sourceType) {
      case "youtube":
        return "YouTube";
      case "blog":
        return "블로그";
      default:
        return "Article";
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
        <span className="text-muted-foreground">동향 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              새 동향 추가
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                placeholder="YouTube, 블로그, 뉴스 URL을 입력하세요..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                data-testid="input-trend-url"
              />
              <Textarea
                placeholder="코멘트를 입력하세요 (선택사항)..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                rows={3}
                data-testid="input-trend-comment"
              />
              <Button 
                type="submit" 
                disabled={createTrend.isPending || !urlInput.trim()}
                data-testid="button-add-trend"
              >
                {createTrend.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    추가중...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    추가
                  </>
                )}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              URL과 함께 코멘트를 입력하면 동향 정보로 저장됩니다. (YouTube, 네이버 블로그, 일반 기사 지원)
            </p>
          </CardContent>
        </Card>
      )}

      {(!trends || trends.length === 0) ? (
        <div className="p-12 text-center border-2 border-dashed rounded-xl">
          <Newspaper className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">동향 정보가 없습니다</h3>
          <p className="text-muted-foreground">
            {isAdmin ? "URL을 추가하여 ETF 관련 콘텐츠를 요약해보세요." : "관리자가 ETF 동향을 추가하면 여기에 표시됩니다."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trends.map((trend) => (
            <a 
              key={trend.id} 
              href={trend.url} 
              target="_blank" 
              rel="noopener noreferrer"
              data-testid={`link-trend-card-${trend.id}`}
            >
              <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow h-full">
                <CardContent className="p-0">
                  {trend.thumbnail && (
                    <div className="aspect-video relative overflow-hidden bg-muted">
                      <img 
                        src={trend.thumbnail} 
                        alt={trend.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <StatusBadge variant="outline" className="gap-1">
                        {getSourceIcon(trend.sourceType)}
                        {getSourceLabel(trend.sourceType)}
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(trend.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <h4 className="font-bold text-base mb-2 line-clamp-2">{trend.title}</h4>
                    {trend.comment && (
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap mb-3 line-clamp-5">
                        {trend.comment}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        원문 보기
                      </Button>
                      {isAdmin && (
                        <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleEdit(trend); }}
                            data-testid={`button-edit-trend-${trend.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); deleteTrend.mutate(trend.id); }}
                            disabled={deleteTrend.isPending}
                            data-testid={`button-delete-trend-${trend.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      )}

      <Dialog open={!!editingTrend} onOpenChange={(open) => !open && setEditingTrend(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>코멘트 수정</DialogTitle>
            <DialogDescription>
              {editingTrend?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="코멘트를 입력하세요..."
              value={editComment}
              onChange={(e) => setEditComment(e.target.value)}
              rows={5}
              data-testid="input-edit-comment"
            />
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setEditingTrend(null)}
              >
                취소
              </Button>
              <Button 
                onClick={handleSaveEdit}
                disabled={updateTrend.isPending}
                data-testid="button-save-edit"
              >
                {updateTrend.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

