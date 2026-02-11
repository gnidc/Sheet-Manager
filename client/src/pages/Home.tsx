import { useState, useEffect, Suspense, lazy } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, ExternalLink, TrendingUp, Globe, Loader2, Star, Newspaper, Youtube, FileText, Link as LinkIcon, Trash2, Pencil, Scale, Zap, ChevronDown, Calendar, Home as HomeIcon, Bot, Search, X, Eye, ChevronLeft, ChevronRight, PenSquare, Send, LogIn, LogOut } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

// ===== 홈 탭: 네이버 카페 전체글보기 (관리자 전용) =====
const CAFE_URL = "https://cafe.naver.com/lifefit";

interface CafeArticle {
  articleId: number;
  subject: string;
  writerNickname: string;
  menuId?: number;
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

interface CafeMenu {
  menuId: number;
  menuName: string;
  menuType: string;
}

interface ArticleDetail {
  articleId: number;
  subject: string;
  writerNickname: string;
  writeDate: string;
  contentHtml: string;
  fallbackUrl: string;
}

function HomeEmbed() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [selectedMenuId, setSelectedMenuId] = useState("0"); // "0" = 전체
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [previewArticleId, setPreviewArticleId] = useState<number | null>(null);

  // 글쓰기 상태
  const [showWriteDialog, setShowWriteDialog] = useState(false);
  const [writeSubject, setWriteSubject] = useState("");
  const [writeContent, setWriteContent] = useState("");
  const [writeMenuId, setWriteMenuId] = useState("");

  // 게시판 목록 조회
  const { data: menusData } = useQuery<{ menus: CafeMenu[] }>({
    queryKey: ["/api/cafe/menus"],
    queryFn: async () => {
      const res = await fetch("/api/cafe/menus", { credentials: "include" });
      if (!res.ok) return { menus: [] };
      return res.json();
    },
    enabled: isAdmin,
    staleTime: 10 * 60 * 1000, // 10분
  });

  // 네이버 로그인 상태
  const { data: naverStatus, refetch: refetchNaverStatus } = useQuery<{
    isNaverLoggedIn: boolean;
    naverNickname: string | null;
    naverProfileImage: string | null;
  }>({
    queryKey: ["/api/auth/naver/status"],
    queryFn: async () => {
      const res = await fetch("/api/auth/naver/status", { credentials: "include" });
      if (!res.ok) return { isNaverLoggedIn: false, naverNickname: null, naverProfileImage: null };
      return res.json();
    },
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  // 글 목록 조회 (게시판 필터 지원)
  const { data, isLoading, isFetching } = useQuery<{
    articles: CafeArticle[];
    page: number;
    perPage: number;
    totalArticles: number;
  }>({
    queryKey: ["/api/cafe/articles", page, selectedMenuId],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), perPage: "20" });
      if (selectedMenuId !== "0") params.set("menuId", selectedMenuId);
      const res = await fetch(`/api/cafe/articles?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("카페 글 목록을 불러올 수 없습니다.");
      return res.json();
    },
    enabled: isAdmin && !isSearchMode,
    staleTime: 2 * 60 * 1000,
  });

  // 검색 결과 조회
  const { data: searchData, isFetching: isSearching } = useQuery<{
    articles: CafeArticle[];
    totalArticles: number;
  }>({
    queryKey: ["/api/cafe/search", searchQuery, page],
    queryFn: async () => {
      const params = new URLSearchParams({ q: searchQuery, page: String(page), perPage: "20" });
      const res = await fetch(`/api/cafe/search?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("검색에 실패했습니다.");
      return res.json();
    },
    enabled: isAdmin && isSearchMode && searchQuery.length > 0,
    staleTime: 60 * 1000,
  });

  // 글 본문 미리보기 조회
  const { data: articleDetail, isLoading: isLoadingDetail } = useQuery<ArticleDetail>({
    queryKey: ["/api/cafe/article", previewArticleId],
    queryFn: async () => {
      const res = await fetch(`/api/cafe/article/${previewArticleId}`, { credentials: "include" });
      if (!res.ok) throw new Error("글을 불러올 수 없습니다.");
      return res.json();
    },
    enabled: !!previewArticleId && isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  // 카페 글쓰기 mutation
  const writeMutation = useMutation({
    mutationFn: async (data: { subject: string; content: string; menuId: string }) => {
      const res = await fetch("/api/cafe/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.requireNaverLogin) {
          throw new Error("NAVER_LOGIN_REQUIRED");
        }
        throw new Error(json.message || "글 등록에 실패했습니다.");
      }
      return json;
    },
    onSuccess: () => {
      toast({ title: "카페 글 등록 완료", description: "네이버 카페에 글이 등록되었습니다." });
      setShowWriteDialog(false);
      setWriteSubject("");
      setWriteContent("");
      setWriteMenuId("");
      // 글 목록 새로고침
      queryClient.invalidateQueries({ queryKey: ["/api/cafe/articles"] });
    },
    onError: (error: Error) => {
      if (error.message === "NAVER_LOGIN_REQUIRED") {
        toast({ title: "네이버 로그인 필요", description: "글을 올리려면 네이버 로그인이 필요합니다.", variant: "destructive" });
        handleNaverLogin();
      } else {
        toast({ title: "글 등록 실패", description: error.message, variant: "destructive" });
      }
    },
  });

  // 네이버 로그아웃 mutation
  const naverLogoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/naver/logout", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("로그아웃 실패");
      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/naver/status"], {
        isNaverLoggedIn: false, naverNickname: null, naverProfileImage: null,
      });
      toast({ title: "네이버 로그아웃 완료" });
    },
  });

  // 네이버 로그인 핸들러
  const handleNaverLogin = async () => {
    try {
      const res = await fetch("/api/auth/naver", { credentials: "include" });
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({ title: "오류", description: data.message || "네이버 로그인을 시작할 수 없습니다.", variant: "destructive" });
      }
    } catch {
      toast({ title: "오류", description: "네이버 로그인 요청 실패", variant: "destructive" });
    }
  };

  // URL에서 네이버 OAuth 콜백 결과 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const naverAuth = params.get("naverAuth");
    if (naverAuth === "success") {
      toast({ title: "네이버 로그인 성공", description: "이제 카페에 글을 올릴 수 있습니다." });
      refetchNaverStatus();
      // URL 파라미터 제거
      window.history.replaceState({}, "", window.location.pathname);
    } else if (naverAuth === "error") {
      const message = params.get("message");
      toast({ title: "네이버 로그인 실패", description: message || "다시 시도해주세요.", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // 글쓰기 제출
  const handleWriteSubmit = () => {
    if (!writeSubject.trim() || !writeContent.trim() || !writeMenuId) {
      toast({ title: "입력 오류", description: "제목, 내용, 게시판을 모두 입력해주세요.", variant: "destructive" });
      return;
    }
    writeMutation.mutate({ subject: writeSubject, content: writeContent, menuId: writeMenuId });
  };

  // admin 체크
  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Globe className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
          <h3 className="text-lg font-semibold">관리자 전용 기능입니다</h3>
          <p className="text-sm text-muted-foreground mt-2">
            카페 전체글보기는 관리자 로그인 후 이용 가능합니다.
          </p>
          <Button
            variant="outline"
            className="mt-4 gap-2"
            onClick={() => window.open(CAFE_URL, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="w-4 h-4" />
            네이버 카페 직접 방문
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activeData = isSearchMode ? searchData : data;
  const articles = activeData?.articles || [];
  const totalArticles = activeData?.totalArticles || 0;
  const totalPages = Math.ceil(totalArticles / 20);
  const menus = menusData?.menus || [];
  const loading = isLoading || (isSearchMode && isSearching);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
  };

  const handleSearch = () => {
    const q = searchInput.trim();
    if (q) {
      setSearchQuery(q);
      setIsSearchMode(true);
      setPage(1);
    }
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setIsSearchMode(false);
    setPage(1);
  };

  const handleMenuChange = (menuId: string) => {
    setSelectedMenuId(menuId);
    setPage(1);
    if (isSearchMode) clearSearch();
  };

  if (isLoading && !isSearchMode) {
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
    <>
      <Card className="overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <img
              src="https://ssl.pstatic.net/static/cafe/cafe_pc/default/cafe_logo_img.png"
              alt="카페"
              className="w-5 h-5"
            />
            <h3 className="font-semibold text-sm">Life Fitness</h3>
            {!isSearchMode && (
              <span className="text-xs text-muted-foreground">({totalArticles})</span>
            )}
            {isSearchMode && searchQuery && (
              <span className="text-xs text-primary font-medium">"{searchQuery}" 검색결과</span>
            )}
            {(isFetching || isSearching) && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-2">
            {/* 네이버 로그인 상태 */}
            {naverStatus?.isNaverLoggedIn ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-green-600 font-medium">
                  ✅ {naverStatus.naverNickname}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground"
                  onClick={() => naverLogoutMutation.mutate()}
                  disabled={naverLogoutMutation.isPending}
                >
                  <LogOut className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs h-7 text-green-700 border-green-300 hover:bg-green-50"
                onClick={handleNaverLogin}
              >
                <LogIn className="w-3 h-3" />
                네이버 로그인
              </Button>
            )}

            {/* 글쓰기 버튼 */}
            <Button
              variant="default"
              size="sm"
              className="gap-1 text-xs h-7"
              onClick={() => {
                if (!naverStatus?.isNaverLoggedIn) {
                  toast({ title: "네이버 로그인 필요", description: "글을 작성하려면 네이버 로그인이 필요합니다.", variant: "destructive" });
                  handleNaverLogin();
                  return;
                }
                setShowWriteDialog(true);
              }}
            >
              <PenSquare className="w-3 h-3" />
              글쓰기
            </Button>

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
        </div>

        {/* 검색바 */}
        <div className="px-4 py-2 border-b bg-muted/10">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="카페 글 검색..."
                className="h-8 pl-8 text-sm"
              />
              {searchInput && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Button size="sm" onClick={handleSearch} disabled={!searchInput.trim()} className="h-8 text-xs gap-1">
              <Search className="w-3 h-3" />
              검색
            </Button>
          </div>
        </div>

        {/* 게시판 필터 탭 */}
        {!isSearchMode && menus.length > 0 && (
          <div className="px-4 py-2 border-b overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              <Button
                variant={selectedMenuId === "0" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleMenuChange("0")}
                className="h-7 text-xs px-3 whitespace-nowrap"
              >
                전체
              </Button>
              {menus.map((menu) => (
                <Button
                  key={menu.menuId}
                  variant={selectedMenuId === String(menu.menuId) ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleMenuChange(String(menu.menuId))}
                  className="h-7 text-xs px-3 whitespace-nowrap"
                >
                  {menu.menuName}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* 검색 모드 해제 버튼 */}
        {isSearchMode && (
          <div className="px-4 py-2 border-b bg-primary/5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                "{searchQuery}" 검색결과: {totalArticles}건
              </span>
              <Button variant="ghost" size="sm" onClick={clearSearch} className="h-6 text-xs gap-1">
                <X className="w-3 h-3" />
                검색 해제
              </Button>
            </div>
          </div>
        )}

        {/* 글 목록 */}
        <div className="divide-y">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{isSearchMode ? "검색 중..." : "로딩 중..."}</p>
            </div>
          ) : articles.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              {isSearchMode ? "검색 결과가 없습니다." : "게시글이 없습니다."}
            </div>
          ) : (
            articles.map((article) => (
              <div
                key={article.articleId}
                className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex gap-3 group"
              >
                {/* 썸네일 */}
                {article.representImage && (
                  <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-muted cursor-pointer"
                    onClick={() => setPreviewArticleId(article.articleId)}
                  >
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
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium truncate max-w-[100px]">
                      {article.menuName}
                    </span>
                    {article.newArticle && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-red-500 text-white font-bold">N</span>
                    )}
                  </div>
                  <h4
                    className="text-sm font-medium line-clamp-1 mb-1 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setPreviewArticleId(article.articleId)}
                  >
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
                {/* 미리보기 / 새탭 버튼 */}
                <div className="flex-shrink-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="미리보기"
                    onClick={() => setPreviewArticleId(article.articleId)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="새 탭에서 열기"
                    onClick={() => window.open(`${CAFE_URL}/${article.articleId}`, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
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
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 p-0 text-xs"
            >
              <ChevronLeft className="w-4 h-4" />
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
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 p-0 text-xs"
            >
              <ChevronRight className="w-4 h-4" />
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

      {/* 글 본문 미리보기 모달 */}
      <Dialog open={!!previewArticleId} onOpenChange={(open) => !open && setPreviewArticleId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base pr-8 line-clamp-2">
              {isLoadingDetail ? "로딩 중..." : articleDetail?.subject || "게시글"}
            </DialogTitle>
            {articleDetail && (
              <DialogDescription className="flex items-center gap-2 text-xs">
                <span>{articleDetail.writerNickname}</span>
                {articleDetail.writeDate && (
                  <>
                    <span className="opacity-40">|</span>
                    <span>{articleDetail.writeDate}</span>
                  </>
                )}
              </DialogDescription>
            )}
          </DialogHeader>

          {isLoadingDetail ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">본문 로딩 중...</p>
            </div>
          ) : articleDetail?.contentHtml ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert overflow-hidden"
              dangerouslySetInnerHTML={{ __html: articleDetail.contentHtml }}
            />
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                본문을 앱 내에서 표시할 수 없습니다.
              </p>
              <Button
                onClick={() => {
                  window.open(
                    articleDetail?.fallbackUrl || `${CAFE_URL}/${previewArticleId}`,
                    "_blank",
                    "noopener,noreferrer"
                  );
                  setPreviewArticleId(null);
                }}
                className="gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                카페에서 보기
              </Button>
            </div>
          )}

          {/* 하단 버튼 */}
          {articleDetail && (
            <div className="flex justify-end pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(articleDetail.fallbackUrl, "_blank", "noopener,noreferrer")}
                className="gap-1.5 text-xs"
              >
                <ExternalLink className="w-3 h-3" />
                카페에서 보기
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 글쓰기 다이얼로그 */}
      <Dialog open={showWriteDialog} onOpenChange={setShowWriteDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenSquare className="w-5 h-5" />
              카페 글쓰기
            </DialogTitle>
            <DialogDescription>
              네이버 카페 "Life Fitness"에 새 글을 작성합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 게시판 선택 */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">게시판 선택</label>
              <Select value={writeMenuId} onValueChange={setWriteMenuId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="게시판을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {menus
                    .filter((m) => m.menuType === "B" || m.menuType === "L") // 게시판 유형만
                    .map((m) => (
                      <SelectItem key={m.menuId} value={String(m.menuId)}>
                        {m.menuName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* 제목 */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">제목</label>
              <Input
                value={writeSubject}
                onChange={(e) => setWriteSubject(e.target.value)}
                placeholder="글 제목을 입력하세요"
                className="h-9"
                maxLength={100}
              />
            </div>

            {/* 본문 */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">내용</label>
              <Textarea
                value={writeContent}
                onChange={(e) => setWriteContent(e.target.value)}
                placeholder="글 내용을 작성하세요..."
                className="min-h-[200px] resize-y"
              />
              <p className="text-xs text-muted-foreground mt-1">
                HTML 태그를 사용할 수 있습니다. (예: &lt;b&gt;굵게&lt;/b&gt;, &lt;br&gt;줄바꿈)
              </p>
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="flex justify-between items-center pt-2 border-t">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              {naverStatus?.isNaverLoggedIn && (
                <>✅ {naverStatus.naverNickname} 계정으로 작성</>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowWriteDialog(false)}
                disabled={writeMutation.isPending}
              >
                취소
              </Button>
              <Button
                onClick={handleWriteSubmit}
                disabled={writeMutation.isPending || !writeSubject.trim() || !writeContent.trim() || !writeMenuId}
                className="gap-1.5"
              >
                {writeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                카페에 올리기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
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

