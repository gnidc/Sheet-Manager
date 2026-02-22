import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import AiAgent from "@/components/AiAgent";
import { LoginDialog } from "@/components/LoginDialog";
import { Bot, ArrowLeft, Download, BarChart3, Loader2, Zap, Key, TrendingUp, Globe, Newspaper, Star, Mic, Settings2, Info, ExternalLink, Volume2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const EtfComponents = lazy(() => import("@/components/EtfComponents"));
const ApiManager = lazy(() => import("@/components/ApiManager"));
const DomesticMarket = lazy(() => import("@/components/DomesticMarket"));
const GlobalMarket = lazy(() => import("@/components/GlobalMarket"));
const MarketNews = lazy(() => import("@/components/MarketNews"));
const Bookmarks = lazy(() => import("@/components/Bookmarks"));
const EtfSearch = lazy(() => import("@/components/EtfSearch"));

type MobileMode = "select" | "ai-agent" | "etf" | "api-manager" | "domestic-market" | "global-market" | "domestic-news" | "global-news" | "bookmarks" | "etf-search";

interface MenuItemConfig {
  id: MobileMode | "external-trading";
  label: string;
  sub: string;
  icon: typeof Bot;
  borderColor: string;
  bgGradient: string;
  iconGradient: string;
  adminOnly?: boolean;
}

const MENU_ITEMS: MenuItemConfig[] = [
  { id: "etf", label: "실시간 ETF", sub: "ETF 시세 · AI 분석", icon: BarChart3, borderColor: "border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600", bgGradient: "from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30", iconGradient: "from-green-500 to-emerald-600" },
  { id: "etf-search", label: "ETF통합검색", sub: "ETF 검색 · 비교", icon: Search, borderColor: "border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600", bgGradient: "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30", iconGradient: "from-blue-500 to-indigo-600" },
  { id: "domestic-market", label: "국내증시", sub: "코스피 · 코스닥 · 업종", icon: TrendingUp, borderColor: "border-rose-200 dark:border-rose-800 hover:border-rose-400 dark:hover:border-rose-600", bgGradient: "from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30", iconGradient: "from-rose-500 to-pink-600" },
  { id: "global-market", label: "해외증시", sub: "미국 · 유럽 · 아시아", icon: Globe, borderColor: "border-sky-200 dark:border-sky-800 hover:border-sky-400 dark:hover:border-sky-600", bgGradient: "from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/30", iconGradient: "from-sky-500 to-cyan-600" },
  { id: "domestic-news", label: "주요뉴스", sub: "국내 시장 뉴스", icon: Newspaper, borderColor: "border-teal-200 dark:border-teal-800 hover:border-teal-400 dark:hover:border-teal-600", bgGradient: "from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30", iconGradient: "from-teal-500 to-emerald-600" },
  { id: "global-news", label: "글로벌뉴스", sub: "해외 시장 뉴스", icon: Globe, borderColor: "border-violet-200 dark:border-violet-800 hover:border-violet-400 dark:hover:border-violet-600", bgGradient: "from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30", iconGradient: "from-violet-500 to-indigo-600" },
  { id: "external-trading", label: "매매A(Active)", sub: "주문 · 잔고 · 전략", icon: Zap, borderColor: "border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600", bgGradient: "from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30", iconGradient: "from-amber-500 to-orange-600" },
  { id: "ai-agent", label: "AI Agent", sub: "AI 투자 에이전트", icon: Bot, borderColor: "border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600", bgGradient: "from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30", iconGradient: "from-purple-500 to-blue-600" },
  { id: "api-manager", label: "API 관리", sub: "API 키 등록 · 전환", icon: Key, borderColor: "border-orange-200 dark:border-orange-800 hover:border-orange-400 dark:hover:border-orange-600", bgGradient: "from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30", iconGradient: "from-orange-500 to-red-600" },
  { id: "bookmarks", label: "즐겨찾기", sub: "저장한 종목 · 링크", icon: Star, borderColor: "border-yellow-200 dark:border-yellow-800 hover:border-yellow-400 dark:hover:border-yellow-600", bgGradient: "from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30", iconGradient: "from-yellow-500 to-amber-600" },
];

function MobileMenuGrid({ navigateTo, isAdmin }: { navigateTo: (mode: MobileMode) => void; isAdmin: boolean }) {
  const items = MENU_ITEMS.filter(m => !m.adminOnly || isAdmin);

  return (
    <div className="grid grid-cols-2 gap-2 w-full max-w-md mx-auto">
      {items.map((item) => {
        const Icon = item.icon;
        const handleClick = item.id === "external-trading"
          ? () => window.open("https://lifefit2.vercel.app/trading", "_blank", "noopener,noreferrer")
          : () => navigateTo(item.id as MobileMode);

        return (
          <button
            key={item.id}
            onClick={handleClick}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border-2 ${item.borderColor} bg-gradient-to-br ${item.bgGradient} hover:shadow-lg transition-all duration-200 active:scale-95`}
          >
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${item.iconGradient} flex items-center justify-center shadow-md`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-foreground leading-tight">{item.label}</p>
              <p className="text-[8px] text-muted-foreground leading-tight">{item.sub}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function AiMobileContent() {
  const { isAdmin, isLoggedIn, userName, userEmail, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [mode, setMode] = useState<MobileMode>("select");
  const modeRef = useRef<MobileMode>("select");
  const [voiceActivated, setVoiceActivated] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(() => localStorage.getItem("wakeword_enabled") === "true");
  const [wakeWordListening, setWakeWordListening] = useState(false);
  const wakeRecognitionRef = useRef<any>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const navigateTo = useCallback((newMode: MobileMode) => {
    setMode(newMode);
  }, []);

  const goBack = useCallback(() => {
    if (modeRef.current !== "select") {
      setMode("select");
      setVoiceActivated(false);
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

  // 딥링크: URL 해시로 자동 진입
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "ai-agent") {
      setMode("ai-agent");
      setVoiceActivated(true);
    }
  }, []);

  // 웨이크워드 감지: 메인 화면에서 "헤이 라마" 인식
  useEffect(() => {
    if (!wakeWordEnabled || mode !== "select" || !isLoggedIn) {
      if (wakeRecognitionRef.current) {
        try { wakeRecognitionRef.current.stop(); } catch {}
        setWakeWordListening(false);
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 3;

    const startListening = () => {
      try {
        recognition.start();
        setWakeWordListening(true);
      } catch { setWakeWordListening(false); }
    };

    recognition.onresult = (event: any) => {
      for (let i = 0; i < event.results.length; i++) {
        for (let j = 0; j < event.results[i].length; j++) {
          const transcript = event.results[i][j].transcript.toLowerCase().replace(/\s+/g, "");
          if (transcript.includes("헤이라마") || transcript.includes("해이라마") || transcript.includes("헤이나마") || transcript.includes("hey라마") || transcript.includes("헤일라마")) {
            toast({ title: "🎙️ \"헤이 라마\" 감지!", description: "AI Agent로 이동합니다", duration: 2000 });
            setVoiceActivated(true);
            setMode("ai-agent");
            return;
          }
        }
      }
    };

    recognition.onend = () => {
      setWakeWordListening(false);
      if (modeRef.current === "select" && wakeWordEnabled) {
        setTimeout(startListening, 300);
      }
    };

    recognition.onerror = (e: any) => {
      setWakeWordListening(false);
      if (e.error !== "aborted" && e.error !== "no-speech" && modeRef.current === "select") {
        setTimeout(startListening, 2000);
      } else if (e.error === "no-speech" && modeRef.current === "select") {
        setTimeout(startListening, 300);
      }
    };

    wakeRecognitionRef.current = recognition;
    startListening();

    return () => {
      try { recognition.stop(); } catch {}
      wakeRecognitionRef.current = null;
      setWakeWordListening(false);
    };
  }, [wakeWordEnabled, mode, isLoggedIn, toast]);

  const toggleWakeWord = useCallback((enabled: boolean) => {
    setWakeWordEnabled(enabled);
    localStorage.setItem("wakeword_enabled", String(enabled));
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

  const isInApp = /NAVER|KAKAOTALK|Line|Instagram|FBAN|FBAV|Twitter|Snapchat|DaumApps|everytimeApp|SamsungBrowser\/.*CrossApp/i.test(navigator.userAgent)
    || (/wv\)/.test(navigator.userAgent) && /Android/.test(navigator.userAgent));

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
          {isInApp && (
            <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-left space-y-1.5">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                ⚠️ 인앱 브라우저에서는 Google 로그인이 제한됩니다
              </p>
              <p className="text-[10px] text-amber-700 dark:text-amber-400">
                Chrome 또는 Safari에서 열어주세요.
              </p>
              <button
                className="w-full text-[11px] font-medium text-white bg-amber-600 hover:bg-amber-700 rounded px-3 py-1.5"
                onClick={() => {
                  const url = window.location.href;
                  if (/Android/i.test(navigator.userAgent)) {
                    window.location.href = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;end`;
                  } else {
                    navigator.clipboard?.writeText(url);
                  }
                }}
              >
                외부 브라우저로 열기
              </button>
            </div>
          )}
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
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setSettingsOpen(true)}
              title="음성 설정"
            >
              <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
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
        <div className="flex-1 flex flex-col justify-center p-3">
          <MobileMenuGrid navigateTo={navigateTo} isAdmin={isAdmin} />

          {/* 웨이크워드 상태 인디케이터 */}
          {wakeWordEnabled && (
            <div className="flex items-center justify-center gap-2 pt-2 mx-auto max-w-md">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                {wakeWordListening ? (
                  <>
                    <div className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500" />
                    </div>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                      "헤이 라마" 대기 중...
                    </span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3 h-3 text-purple-400" />
                    <span className="text-[10px] text-muted-foreground">웨이크워드 연결 중...</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 음성 설정 다이얼로그 */}
        <VoiceSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          wakeWordEnabled={wakeWordEnabled}
          onToggleWakeWord={toggleWakeWord}
        />
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
          <AiAgent isAdmin={isAdmin} compact autoStartVoice={voiceActivated} />
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
    "bookmarks": { title: "즐겨찾기", icon: <Star className="w-4 h-4 text-white" />, color: "from-yellow-500 to-amber-600", spinColor: "text-yellow-500" },
    "etf-search": { title: "ETF통합검색", icon: <Search className="w-4 h-4 text-white" />, color: "from-blue-500 to-indigo-600", spinColor: "text-blue-500" },
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
              {mode === "bookmarks" && <Bookmarks />}
              {mode === "etf-search" && <EtfSearch isAdmin={isAdmin} />}
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

function VoiceSettingsDialog({ open, onOpenChange, wakeWordEnabled, onToggleWakeWord }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wakeWordEnabled: boolean;
  onToggleWakeWord: (enabled: boolean) => void;
}) {
  const deepLink = `${window.location.origin}/mobile#ai-agent`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Volume2 className="w-4 h-4 text-purple-500" />
            음성 호출 설정
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 웨이크워드 토글 */}
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-purple-500" />
                <div>
                  <p className="text-sm font-medium">"헤이 라마" 웨이크워드</p>
                  <p className="text-[10px] text-muted-foreground">메인 화면에서 음성으로 AI Agent 실행</p>
                </div>
              </div>
              <Button
                variant={wakeWordEnabled ? "default" : "outline"}
                size="sm"
                className="h-7 text-[10px] px-3"
                onClick={() => onToggleWakeWord(!wakeWordEnabled)}
              >
                {wakeWordEnabled ? "ON" : "OFF"}
              </Button>
            </div>
            {wakeWordEnabled && (
              <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-2 bg-purple-50 dark:bg-purple-950/30 p-2 rounded">
                메인 화면에서 <strong>"헤이 라마"</strong>라고 말하면 AI Agent가 자동으로 실행되고 음성인식이 시작됩니다.
              </p>
            )}
          </div>

          {/* 외부 음성비서 설정 가이드 */}
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-medium">외부 음성비서 연동</p>
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">
              앱이 닫혀 있을 때도 음성으로 실행하려면 휴대폰의 음성비서에 아래 URL을 등록하세요.
            </p>
            <div className="flex items-center gap-1.5 p-2 bg-background rounded border text-[10px] font-mono break-all">
              {deepLink}
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(deepLink);
                }}
                title="복사"
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              <details className="group">
                <summary className="text-[11px] font-medium cursor-pointer flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <span className="group-open:rotate-90 transition-transform">▶</span>
                  Google Assistant (Android)
                </summary>
                <ol className="text-[10px] text-muted-foreground mt-1 ml-4 space-y-0.5 list-decimal">
                  <li>Google 앱 → 설정 → Google 어시스턴트</li>
                  <li>루틴 → 새 루틴 추가</li>
                  <li>트리거: "헤이 라마"</li>
                  <li>작업: "웹사이트 열기" → 위 URL 입력</li>
                </ol>
              </details>
              <details className="group">
                <summary className="text-[11px] font-medium cursor-pointer flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <span className="group-open:rotate-90 transition-transform">▶</span>
                  Samsung Bixby
                </summary>
                <ol className="text-[10px] text-muted-foreground mt-1 ml-4 space-y-0.5 list-decimal">
                  <li>Bixby 루틴 앱 실행</li>
                  <li>"+" → 조건: 음성 명령 "헤이 라마"</li>
                  <li>실행: "앱 열기" → 브라우저로 위 URL 열기</li>
                </ol>
              </details>
              <details className="group">
                <summary className="text-[11px] font-medium cursor-pointer flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <span className="group-open:rotate-90 transition-transform">▶</span>
                  Siri (iPhone)
                </summary>
                <ol className="text-[10px] text-muted-foreground mt-1 ml-4 space-y-0.5 list-decimal">
                  <li>단축어 앱 → "+" → 새 단축어</li>
                  <li>"URL 열기" 액션 추가 → 위 URL 입력</li>
                  <li>단축어 이름: "헤이 라마"</li>
                  <li>"Siri야 헤이 라마"로 실행</li>
                </ol>
              </details>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AiMobile() {
  return <AiMobileContent />;
}
