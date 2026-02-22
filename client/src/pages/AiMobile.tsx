import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import AiAgent from "@/components/AiAgent";
import { LoginDialog } from "@/components/LoginDialog";
import { Bot, ArrowLeft, Smartphone, Download, BarChart3, Loader2, Zap, Key, TrendingUp, Globe, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";

const EtfComponents = lazy(() => import("@/components/EtfComponents"));
const ApiManager = lazy(() => import("@/components/ApiManager"));
const DomesticMarket = lazy(() => import("@/components/DomesticMarket"));
const GlobalMarket = lazy(() => import("@/components/GlobalMarket"));
const MarketNews = lazy(() => import("@/components/MarketNews"));

type MobileMode = "select" | "ai-agent" | "etf" | "api-manager" | "domestic-market" | "global-market" | "domestic-news" | "global-news";

export function AiMobileContent() {
  const { isAdmin, isLoggedIn, userName, userEmail, logout, isLoggingOut } = useAuth();
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [mode, setMode] = useState<MobileMode>("select");
  const modeRef = useRef<MobileMode>("select");

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const navigateTo = useCallback((newMode: MobileMode) => {
    setMode(newMode);
  }, []);

  const goBack = useCallback(() => {
    if (modeRef.current !== "select") {
      setMode("select");
    }
  }, []);

  useEffect(() => {
    window.history.pushState(null, "");

    const handlePopState = () => {
      window.history.pushState(null, "");
      if (modeRef.current !== "select") {
        setMode("select");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // 모바일 viewport 최적화 + PWA 등록
  useEffect(() => {
    // 다크모드 확인
    const savedDark = localStorage.getItem("darkMode");
    if (savedDark === "true") {
      document.documentElement.classList.add("dark");
    }
    // 모바일 viewport height 보정 (주소바 고려)
    const setVH = () => {
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    };
    setVH();
    window.addEventListener("resize", setVH);

    // PWA manifest 연결
    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      manifestLink.href = "/manifest.json";
      document.head.appendChild(manifestLink);
    }

    // theme-color 메타 태그
    let themeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    if (!themeColor) {
      themeColor = document.createElement("meta");
      themeColor.name = "theme-color";
      themeColor.content = "#3b82f6";
      document.head.appendChild(themeColor);
    }

    // Service Worker 등록
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // PWA 설치 프롬프트 캐치
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("resize", setVH);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            LifeFit
          </h1>
          <p className="text-sm text-muted-foreground">
            로그인 후 이용할 수 있습니다
          </p>
          <div className="flex justify-center">
            <LoginDialog />
          </div>
          <a
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 mt-2"
          >
            <ArrowLeft className="w-3 h-3" /> 메인으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  // 초기 선택 화면
  if (mode === "select") {
    return (
      <div
        className="flex flex-col bg-background"
        style={{ height: "calc(var(--vh, 1vh) * 100)" }}
      >
        {/* 헤더 */}
        <header className="flex items-center justify-between px-3 py-2 border-b bg-background/95 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <a href="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </a>
            <div>
              <h1 className="text-sm font-bold leading-tight">LifeFit</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">{userName || userEmail || "User"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {installPrompt && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] px-2 gap-1 border-blue-300 text-blue-600"
                onClick={async () => {
                  installPrompt.prompt();
                  const result = await installPrompt.userChoice;
                  if (result.outcome === "accepted") {
                    setInstallPrompt(null);
                  }
                }}
              >
                <Download className="w-3 h-3" />
                앱 설치
              </Button>
            )}
            <Smartphone className="w-3.5 h-3.5 text-blue-500" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] px-2 text-muted-foreground"
              onClick={() => logout()}
              disabled={isLoggingOut}
            >
              로그아웃
            </Button>
          </div>
        </header>

        {/* 선택 카드 영역 */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 w-full max-w-md mx-auto">
            {/* AI Agent 버튼 */}
            <button
              onClick={() => navigateTo("ai-agent")}
              className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-lg transition-all duration-200 active:scale-95"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-md">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-foreground">AI Agent</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">AI 투자 에이전트</p>
              </div>
            </button>

            {/* 실시간ETF 버튼 */}
            <button
              onClick={() => navigateTo("etf")}
              className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 hover:border-green-400 dark:hover:border-green-600 hover:shadow-lg transition-all duration-200 active:scale-95"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-foreground">실시간 ETF</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">ETF 시세 · AI 분석</p>
              </div>
            </button>

            {/* 자동매매 (매매A) 버튼 */}
            <button
              onClick={() => window.open("https://lifefit2.vercel.app/trading", "_blank", "noopener,noreferrer")}
              className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-lg transition-all duration-200 active:scale-95"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-foreground">매매A(Active)</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">주문 · 잔고 · 전략</p>
              </div>
            </button>

            {/* API 관리 버튼 */}
            <button
              onClick={() => navigateTo("api-manager")}
              className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 hover:border-orange-400 dark:hover:border-orange-600 hover:shadow-lg transition-all duration-200 active:scale-95"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-md">
                <Key className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-foreground">API 관리</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">API 키 등록 · 전환</p>
              </div>
            </button>

            {/* 국내증시 버튼 */}
            <button
              onClick={() => navigateTo("domestic-market")}
              className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl border-2 border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 hover:border-rose-400 dark:hover:border-rose-600 hover:shadow-lg transition-all duration-200 active:scale-95"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-foreground">국내증시</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">코스피 · 코스닥 · 업종</p>
              </div>
            </button>

            {/* 해외증시 버튼 */}
            <button
              onClick={() => navigateTo("global-market")}
              className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl border-2 border-sky-200 dark:border-sky-800 bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/30 hover:border-sky-400 dark:hover:border-sky-600 hover:shadow-lg transition-all duration-200 active:scale-95"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-md">
                <Globe className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-foreground">해외증시</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">미국 · 유럽 · 아시아</p>
              </div>
            </button>

            {/* 주요뉴스 버튼 */}
            <button
              onClick={() => navigateTo("domestic-news")}
              className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl border-2 border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30 hover:border-teal-400 dark:hover:border-teal-600 hover:shadow-lg transition-all duration-200 active:scale-95"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md">
                <Newspaper className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-foreground">주요뉴스</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">국내 시장 뉴스</p>
              </div>
            </button>

            {/* 주요글로벌뉴스 버튼 */}
            <button
              onClick={() => navigateTo("global-news")}
              className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl border-2 border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 hover:border-violet-400 dark:hover:border-violet-600 hover:shadow-lg transition-all duration-200 active:scale-95"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md">
                <Globe className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-foreground">글로벌뉴스</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">해외 시장 뉴스</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // AI Agent 모드
  if (mode === "ai-agent") {
    return (
      <div
        className="flex flex-col bg-background"
        style={{ height: "calc(var(--vh, 1vh) * 100)" }}
      >
        <header className="flex items-center justify-between px-3 py-2 border-b bg-background/95 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={goBack} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">AI Agent</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">{userName || userEmail || "User"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] px-2 text-muted-foreground"
              onClick={() => logout()}
              disabled={isLoggingOut}
            >
              로그아웃
            </Button>
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden">
          <AiAgent isAdmin={isAdmin} compact />
        </div>
      </div>
    );
  }

  // 실시간ETF 모드
  if (mode === "etf") {
    return (
      <div
        className="flex flex-col bg-background"
        style={{ height: "calc(var(--vh, 1vh) * 100)" }}
      >
        <header className="flex items-center justify-between px-3 py-2 border-b bg-background/95 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={goBack} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">실시간 ETF</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">{userName || userEmail || "User"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] px-2 text-muted-foreground"
              onClick={() => logout()}
              disabled={isLoggingOut}
            >
              로그아웃
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-green-500" />
            </div>
          }>
            <div className="p-2">
              <EtfComponents />
            </div>
          </Suspense>
        </div>
      </div>
    );
  }

  // API 관리 모드
  if (mode === "api-manager") {
    return (
      <div
        className="flex flex-col bg-background"
        style={{ height: "calc(var(--vh, 1vh) * 100)" }}
      >
        <header className="flex items-center justify-between px-3 py-2 border-b bg-background/95 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={goBack} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <Key className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">API 관리</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">{userName || userEmail || "User"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] px-2 text-muted-foreground"
              onClick={() => logout()}
              disabled={isLoggingOut}
            >
              로그아웃
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          }>
            <div className="p-2">
              <ApiManager />
            </div>
          </Suspense>
        </div>
      </div>
    );
  }

  const subPageConfig: Record<string, { title: string; icon: React.ReactNode; color: string; spinColor: string }> = {
    "domestic-market": { title: "국내증시", icon: <TrendingUp className="w-4 h-4 text-white" />, color: "from-rose-500 to-pink-600", spinColor: "text-rose-500" },
    "global-market": { title: "해외증시", icon: <Globe className="w-4 h-4 text-white" />, color: "from-sky-500 to-cyan-600", spinColor: "text-sky-500" },
    "domestic-news": { title: "주요뉴스", icon: <Newspaper className="w-4 h-4 text-white" />, color: "from-teal-500 to-emerald-600", spinColor: "text-teal-500" },
    "global-news": { title: "글로벌뉴스", icon: <Globe className="w-4 h-4 text-white" />, color: "from-violet-500 to-indigo-600", spinColor: "text-violet-500" },
  };

  const cfg = subPageConfig[mode];
  if (cfg) {
    return (
      <div
        className="flex flex-col bg-background"
        style={{ height: "calc(var(--vh, 1vh) * 100)" }}
      >
        <header className="flex items-center justify-between px-3 py-2 border-b bg-background/95 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={goBack} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${cfg.color} flex items-center justify-center`}>
              {cfg.icon}
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">{cfg.title}</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">{userName || userEmail || "User"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] px-2 text-muted-foreground"
              onClick={() => logout()}
              disabled={isLoggingOut}
            >
              로그아웃
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <Loader2 className={`w-8 h-8 animate-spin ${cfg.spinColor}`} />
            </div>
          }>
            <div className="p-2">
              {mode === "domestic-market" && <DomesticMarket />}
              {mode === "global-market" && <GlobalMarket />}
              {mode === "domestic-news" && <MarketNews />}
              {mode === "global-news" && <MobileGlobalNews />}
            </div>
          </Suspense>
        </div>
      </div>
    );
  }

  return null;
}

function MobileGlobalNews() {
  const { data, isLoading } = useQuery<{ news: { title: string; url: string; date: string }[]; updatedAt: string }>({
    queryKey: ["/api/markets/global/news"],
    queryFn: async () => {
      const res = await fetch("/api/markets/global/news");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 300000,
  });
  const news = data?.news || [];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold flex items-center gap-1.5">
          <Globe className="w-4 h-4 text-violet-500" />
          최신 글로벌 뉴스
        </h2>
        {data?.updatedAt && <span className="text-[10px] text-muted-foreground">{data.updatedAt}</span>}
      </div>
      {isLoading && news.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
        </div>
      ) : news.length > 0 ? (
        <div className="space-y-0.5">
          {news.map((item, i) => (
            <a
              key={i}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 py-2 px-2 rounded-lg hover:bg-muted/40 transition-colors"
            >
              <span className="text-xs text-muted-foreground font-mono mt-0.5 shrink-0 w-4 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug line-clamp-2">{item.title}</p>
                {item.date && <span className="text-[10px] text-muted-foreground mt-0.5 block">{item.date}</span>}
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-sm text-muted-foreground">뉴스를 불러올 수 없습니다</div>
      )}
    </div>
  );
}

export default function AiMobile() {
  return <AiMobileContent />;
}
