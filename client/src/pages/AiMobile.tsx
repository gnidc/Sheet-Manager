import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/use-auth";
import AiAgent from "@/components/AiAgent";
import { LoginDialog } from "@/components/LoginDialog";
import { Bot, ArrowLeft, Smartphone, Download, BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const EtfComponents = lazy(() => import("@/components/EtfComponents"));

type MobileMode = "select" | "ai-agent" | "etf";

function AiMobileContent() {
  const { isAdmin, isLoggedIn, userName, userEmail, logout, isLoggingOut } = useAuth();
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [mode, setMode] = useState<MobileMode>("select");

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
            LifeFit Mobile
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
              <h1 className="text-sm font-bold leading-tight">LifeFit Mobile</h1>
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
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="grid grid-cols-2 gap-4 w-full max-w-md">
            {/* AI Agent 버튼 */}
            <button
              onClick={() => setMode("ai-agent")}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-lg transition-all duration-200 active:scale-95"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-md">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">AI Agent</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">AI 투자 에이전트</p>
              </div>
            </button>

            {/* 실시간ETF 버튼 */}
            <button
              onClick={() => setMode("etf")}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 hover:border-green-400 dark:hover:border-green-600 hover:shadow-lg transition-all duration-200 active:scale-95"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">실시간 ETF</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">ETF 시세 · AI 분석</p>
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
            <button onClick={() => setMode("select")} className="text-muted-foreground hover:text-foreground">
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
  return (
    <div
      className="flex flex-col bg-background"
      style={{ height: "calc(var(--vh, 1vh) * 100)" }}
    >
      <header className="flex items-center justify-between px-3 py-2 border-b bg-background/95 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => setMode("select")} className="text-muted-foreground hover:text-foreground">
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

export default function AiMobile() {
  return <AiMobileContent />;
}
