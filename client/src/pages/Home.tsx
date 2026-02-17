import { useState, useEffect, useRef, Suspense, lazy, useTransition, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ExternalLink, TrendingUp, Globe, Loader2, Star, Newspaper, FileText, Trash2, Pencil, Scale, Zap, ChevronDown, Calendar, Home as HomeIcon, Search, X, Eye, ChevronLeft, ChevronRight, PenSquare, Send, LogIn, LogOut, Bell, BellRing, MessageCircle, Heart, UserPlus, FileEdit, BarChart3, Bot, Moon, Sun, PanelLeftClose, PanelLeft, Smartphone, Download, Users, Key } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginDialog } from "@/components/LoginDialog";
import { QnABoard } from "@/components/QnABoard";

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
const NewEtfComp = lazy(() => import("@/components/NewEtf"));
const WatchlistEtfComp = lazy(() => import("@/components/WatchlistEtf"));
const SteemReport = lazy(() => import("@/components/SteemReport"));
const SteemReader = lazy(() => import("@/components/SteemReader"));
const DomesticMarket = lazy(() => import("@/components/DomesticMarket"));
const GlobalMarket = lazy(() => import("@/components/GlobalMarket"));
const DomesticStocks = lazy(() => import("@/components/DomesticStocks"));
const OverseasStocks = lazy(() => import("@/components/OverseasStocks"));
const TenBaggerStocks = lazy(() => import("@/components/TenBaggerStocks"));
const AiAgent = lazy(() => import("@/components/AiAgent"));
const EtfSearch = lazy(() => import("@/components/EtfSearch"));
const AdminDashboard = lazy(() => import("@/components/AdminDashboard"));
const SecurityAudit = lazy(() => import("@/components/SecurityAudit"));
const SystemMonitor = lazy(() => import("@/components/SystemMonitor"));
const MobilePreview = lazy(() => import("@/components/MobilePreview"));
const MarketsEtc = lazy(() => import("@/components/MarketsEtc"));
const MarketCalendar = lazy(() => import("@/components/MarketCalendar"));
const ApiManager = lazy(() => import("@/components/ApiManager"));

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Home() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTabRaw] = useState("home");
  const [isTabPending, startTabTransition] = useTransition();
  const setActiveTab = useCallback((tab: string) => {
    // useTransition만 사용: React가 자체적으로 non-blocking 처리
    // rAF 제거로 ~32ms 불필요 지연 해소
    startTabTransition(() => {
      setActiveTabRaw(tab);
    });
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  
  const { toast } = useToast();
  const { isAdmin, isLoggedIn } = useAuth();

  // Admin: 가입사용자 수 / 활성사용자 수 조회
  const { data: adminUsers } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdmin,
    staleTime: 60 * 1000,
  });
  const { data: adminStats } = useQuery<any>({
    queryKey: ["/api/admin/dashboard/stats", { days: 1 }],
    queryFn: async () => {
      const res = await fetch("/api/admin/dashboard/stats?days=1", { credentials: "include" });
      if (!res.ok) throw new Error("stats fetch failed");
      return res.json();
    },
    enabled: isAdmin,
    staleTime: 60 * 1000,
  });
  const totalUsers = adminUsers?.length ?? 0;
  const activeUsers = adminStats?.uniqueVisitors ?? 0;

  // Dark mode toggle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // 방문 추적: 탭 전환 시 기록
  useEffect(() => {
    const trackVisit = async () => {
      try {
        await fetch("/api/visit/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page: activeTab }),
        });
      } catch {}
    };
    trackVisit();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header / Hero */}
      <header className="glass-header sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Sidebar toggle (desktop) */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                title={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
              >
                {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-2 rounded-xl">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground tracking-tight">Life Fitness ETF</h1>
                <p className="text-[11px] text-muted-foreground hidden sm:block">투자와 함께 하는 삶 · Advanced Analytics</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Dark mode toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-muted/60 transition-all duration-200 text-muted-foreground hover:text-foreground"
                title={darkMode ? "라이트 모드" : "다크 모드"}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              {/* Admin: 가입/활성 사용자 수 */}
              {isAdmin && totalUsers > 0 && (
                <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 rounded-md px-1.5 py-1" title={`가입 ${totalUsers}명 / 오늘 활성 ${activeUsers}명`}>
                  <Users className="w-3 h-3" />
                  <span className="font-semibold text-foreground">{totalUsers}</span>
                  <span>/</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{activeUsers}</span>
                </div>
              )}
              {/* AI Agent 모바일웹 버튼 */}
              <a
                href="/ai-mobile"
                target="_blank"
                rel="noopener noreferrer"
                title="AI Agent 모바일웹"
                className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold transition-colors shadow-sm"
              >
                M
              </a>
              <QnABoard />
              {(isAdmin || isLoggedIn) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950 btn-hover-lift"
                  onClick={() => {
                    startTabTransition(() => { navigate("/trading"); });
                  }}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-xs">자동매매</span>
                </Button>
              )}
              <LoginDialog />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex gap-4">
          {/* 왼쪽 세로 메인탭 사이드바 */}
          <div className={`hidden md:flex flex-col shrink-0 sticky top-[73px] self-start max-h-[calc(100vh-85px)] overflow-y-auto scrollbar-thin transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-14' : 'w-44'}`}>
            <nav className="sidebar-nav bg-card border border-border/60 shadow-sm">
              {/* 홈 */}
              <SidebarButton icon={<HomeIcon className="h-4 w-4 shrink-0" />} label="홈" active={activeTab === "home"} collapsed={sidebarCollapsed} onClick={() => setActiveTab("home")} />

              {/* ETF정보 */}
              {sidebarCollapsed ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`sidebar-item relative justify-center px-0 ${(activeTab === "etf-components" || activeTab === "new-etf" || activeTab === "watchlist-etf" || activeTab === "satellite-etf" || activeTab === "etf-search") ? "sidebar-item-active" : ""}`} title="ETF정보">
                      <Scale className="h-4 w-4 shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="min-w-[160px]">
                    <DropdownMenuItem onClick={() => setActiveTab("etf-components")} className="gap-2 cursor-pointer">📊 실시간ETF</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("new-etf")} className="gap-2 cursor-pointer">🆕 신규ETF</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("watchlist-etf")} className="gap-2 cursor-pointer">⭐ 관심(Core)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("satellite-etf")} className="gap-2 cursor-pointer">🛰️ 관심(Satellite)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("etf-search")} className="gap-2 cursor-pointer">🔍 ETF통합검색</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <SidebarAccordion
                  icon={<Scale className="h-4 w-4 shrink-0" />}
                  label="ETF정보"
                  active={["etf-components","new-etf","watchlist-etf","satellite-etf","etf-search"].includes(activeTab)}
                  items={[
                    { label: "📊 실시간ETF", value: "etf-components" },
                    { label: "🆕 신규ETF", value: "new-etf" },
                    { label: "⭐ 관심(Core)", value: "watchlist-etf" },
                    { label: "🛰️ 관심(Satellite)", value: "satellite-etf" },
                    { label: "🔍 ETF통합검색", value: "etf-search" },
                  ]}
                  activeTab={activeTab}
                  onSelect={setActiveTab}
                />
              )}

              {/* Markets */}
              {sidebarCollapsed ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`sidebar-item relative justify-center px-0 ${activeTab.startsWith("markets-") ? "sidebar-item-active" : ""}`} title="Markets">
                      <Globe className="h-4 w-4 shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="min-w-[140px]">
                    <DropdownMenuItem onClick={() => setActiveTab("markets-domestic")} className="gap-2 cursor-pointer">🇰🇷 국내증시</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("markets-global")} className="gap-2 cursor-pointer">🌍 해외증시</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("markets-etc")} className="gap-2 cursor-pointer">💹 ETC</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("markets-news")} className="gap-2 cursor-pointer">📰 주요뉴스</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("markets-research")} className="gap-2 cursor-pointer">📊 리서치</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("markets-calendar")} className="gap-2 cursor-pointer">📅 증시캘린더</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <SidebarAccordion
                  icon={<Globe className="h-4 w-4 shrink-0" />}
                  label="Markets"
                  active={activeTab.startsWith("markets-")}
                  items={[
                    { label: "🇰🇷 국내증시", value: "markets-domestic" },
                    { label: "🌍 해외증시", value: "markets-global" },
                    { label: "💹 ETC", value: "markets-etc" },
                    { label: "📰 주요뉴스", value: "markets-news" },
                    { label: "📊 리서치", value: "markets-research" },
                    { label: "📅 증시캘린더", value: "markets-calendar" },
                  ]}
                  activeTab={activeTab}
                  onSelect={setActiveTab}
                />
              )}

              {/* 주식정보 */}
              {sidebarCollapsed ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`sidebar-item relative justify-center px-0 ${activeTab.startsWith("stocks-") ? "sidebar-item-active" : ""}`} title="주식정보">
                      <BarChart3 className="h-4 w-4 shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="min-w-[140px]">
                    <DropdownMenuItem onClick={() => setActiveTab("stocks-domestic")} className="gap-2 cursor-pointer">🇰🇷 국내주식</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("stocks-overseas")} className="gap-2 cursor-pointer">🌐 해외주식</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("stocks-10x")} className="gap-2 cursor-pointer">🚀 10X</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <SidebarAccordion
                  icon={<BarChart3 className="h-4 w-4 shrink-0" />}
                  label="주식정보"
                  active={activeTab.startsWith("stocks-")}
                  items={[
                    { label: "🇰🇷 국내주식", value: "stocks-domestic" },
                    { label: "🌐 해외주식", value: "stocks-overseas" },
                    { label: "🚀 10X", value: "stocks-10x" },
                  ]}
                  activeTab={activeTab}
                  onSelect={setActiveTab}
                />
              )}

              {/* 투자전략 */}
              {sidebarCollapsed ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`sidebar-item relative justify-center px-0 ${activeTab.startsWith("strategy-") ? "sidebar-item-active" : ""}`} title="투자전략">
                      <Calendar className="h-4 w-4 shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="min-w-[130px]">
                    <DropdownMenuItem onClick={() => setActiveTab("strategy-daily")} className="gap-2 cursor-pointer">📋 일일 보고서</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("strategy-weekly")} className="gap-2 cursor-pointer">📊 주간 보고서</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("strategy-monthly")} className="gap-2 cursor-pointer">📈 월간 보고서</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("strategy-yearly")} className="gap-2 cursor-pointer">📉 연간 보고서</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <SidebarAccordion
                  icon={<Calendar className="h-4 w-4 shrink-0" />}
                  label="투자전략"
                  active={activeTab.startsWith("strategy-")}
                  items={[
                    { label: "📋 일일 보고서", value: "strategy-daily" },
                    { label: "📊 주간 보고서", value: "strategy-weekly" },
                    { label: "📈 월간 보고서", value: "strategy-monthly" },
                    { label: "📉 연간 보고서", value: "strategy-yearly" },
                  ]}
                  activeTab={activeTab}
                  onSelect={setActiveTab}
                />
              )}

              {/* CRYPTO (Admin 전용) */}
              {isAdmin && (
                sidebarCollapsed ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`sidebar-item relative justify-center px-0 ${activeTab.startsWith("crypto-") ? "sidebar-item-active" : ""}`} title="CRYPTO">
                        <Zap className="h-4 w-4 shrink-0" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="min-w-[130px]">
                      <DropdownMenuItem onClick={() => setActiveTab("crypto-steem-reader")} className="gap-2 cursor-pointer">📖 스팀글읽기</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab("crypto-steem-report")} className="gap-2 cursor-pointer">🔬 스팀보고서</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <SidebarAccordion
                    icon={<Zap className="h-4 w-4 shrink-0" />}
                    label="CRYPTO"
                    active={activeTab.startsWith("crypto-")}
                    items={[
                      { label: "📖 스팀글읽기", value: "crypto-steem-reader" },
                      { label: "🔬 스팀보고서", value: "crypto-steem-report" },
                    ]}
                    activeTab={activeTab}
                    onSelect={setActiveTab}
                  />
                )
              )}

              {/* 구분선 */}
              <div className="my-1 border-t border-border/40" />

              {/* AI Agent */}
              <SidebarButton icon={<Bot className="h-4 w-4 shrink-0 text-purple-500" />} label="AI Agent" active={activeTab === "ai-agent"} collapsed={sidebarCollapsed} onClick={() => setActiveTab("ai-agent")} />

              {/* API 관리 */}
              {isLoggedIn && (
                <SidebarButton icon={<Key className="h-4 w-4 shrink-0 text-orange-500" />} label="API 관리" active={activeTab === "api-manager"} collapsed={sidebarCollapsed} onClick={() => setActiveTab("api-manager")} />
              )}

              {/* 즐겨찾기 */}
              <SidebarButton icon={<Star className="h-4 w-4 shrink-0 text-yellow-500" />} label="즐겨찾기" active={activeTab === "bookmarks"} collapsed={sidebarCollapsed} onClick={() => setActiveTab("bookmarks")} />

              {/* Admin Dashboard */}
              {isAdmin && (
                sidebarCollapsed ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`sidebar-item relative justify-center px-0 ${(activeTab === "admin-dashboard" || activeTab === "admin-security" || activeTab === "admin-system" || activeTab === "mobile-preview") ? "sidebar-item-active" : ""}`} title="Dashboard">
                        <BarChart3 className="h-4 w-4 shrink-0 text-emerald-500" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="min-w-[180px]">
                      <DropdownMenuItem onClick={() => setActiveTab("admin-dashboard")} className="gap-2 cursor-pointer">👥 방문,사용자 관리</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab("admin-system")} className="gap-2 cursor-pointer">🖥️ 시스템점검</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab("admin-security")} className="gap-2 cursor-pointer">🛡️ 보안점검</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab("mobile-preview")} className="gap-2 cursor-pointer">📱 Mobile</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <SidebarAccordion
                    icon={<BarChart3 className="h-4 w-4 shrink-0 text-emerald-500" />}
                    label="Dashboard"
                    active={activeTab === "admin-dashboard" || activeTab === "admin-system" || activeTab === "admin-security" || activeTab === "mobile-preview"}
                    items={[
                      { label: "👥 방문,사용자 관리", value: "admin-dashboard" },
                      { label: "🖥️ 시스템점검", value: "admin-system" },
                      { label: "🛡️ 보안점검", value: "admin-security" },
                      { label: "📱 Mobile", value: "mobile-preview" },
                    ]}
                    activeTab={activeTab}
                    onSelect={setActiveTab}
                  />
                )
              )}
            </nav>
          </div>

          {/* 모바일용 가로 탭 (md 이하에서만 표시) */}
          <div className="md:hidden w-full mb-4">
            <TabsList className="flex w-full overflow-x-auto bg-violet-100/70 dark:bg-violet-950/30">
              <TabsTrigger value="home" className="gap-1 text-xs shrink-0">
                <HomeIcon className="h-3.5 w-3.5" />
              홈
            </TabsTrigger>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <button className={`inline-flex items-center gap-1 shrink-0 px-2 py-1.5 text-xs font-medium rounded-sm transition-all ${
                    activeTab === "etf-components" || activeTab === "new-etf" || activeTab === "watchlist-etf" || activeTab === "satellite-etf"
                      ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}>
                    <Scale className="h-3.5 w-3.5" /> ETF <ChevronDown className="h-2.5 w-2.5" />
                </button>
              </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="min-w-[130px]">
                  <DropdownMenuItem onClick={() => setActiveTab("etf-components")} className="gap-2 cursor-pointer text-xs">📊 실시간ETF</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("new-etf")} className="gap-2 cursor-pointer text-xs">🆕 신규ETF</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("watchlist-etf")} className="gap-2 cursor-pointer text-xs">⭐ 관심(Core)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("satellite-etf")} className="gap-2 cursor-pointer text-xs">🛰️ 관심(Satellite)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <button className={`inline-flex items-center gap-1 shrink-0 px-2 py-1.5 text-xs font-medium rounded-sm transition-all ${
                    activeTab.startsWith("markets-") ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}>
                    <Globe className="h-3.5 w-3.5" /> Markets <ChevronDown className="h-2.5 w-2.5" />
                </button>
              </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="min-w-[120px]">
                  <DropdownMenuItem onClick={() => setActiveTab("markets-domestic")} className="gap-2 cursor-pointer text-xs">🇰🇷 국내증시</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("markets-global")} className="gap-2 cursor-pointer text-xs">🌍 해외증시</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("markets-etc")} className="gap-2 cursor-pointer text-xs">💹 ETC</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("markets-news")} className="gap-2 cursor-pointer text-xs">📰 뉴스</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("markets-research")} className="gap-2 cursor-pointer text-xs">📊 리서치</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("markets-calendar")} className="gap-2 cursor-pointer text-xs">📅 캘린더</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <button className={`inline-flex items-center gap-1 shrink-0 px-2 py-1.5 text-xs font-medium rounded-sm transition-all ${
                    activeTab.startsWith("stocks-") ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}>
                    <BarChart3 className="h-3.5 w-3.5" /> 주식 <ChevronDown className="h-2.5 w-2.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[120px]">
                  <DropdownMenuItem onClick={() => setActiveTab("stocks-domestic")} className="gap-2 cursor-pointer text-xs">🇰🇷 국내주식</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("stocks-overseas")} className="gap-2 cursor-pointer text-xs">🌐 해외주식</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("stocks-10x")} className="gap-2 cursor-pointer text-xs">🚀 10X</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`inline-flex items-center gap-1 shrink-0 px-2 py-1.5 text-xs font-medium rounded-sm transition-all ${
                    activeTab.startsWith("strategy-") ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}>
                    <Calendar className="h-3.5 w-3.5" /> 전략 <ChevronDown className="h-2.5 w-2.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="min-w-[110px]">
                  <DropdownMenuItem onClick={() => setActiveTab("strategy-daily")} className="gap-2 cursor-pointer text-xs">📋 일일</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("strategy-weekly")} className="gap-2 cursor-pointer text-xs">📊 주간</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("strategy-monthly")} className="gap-2 cursor-pointer text-xs">📈 월간</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("strategy-yearly")} className="gap-2 cursor-pointer text-xs">📉 연간</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
                {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`inline-flex items-center gap-1 shrink-0 px-2 py-1.5 text-xs font-medium rounded-sm transition-all ${
                    activeTab.startsWith("crypto-") ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}>
                    <Zap className="h-3.5 w-3.5" /> CRYPTO <ChevronDown className="h-2.5 w-2.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="min-w-[120px]">
                  <DropdownMenuItem onClick={() => setActiveTab("crypto-steem-reader")} className="gap-2 cursor-pointer text-xs">📖 스팀글읽기</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("crypto-steem-report")} className="gap-2 cursor-pointer text-xs">🔬 스팀보고서</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
              )}
              <TabsTrigger value="ai-agent" className="gap-1 text-xs shrink-0">
                <Bot className="h-3.5 w-3.5 text-purple-500" /> AI Agent
            </TabsTrigger>
              {isLoggedIn && (
              <TabsTrigger value="api-manager" className="gap-1 text-xs shrink-0">
                <Key className="h-3.5 w-3.5 text-orange-500" /> API
              </TabsTrigger>
              )}
              <TabsTrigger value="bookmarks" className="gap-1 text-xs shrink-0">
                <Star className="h-3.5 w-3.5 text-yellow-500" /> 즐겨찾기
            </TabsTrigger>
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`inline-flex items-center gap-1 shrink-0 px-2 py-1.5 text-xs font-medium rounded-sm transition-all ${
                      activeTab === "admin-dashboard" || activeTab === "admin-system" || activeTab === "admin-security" || activeTab === "mobile-preview" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                    }`}>
                      <BarChart3 className="h-3.5 w-3.5 text-emerald-500" /> Dashboard <ChevronDown className="h-2.5 w-2.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="min-w-[170px]">
                    <DropdownMenuItem onClick={() => setActiveTab("admin-dashboard")} className="gap-2 cursor-pointer text-xs">👥 방문,사용자 관리</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("admin-system")} className="gap-2 cursor-pointer text-xs">🖥️ 시스템점검</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("admin-security")} className="gap-2 cursor-pointer text-xs">🛡️ 보안점검</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab("mobile-preview")} className="gap-2 cursor-pointer text-xs">📱 Mobile</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
          </TabsList>
          </div>

          {/* 오른쪽 콘텐츠 영역 */}
          <div className={`flex-1 min-w-0 ${isTabPending ? 'opacity-70 transition-opacity duration-150' : ''}`} style={{ contain: 'layout style' }}>

          <TabsContent value="home">
            <HomeEmbed onNavigate={setActiveTab} />
          </TabsContent>

          <TabsContent value="etf-components">
            {isLoggedIn ? (
              <Suspense fallback={<ContentSkeleton />}>
              <EtfComponents />
            </Suspense>
            ) : (
              <LoginRequiredMessage />
            )}
          </TabsContent>

          <TabsContent value="new-etf">
            <Suspense fallback={<ContentSkeleton />}>
              <NewEtfComp />
            </Suspense>
          </TabsContent>

          <TabsContent value="watchlist-etf">
            {isLoggedIn ? (
              <Suspense fallback={<ContentSkeleton />}>
                <WatchlistEtfComp listType="core" />
              </Suspense>
            ) : (
              <LoginRequiredMessage />
            )}
          </TabsContent>

          <TabsContent value="satellite-etf">
            {isLoggedIn ? (
              <Suspense fallback={<ContentSkeleton />}>
                <WatchlistEtfComp listType="satellite" />
              </Suspense>
            ) : (
              <LoginRequiredMessage />
            )}
          </TabsContent>

          <TabsContent value="etf-search">
            <Suspense fallback={<ContentSkeleton />}>
              <EtfSearch isAdmin={isAdmin} onNavigate={setActiveTab} />
            </Suspense>
          </TabsContent>

          <TabsContent value="markets-news">
            <Suspense fallback={<ContentSkeleton />}>
              <MarketNews />
            </Suspense>
          </TabsContent>

          <TabsContent value="markets-research">
            <Suspense fallback={<ContentSkeleton />}>
              <ResearchList />
            </Suspense>
          </TabsContent>

          {/* 국내증시 */}
          <TabsContent value="markets-domestic">
            <Suspense fallback={<ContentSkeleton />}>
              <DomesticMarket />
            </Suspense>
          </TabsContent>

          {/* 해외증시 */}
          <TabsContent value="markets-global">
            <Suspense fallback={<ContentSkeleton />}>
              <GlobalMarket />
            </Suspense>
          </TabsContent>

          {/* 국내주식 */}
          <TabsContent value="stocks-domestic">
            <Suspense fallback={<ContentSkeleton />}>
              <DomesticStocks />
            </Suspense>
          </TabsContent>

          {/* 해외주식 */}
          <TabsContent value="stocks-overseas">
            <Suspense fallback={<ContentSkeleton />}>
              <OverseasStocks />
            </Suspense>
          </TabsContent>

          {/* 10X (Ten Bagger) */}
          <TabsContent value="stocks-10x">
            {isLoggedIn ? (
              <Suspense fallback={<ContentSkeleton />}>
                <TenBaggerStocks />
              </Suspense>
            ) : (
              <LoginRequiredMessage />
            )}
          </TabsContent>

          {/* ETC (Commodity, Forex, Crypto, Bond) */}
          <TabsContent value="markets-etc">
            <Suspense fallback={<ContentSkeleton />}>
              <MarketsEtc />
            </Suspense>
          </TabsContent>

          {/* 증시캘린더 */}
          <TabsContent value="markets-calendar">
            <Suspense fallback={<ContentSkeleton />}>
              <MarketCalendar />
            </Suspense>
          </TabsContent>

          {/* 투자전략 보고서 - 일일/주간/월간/연간 */}
          {(["daily", "weekly", "monthly", "yearly"] as const).map((period) => (
            <TabsContent key={period} value={`strategy-${period}`}>
              <Suspense fallback={<ContentSkeleton />}>
                <DailyStrategy period={period} />
              </Suspense>
          </TabsContent>
          ))}

          {/* CRYPTO - 스팀글읽기 (Admin 전용) */}
          {isAdmin && (
          <TabsContent value="crypto-steem-reader">
            <Suspense fallback={<ContentSkeleton />}>
              <SteemReader />
            </Suspense>
          </TabsContent>
          )}

          {/* CRYPTO - 스팀보고서 (Admin 전용) */}
          {isAdmin && (
          <TabsContent value="crypto-steem-report">
            <Suspense fallback={<ContentSkeleton />}>
              <SteemReport />
            </Suspense>
          </TabsContent>
          )}

          <TabsContent value="ai-agent">
            {isLoggedIn ? (
              <Suspense fallback={<ContentSkeleton />}>
                <AiAgent isAdmin={isAdmin} onNavigate={setActiveTab} />
              </Suspense>
            ) : (
              <LoginRequiredMessage />
            )}
          </TabsContent>

          <TabsContent value="bookmarks">
            <Suspense fallback={<ContentSkeleton />}>
              <BookmarksComp />
            </Suspense>
          </TabsContent>

          {/* API 관리 */}
          {isLoggedIn && (
          <TabsContent value="api-manager">
            <Suspense fallback={<ContentSkeleton />}>
              <ApiManager />
            </Suspense>
          </TabsContent>
          )}

          {/* Admin Dashboard - 방문,사용자 관리 */}
          {isAdmin && (
          <TabsContent value="admin-dashboard">
            <Suspense fallback={<ContentSkeleton />}>
              <AdminDashboard />
            </Suspense>
          </TabsContent>
          )}

          {/* Admin Dashboard - 시스템점검 */}
          {isAdmin && (
          <TabsContent value="admin-system">
            <Suspense fallback={<ContentSkeleton />}>
              <SystemMonitor />
            </Suspense>
          </TabsContent>
          )}

          {/* Admin Dashboard - 보안점검 */}
          {isAdmin && (
          <TabsContent value="admin-security">
            <Suspense fallback={<ContentSkeleton />}>
              <SecurityAudit />
            </Suspense>
          </TabsContent>
          )}

          {/* Mobile Preview (Admin only) */}
          {isAdmin && (
          <TabsContent value="mobile-preview">
            <Suspense fallback={<ContentSkeleton />}>
              <MobilePreview />
            </Suspense>
          </TabsContent>
          )}
          </div>
          </div>
        </Tabs>
      </main>
    </div>
  );
}

// ===== 사이드바 버튼 컴포넌트 =====
function SidebarButton({ icon, label, active, collapsed, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; collapsed: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`sidebar-item relative ${collapsed ? 'justify-center px-0' : ''} ${active ? 'sidebar-item-active' : ''}`}
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

// ===== 사이드바 아코디언 서브메뉴 컴포넌트 =====
function SidebarAccordion({ icon, label, active, items, activeTab, onSelect }: {
  icon: React.ReactNode; label: string; active: boolean;
  items: { label: string; value: string }[];
  activeTab: string; onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(active);
  
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`sidebar-item relative ${active ? 'text-foreground font-semibold' : ''}`}
      >
        {icon}
        <span className="truncate flex-1">{label}</span>
        <ChevronDown className={`h-3 w-3 opacity-50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-200 ease-in-out ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="ml-3 pl-3 border-l border-border/40 space-y-0.5 py-1">
          {items.map((item) => (
            <button
              key={item.value}
              onClick={() => onSelect(item.value)}
              className={`w-full text-left rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150 ${
                activeTab === item.value
                  ? 'bg-primary/10 text-primary dark:bg-primary/15'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== 스켈레톤 로딩 컴포넌트 =====
function ContentSkeleton() {
  return (
    <div className="animate-fade-in space-y-4 py-6">
      <div className="skeleton-title" />
      <div className="space-y-3">
        <div className="skeleton-text" />
        <div className="skeleton-text w-5/6" />
        <div className="skeleton-text w-4/6" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="skeleton-card" />
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </div>
    </div>
  );
}

// ===== 로그인 필요 안내 컴포넌트 =====
function LoginRequiredMessage() {
  const [showLogin, setShowLogin] = useState(false);
  const { login, googleLogin, isLoggingIn, isGoogleLoggingIn } = useAuth();
  const { toast } = useToast();
  const [rememberMe, setRememberMe] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const rememberMeRef = useRef(rememberMe);

  useEffect(() => {
    rememberMeRef.current = rememberMe;
  }, [rememberMe]);

  useEffect(() => {
    if (!showLogin) return;
    const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!GOOGLE_CLIENT_ID || !window.google) return;

    const timer = setTimeout(() => {
      try {
        window.google?.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response: any) => {
            try {
              await googleLogin({ credential: response.credential, rememberMe: rememberMeRef.current });
              setShowLogin(false);
              toast({ title: "로그인 성공", description: "환영합니다!" });
            } catch (err: any) {
              toast({ title: "로그인 실패", description: err.message, variant: "destructive" });
            }
          },
          auto_select: false,
          cancel_on_tap_outside: false,
        });
        if (googleBtnRef.current) {
          googleBtnRef.current.innerHTML = "";
          window.google?.accounts.id.renderButton(googleBtnRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "signin_with",
            width: 300,
            logo_alignment: "left",
          });
          setGoogleReady(true);
        }
      } catch {}
    }, 100);
    return () => clearTimeout(timer);
  }, [showLogin]);

  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-8 text-center max-w-md w-full shadow-sm">
        <div className="flex justify-center mb-4">
          <div className="bg-amber-100 dark:bg-amber-900/50 rounded-full p-3">
            <LogIn className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-2">
          로그인이 필요합니다
        </h3>
        <p className="text-sm text-amber-700 dark:text-amber-400 mb-6">
          구글계정 로그인이 필요합니다.
        </p>
        <Button
          onClick={() => setShowLogin(true)}
          className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
        >
          <LogIn className="w-4 h-4" />
          로그인하기
        </Button>
      </div>

      {/* 로그인 다이얼로그 */}
      <Dialog open={showLogin} onOpenChange={setShowLogin}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5" />
              로그인
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Google 계정으로 간편 로그인
                </p>
                <div ref={googleBtnRef} className="flex justify-center" />
                {!googleReady && (
                  <p className="text-xs text-muted-foreground">Google SDK 로딩 중...</p>
                )}
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg">
                Google OAuth가 설정되지 않았습니다.
              </div>
            )}

            {/* 로그인 유지 체크박스 */}
            <div className="flex items-center space-x-2 justify-center">
              <input
                type="checkbox"
                id="rememberMe-required"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="rememberMe-required" className="text-sm font-normal cursor-pointer select-none">
                로그인 유지 (24시간)
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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

interface CafeNotification {
  id: string;
  type: "new_article" | "new_comment" | "new_like" | "member_change";
  message: string;
  detail?: string;
  articleId?: number;
  timestamp: number;
}

// ===== Markets 탭 컴포넌트 (국내증시, 해외증시, ETC) =====
function MarketsView({ type }: { type: "domestic" | "global" | "etc" | "calendar" }) {
  const [activeSubTab, setActiveSubTab] = useState<string>(() => {
    if (type === "domestic") return "kospi";
    if (type === "global") return "us";
    if (type === "calendar") return "kr-calendar";
    return "commodity";
  });

  const tabs: Record<string, { label: string; url: string }[]> = {
    domestic: [
      { label: "코스피", url: "https://stock.naver.com/market/stock/kr/KOSPI" },
      { label: "코스닥", url: "https://stock.naver.com/market/stock/kr/KOSDAQ" },
      { label: "업종별", url: "https://stock.naver.com/market/stock/kr/sectors" },
      { label: "투자자별", url: "https://stock.naver.com/market/stock/kr/investors" },
    ],
    global: [
      { label: "미국", url: "https://stock.naver.com/market/stock/us" },
      { label: "일본", url: "https://stock.naver.com/market/stock/jp" },
      { label: "중국", url: "https://stock.naver.com/market/stock/cn" },
      { label: "유럽", url: "https://stock.naver.com/market/stock/eu" },
      { label: "아시아", url: "https://stock.naver.com/market/stock/asia" },
    ],
    etc: [
      { label: "원자재", url: "https://stock.naver.com/market/commodity" },
      { label: "환율", url: "https://stock.naver.com/market/forex" },
      { label: "암호화폐", url: "https://stock.naver.com/market/crypto" },
      { label: "채권/금리", url: "https://stock.naver.com/market/bond" },
    ],
    calendar: [
      { label: "국내 증시일정", url: "https://finance.naver.com/sise/investCalendar.naver" },
      { label: "해외 경제지표", url: "https://kr.investing.com/economic-calendar/" },
      { label: "IPO 일정", url: "https://www.38.co.kr/html/fund/index.htm?o=k" },
      { label: "배당 일정", url: "https://finance.naver.com/sise/dividendCalendar.naver" },
    ],
  };

  const currentTabs = tabs[type] || [];
  const selectedTab = currentTabs.find((_, i) => {
    const keys: Record<string, string[]> = {
      domestic: ["kospi", "kosdaq", "sectors", "investors"],
      global: ["us", "jp", "cn", "eu", "asia"],
      etc: ["commodity", "forex", "crypto", "bond"],
      calendar: ["kr-calendar", "global-indicators", "ipo", "dividend"],
    };
    return keys[type]?.[i] === activeSubTab;
  });
  const selectedUrl = selectedTab?.url || currentTabs[0]?.url || "";

  const subTabKeys: Record<string, string[]> = {
    domestic: ["kospi", "kosdaq", "sectors", "investors"],
    global: ["us", "jp", "cn", "eu", "asia"],
    etc: ["commodity", "forex", "crypto", "bond"],
    calendar: ["kr-calendar", "global-indicators", "ipo", "dividend"],
  };

  const typeTitle: Record<string, string> = {
    domestic: "🇰🇷 국내증시",
    global: "🌍 해외증시",
    etc: "💹 ETC (원자재·환율·암호화폐·채권)",
    calendar: "📅 증시캘린더",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{typeTitle[type]}</CardTitle>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {currentTabs.map((tab, idx) => {
            const key = subTabKeys[type]?.[idx] || String(idx);
            return (
              <Button
                key={key}
                variant={activeSubTab === key ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setActiveSubTab(key)}
              >
                {tab.label}
              </Button>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs ml-auto gap-1"
            onClick={() => {
              const idx = subTabKeys[type]?.indexOf(activeSubTab) ?? 0;
              const url = currentTabs[idx]?.url;
              if (url) window.open(url, "_blank", "noopener,noreferrer");
            }}
          >
            <ExternalLink className="w-3 h-3" />
            새 탭에서 열기
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <iframe
          key={activeSubTab}
          src={(() => {
            const idx = subTabKeys[type]?.indexOf(activeSubTab) ?? 0;
            return currentTabs[idx]?.url || "";
          })()}
          className="w-full border-0 rounded-b-lg"
          style={{ height: "calc(100vh - 220px)", minHeight: "600px" }}
          title={typeTitle[type]}
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </CardContent>
    </Card>
  );
}

// ===== 일반 유저용 공개 카페 글 목록 (검색 포함) =====
function PublicCafeView() {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchPage, setSearchPage] = useState(1);

  const { data, isLoading } = useQuery<{
    latestArticles: CafeArticle[];
    noticeArticles: CafeArticle[];
  }>({
    queryKey: ["/api/cafe/public-articles"],
    queryFn: async () => {
      const res = await fetch("/api/cafe/public-articles");
      if (!res.ok) throw new Error("카페 글 목록을 불러올 수 없습니다.");
      return res.json();
    },
    staleTime: 3 * 60 * 1000,
  });

  // 검색 쿼리
  const { data: searchData, isFetching: isSearching } = useQuery<{
    articles: CafeArticle[];
    totalArticles: number;
  }>({
    queryKey: ["/api/cafe/public-search", searchQuery, searchPage],
    queryFn: async () => {
      const params = new URLSearchParams({ q: searchQuery, page: String(searchPage), perPage: "20" });
      const res = await fetch(`/api/cafe/public-search?${params}`);
      if (!res.ok) throw new Error("검색에 실패했습니다.");
      return res.json();
    },
    enabled: isSearchMode && searchQuery.length > 0,
    staleTime: 60 * 1000,
  });

  // 일반계정: 최근 3일치 글만 표시
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const latestArticles = (data?.latestArticles || []).filter(
    (a) => a.writeDateTimestamp >= threeDaysAgo
  );
  const noticeArticles = data?.noticeArticles || [];
  const searchArticles = searchData?.articles || [];
  const searchTotalArticles = searchData?.totalArticles || 0;
  const searchTotalPages = Math.ceil(searchTotalArticles / 20);

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
      setSearchPage(1);
    }
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setIsSearchMode(false);
    setSearchPage(1);
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">카페 글 목록 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <img
              src="https://ssl.pstatic.net/static/cafe/cafe_pc/default/cafe_logo_img.png"
              alt="카페"
              className="w-5 h-5"
            />
            <h3 className="font-semibold text-sm">Life Fitness 카페</h3>
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

        {/* 검색 모드 */}
        {isSearchMode && (
          <>
            <div className="px-4 py-2 border-b bg-primary/5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  "{searchQuery}" 검색결과: {searchTotalArticles}건
                  {isSearching && <Loader2 className="w-3 h-3 animate-spin inline ml-1" />}
                </span>
                <Button variant="ghost" size="sm" onClick={clearSearch} className="h-6 text-xs gap-1">
                  <X className="w-3 h-3" />
                  검색 해제
                </Button>
              </div>
            </div>
            <div className="divide-y">
              {isSearching ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">검색 중...</p>
                </div>
              ) : searchArticles.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  검색 결과가 없습니다.
                </div>
              ) : (
                searchArticles.map((article) => (
                  <a
                    key={article.articleId}
                    href={`${CAFE_URL}/${article.articleId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {article.subject}
                        </span>
                        {article.commentCount > 0 && (
                          <span className="text-xs text-primary font-bold flex-shrink-0">[{article.commentCount}]</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="text-blue-500/70 font-medium">{article.menuName}</span>
                        <span className="opacity-40">|</span>
                        <span>{article.writerNickname}</span>
                        <span className="opacity-40">|</span>
                        <span>👁 {article.readCount}</span>
                        {article.likeItCount > 0 && (
                          <>
                            <span className="opacity-40">|</span>
                            <span>❤️ {article.likeItCount}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                      {formatDate(article.writeDateTimestamp)}
                    </span>
                  </a>
                ))
              )}
            </div>
            {/* 검색 페이지네이션 */}
            {searchTotalPages > 1 && (
              <div className="flex items-center justify-center gap-1 py-3 border-t bg-muted/20">
                <Button variant="ghost" size="sm" disabled={searchPage <= 1} onClick={() => setSearchPage(1)} className="h-8 w-8 p-0 text-xs">«</Button>
                <Button variant="ghost" size="sm" disabled={searchPage <= 1} onClick={() => setSearchPage((p) => Math.max(1, p - 1))} className="h-8 w-8 p-0 text-xs">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: Math.min(5, searchTotalPages) }, (_, i) => {
                  const startPage = Math.max(1, Math.min(searchPage - 2, searchTotalPages - 4));
                  const p = startPage + i;
                  if (p > searchTotalPages) return null;
                  return (
                    <Button key={p} variant={p === searchPage ? "default" : "ghost"} size="sm" onClick={() => setSearchPage(p)} className="h-8 w-8 p-0 text-xs">{p}</Button>
                  );
                })}
                <Button variant="ghost" size="sm" disabled={searchPage >= searchTotalPages} onClick={() => setSearchPage((p) => Math.min(searchTotalPages, p + 1))} className="h-8 w-8 p-0 text-xs">
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" disabled={searchPage >= searchTotalPages} onClick={() => setSearchPage(searchTotalPages)} className="h-8 w-8 p-0 text-xs">»</Button>
              </div>
            )}
          </>
        )}

        {/* 최신글 10개 (검색 모드가 아닐 때만) */}
        {!isSearchMode && (
          <>
            <div className="px-4 pt-3 pb-1">
              <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <FileText className="w-4 h-4 text-primary" />
                최신글 <span className="text-xs text-muted-foreground font-normal">(최근 3일, {latestArticles.length}건)</span>
              </h4>
            </div>
            {latestArticles.length === 0 ? (
              <CardContent className="py-8 text-center text-muted-foreground">
                <p className="text-sm">글 목록을 불러올 수 없습니다.</p>
              </CardContent>
            ) : (
              <div className="divide-y">
                {latestArticles.map((article) => (
                  <a
                    key={article.articleId}
                    href={`${CAFE_URL}/${article.articleId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {article.subject}
                        </span>
                        {article.newArticle && (
                          <span className="text-[10px] px-1 py-0 rounded bg-red-500 text-white font-bold flex-shrink-0">N</span>
                        )}
                        {article.commentCount > 0 && (
                          <span className="text-xs text-primary font-bold flex-shrink-0">[{article.commentCount}]</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="text-blue-500/70 font-medium">{article.menuName}</span>
                        <span className="opacity-40">|</span>
                        <span>{article.writerNickname}</span>
                        <span className="opacity-40">|</span>
                        <span>👁 {article.readCount}</span>
                        {article.likeItCount > 0 && (
                          <>
                            <span className="opacity-40">|</span>
                            <span>❤️ {article.likeItCount}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                      {formatDate(article.writeDateTimestamp)}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 전체 공지글 (검색 모드가 아닐 때만) */}
      {!isSearchMode && noticeArticles.length > 0 && (
        <div className="overflow-hidden">
          <div className="px-4 pt-3 pb-1 bg-amber-50/50 border-b border-amber-200/30">
            <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <Newspaper className="w-4 h-4 text-amber-600" />
              <span className="text-amber-700">전체공지</span>
              <span className="text-xs text-muted-foreground font-normal">({noticeArticles.length})</span>
            </h4>
          </div>
          <div className="divide-y">
            {noticeArticles.map((article) => (
              <a
                key={article.articleId}
                href={`${CAFE_URL}/${article.articleId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50/30 transition-colors group"
              >
                <span className="text-amber-500 text-xs font-bold flex-shrink-0">📌</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate group-hover:text-amber-600 transition-colors">
                      {article.subject}
                    </span>
                    {article.commentCount > 0 && (
                      <span className="text-xs text-primary font-bold flex-shrink-0">[{article.commentCount}]</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    <span>{article.writerNickname}</span>
                    <span className="opacity-40">|</span>
                    <span>👁 {article.readCount}</span>
                    {article.likeItCount > 0 && (
                      <>
                        <span className="opacity-40">|</span>
                        <span>❤️ {article.likeItCount}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                  {formatDate(article.writeDateTimestamp)}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface NoticeItem {
  id: number;
  content: string;
  sortOrder: number | null;
  isActive: boolean | null;
  createdAt: string;
  updatedAt: string;
}

// ===== 바로가기 버튼 =====
function QuickLinks({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const shortcuts = [
    { label: "실시간ETF", tab: "etf-components", icon: "📈" },
    { label: "ETF검색", tab: "etf-search", icon: "🔍" },
    { label: "국내증시", tab: "markets-domestic", icon: "🇰🇷" },
    { label: "해외증시", tab: "markets-global", icon: "🌍" },
    { label: "일간보고서", tab: "strategy-daily", icon: "📋" },
    { label: "즐겨찾기", tab: "bookmarks", icon: "⭐" },
  ];

  return (
    <div className="mb-4 px-1">
      <div className="py-3 px-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-foreground">⚡ 바로가기</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {shortcuts.map((s) => (
            <Button
              key={s.tab}
              variant="outline"
              size="sm"
              onClick={() => onNavigate(s.tab)}
              className="gap-1 text-xs h-9 font-medium hover:bg-primary/10 hover:border-primary/40 transition-colors"
            >
              <span>{s.icon}</span>
              {s.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function NoticeBoard() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [newContent, setNewContent] = useState("");

  // 관리자: 전체 공지 (비활성 포함) / 일반: 활성 공지만
  const { data: noticeList = [], refetch } = useQuery<NoticeItem[]>({
    queryKey: [isAdmin ? "/api/notices/all" : "/api/notices"],
    queryFn: async () => {
      const url = isAdmin ? "/api/notices/all" : "/api/notices";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  // 공지 추가
  const addMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/notices", { content, sortOrder: 0, isActive: true });
      return res.json();
    },
    onSuccess: () => {
      refetch();
      setNewContent("");
      toast({ title: "공지 추가 완료" });
    },
  });

  // 공지 수정
  const updateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const res = await apiRequest("PUT", `/api/notices/${id}`, { content });
      return res.json();
    },
    onSuccess: () => {
      refetch();
      setEditingId(null);
      toast({ title: "공지 수정 완료" });
    },
  });

  // 공지 활성/비활성 토글
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/notices/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => refetch(),
  });

  // 공지 삭제
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/notices/${id}`);
    },
    onSuccess: () => {
      refetch();
      toast({ title: "공지 삭제 완료" });
    },
  });

  // 일반 유저: 공지가 없으면 표시 안 함
  if (!isAdmin && noticeList.length === 0) return null;

  // ===== 일반 유저용 뷰 =====
  if (!isAdmin) {
    return (
      <div className="mb-4">
        <div className="pb-2 pt-3 px-4">
          <div className="text-base font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-yellow-600" />
            공지사항
          </div>
        </div>
        <div className="pb-3 px-4">
          <div className="space-y-1">
            {noticeList.map((n, idx) => (
              <p key={n.id} className="text-sm font-bold text-foreground" dangerouslySetInnerHTML={{
                __html: `공지${idx + 1}) ${n.content.replace(
                  /(https?:\/\/[^\s)<]+)/g,
                  '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-800 dark:text-blue-400">$1</a>'
                )}`
              }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ===== 관리자용 편집 뷰 =====
  return (
    <div className="mb-4">
      <div className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-yellow-600" />
            공지사항 관리
          </div>
          <span className="text-xs text-muted-foreground">{noticeList.length}개 공지</span>
        </div>
      </div>
      <div className="pb-3 px-4 space-y-3">
        {/* 공지 목록 */}
        {noticeList.length > 0 && (
          <div className="space-y-2">
            {noticeList.map((n) => (
              <div key={n.id} className={`flex items-start gap-2 p-2 rounded border ${n.isActive ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800" : "bg-muted/30 border-dashed opacity-60"}`}>
                {editingId === n.id ? (
                  <div className="flex-1 space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="text-sm min-h-[60px]"
                      placeholder="공지 내용"
                    />
                    <div className="flex gap-1">
                      <Button size="sm" variant="default" onClick={() => updateMutation.mutate({ id: n.id, content: editContent })} disabled={updateMutation.isPending || !editContent.trim()}>
                        저장
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        취소
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="flex-1 text-sm font-medium leading-relaxed whitespace-pre-wrap">{n.content}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleMutation.mutate({ id: n.id, isActive: !n.isActive })} title={n.isActive ? "비활성화" : "활성화"}>
                        {n.isActive ? <Eye className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-muted-foreground" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingId(n.id); setEditContent(n.content); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => { if (confirm("이 공지를 삭제하시겠습니까?")) deleteMutation.mutate(n.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 새 공지 추가 */}
        <div className="flex gap-2">
          <Input
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="새 공지 내용을 입력하세요..."
            className="text-sm"
            onKeyDown={(e) => { if (e.key === "Enter" && newContent.trim()) addMutation.mutate(newContent); }}
          />
          <Button size="sm" onClick={() => addMutation.mutate(newContent)} disabled={addMutation.isPending || !newContent.trim()}>
            <Plus className="w-4 h-4 mr-1" />
            추가
          </Button>
        </div>
      </div>
    </div>
  );
}

function HomeEmbed({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [selectedMenuId, setSelectedMenuId] = useState("0"); // "0" = 전체
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [previewArticleId, setPreviewArticleId] = useState<number | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

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

  // 카페 알림 조회 (2분마다 자동 폴링)
  const { data: notifData, refetch: refetchNotifications } = useQuery<{
    notifications: CafeNotification[];
    lastChecked: number;
    memberCount: number | null;
    newCount?: number;
  }>({
    queryKey: ["/api/cafe/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/cafe/notifications", { credentials: "include" });
      if (!res.ok) return { notifications: [], lastChecked: 0, memberCount: null };
      return res.json();
    },
    enabled: isAdmin,
    staleTime: 60 * 1000, // 1분
    refetchInterval: 2 * 60 * 1000, // 2분마다 자동 갱신
  });

  const notifications = notifData?.notifications || [];
  const unreadCount = notifications.length;

  // 알림 삭제 mutation
  const deleteNotifMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/cafe/notifications/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cafe/notifications"] });
    },
  });

  const clearAllNotifMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/cafe/notifications", { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/cafe/notifications"], {
        notifications: [], lastChecked: Date.now(), memberCount: notifData?.memberCount,
      });
      setShowNotifications(false);
    },
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

  // 일반 유저: 공개 카페 글 목록 (최신 10개 + 전체 공지글)
  if (!isAdmin) {
    return (
      <>
        <NoticeBoard />
        <QuickLinks onNavigate={onNavigate} />
        <PublicCafeView />
      </>
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
      <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">카페 글 목록 로딩 중...</p>
      </div>
    );
  }

  return (
    <>
      <NoticeBoard />
      <QuickLinks onNavigate={onNavigate} />
      <div className="overflow-hidden">
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

            {/* 알림 벨 */}
            <div className="relative">
              <Button
                variant={showNotifications ? "default" : "outline"}
                size="sm"
                className="gap-1 text-xs h-7 relative"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) refetchNotifications();
                }}
              >
                {unreadCount > 0 ? (
                  <BellRing className="w-3.5 h-3.5" />
                ) : (
                  <Bell className="w-3.5 h-3.5" />
                )}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </div>

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

        {/* 알림 패널 */}
        {showNotifications && (
          <div className="border-b bg-amber-50/50 dark:bg-amber-950/20">
            <div className="px-4 py-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <BellRing className="w-4 h-4 text-amber-600" />
                카페 알림
                {notifData?.memberCount && (
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    멤버 {notifData.memberCount.toLocaleString()}명
                          </span>
                )}
              </h4>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground"
                  onClick={() => refetchNotifications()}
                >
                  새로고침
                </Button>
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-red-500 hover:text-red-700"
                    onClick={() => clearAllNotifMutation.mutate()}
                    disabled={clearAllNotifMutation.isPending}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    전체 삭제
                  </Button>
                )}
              </div>
            </div>
            <div className="max-h-[250px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p>새로운 알림이 없습니다</p>
                  <p className="text-xs mt-1">2분마다 자동으로 확인합니다</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notif) => {
                    const icon = notif.type === "new_article" ? <FileEdit className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      : notif.type === "new_comment" ? <MessageCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      : notif.type === "new_like" ? <Heart className="w-4 h-4 text-pink-500 flex-shrink-0" />
                      : <UserPlus className="w-4 h-4 text-purple-500 flex-shrink-0" />;

                    const timeAgo = (() => {
                      const diff = Date.now() - notif.timestamp;
                      const mins = Math.floor(diff / 60000);
                      if (mins < 1) return "방금";
                      if (mins < 60) return `${mins}분 전`;
                      const hours = Math.floor(mins / 60);
                      if (hours < 24) return `${hours}시간 전`;
                      return `${Math.floor(hours / 24)}일 전`;
                    })();

                        return (
                      <div
                        key={notif.id}
                        className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 cursor-pointer group"
                        onClick={() => {
                          if (notif.articleId) {
                            setPreviewArticleId(notif.articleId);
                            setShowNotifications(false);
                          }
                        }}
                      >
                        {icon}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{notif.message}</p>
                          {notif.detail && (
                            <p className="text-xs text-muted-foreground mt-0.5">{notif.detail}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[11px] text-muted-foreground">{timeAgo}</span>
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotifMutation.mutate(notif.id);
                            }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                        );
                      })}
            </div>
              )}
            </div>
            {notifData?.lastChecked && (
              <div className="px-4 py-1.5 border-t bg-muted/30 text-[11px] text-muted-foreground">
                마지막 확인: {new Date(notifData.lastChecked).toLocaleTimeString("ko-KR")}
              </div>
            )}
          </div>
        )}

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
        </div>

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


