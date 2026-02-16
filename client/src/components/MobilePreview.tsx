import { useState, lazy, Suspense } from "react";
import AiAgent from "@/components/AiAgent";
import { Bot, ArrowLeft, BarChart3, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

const EtfComponents = lazy(() => import("@/components/EtfComponents"));

type MobileMode = "select" | "ai-agent" | "etf";

export default function MobilePreview({ isAdmin }: { isAdmin: boolean }) {
  const [mode, setMode] = useState<MobileMode>("select");

  return (
    <div className="flex flex-col items-center">
      {/* 안내 헤더 */}
      <div className="w-full max-w-md mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Smartphone className="w-4 h-4 text-red-500" />
        <span className="font-medium">Mobile Preview</span>
        <span className="text-[10px]">— 모바일 페이지와 동일한 화면입니다</span>
      </div>

      {/* 모바일 프레임 */}
      <div className="w-full max-w-md border-2 border-gray-300 dark:border-gray-700 rounded-3xl overflow-hidden shadow-2xl bg-background" style={{ height: "75vh" }}>
        {/* 상단 노치 바 */}
        <div className="h-6 bg-gray-900 dark:bg-black flex items-center justify-center">
          <div className="w-20 h-3 bg-gray-800 dark:bg-gray-900 rounded-full" />
        </div>

        {/* 콘텐츠 영역 */}
        <div className="flex flex-col" style={{ height: "calc(75vh - 24px)" }}>
          {mode === "select" && (
            <>
              {/* 선택 화면 헤더 */}
              <header className="flex items-center justify-between px-3 py-2 border-b bg-background/95 shrink-0">
                <div>
                  <h1 className="text-sm font-bold leading-tight">LifeFit Mobile</h1>
                  <p className="text-[10px] text-muted-foreground leading-tight">Admin</p>
                </div>
              </header>

              {/* 선택 카드 */}
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="grid grid-cols-2 gap-4 w-full">
                  <button
                    onClick={() => setMode("ai-agent")}
                    className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-lg transition-all duration-200 active:scale-95"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-md">
                      <Bot className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-foreground">AI Agent</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">AI 투자 에이전트</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setMode("etf")}
                    className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 hover:border-green-400 dark:hover:border-green-600 hover:shadow-lg transition-all duration-200 active:scale-95"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md">
                      <BarChart3 className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-foreground">실시간 ETF</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">ETF 시세 · AI 분석</p>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}

          {mode === "ai-agent" && (
            <>
              <header className="flex items-center gap-2 px-3 py-2 border-b bg-background/95 shrink-0">
                <button onClick={() => setMode("select")} className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <h1 className="text-sm font-bold leading-tight">AI Agent</h1>
              </header>
              <div className="flex-1 flex flex-col overflow-hidden">
                <AiAgent isAdmin={isAdmin} compact />
              </div>
            </>
          )}

          {mode === "etf" && (
            <>
              <header className="flex items-center gap-2 px-3 py-2 border-b bg-background/95 shrink-0">
                <button onClick={() => setMode("select")} className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <BarChart3 className="w-3.5 h-3.5 text-white" />
                </div>
                <h1 className="text-sm font-bold leading-tight">실시간 ETF</h1>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

