import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, ComposedChart, Cell,
} from "recharts";


// ========== 주요 국내 종목 리스트 (KRX 시가총액 상위) ==========
const POPULAR_STOCKS: { code: string; name: string; market: string }[] = [
  { code: "005930", name: "삼성전자", market: "KOSPI" },
  { code: "000660", name: "SK하이닉스", market: "KOSPI" },
  { code: "373220", name: "LG에너지솔루션", market: "KOSPI" },
  { code: "207940", name: "삼성바이오로직스", market: "KOSPI" },
  { code: "005380", name: "현대차", market: "KOSPI" },
  { code: "000270", name: "기아", market: "KOSPI" },
  { code: "068270", name: "셀트리온", market: "KOSPI" },
  { code: "005490", name: "POSCO홀딩스", market: "KOSPI" },
  { code: "035420", name: "NAVER", market: "KOSPI" },
  { code: "035720", name: "카카오", market: "KOSPI" },
  { code: "051910", name: "LG화학", market: "KOSPI" },
  { code: "006400", name: "삼성SDI", market: "KOSPI" },
  { code: "003670", name: "포스코퓨처엠", market: "KOSPI" },
  { code: "105560", name: "KB금융", market: "KOSPI" },
  { code: "055550", name: "신한지주", market: "KOSPI" },
  { code: "066570", name: "LG전자", market: "KOSPI" },
  { code: "012330", name: "현대모비스", market: "KOSPI" },
  { code: "028260", name: "삼성물산", market: "KOSPI" },
  { code: "096770", name: "SK이노베이션", market: "KOSPI" },
  { code: "034730", name: "SK", market: "KOSPI" },
  { code: "003550", name: "LG", market: "KOSPI" },
  { code: "032830", name: "삼성생명", market: "KOSPI" },
  { code: "086790", name: "하나금융지주", market: "KOSPI" },
  { code: "010950", name: "S-Oil", market: "KOSPI" },
  { code: "033780", name: "KT&G", market: "KOSPI" },
  { code: "015760", name: "한국전력", market: "KOSPI" },
  { code: "017670", name: "SK텔레콤", market: "KOSPI" },
  { code: "030200", name: "KT", market: "KOSPI" },
  { code: "316140", name: "우리금융지주", market: "KOSPI" },
  { code: "009150", name: "삼성전기", market: "KOSPI" },
  { code: "018260", name: "삼성에스디에스", market: "KOSPI" },
  { code: "000810", name: "삼성화재", market: "KOSPI" },
  { code: "010130", name: "고려아연", market: "KOSPI" },
  { code: "011200", name: "HMM", market: "KOSPI" },
  { code: "036570", name: "엔씨소프트", market: "KOSPI" },
  { code: "251270", name: "넷마블", market: "KOSPI" },
  { code: "259960", name: "크래프톤", market: "KOSPI" },
  { code: "352820", name: "하이브", market: "KOSPI" },
  { code: "247540", name: "에코프로비엠", market: "KOSDAQ" },
  { code: "086520", name: "에코프로", market: "KOSDAQ" },
  { code: "041510", name: "에스엠", market: "KOSDAQ" },
  { code: "263750", name: "펄어비스", market: "KOSDAQ" },
  { code: "293490", name: "카카오게임즈", market: "KOSDAQ" },
  { code: "403870", name: "HPSP", market: "KOSDAQ" },
  { code: "196170", name: "알테오젠", market: "KOSDAQ" },
  { code: "257720", name: "실리콘투", market: "KOSDAQ" },
  // 주요 ETF
  { code: "069500", name: "KODEX 200", market: "ETF" },
  { code: "102110", name: "TIGER 200", market: "ETF" },
  { code: "229200", name: "KODEX 코스닥150", market: "ETF" },
  { code: "305720", name: "KODEX 2차전지산업", market: "ETF" },
  { code: "091160", name: "KODEX 반도체", market: "ETF" },
  { code: "091170", name: "KODEX 은행", market: "ETF" },
  { code: "139260", name: "TIGER 200 IT", market: "ETF" },
  { code: "381170", name: "TIGER 미국나스닥100", market: "ETF" },
  { code: "379800", name: "KODEX 미국S&P500TR", market: "ETF" },
  { code: "360750", name: "TIGER 미국S&P500", market: "ETF" },
];

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import {
  ArrowLeft, TrendingUp, Wallet, BarChart3, Plus, Trash2, Play, Pause,
  RefreshCw, Loader2, AlertTriangle, CheckCircle2, XCircle, Search,
  ArrowUpRight, ArrowDownRight, Zap, Clock, Settings, ShieldCheck, ShieldAlert, Rocket,
  Sparkles, Eye, Power, ChevronDown, ChevronUp, Activity, FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import GapStrategyPanel from "@/components/GapStrategyPanel";
import MultiFactorPanel from "@/components/MultiFactorPanel";

// ========== Types ==========
interface TradingStatus {
  configured: boolean;
  tradingConfigured: boolean;
  mockTrading: boolean;
  accountNo: string;
  accountProductCd: string;
  needsSetup?: boolean; // 일반 유저가 인증정보 미등록 시
  broker?: string; // "kis" | "kiwoom"
}

interface TradingConfig {
  configured: boolean;
  isAdmin?: boolean;
  broker?: string; // "kis" | "kiwoom"
  appKey?: string;
  accountNo?: string;
  accountProductCd?: string;
  mockTrading?: boolean;
  updatedAt?: string;
}

interface HoldingItem {
  stockCode: string;
  stockName: string;
  holdingQty: number;
  avgBuyPrice: number;
  currentPrice: number;
  evalAmount: number;
  evalProfitLoss: number;
  evalProfitRate: number;
  buyAmount: number;
}

interface BalanceSummary {
  depositAmount: number;
  totalEvalAmount: number;
  totalBuyAmount: number;
  totalEvalProfitLoss: number;
  totalEvalProfitRate: number;
}

interface AccountBalance {
  holdings: HoldingItem[];
  summary: BalanceSummary;
}

interface AutoTradeRule {
  id: number;
  name: string;
  stockCode: string;
  stockName: string;
  ruleType: string;
  targetPrice: string;
  quantity: number;
  orderMethod: string | null;
  isActive: boolean | null;
  status: string | null;
  executedAt: string | null;
  createdAt: string;
}

interface TradingOrder {
  id: number;
  stockCode: string;
  stockName: string | null;
  orderType: string;
  orderMethod: string | null;
  quantity: number;
  price: string | null;
  totalAmount: string | null;
  status: string | null;
  kisOrderNo: string | null;
  autoTradeRuleId: number | null;
  errorMessage: string | null;
  createdAt: string;
  executedAt: string | null;
}

// ========== Main Component ==========
export default function Trading() {
  const { isAdmin, isLoggedIn, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const canAccess = isAdmin || isLoggedIn;
  
  // URL 쿼리 파라미터에서 종목 코드/이름 추출
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlCode = urlParams.get("code") || "";
  const urlName = urlParams.get("name") || "";

  // 탭 제어 상태
  const [activeTab, setActiveTab] = useState(urlCode ? "order" : "account");
  // 계좌현황에서 주문탭으로 넘기는 종목/주문유형/보유수량/현재가 정보
  const [orderTarget, setOrderTarget] = useState<{ code: string; name: string; orderType: "buy" | "sell"; holdingQty?: number; currentPrice?: number } | null>(null);

  // KIS API 상태
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<TradingStatus>({
    queryKey: ["/api/trading/status"],
    enabled: canAccess,
    retry: false,
  });

  // 사용자 설정 정보
  const { data: tradingConfig, refetch: refetchConfig } = useQuery<TradingConfig>({
    queryKey: ["/api/trading/config"],
    enabled: canAccess,
    retry: false,
  });

  // 일반 유저이면서 설정이 안된 경우
  const showUserSetup = !isAdmin && (status?.needsSetup || (tradingConfig && !tradingConfig.configured));

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <ShieldAlert className="w-16 h-16 text-destructive" />
        <h1 className="text-2xl font-bold">접근 권한 없음</h1>
        <p className="text-muted-foreground">자동매매 기능은 로그인 후 사용할 수 있습니다.</p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            홈으로 돌아가기
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="bg-amber-500/10 p-2 rounded-lg">
                <Zap className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">
                  {status?.broker === "kiwoom" ? "키움 자동매매" : "KIS 자동매매"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {status?.broker === "kiwoom" ? "키움증권 REST API 자동매매 시스템" : "한국투자증권 API 자동매매 시스템"}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* 설정 버튼 (일반 유저가 이미 설정한 경우 설정 관리) */}
              {!isAdmin && tradingConfig?.configured && (
                <UserConfigManageButton config={tradingConfig} onConfigChanged={() => { refetchConfig(); refetchStatus(); }} />
              )}
              {/* 활성 증권사 표시 */}
              {status?.tradingConfigured && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 hidden sm:flex">
                  {status.broker === "kiwoom" ? "🏦 키움" : "🏦 KIS"}
                </Badge>
              )}
              {/* 연결 상태 표시 */}
              {statusLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : status?.tradingConfigured ? (
                <StatusBadge variant="success" className="gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {status.mockTrading ? "모의투자" : "실전투자"}
                </StatusBadge>
              ) : (
                <StatusBadge variant="destructive" className="gap-1.5">
                  <XCircle className="w-3.5 h-3.5" />
                  미연결
                </StatusBadge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showUserSetup ? (
          <UserSetupGuide onComplete={() => { refetchConfig(); refetchStatus(); }} />
        ) : !status?.tradingConfigured && !statusLoading ? (
          isAdmin ? <AdminSetupGuide status={status} /> : <UserSetupGuide onComplete={() => { refetchConfig(); refetchStatus(); }} />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="grid w-full grid-cols-7 max-w-5xl mx-auto">
              <TabsTrigger value="account" className="gap-1 text-xs sm:text-sm">
                <Wallet className="h-4 w-4" />
                계좌
              </TabsTrigger>
              <TabsTrigger value="order" className="gap-1 text-xs sm:text-sm">
                <TrendingUp className="h-4 w-4" />
                주문
              </TabsTrigger>
              <TabsTrigger value="stoploss" className="gap-1 text-xs sm:text-sm">
                <ShieldAlert className="h-4 w-4" />
                손절감시
              </TabsTrigger>
              <TabsTrigger value="auto" className="gap-1 text-xs sm:text-sm">
                <Zap className="h-4 w-4" />
                자동매매
              </TabsTrigger>
              <TabsTrigger value="skills" className="gap-1 text-xs sm:text-sm">
                <Sparkles className="h-4 w-4" />
                표준스킬
              </TabsTrigger>
              <TabsTrigger value="manual-skills" className="gap-1 text-xs sm:text-sm">
                <Rocket className="h-4 w-4" />
                수동스킬
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1 text-xs sm:text-sm">
                <Clock className="h-4 w-4" />
                주문내역
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account">
              <AccountSection onNavigateOrder={(code, name, type, holdingQty, currentPrice) => {
                setOrderTarget({ code, name, orderType: type, holdingQty, currentPrice });
                setActiveTab("order");
              }} />
            </TabsContent>
            <TabsContent value="order">
              <OrderSection initialCode={orderTarget?.code || urlCode} initialName={orderTarget?.name || urlName} initialOrderType={orderTarget?.orderType} initialHoldingQty={orderTarget?.holdingQty} initialCurrentPrice={orderTarget?.currentPrice} />
            </TabsContent>
            <TabsContent value="stoploss">
              <StopLossSection />
            </TabsContent>
            <TabsContent value="auto">
              <AutoTradeSection />
            </TabsContent>
            <TabsContent value="skills">
              <SkillsSection />
            </TabsContent>
            <TabsContent value="manual-skills">
              <ManualSkillsSection />
            </TabsContent>
            <TabsContent value="history">
              <OrderHistorySection />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

// ========== Admin Setup Guide (환경변수 기반) ==========
function AdminSetupGuide({ status }: { status?: TradingStatus | null }) {
  const broker = status?.broker || "kis";
  const isKiwoom = broker === "kiwoom";

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          {isKiwoom ? "키움증권 API 설정 필요 (관리자)" : "KIS API 설정 필요 (관리자)"}
        </CardTitle>
        <CardDescription>
          {isKiwoom
            ? "관리자 계정은 API 관리에서 키움증권 API를 등록하거나 서버 환경 변수로 설정합니다."
            : "관리자 계정은 서버 환경 변수로 KIS API를 설정합니다."}
          <br />
          <span className="text-[10px] text-amber-600">💡 API 관리에서 활성화된 증권사에 따라 자동으로 전환됩니다.</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isKiwoom ? (
          <>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm">필수 환경 변수 (키움증권):</h4>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex items-center gap-2">
                  {status?.configured ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                  <span>KIWOOM_APP_KEY</span>
                  <span className="text-muted-foreground">- 앱 키</span>
                </div>
                <div className="flex items-center gap-2">
                  {status?.configured ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                  <span>KIWOOM_APP_SECRET</span>
                  <span className="text-muted-foreground">- 시크릿 키</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span>KIWOOM_ACCOUNT_NO</span>
                  <span className="text-muted-foreground">- 계좌번호</span>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="text-[11px] text-blue-600 dark:text-blue-400 space-y-0.5">
                <p>키움증권 REST API는 현재 <strong>모의투자 전용</strong>입니다.</p>
                <p>모의투자 도메인: mockapi.kiwoom.com</p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>
                키움증권 오픈API: {" "}
                <a href="https://openapi.kiwoom.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  openapi.kiwoom.com
                </a>
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm">필수 환경 변수 (한국투자증권):</h4>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex items-center gap-2">
                  {status?.configured ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                  <span>KIS_APP_KEY</span>
                  <span className="text-muted-foreground">- 앱 키</span>
                </div>
                <div className="flex items-center gap-2">
                  {status?.configured ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                  <span>KIS_APP_SECRET</span>
                  <span className="text-muted-foreground">- 앱 시크릿</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span>KIS_ACCOUNT_NO</span>
                  <span className="text-muted-foreground">- 계좌번호 앞 8자리</span>
                </div>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm">선택 환경 변수:</h4>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-muted-foreground/30 flex items-center justify-center text-[10px]">?</span>
                  <span>KIS_ACCOUNT_PRODUCT_CD</span>
                  <span className="text-muted-foreground">- 계좌상품코드 (기본: 01)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-muted-foreground/30 flex items-center justify-center text-[10px]">?</span>
                  <span>KIS_MOCK_TRADING=true</span>
                  <span className="text-muted-foreground">- 모의투자 모드</span>
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>
                한국투자증권 개발자센터: {" "}
                <a href="https://apiportal.koreainvestment.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  apiportal.koreainvestment.com
                </a>
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ========== User Setup Guide (폼 입력 기반) ==========
function UserSetupGuide({ onComplete }: { onComplete: () => void }) {
  const { toast } = useToast();

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          자동매매 API 등록
        </CardTitle>
        <CardDescription>
          자동매매를 이용하려면 먼저 <strong>API 관리</strong>에서 증권사 API를 등록하세요.
          <br />
          한국투자증권(KIS) 또는 키움증권(REST) API 중 하나를 선택하여 등록할 수 있으며, 동시에 1개의 API만 활성화됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-sm">📋 등록 절차</h4>
          <ol className="space-y-2 text-sm list-decimal list-inside text-muted-foreground">
            <li><strong className="text-foreground">API 관리</strong> 메뉴로 이동</li>
            <li><strong className="text-foreground">자동매매 API</strong> 탭에서 "추가" 클릭</li>
            <li>증권사(KIS/키움) 선택 후 인증 정보 입력</li>
            <li>등록 후 <strong className="text-foreground">"활성화"</strong> 버튼으로 사용할 API 전환</li>
          </ol>
        </div>

        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-[11px] text-amber-600 dark:text-amber-400 space-y-0.5">
            <p>동시에 <strong>1개의 증권사 API만</strong> 활성 상태로 운영됩니다.</p>
            <p>활성화된 API에 따라 잔고 조회, 주문 등 모든 기능이 해당 증권사로 연결됩니다.</p>
          </div>
        </div>

        <div className="flex gap-3 text-[11px] text-muted-foreground justify-center">
          <a href="https://apiportal.koreainvestment.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            🏦 한국투자증권 API 포탈
          </a>
          <span>|</span>
          <a href="https://openapi.kiwoom.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            🏦 키움증권 오픈API
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

// ========== User Config Manage Button (설정 관리) ==========
function UserConfigManageButton({ config, onConfigChanged }: { config: TradingConfig; onConfigChanged: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const brokerName = config.broker === "kiwoom" ? "키움증권" : "한국투자증권(KIS)";

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/trading/config");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "설정 삭제", description: `${brokerName} API 인증 정보가 삭제되었습니다` });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/config"] });
      setOpen(false);
      onConfigChanged();
    },
    onError: (error: Error) => {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">설정</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {brokerName} API 설정 관리
          </DialogTitle>
          <DialogDescription>
            현재 활성화된 {brokerName} 인증 정보를 확인하거나 삭제할 수 있습니다.
            <br />
            <span className="text-[10px] text-amber-600">API 관리에서 다른 증권사로 전환할 수 있습니다.</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">증권사</span>
              <Badge variant="secondary" className="text-[10px]">{brokerName}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">앱 키</span>
              <span className="font-mono">{config.appKey}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">계좌번호</span>
              <span className="font-mono">{config.accountNo}</span>
            </div>
            {config.broker !== "kiwoom" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">상품코드</span>
                <span className="font-mono">{config.accountProductCd}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">모드</span>
              <StatusBadge variant={config.mockTrading ? "default" : "destructive"}>
                {config.mockTrading ? "모의투자" : "실전투자"}
              </StatusBadge>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)}>닫기</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              인증 정보 삭제
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ========== 호가 / 차트 타입 ==========
interface AskingPriceData {
  sellPrices: { price: string; qty: string }[];
  buyPrices: { price: string; qty: string }[];
  totalSellQty: string;
  totalBuyQty: string;
}
interface DailyPriceData {
  date: string;
  closePrice: string;
  openPrice?: string;
  highPrice?: string;
  lowPrice?: string;
  volume?: string;
}

// ========== 종목 호가 컴포넌트 ==========
function StockAskingPrice({ stockCode, stockName }: { stockCode: string; stockName: string }) {
  const { data, isLoading, error, refetch } = useQuery<AskingPriceData>({
    queryKey: ["/api/trading/asking-price", stockCode],
    queryFn: async () => {
      const res = await fetch(`/api/trading/asking-price/${stockCode}`, { credentials: "include" });
      if (!res.ok) throw new Error("호가 조회 실패");
      return res.json();
    },
    staleTime: 10000,
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">호가 조회 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        호가 조회 실패 - <button className="text-primary underline" onClick={() => refetch()}>재시도</button>
      </div>
    );
  }

  if (!data) return null;

  const maxQty = Math.max(
    ...data.sellPrices.map(p => Number(p.qty)),
    ...data.buyPrices.map(p => Number(p.qty)),
    1
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold">📊 {stockName} 호가</h4>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="text-xs grid grid-cols-1">
        {/* 매도호가 (높은가→낮은가, 빨간바탕) */}
        {data.sellPrices.map((p, i) => {
          const ratio = Number(p.qty) / maxQty * 100;
          return (
            <div key={`sell-${i}`} className="flex items-center gap-1 py-0.5 px-1 relative">
              <div className="absolute inset-y-0 right-0 bg-blue-100 dark:bg-blue-900/30" style={{ width: `${ratio}%` }} />
              <span className="w-20 text-right text-blue-600 font-mono text-xs relative z-10">{Number(p.qty).toLocaleString()}</span>
              <span className="w-24 text-center font-mono text-xs font-medium relative z-10">{Number(p.price).toLocaleString()}</span>
              <span className="w-20 relative z-10" />
            </div>
          );
        })}
        {/* 구분선 */}
        <div className="border-t-2 border-gray-300 dark:border-gray-600 my-0.5" />
        {/* 매수호가 (높은가→낮은가, 파란바탕) */}
        {data.buyPrices.map((p, i) => {
          const ratio = Number(p.qty) / maxQty * 100;
          return (
            <div key={`buy-${i}`} className="flex items-center gap-1 py-0.5 px-1 relative">
              <div className="absolute inset-y-0 left-0 bg-red-100 dark:bg-red-900/30" style={{ width: `${ratio}%` }} />
              <span className="w-20 relative z-10" />
              <span className="w-24 text-center font-mono text-xs font-medium relative z-10">{Number(p.price).toLocaleString()}</span>
              <span className="w-20 text-left text-red-600 font-mono text-xs relative z-10">{Number(p.qty).toLocaleString()}</span>
            </div>
          );
        })}
        {/* 총 잔량 */}
        <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1 flex justify-between text-[11px] text-muted-foreground px-1">
          <span>매도잔량: <b className="text-blue-600">{Number(data.totalSellQty).toLocaleString()}</b></span>
          <span>매수잔량: <b className="text-red-600">{Number(data.totalBuyQty).toLocaleString()}</b></span>
        </div>
      </div>
    </div>
  );
}

// ========== 종목 일봉 차트 컴포넌트 ==========
function StockDailyChart({ stockCode, stockName }: { stockCode: string; stockName: string }) {
  const [chartPeriod, setChartPeriod] = useState<"1M" | "3M" | "6M" | "1Y">("3M");

  const { data, isLoading, error } = useQuery<DailyPriceData[]>({
    queryKey: ["/api/trading/daily-chart", stockCode, chartPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/trading/daily-chart/${stockCode}?period=${chartPeriod}`, { credentials: "include" });
      if (!res.ok) throw new Error("차트 데이터 조회 실패");
      return res.json();
    },
    staleTime: 60000,
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map(d => ({
      date: d.date.slice(5), // MM-DD
      fullDate: d.date,
      종가: Number(d.closePrice),
      시가: Number(d.openPrice || 0),
      고가: Number(d.highPrice || 0),
      저가: Number(d.lowPrice || 0),
      거래량: Number(d.volume || 0),
    }));
  }, [data]);

  // 최저/최고값 계산 (Y축 범위)
  const yDomain = useMemo(() => {
    if (!chartData.length) return [0, 0];
    const allPrices = chartData.flatMap(d => [d.고가, d.저가, d.시가, d.종가]).filter(Boolean);
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const margin = (max - min) * 0.05 || max * 0.02;
    return [Math.floor(min - margin), Math.ceil(max + margin)];
  }, [chartData]);

  // 캔들스틱 커스텀 Shape
  const CandlestickBar = (props: any) => {
    const { x, y, width, height, payload } = props;
    if (!payload) return null;
    const { 시가, 종가, 고가, 저가 } = payload;
    const isUp = 종가 >= 시가;
    const color = isUp ? "#ef4444" : "#3b82f6"; // 양봉: 빨강, 음봉: 파랑

    const yScale = (val: number) => {
      const [domMin, domMax] = yDomain;
      const chartHeight = 210; // approx chart area height
      const topMargin = 5;
      return topMargin + ((domMax - val) / (domMax - domMin)) * chartHeight;
    };

    const bodyTop = yScale(Math.max(시가, 종가));
    const bodyBottom = yScale(Math.min(시가, 종가));
    const bodyHeight = Math.max(bodyBottom - bodyTop, 1);
    const wickTop = yScale(고가);
    const wickBottom = yScale(저가);
    const centerX = x + width / 2;

    return (
      <g>
        {/* 꼬리 (위 아래) */}
        <line x1={centerX} y1={wickTop} x2={centerX} y2={wickBottom} stroke={color} strokeWidth={1} />
        {/* 몸통 */}
        <rect x={x + 1} y={bodyTop} width={Math.max(width - 2, 2)} height={bodyHeight} fill={isUp ? color : color} stroke={color} strokeWidth={0.5} />
      </g>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold">📈 {stockName} 일봉 차트</h4>
        <div className="flex gap-1">
          {(["1M", "3M", "6M", "1Y"] as const).map(p => (
            <Button
              key={p}
              variant={chartPeriod === p ? "default" : "outline"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setChartPeriod(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground text-sm">차트 로딩 중...</span>
        </div>
      ) : error ? (
        <div className="text-center py-4 text-muted-foreground text-sm">차트 데이터를 불러올 수 없습니다</div>
      ) : chartData.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-sm">차트 데이터가 없습니다</div>
      ) : (
        <div className="space-y-2">
          {/* 봉차트 (캔들스틱) */}
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis domain={yDomain} tick={{ fontSize: 10 }} tickFormatter={v => v.toLocaleString()} width={60} />
              <RechartsTooltip
                contentStyle={{ fontSize: "12px" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  if (!d) return null;
                  const isUp = d.종가 >= d.시가;
                  return (
                    <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-2 text-xs">
                      <p className="font-medium mb-1">{d.fullDate}</p>
                      <p>시가: <span className="font-mono">{d.시가.toLocaleString()}</span></p>
                      <p>고가: <span className="font-mono text-red-500">{d.고가.toLocaleString()}</span></p>
                      <p>저가: <span className="font-mono text-blue-500">{d.저가.toLocaleString()}</span></p>
                      <p>종가: <span className={`font-mono font-bold ${isUp ? "text-red-500" : "text-blue-500"}`}>{d.종가.toLocaleString()}</span></p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="고가" shape={<CandlestickBar />} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>

          {/* 거래량 차트 */}
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={chartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
              <XAxis dataKey="date" tick={false} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => (v >= 1000000 ? (v / 1000000).toFixed(0) + "M" : v >= 1000 ? (v / 1000).toFixed(0) + "K" : v)} width={60} />
              <RechartsTooltip
                contentStyle={{ fontSize: "11px" }}
                formatter={(value: number) => [value.toLocaleString(), "거래량"]}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
              />
              <Bar dataKey="거래량" isAnimationActive={false}>
                {chartData.map((d, idx) => (
                  <Cell key={idx} fill={d.종가 >= d.시가 ? "#ef4444" : "#3b82f6"} opacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ========== Account Section ==========
function AccountSection({ onNavigateOrder }: { onNavigateOrder?: (code: string, name: string, orderType: "buy" | "sell", holdingQty: number, currentPrice: number) => void }) {
  const [selectedStock, setSelectedStock] = useState<{ code: string; name: string } | null>(null);
  const { data: balance, isLoading, error, refetch } = useQuery<AccountBalance>({
    queryKey: ["/api/trading/balance"],
    retry: false,
  });

  const handleStockClick = useCallback((stockCode: string, stockName: string) => {
    setSelectedStock(prev =>
      prev?.code === stockCode ? null : { code: stockCode, name: stockName }
    );
  }, []);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">계좌 현황</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">잔고 조회 중...</span>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center">
            <XCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h3 className="font-semibold mb-2">잔고 조회 실패</h3>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              다시 시도
            </Button>
          </CardContent>
        </Card>
      ) : balance ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">총 평가금액</p>
                <p className="text-2xl font-bold">{balance.summary.totalEvalAmount.toLocaleString()}원</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">예수금</p>
                <p className="text-2xl font-bold text-blue-600">{balance.summary.depositAmount.toLocaleString()}원</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">평가 손익</p>
                <p className={`text-2xl font-bold ${balance.summary.totalEvalProfitLoss >= 0 ? "text-red-500" : "text-blue-500"}`}>
                  {balance.summary.totalEvalProfitLoss >= 0 ? "+" : ""}
                  {balance.summary.totalEvalProfitLoss.toLocaleString()}원
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">수익률</p>
                <p className={`text-2xl font-bold ${balance.summary.totalEvalProfitRate >= 0 ? "text-red-500" : "text-blue-500"}`}>
                  {balance.summary.totalEvalProfitRate >= 0 ? "+" : ""}
                  {balance.summary.totalEvalProfitRate.toFixed(2)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Holdings Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">보유 종목</CardTitle>
              <CardDescription className="text-xs">종목을 클릭하면 호가와 차트를 확인할 수 있습니다</CardDescription>
            </CardHeader>
            <CardContent>
              {balance.holdings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  보유 종목이 없습니다
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>종목코드</TableHead>
                        <TableHead>종목명</TableHead>
                        <TableHead className="text-right">보유수량</TableHead>
                        <TableHead className="text-right">매입평균가</TableHead>
                        <TableHead className="text-right">현재가</TableHead>
                        <TableHead className="text-right">평가금액</TableHead>
                        <TableHead className="text-right">손익</TableHead>
                        <TableHead className="text-right">수익률</TableHead>
                        <TableHead className="text-center">주문</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balance.holdings.map((item) => (
                        <TableRow
                          key={item.stockCode}
                          className={`cursor-pointer hover:bg-muted/60 transition-colors ${selectedStock?.code === item.stockCode ? "bg-primary/10 border-l-2 border-primary" : ""}`}
                          onClick={() => handleStockClick(item.stockCode, item.stockName)}
                        >
                          <TableCell className="font-mono text-sm">{item.stockCode}</TableCell>
                          <TableCell className="font-medium">
                            <span className="text-primary hover:underline">{item.stockName}</span>
                          </TableCell>
                          <TableCell className="text-right">{item.holdingQty.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{item.avgBuyPrice.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{item.currentPrice.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{item.evalAmount.toLocaleString()}</TableCell>
                          <TableCell className={`text-right font-medium ${item.evalProfitLoss >= 0 ? "text-red-500" : "text-blue-500"}`}>
                            {item.evalProfitLoss >= 0 ? "+" : ""}{item.evalProfitLoss.toLocaleString()}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${item.evalProfitRate >= 0 ? "text-red-500" : "text-blue-500"}`}>
                            {item.evalProfitRate >= 0 ? "+" : ""}{item.evalProfitRate.toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1 justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
                                onClick={() => onNavigateOrder?.(item.stockCode, item.stockName, "buy", item.holdingQty, item.currentPrice)}
                              >
                                <ArrowUpRight className="w-3 h-3 mr-0.5" />
                                매수
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs text-blue-600 border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                                onClick={() => onNavigateOrder?.(item.stockCode, item.stockName, "sell", item.holdingQty, item.currentPrice)}
                              >
                                <ArrowDownRight className="w-3 h-3 mr-0.5" />
                                매도
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 선택된 종목 호가 + 차트 */}
          {selectedStock && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  {selectedStock.name} ({selectedStock.code})
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-6 text-xs"
                    onClick={() => setSelectedStock(null)}
                  >
                    닫기 ✕
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 호가 */}
                  <div>
                    <StockAskingPrice stockCode={selectedStock.code} stockName={selectedStock.name} />
                  </div>
                  {/* 차트 */}
                  <div>
                    <StockDailyChart stockCode={selectedStock.code} stockName={selectedStock.name} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

// ========== Order Section ==========
function OrderSection({ initialCode, initialName, initialOrderType, initialHoldingQty, initialCurrentPrice }: { initialCode?: string; initialName?: string; initialOrderType?: "buy" | "sell"; initialHoldingQty?: number; initialCurrentPrice?: number }) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState(initialName || initialCode || "");
  const [selectedStock, setSelectedStock] = useState<{ code: string; name: string } | null>(
    initialCode ? { code: initialCode, name: initialName || initialCode } : null
  );
  const [orderType, setOrderType] = useState<"buy" | "sell">(initialOrderType || "buy");

  // 계좌현황에서 넘어온 종목/주문유형/현재가/보유수량 반영
  useEffect(() => {
    if (initialCode) {
      setSelectedStock({ code: initialCode, name: initialName || initialCode });
      setSearchTerm(initialName || initialCode);
      // 현재가를 주문가격에 자동 입력
      if (initialCurrentPrice) {
        setPrice(String(initialCurrentPrice));
      } else {
        setPrice("");
      }
      // 매도주문 시 보유수량을 자동 입력
      if (initialOrderType === "sell" && initialHoldingQty) {
        setQuantity(String(initialHoldingQty));
      } else {
        setQuantity("");
      }
    }
    if (initialOrderType) {
      setOrderType(initialOrderType);
    }
  }, [initialCode, initialName, initialOrderType, initialHoldingQty, initialCurrentPrice]);
  const [orderMethod, setOrderMethod] = useState<"limit" | "market">("limit");
  const [quantity, setQuantity] = useState(initialOrderType === "sell" && initialHoldingQty ? String(initialHoldingQty) : "");
  const [price, setPrice] = useState(initialCurrentPrice ? String(initialCurrentPrice) : "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [codeSearching, setCodeSearching] = useState(false);

  // 손절 설정 상태
  const [enableStopLoss, setEnableStopLoss] = useState(false);
  const [stopLossPercent, setStopLossPercent] = useState("3");
  const [stopType, setStopType] = useState<"simple" | "trailing">("simple");

  // 현재가 조회 (REST)
  const { data: priceData, isLoading: priceLoading, refetch: refetchPrice } = useQuery({
    queryKey: ["/api/trading/price", selectedStock?.code],
    queryFn: async () => {
      if (!selectedStock) return null;
      const res = await fetch(`/api/trading/price/${selectedStock.code}`, { credentials: "include" });
      if (!res.ok) throw new Error("가격 조회 실패");
      return res.json();
    },
    enabled: !!selectedStock,
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // 현재가로부터 종목명 업데이트 + 주문가격 자동 설정
  React.useEffect(() => {
    if (priceData?.stockName && selectedStock && !selectedStock.name) {
      setSelectedStock(prev => prev ? { ...prev, name: priceData.stockName } : prev);
      setSearchTerm(priceData.stockName);
    }
    // 현재가 조회 결과로 주문가격 자동 입력 (가격이 비어있을 때)
    if (priceData?.price && !price) {
      setPrice(priceData.price);
    }
  }, [priceData?.stockName, priceData?.price]);

  // 손절 감시 등록 mutation
  const stopLossMutation = useMutation({
    mutationFn: async (params: { stockCode: string; stockName: string; buyPrice: number; quantity: number; stopLossPercent: number; stopType: string }) => {
      const res = await apiRequest("POST", "/api/trading/stop-loss", params);
      return res.json();
    },
  });

  const orderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trading/order", {
        stockCode: selectedStock!.code,
        stockName: selectedStock!.name || priceData?.stockName || selectedStock!.code,
        orderType,
        quantity: Number(quantity),
        price: orderMethod === "limit" ? Number(price) : undefined,
        orderMethod,
      });
      return res.json();
    },
    onSuccess: async (data) => {
      if (data.success) {
        toast({ title: "주문 성공", description: `${selectedStock!.name || selectedStock!.code} ${orderType === "buy" ? "매수" : "매도"} 주문이 체결되었습니다.` });

        // 매수 주문 성공 + 손절 설정 활성화 시 → 자동으로 손절 감시 등록
        if (orderType === "buy" && enableStopLoss && Number(stopLossPercent) > 0) {
          const buyPx = orderMethod === "limit" ? Number(price) : Number(priceData?.price || 0);
          try {
            await stopLossMutation.mutateAsync({
              stockCode: selectedStock!.code,
              stockName: selectedStock!.name || priceData?.stockName || selectedStock!.code,
              buyPrice: buyPx,
              quantity: Number(quantity),
              stopLossPercent: Number(stopLossPercent),
              stopType,
            });
            const stopPx = Math.floor(buyPx * (1 - Number(stopLossPercent) / 100));
            toast({
              title: "손절 감시 등록",
              description: `${stopType === "trailing" ? "트레일링 스탑" : "손절가"} ${stopLossPercent}% (${stopPx.toLocaleString()}원) 감시가 활성화되었습니다.`,
            });
            queryClient.invalidateQueries({ queryKey: ["/api/trading/stop-loss"] });
          } catch (slErr: any) {
            toast({ title: "손절 감시 등록 실패", description: slErr.message, variant: "destructive" });
          }
        }

        setQuantity("");
        setPrice("");
        queryClient.invalidateQueries({ queryKey: ["/api/trading/orders"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trading/balance"] });
      } else {
        toast({ title: "주문 실패", description: data.message, variant: "destructive" });
      }
      setConfirmOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "주문 오류", description: error.message, variant: "destructive" });
      setConfirmOpen(false);
    },
  });

  // ETF DB + 인기 종목 통합 검색
  const filteredStocks = useMemo(() => {
    if (!searchTerm || selectedStock) return [];
    const term = searchTerm.toLowerCase().trim();
    if (!term) return [];

    const results: { code: string; name: string; category: string; source: string }[] = [];
    const addedCodes = new Set<string>();

    // 인기 종목 검색
    POPULAR_STOCKS.forEach((s) => {
      if (
        s.name.toLowerCase().includes(term) ||
        s.code.includes(term)
      ) {
        if (!addedCodes.has(s.code)) {
          results.push({ code: s.code, name: s.name, category: s.market, source: "stock" });
          addedCodes.add(s.code);
        }
      }
    });

    return results;
  }, [searchTerm, selectedStock]);

  // 종목코드 직접 입력 확인 (6자리 숫자 or 영숫자)
  const isStockCode = (term: string) => /^[0-9A-Za-z]{6}$/.test(term.trim());

  const handleSelectStock = (code: string, name: string) => {
    setSelectedStock({ code, name });
    setSearchTerm(name || code);
    setPrice(""); // 종목 변경 시 가격 리셋 → 현재가로 재설정됨
  };

  // 종목코드 직접 입력으로 검색
  const handleDirectCodeSearch = async () => {
    const code = searchTerm.trim();
    if (!isStockCode(code)) {
      toast({ title: "종목코드 오류", description: "6자리 종목코드를 입력해주세요. (예: 005930)", variant: "destructive" });
      return;
    }
    setCodeSearching(true);
    try {
      const res = await fetch(`/api/trading/price/${code}`, { credentials: "include" });
      if (!res.ok) throw new Error("종목을 찾을 수 없습니다");
      const data = await res.json();
      handleSelectStock(code, data.stockName || code);
    } catch {
      toast({ title: "종목 조회 실패", description: `종목코드 "${code}"를 찾을 수 없습니다.`, variant: "destructive" });
    } finally {
      setCodeSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchTerm.trim() && !selectedStock) {
      e.preventDefault();
      // 검색 결과에서 1건만 있으면 바로 선택
      if (filteredStocks.length === 1) {
        handleSelectStock(filteredStocks[0].code, filteredStocks[0].name);
      } else if (isStockCode(searchTerm.trim())) {
        // 6자리 코드면 직접 KIS API 조회
        handleDirectCodeSearch();
      }
    }
  };

  const totalAmount = orderMethod === "limit" && price && quantity
    ? Number(price) * Number(quantity)
    : priceData && quantity
      ? Number(priceData.price) * Number(quantity)
      : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">매매 주문</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 주문 폼 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">주문 입력</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 종목 검색 */}
            <div className="space-y-2">
              <Label>종목 검색</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="종목명 검색 또는 종목코드 6자리 입력 (예: 005930)"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (selectedStock) setSelectedStock(null);
                  }}
                  onKeyDown={handleKeyDown}
                  className="pl-9"
                />
                {codeSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!selectedStock && searchTerm && (
                  <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {/* 직접 종목코드 입력 옵션 */}
                    {searchTerm.trim().length >= 4 && (
                      <div
                        className="p-3 hover:bg-muted cursor-pointer border-b flex items-center gap-2"
                        onClick={handleDirectCodeSearch}
                      >
                        <Search className="w-4 h-4 text-primary" />
                        <div>
                          <div className="font-medium text-sm text-primary">
                            "{searchTerm.trim()}" 종목코드로 직접 조회
                          </div>
                          <div className="text-xs text-muted-foreground">
                            증권사 API에서 실시간 조회합니다 (Enter 키)
                          </div>
                        </div>
                      </div>
                    )}
                    {/* 종목 검색 결과 (인기종목 + ETF DB) */}
                    {filteredStocks.slice(0, 10).map((stock) => (
                      <div
                        key={stock.code + stock.source}
                        className="p-3 hover:bg-muted cursor-pointer"
                        onClick={() => handleSelectStock(stock.code, stock.name)}
                      >
                        <div className="font-medium text-sm">{stock.name}</div>
                        <div className="text-xs text-muted-foreground">{stock.code} | {stock.category}</div>
                      </div>
                    ))}
                    {filteredStocks.length === 0 && searchTerm.trim().length < 4 && (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        종목명 또는 6자리 종목코드를 입력하세요
                      </div>
                    )}
                  </div>
                )}
              </div>
              {selectedStock && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    선택: <span className="font-medium text-foreground">{selectedStock.name || selectedStock.code}</span> ({selectedStock.code})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-xs"
                    onClick={() => { setSelectedStock(null); setSearchTerm(""); }}
                  >
                    변경
                  </Button>
                </div>
              )}
            </div>

            {/* 매수/매도 선택 */}
            <div className="space-y-2">
              <Label>주문 유형</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={orderType === "buy" ? "default" : "outline"}
                  className={orderType === "buy" ? "bg-red-500 hover:bg-red-600 text-white" : ""}
                  onClick={() => setOrderType("buy")}
                >
                  <ArrowUpRight className="w-4 h-4 mr-1" />
                  매수
                </Button>
                <Button
                  variant={orderType === "sell" ? "default" : "outline"}
                  className={orderType === "sell" ? "bg-blue-500 hover:bg-blue-600 text-white" : ""}
                  onClick={() => setOrderType("sell")}
                >
                  <ArrowDownRight className="w-4 h-4 mr-1" />
                  매도
                </Button>
              </div>
            </div>

            {/* 주문 방법 */}
            <div className="space-y-2">
              <Label>주문 방법</Label>
              <Select value={orderMethod} onValueChange={(v) => setOrderMethod(v as "limit" | "market")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="limit">지정가</SelectItem>
                  <SelectItem value="market">시장가</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 수량 */}
            <div className="space-y-2">
              <Label>수량 (주)</Label>
              <Input
                type="number"
                placeholder="주문 수량"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
              />
            </div>

            {/* 가격 (지정가) */}
            {orderMethod === "limit" && (
              <div className="space-y-2">
                <Label>주문 가격 (원)</Label>
                <Input
                  type="number"
                  placeholder="주문 가격"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  min="1"
                />
              </div>
            )}

            {/* 손절가 설정 (매수 주문 시에만 표시) */}
            {orderType === "buy" && (
              <div className="space-y-3 border rounded-lg p-3 bg-orange-50/50 dark:bg-orange-950/20">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-orange-500" />
                    손절가 설정
                  </Label>
                  <Switch
                    checked={enableStopLoss}
                    onCheckedChange={setEnableStopLoss}
                  />
                </div>

                {enableStopLoss && (
                  <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                    {/* 손절 유형 선택 */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">손절 유형</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={stopType === "simple" ? "default" : "outline"}
                          size="sm"
                          className={`text-xs ${stopType === "simple" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
                          onClick={() => setStopType("simple")}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                          단순 손절가
                        </Button>
                        <Button
                          type="button"
                          variant={stopType === "trailing" ? "default" : "outline"}
                          size="sm"
                          className={`text-xs ${stopType === "trailing" ? "bg-purple-500 hover:bg-purple-600 text-white" : ""}`}
                          onClick={() => setStopType("trailing")}
                        >
                          <TrendingUp className="w-3.5 h-3.5 mr-1" />
                          트레일링 스탑
                        </Button>
                      </div>
                    </div>

                    {/* 손절 비율 입력 */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        손절 비율 (%)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="3"
                          value={stopLossPercent}
                          onChange={(e) => setStopLossPercent(e.target.value)}
                          min="0.5"
                          max="50"
                          step="0.5"
                          className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground font-medium">%</span>
                      </div>
                      {/* 빠른 선택 버튼 */}
                      <div className="flex gap-1.5 flex-wrap">
                        {["1", "2", "3", "5", "7", "10"].map((pct) => (
                          <Button
                            key={pct}
                            type="button"
                            variant={stopLossPercent === pct ? "default" : "outline"}
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => setStopLossPercent(pct)}
                          >
                            {pct}%
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* 손절가 미리보기 */}
                    {(() => {
                      const buyPx = orderMethod === "limit" && price ? Number(price) : Number(priceData?.price || 0);
                      const slPct = Number(stopLossPercent || 0);
                      if (buyPx > 0 && slPct > 0) {
                        const stopPx = Math.floor(buyPx * (1 - slPct / 100));
                        return (
                          <div className="bg-orange-100/60 dark:bg-orange-900/30 rounded-md p-2.5 text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">기준가(매수가)</span>
                              <span className="font-medium">{buyPx.toLocaleString()}원</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                {stopType === "trailing" ? "트레일링 손절가" : "손절가"} (-{slPct}%)
                              </span>
                              <span className="font-bold text-red-500">{stopPx.toLocaleString()}원</span>
                            </div>
                            {stopType === "trailing" && (
                              <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                                💡 주가 상승 시 최고가를 추적하여 손절가가 자동으로 상향됩니다.
                                <br />최고가 대비 {slPct}% 하락 시 시장가 매도됩니다.
                              </div>
                            )}
                            {stopType === "simple" && (
                              <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                                💡 현재가가 {stopPx.toLocaleString()}원 이하로 하락 시 시장가 매도됩니다.
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* 예상 금액 */}
            {totalAmount > 0 && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">예상 주문 금액</span>
                  <span className="font-bold">{totalAmount.toLocaleString()}원</span>
                </div>
              </div>
            )}

            {/* 주문 버튼 */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger asChild>
                <Button
                  className={`w-full ${orderType === "buy" ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"} text-white`}
                  disabled={!selectedStock || !quantity || (orderMethod === "limit" && !price)}
                >
                  {orderType === "buy" ? "매수 주문" : "매도 주문"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>주문 확인</DialogTitle>
                  <DialogDescription>
                    아래 내용으로 주문하시겠습니까?
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">종목</span>
                    <span className="font-medium">{selectedStock?.name}</span>
                    <span className="text-muted-foreground">유형</span>
                    <span className={`font-bold ${orderType === "buy" ? "text-red-500" : "text-blue-500"}`}>
                      {orderType === "buy" ? "매수" : "매도"}
                    </span>
                    <span className="text-muted-foreground">방법</span>
                    <span>{orderMethod === "limit" ? "지정가" : "시장가"}</span>
                    <span className="text-muted-foreground">수량</span>
                    <span>{Number(quantity).toLocaleString()}주</span>
                    {orderMethod === "limit" && (
                      <>
                        <span className="text-muted-foreground">가격</span>
                        <span>{Number(price).toLocaleString()}원</span>
                      </>
                    )}
                    <span className="text-muted-foreground">예상 금액</span>
                    <span className="font-bold">{totalAmount.toLocaleString()}원</span>
                    {orderType === "buy" && enableStopLoss && Number(stopLossPercent) > 0 && (
                      <>
                        <span className="text-muted-foreground col-span-2 border-t pt-2 mt-1 flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />
                          손절 설정
                        </span>
                        <span className="text-muted-foreground">손절 유형</span>
                        <span className={stopType === "trailing" ? "text-purple-500 font-medium" : "text-orange-500 font-medium"}>
                          {stopType === "trailing" ? "트레일링 스탑" : "단순 손절가"}
                        </span>
                        <span className="text-muted-foreground">손절 비율</span>
                        <span className="font-medium">{stopLossPercent}%</span>
                        <span className="text-muted-foreground">손절가</span>
                        <span className="font-bold text-red-500">
                          {(() => {
                            const buyPx = orderMethod === "limit" ? Number(price) : Number(priceData?.price || 0);
                            return Math.floor(buyPx * (1 - Number(stopLossPercent) / 100)).toLocaleString();
                          })()}원
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setConfirmOpen(false)}>취소</Button>
                  <Button
                    className={orderType === "buy" ? "bg-red-500 hover:bg-red-600 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"}
                    onClick={() => orderMutation.mutate()}
                    disabled={orderMutation.isPending}
                  >
                    {orderMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    확인
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* 현재가 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>현재가 정보</span>
              {selectedStock && (
                <Button variant="ghost" size="sm" onClick={() => refetchPrice()} disabled={priceLoading}>
                  <RefreshCw className={`w-4 h-4 ${priceLoading ? "animate-spin" : ""}`} />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedStock ? (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>종목을 선택하면 현재가가 표시됩니다</p>
              </div>
            ) : priceLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : priceData ? (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">{selectedStock.name || selectedStock.code}</p>
                  <p className="text-4xl font-bold mt-1">{parseInt(priceData.price).toLocaleString()}<span className="text-lg">원</span></p>
                  <p className={`text-lg mt-1 ${parseFloat(priceData.changePercent) >= 0 ? "text-red-500" : "text-blue-500"}`}>
                    {parseFloat(priceData.changePercent) >= 0 ? "▲" : "▼"}{" "}
                    {Math.abs(parseInt(priceData.change)).toLocaleString()}원 ({priceData.changePercent}%)
                  </p>
                </div>
                {priceData.open && (
                  <div className="grid grid-cols-2 gap-2 text-sm border-t pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">시가</span>
                      <span>{parseInt(priceData.open).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">고가</span>
                      <span className="text-red-500">{parseInt(priceData.high).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">저가</span>
                      <span className="text-blue-500">{parseInt(priceData.low).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">거래량</span>
                      <span>{parseInt(priceData.volume || "0").toLocaleString()}</span>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                가격 정보를 불러올 수 없습니다
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 선택된 종목 호가 + 차트 */}
      {selectedStock && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-4">
              <StockAskingPrice stockCode={selectedStock.code} stockName={selectedStock.name || selectedStock.code} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <StockDailyChart stockCode={selectedStock.code} stockName={selectedStock.name || selectedStock.code} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ========== Stop Loss Section ==========
interface StopLossItem {
  id: number;
  userId: number | null;
  stockCode: string;
  stockName: string | null;
  buyPrice: string;
  quantity: number;
  stopLossPercent: string;
  stopType: string;
  stopPrice: string;
  highestPrice: string | null;
  status: string | null;
  kisOrderNo: string | null;
  triggerPrice: string | null;
  errorMessage: string | null;
  createdAt: string;
  triggeredAt: string | null;
}

interface StopLossPricesResponse {
  prices: Record<string, { price: number; changePercent: string; checkedAt: string }>;
  lastCheckedAt: string | null;
  isMarketOpen: boolean;
  interval: string;
}

function StopLossSection() {
  const { toast } = useToast();

  // 감시 목록 조회 (10초 자동 새로고침)
  const { data: stopLossOrders, isLoading, refetch } = useQuery<StopLossItem[]>({
    queryKey: ["/api/trading/stop-loss"],
    refetchInterval: 10000,
  });

  // 실시간 현재가 조회 (10초 자동 새로고침)
  const { data: pricesData } = useQuery<StopLossPricesResponse>({
    queryKey: ["/api/trading/stop-loss/prices"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/trading/stop-loss/prices");
      return res.json();
    },
    refetchInterval: 10000,
    enabled: (stopLossOrders?.filter(o => o.status === "active")?.length ?? 0) > 0,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/trading/stop-loss/${id}`);
    },
    onSuccess: () => {
      toast({ title: "취소 완료", description: "손절 감시가 취소되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/stop-loss"] });
    },
    onError: (error: Error) => {
      toast({ title: "취소 실패", description: error.message, variant: "destructive" });
    },
  });

  const checkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trading/stop-loss/check");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "감시 체크 완료",
        description: `${data.checked}건 확인, ${data.triggered}건 발동`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/stop-loss"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/stop-loss/prices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/orders"] });
    },
    onError: (error: Error) => {
      toast({ title: "감시 체크 실패", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active": return <StatusBadge variant="outline">감시중</StatusBadge>;
      case "triggered": return <StatusBadge variant="destructive">발동(매도)</StatusBadge>;
      case "cancelled": return <StatusBadge variant="secondary">취소</StatusBadge>;
      case "error": return <StatusBadge variant="destructive">오류</StatusBadge>;
      default: return <StatusBadge variant="outline">{status}</StatusBadge>;
    }
  };

  const activeOrders = stopLossOrders?.filter(o => o.status === "active") || [];
  const historyOrders = stopLossOrders?.filter(o => o.status !== "active") || [];

  // 현재가로 손익률 계산 헬퍼
  const getCurrentPriceInfo = (stockCode: string) => {
    return pricesData?.prices?.[stockCode] || null;
  };

  const calcProfitRate = (buyPrice: number, currentPrice: number) => {
    if (buyPrice <= 0) return 0;
    return ((currentPrice - buyPrice) / buyPrice) * 100;
  };

  const calcGapToStop = (currentPrice: number, stopPrice: number) => {
    if (stopPrice <= 0) return 0;
    return ((currentPrice - stopPrice) / stopPrice) * 100;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-orange-500" />
          손절/트레일링 스탑 감시
        </h2>
        <div className="flex items-center gap-2">
          {/* 장 운영 상태 표시 */}
          <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
            pricesData?.isMarketOpen
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${pricesData?.isMarketOpen ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
            {pricesData?.isMarketOpen ? `장중 (${pricesData.interval})` : "장외"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkMutation.mutate()}
            disabled={checkMutation.isPending || activeOrders.length === 0}
          >
            {checkMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            수동 체크
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* 안내 */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50">
        <CardContent className="p-4 text-sm text-muted-foreground space-y-1">
          <p>💡 <strong>손절 감시</strong>는 매수 주문 시 손절가를 설정하면 자동으로 등록됩니다.</p>
          <p>📊 서버에서 장중 <strong>10초 간격</strong>으로 현재가를 확인하고, 손절 조건 충족 시 <strong>시장가 매도</strong>를 자동 실행합니다.</p>
          <p>📈 <strong>트레일링 스탑</strong>은 주가 상승 시 최고가를 추적하여 손절가가 자동으로 올라갑니다.</p>
          <p>⏰ 장 운영 시간 (09:00~15:30) 동안만 감시가 활성화되며, 장외 시간에는 자동 비활성화됩니다.</p>
          {pricesData?.lastCheckedAt && (
            <p className="text-xs text-muted-foreground/70">
              마지막 체크: {new Date(pricesData.lastCheckedAt).toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : activeOrders.length === 0 && historyOrders.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">등록된 손절 감시 없음</h3>
            <p className="text-muted-foreground mt-1">주문 탭에서 매수 시 손절가를 설정하면 자동 등록됩니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* 활성 감시 */}
          {activeOrders.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-orange-600 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                활성 감시 ({activeOrders.length}건)
              </h3>
              {activeOrders.map((sl) => {
                const buyPx = Number(sl.buyPrice);
                const stopPx = Number(sl.stopPrice);
                const highPx = sl.highestPrice ? Number(sl.highestPrice) : buyPx;
                const slPct = Number(sl.stopLossPercent);
                const priceInfo = getCurrentPriceInfo(sl.stockCode);
                const currentPx = priceInfo?.price || 0;
                const profitRate = currentPx > 0 ? calcProfitRate(buyPx, currentPx) : null;
                const gapToStop = currentPx > 0 ? calcGapToStop(currentPx, stopPx) : null;

                return (
                  <Card key={sl.id} className="border-orange-200/50 dark:border-orange-800/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm">{sl.stockName || sl.stockCode}</h4>
                            <span className="text-xs text-muted-foreground">({sl.stockCode})</span>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              sl.stopType === "trailing"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                            }`}>
                              {sl.stopType === "trailing" ? "트레일링" : "단순손절"}
                            </span>
                            {getStatusBadge(sl.status)}
                          </div>

                          {/* 현재가 & 손익 표시 (실시간) */}
                          {currentPx > 0 && (
                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-md px-3 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">현재가</span>
                                <span className="font-bold text-sm">{currentPx.toLocaleString()}원</span>
                              </div>
                              {profitRate !== null && (
                                <div className={`flex items-center gap-0.5 text-xs font-bold ${profitRate >= 0 ? "text-red-500" : "text-blue-500"}`}>
                                  {profitRate >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                  {profitRate >= 0 ? "+" : ""}{profitRate.toFixed(2)}%
                                </div>
                              )}
                              {gapToStop !== null && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">손절까지 </span>
                                  <span className={`font-semibold ${gapToStop < 2 ? "text-red-500 animate-pulse" : gapToStop < 5 ? "text-orange-500" : "text-green-600"}`}>
                                    {gapToStop.toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">매수가</span>
                              <div className="font-medium">{buyPx.toLocaleString()}원</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">손절가 (-{slPct}%)</span>
                              <div className="font-bold text-red-500">{stopPx.toLocaleString()}원</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">수량</span>
                              <div className="font-medium">{sl.quantity.toLocaleString()}주</div>
                            </div>
                            {sl.stopType === "trailing" && (
                              <div>
                                <span className="text-muted-foreground">최고가</span>
                                <div className="font-medium text-green-600">{highPx.toLocaleString()}원</div>
                              </div>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            등록: {new Date(sl.createdAt).toLocaleString("ko-KR")}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => cancelMutation.mutate(sl.id)}
                          disabled={cancelMutation.isPending}
                          className="text-destructive hover:text-destructive"
                        >
                          <XCircle className="w-5 h-5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* 발동/취소 이력 */}
          {historyOrders.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">이력 ({historyOrders.length}건)</h3>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>종목</TableHead>
                          <TableHead>유형</TableHead>
                          <TableHead className="text-right">매수가</TableHead>
                          <TableHead className="text-right">손절가</TableHead>
                          <TableHead className="text-right">발동가</TableHead>
                          <TableHead className="text-right">수량</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead>시간</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyOrders.map((sl) => (
                          <TableRow key={sl.id}>
                            <TableCell>
                              <div className="font-medium text-sm">{sl.stockName || sl.stockCode}</div>
                              <div className="text-xs text-muted-foreground">{sl.stockCode}</div>
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs font-medium ${sl.stopType === "trailing" ? "text-purple-500" : "text-orange-500"}`}>
                                {sl.stopType === "trailing" ? "트레일링" : "단순손절"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {Number(sl.buyPrice).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-sm text-red-500">
                              {Number(sl.stopPrice).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {sl.triggerPrice ? Number(sl.triggerPrice).toLocaleString() : "-"}
                            </TableCell>
                            <TableCell className="text-right">{sl.quantity.toLocaleString()}</TableCell>
                            <TableCell>{getStatusBadge(sl.status)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {sl.triggeredAt
                                ? new Date(sl.triggeredAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
                                : new Date(sl.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ========== Auto Trade Section ==========
function AutoTradeSection() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStock, setSelectedStock] = useState<{ code: string; name: string } | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState<string>("buy_below");
  const [targetPrice, setTargetPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [orderMethod, setOrderMethod] = useState<string>("limit");

  const { data: rules, isLoading } = useQuery<AutoTradeRule[]>({
    queryKey: ["/api/trading/rules"],
  });

  const createRule = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trading/rules", {
        name: ruleName,
        stockCode: selectedStock!.code,
        stockName: selectedStock!.name,
        ruleType,
        targetPrice: Number(targetPrice),
        quantity: Number(quantity),
        orderMethod,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/rules"] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: "성공", description: "자동매매 규칙이 추가되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const toggleRule = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/trading/rules/${id}/toggle`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/rules"] });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/trading/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/rules"] });
      toast({ title: "삭제됨", description: "규칙이 삭제되었습니다." });
    },
  });

  const executeRules = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trading/execute-rules", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/orders"] });
      toast({
        title: "자동매매 실행 완료",
        description: `${data.executed}건 실행됨 (총 ${data.results?.length || 0}건 확인)`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "실행 오류", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setRuleName("");
    setSearchTerm("");
    setSelectedStock(null);
    setRuleType("buy_below");
    setTargetPrice("");
    setQuantity("");
    setOrderMethod("limit");
  };

  // ETF DB + 인기 종목 통합 검색
  const filteredStocksForRule = useMemo(() => {
    if (!searchTerm || selectedStock) return [];
    const term = searchTerm.toLowerCase().trim();
    if (!term) return [];

    const results: { code: string; name: string; category: string }[] = [];
    const addedCodes = new Set<string>();

    POPULAR_STOCKS.forEach((s) => {
      if (s.name.toLowerCase().includes(term) || s.code.includes(term)) {
        if (!addedCodes.has(s.code)) {
          results.push({ code: s.code, name: s.name, category: s.market });
          addedCodes.add(s.code);
        }
      }
    });

    return results;
  }, [searchTerm, selectedStock]);

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case "buy_below": return "목표가 이하 매수";
      case "sell_above": return "목표가 이상 매도";
      case "trailing_stop": return "트레일링 스탑";
      default: return type;
    }
  };

  const getStatusBadge = (rule: AutoTradeRule) => {
    if (rule.status === "executed") return <StatusBadge variant="success">체결완료</StatusBadge>;
    if (rule.status === "cancelled") return <StatusBadge variant="outline">취소</StatusBadge>;
    if (rule.status === "failed") return <StatusBadge variant="destructive">실패</StatusBadge>;
    if (rule.isActive) return <StatusBadge variant="success">활성</StatusBadge>;
    return <StatusBadge variant="secondary">비활성</StatusBadge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">자동매매 규칙</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => executeRules.mutate()}
            disabled={executeRules.isPending || !rules?.some((r) => r.isActive && r.status === "active")}
          >
            {executeRules.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            규칙 실행
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                규칙 추가
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>자동매매 규칙 추가</DialogTitle>
                <DialogDescription>조건에 맞으면 자동으로 매매를 실행합니다.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>규칙 이름</Label>
                  <Input placeholder="예: TIGER 나스닥 10000원 이하 매수" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>종목 검색</Label>
                  <div className="relative">
                    <Input
                      placeholder="종목명 또는 코드..."
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); if (selectedStock) setSelectedStock(null); }}
                    />
                    {filteredStocksForRule.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {filteredStocksForRule.slice(0, 8).map((stock) => (
                          <div
                            key={stock.code}
                            className="p-2 hover:bg-muted cursor-pointer text-sm"
                            onClick={() => { setSelectedStock({ code: stock.code, name: stock.name }); setSearchTerm(stock.name); }}
                          >
                            {stock.name} ({stock.code}) <span className="text-muted-foreground text-xs">| {stock.category}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>조건</Label>
                  <Select value={ruleType} onValueChange={setRuleType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy_below">목표가 이하 매수</SelectItem>
                      <SelectItem value="sell_above">목표가 이상 매도</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>목표가 (원)</Label>
                    <Input type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>수량 (주)</Label>
                    <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>주문 방법</Label>
                  <Select value={orderMethod} onValueChange={setOrderMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="limit">지정가</SelectItem>
                      <SelectItem value="market">시장가</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>취소</Button>
                <Button
                  onClick={() => createRule.mutate()}
                  disabled={createRule.isPending || !ruleName || !selectedStock || !targetPrice || !quantity}
                >
                  {createRule.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  추가
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : !rules || rules.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Zap className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">자동매매 규칙 없음</h3>
            <p className="text-muted-foreground mt-1">규칙을 추가하여 자동매매를 시작하세요.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} className={`${!rule.isActive ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold">{rule.name}</h4>
                      {getStatusBadge(rule)}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p>
                        {rule.stockName} ({rule.stockCode}) |{" "}
                        <span className={rule.ruleType === "buy_below" ? "text-red-500" : "text-blue-500"}>
                          {getRuleTypeLabel(rule.ruleType)}
                        </span>
                      </p>
                      <p>
                        목표가: {parseInt(rule.targetPrice).toLocaleString()}원 | 수량: {rule.quantity}주 |{" "}
                        {rule.orderMethod === "market" ? "시장가" : "지정가"}
                      </p>
                      {rule.executedAt && (
                        <p className="text-xs">
                          체결: {new Date(rule.executedAt).toLocaleString("ko-KR")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {rule.status === "active" && (
                      <Switch
                        checked={!!rule.isActive}
                        onCheckedChange={() => toggleRule.mutate(rule.id)}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteRule.mutate(rule.id)}
                      disabled={deleteRule.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Order History Section ==========
function OrderHistorySection() {
  const { data: orders, isLoading, refetch } = useQuery<TradingOrder[]>({
    queryKey: ["/api/trading/orders"],
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "filled": return <StatusBadge variant="success">체결</StatusBadge>;
      case "pending": return <StatusBadge variant="outline">대기</StatusBadge>;
      case "cancelled": return <StatusBadge variant="secondary">취소</StatusBadge>;
      case "failed": return <StatusBadge variant="destructive">실패</StatusBadge>;
      default: return <StatusBadge variant="outline">{status}</StatusBadge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">주문 내역</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : !orders || orders.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Clock className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">주문 내역 없음</h3>
            <p className="text-muted-foreground mt-1">매매 주문을 실행하면 여기에 기록됩니다.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>일시</TableHead>
                    <TableHead>종목</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                    <TableHead className="text-right">가격</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>비고</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(order.createdAt).toLocaleString("ko-KR", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">{order.stockName || order.stockCode}</div>
                          <div className="text-xs text-muted-foreground">{order.stockCode}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`font-bold text-sm ${order.orderType === "buy" ? "text-red-500" : "text-blue-500"}`}>
                          {order.orderType === "buy" ? "매수" : "매도"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{order.quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {order.price ? parseInt(order.price).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {order.totalAmount ? parseInt(order.totalAmount).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                        {order.autoTradeRuleId ? "🤖 자동" : ""}
                        {order.kisOrderNo ? ` #${order.kisOrderNo}` : ""}
                        {order.errorMessage || ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ========== Skills Section ==========
interface TradingSkillDef {
  id: number;
  name: string;
  skillCode: string;
  category: string;
  description: string;
  icon: string;
  paramsSchema: string;
  defaultParams: string;
  isBuiltin: boolean;
  isEnabled: boolean;
}

interface SkillInstance {
  id: number;
  userId: number;
  skillId: number;
  label: string;
  stockCode: string | null;
  stockName: string | null;
  params: string | null;
  quantity: number;
  orderMethod: string;
  isActive: boolean;
  priority: number;
  status: string;
  lastCheckedAt: string | null;
  triggeredAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  skill: TradingSkillDef | null;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  entry: { label: "매수", color: "text-red-500 bg-red-50 dark:bg-red-950/30", icon: "🟢" },
  exit: { label: "매도", color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30", icon: "🔴" },
  risk: { label: "리스크", color: "text-amber-500 bg-amber-50 dark:bg-amber-950/30", icon: "🛡️" },
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "활성", variant: "default" },
  paused: { label: "일시정지", variant: "secondary" },
  triggered: { label: "발동", variant: "destructive" },
  completed: { label: "완료", variant: "outline" },
  error: { label: "오류", variant: "destructive" },
};

function SkillsSection() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [checkingAll, setCheckingAll] = useState(false);
  const [expandedInstance, setExpandedInstance] = useState<number | null>(null);

  const { data: skills = [] } = useQuery<TradingSkillDef[]>({
    queryKey: ["/api/trading/skills"],
  });

  const { data: instances = [], refetch: refetchInstances } = useQuery<SkillInstance[]>({
    queryKey: ["/api/trading/skill-instances"],
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/trading/skill-instances/${id}/toggle`);
      return res.json();
    },
    onSuccess: () => { refetchInstances(); },
    onError: (e: Error) => { toast({ title: "토글 실패", description: e.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/trading/skill-instances/${id}`);
      return res.json();
    },
    onSuccess: () => { toast({ title: "삭제 완료" }); refetchInstances(); },
    onError: (e: Error) => { toast({ title: "삭제 실패", description: e.message, variant: "destructive" }); },
  });

  const checkMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/trading/skill-instances/${id}/check`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.triggered ? "🚨 조건 발동!" : "조건 미충족",
        description: data.detail,
        variant: data.triggered ? "destructive" : "default",
      });
      refetchInstances();
    },
    onError: (e: Error) => { toast({ title: "체크 실패", description: e.message, variant: "destructive" }); },
  });

  const checkAllMutation = useMutation({
    mutationFn: async () => {
      setCheckingAll(true);
      const res = await apiRequest("POST", "/api/trading/skills/check-all");
      return res.json();
    },
    onSuccess: (data) => {
      setCheckingAll(false);
      toast({
        title: `스킬 체크 완료`,
        description: `${data.total}개 중 ${data.triggered}개 조건 발동`,
        variant: data.triggered > 0 ? "destructive" : "default",
      });
      refetchInstances();
    },
    onError: (e: Error) => {
      setCheckingAll(false);
      toast({ title: "일괄 체크 실패", description: e.message, variant: "destructive" });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/trading/skill-instances/${id}/execute`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "✅ 주문 성공" : "주문 실패",
        description: data.detail || data.message,
        variant: data.success ? "default" : "destructive",
      });
      refetchInstances();
    },
    onError: (e: Error) => { toast({ title: "실행 실패", description: e.message, variant: "destructive" }); },
  });

  const filteredInstances = selectedCategory === "all"
    ? instances
    : instances.filter(i => i.skill?.category === selectedCategory);

  const activeCount = instances.filter(i => i.isActive && i.status === "active").length;
  const triggeredCount = instances.filter(i => i.status === "triggered").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-purple-500" />
                스킬 레지스트리
              </CardTitle>
              <CardDescription className="mt-1">
                기술적 분석 기반 매매 스킬을 등록하고, 조건 충족 시 자동으로 주문을 실행합니다
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm"
                onClick={() => checkAllMutation.mutate()}
                disabled={checkingAll || activeCount === 0}
                className="text-xs gap-1"
              >
                {checkingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                전체 체크
              </Button>
              <Button size="sm" onClick={() => setShowAddDialog(true)} className="text-xs gap-1">
                <Plus className="w-3 h-3" />
                스킬 추가
              </Button>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Badge variant="secondary" className="text-xs">등록 {instances.length}/20</Badge>
            <Badge variant="default" className="text-xs">활성 {activeCount}</Badge>
            {triggeredCount > 0 && <Badge variant="destructive" className="text-xs">발동 {triggeredCount}</Badge>}
          </div>
        </CardHeader>
      </Card>

      <div className="flex gap-2">
        <Button variant={selectedCategory === "all" ? "default" : "outline"} size="sm" className="text-xs" onClick={() => setSelectedCategory("all")}>전체</Button>
        <Button variant={selectedCategory === "entry" ? "default" : "outline"} size="sm" className="text-xs" onClick={() => setSelectedCategory("entry")}>🟢 매수</Button>
        <Button variant={selectedCategory === "exit" ? "default" : "outline"} size="sm" className="text-xs" onClick={() => setSelectedCategory("exit")}>🔴 매도</Button>
        <Button variant={selectedCategory === "risk" ? "default" : "outline"} size="sm" className="text-xs" onClick={() => setSelectedCategory("risk")}>🛡️ 리스크</Button>
      </div>

      {filteredInstances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">등록된 스킬이 없습니다</p>
            <p className="text-xs text-muted-foreground mt-1">상단의 "스킬 추가" 버튼으로 매매 스킬을 등록하세요</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredInstances.map(inst => {
            const cat = CATEGORY_LABELS[inst.skill?.category || "entry"];
            const statusInfo = STATUS_LABELS[inst.status] || STATUS_LABELS.active;
            const isExpanded = expandedInstance === inst.id;
            const instParams = inst.params ? JSON.parse(inst.params) : {};

            return (
              <Card key={inst.id} className={`transition-all ${inst.status === "triggered" ? "border-red-300 dark:border-red-700 shadow-sm" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ${cat.color}`}>
                        {inst.skill?.icon || "⚡"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{inst.label}</span>
                          <Badge variant={statusInfo.variant} className="text-[10px] px-1.5 py-0 shrink-0">{statusInfo.label}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className={cat.color.split(" ")[0]}>{cat.icon} {cat.label}</span>
                          {inst.stockName && <span>· {inst.stockName}({inst.stockCode})</span>}
                          {inst.quantity > 0 && <span>· {inst.quantity}주</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {inst.skill?.category !== "risk" && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="조건 체크"
                          onClick={() => checkMutation.mutate(inst.id)}
                          disabled={checkMutation.isPending}
                        >
                          {checkMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                      )}
                      {inst.status === "triggered" && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" title="주문 실행"
                          onClick={() => executeMutation.mutate(inst.id)}
                          disabled={executeMutation.isPending}
                        >
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={inst.isActive ? "비활성화" : "활성화"}
                        onClick={() => toggleMutation.mutate(inst.id)}
                      >
                        <Power className={`w-3.5 h-3.5 ${inst.isActive ? "text-green-500" : "text-muted-foreground"}`} />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="상세"
                        onClick={() => setExpandedInstance(isExpanded ? null : inst.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" title="삭제"
                        onClick={() => { if (confirm("이 스킬을 삭제하시겠습니까?")) deleteMutation.mutate(inst.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">스킬: </span><span className="font-medium">{inst.skill?.name}</span></div>
                        <div><span className="text-muted-foreground">주문방식: </span><span className="font-medium">{inst.orderMethod === "market" ? "시장가" : "지정가"}</span></div>
                        <div><span className="text-muted-foreground">우선순위: </span><span className="font-medium">{inst.priority}</span></div>
                        <div><span className="text-muted-foreground">등록일: </span><span>{new Date(inst.createdAt).toLocaleDateString("ko-KR")}</span></div>
                        {inst.lastCheckedAt && (
                          <div><span className="text-muted-foreground">마지막 체크: </span><span>{new Date(inst.lastCheckedAt).toLocaleString("ko-KR")}</span></div>
                        )}
                        {inst.triggeredAt && (
                          <div><span className="text-muted-foreground">발동 시간: </span><span className="text-red-500">{new Date(inst.triggeredAt).toLocaleString("ko-KR")}</span></div>
                        )}
                      </div>
                      {Object.keys(instParams).length > 0 && (
                        <div className="bg-muted/50 rounded-lg p-2">
                          <p className="text-[10px] text-muted-foreground mb-1 font-medium">파라미터</p>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {Object.entries(instParams).map(([key, val]) => (
                              <div key={key}><span className="text-muted-foreground">{key}: </span><span className="font-mono">{String(val)}</span></div>
                            ))}
                          </div>
                        </div>
                      )}
                      {inst.skill?.description && (
                        <p className="text-xs text-muted-foreground italic">{inst.skill.description}</p>
                      )}
                      {inst.errorMessage && (
                        <p className="text-xs text-red-500">⚠️ {inst.errorMessage}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showAddDialog && (
        <AddSkillDialog skills={skills} open={showAddDialog} onClose={() => setShowAddDialog(false)} onSuccess={() => { refetchInstances(); setShowAddDialog(false); }} />
      )}
    </div>
  );
}

// ========== 수동스킬 섹션 ==========
interface ManualSkillItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  isBuiltin: boolean;
  component?: React.ReactNode;
}

function ManualSkillsSection() {
  const { toast } = useToast();
  const { isAdmin, userId } = useAuth();
  // 계정별 고유 키 (admin → "admin", 일반유저 → userId)
  const accountKey = isAdmin ? "admin" : (userId ? String(userId) : "guest");
  const storageKey = `manual-custom-skills-${accountKey}`;

  const builtinSkills: ManualSkillItem[] = [
    {
      id: "gap-strategy",
      name: "시가급등 추세추종",
      icon: "🚀",
      description: "장 시작 시 갭 상승 종목을 감지하고 추세를 추종하여 분할매수/매도",
      isBuiltin: true,
    },
    {
      id: "multi-factor",
      name: "멀티팩터 전략",
      icon: "🧠",
      description: "MA·RSI·볼린저·거래량·갭 5개 팩터 종합점수로 자동매매",
      isBuiltin: true,
    },
  ];

  const defaultActiveSkill = builtinSkills.length > 0 ? "gap-strategy" : "";
  const [activeSkill, setActiveSkill] = useState<string>(defaultActiveSkill);
  const [showAddManual, setShowAddManual] = useState(false);
  const [customSkills, setCustomSkills] = useState<ManualSkillItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillIcon, setNewSkillIcon] = useState("🎯");
  const [newSkillDesc, setNewSkillDesc] = useState("");

  // 계정 전환 시 스킬 목록 다시 로드
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const loaded = saved ? JSON.parse(saved) : [];
      setCustomSkills(loaded);
      setActiveSkill("gap-strategy");
    } catch { setCustomSkills([]); }
  }, [storageKey, isAdmin]);

  const allSkills = [...builtinSkills, ...customSkills];

  const saveCustomSkills = (skills: ManualSkillItem[]) => {
    setCustomSkills(skills);
    localStorage.setItem(storageKey, JSON.stringify(skills));
  };

  const handleAddSkill = () => {
    if (!newSkillName.trim()) {
      toast({ title: "스킬 이름을 입력하세요", variant: "destructive" });
      return;
    }
    const newSkill: ManualSkillItem = {
      id: `custom-${Date.now()}`,
      name: newSkillName.trim(),
      icon: newSkillIcon || "🎯",
      description: newSkillDesc.trim() || "사용자 정의 수동 스킬",
      isBuiltin: false,
    };
    saveCustomSkills([...customSkills, newSkill]);
    setNewSkillName("");
    setNewSkillIcon("🎯");
    setNewSkillDesc("");
    setShowAddManual(false);
    toast({ title: "수동 스킬 등록 완료", description: `${newSkill.icon} ${newSkill.name}` });
  };

  const handleDeleteSkill = (id: string) => {
    if (!confirm("이 수동 스킬을 삭제하시겠습니까?")) return;
    saveCustomSkills(customSkills.filter(s => s.id !== id));
    // 스킬 관련 메모/조건 데이터도 정리
    try {
      localStorage.removeItem(`manual-skill-memo-${accountKey}-${id}`);
      localStorage.removeItem(`manual-skill-conditions-${accountKey}-${id}`);
    } catch { /* empty */ }
    if (activeSkill === id) setActiveSkill("gap-strategy");
    toast({ title: "수동 스킬 삭제 완료" });
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Rocket className="w-5 h-5 text-orange-500" />
                수동스킬
              </CardTitle>
              <CardDescription className="mt-1">
                사용자가 직접 설정하고 수동으로 실행하는 전략 스킬셋입니다
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAddManual(true)} className="text-xs gap-1">
              <Plus className="w-3 h-3" />
              스킬 추가
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* 스킬 목록 (탭처럼) */}
      <div className="flex gap-2 flex-wrap">
        {allSkills.map(skill => (
          <div key={skill.id} className="relative group">
            <Button
              variant={activeSkill === skill.id ? "default" : "outline"}
              size="sm"
              className="text-xs gap-1.5 pr-2"
              onClick={() => setActiveSkill(skill.id)}
            >
              <span>{skill.icon}</span>
              {skill.name}
            </Button>
            {!skill.isBuiltin && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteSkill(skill.id); }}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="삭제"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 선택된 스킬 콘텐츠 */}
      {activeSkill === "gap-strategy" ? (
        <GapStrategyPanel />
      ) : activeSkill === "multi-factor" ? (
        <MultiFactorPanel />
      ) : activeSkill ? (
        <CustomSkillContent
          skill={allSkills.find(s => s.id === activeSkill)}
          accountKey={accountKey}
        />
      ) : allSkills.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="text-sm">등록된 수동 스킬이 없습니다.</p>
            <p className="text-xs mt-1">상단의 "스킬 추가" 버튼으로 나만의 매매 전략을 등록하세요.</p>
          </CardContent>
        </Card>
      ) : null}

      {/* 수동 스킬 추가 다이얼로그 */}
      <Dialog open={showAddManual} onOpenChange={setShowAddManual}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              수동 스킬 등록
            </DialogTitle>
            <DialogDescription className="text-xs">
              새로운 수동 매매 전략을 등록하세요. 등록 후 설정 및 메모를 관리할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="space-y-1.5 w-20">
                <Label className="text-xs">아이콘</Label>
                <Input value={newSkillIcon} onChange={(e) => setNewSkillIcon(e.target.value)} className="text-center text-lg h-9" maxLength={2} />
              </div>
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs">스킬 이름 <span className="text-red-500">*</span></Label>
                <Input value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} placeholder="예: 눌림목 매수, 돌파 매매" className="text-sm h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">설명</Label>
              <Input value={newSkillDesc} onChange={(e) => setNewSkillDesc(e.target.value)} placeholder="전략 설명 (선택사항)" className="text-sm h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddManual(false)} className="text-xs">취소</Button>
            <Button onClick={handleAddSkill} className="text-xs gap-1">
              <Plus className="w-3 h-3" />
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 사용자 정의 수동 스킬 콘텐츠
function CustomSkillContent({ skill, accountKey }: { skill?: ManualSkillItem; accountKey: string }) {
  const memoKey = skill ? `manual-skill-memo-${accountKey}-${skill.id}` : "";
  const condKey = skill ? `manual-skill-conditions-${accountKey}-${skill.id}` : "";

  const [memo, setMemo] = useState(() => {
    if (!skill) return "";
    try {
      return localStorage.getItem(memoKey) || "";
    } catch { return ""; }
  });
  const [conditions, setConditions] = useState<string[]>(() => {
    if (!skill) return [];
    try {
      const saved = localStorage.getItem(condKey);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [newCondition, setNewCondition] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!skill) return;
    try {
      setMemo(localStorage.getItem(memoKey) || "");
      const saved = localStorage.getItem(condKey);
      setConditions(saved ? JSON.parse(saved) : []);
    } catch { /* empty */ }
  }, [skill?.id, memoKey, condKey]);

  if (!skill) return null;

  const saveMemo = (text: string) => {
    setMemo(text);
    localStorage.setItem(memoKey, text);
  };

  const saveConditions = (list: string[]) => {
    setConditions(list);
    localStorage.setItem(condKey, JSON.stringify(list));
  };

  const addCondition = () => {
    if (!newCondition.trim()) return;
    saveConditions([...conditions, newCondition.trim()]);
    setNewCondition("");
  };

  const removeCondition = (idx: number) => {
    saveConditions(conditions.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="text-xl">{skill.icon}</span>
            {skill.name}
          </CardTitle>
          <CardDescription className="text-xs">{skill.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 매매 조건 체크리스트 */}
          <div className="space-y-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              매매 조건 체크리스트
            </Label>
            {conditions.length > 0 ? (
              <div className="space-y-1.5">
                {conditions.map((cond, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                    <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                    <span className="text-sm flex-1">{cond}</span>
                    <button onClick={() => removeCondition(idx)} className="text-red-400 hover:text-red-600 text-xs shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-2">등록된 조건이 없습니다</p>
            )}
            <div className="flex gap-2">
              <Input
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCondition(); }}
                placeholder="매매 조건 입력 (Enter로 추가)"
                className="text-sm h-8 flex-1"
              />
              <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={addCondition}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* 전략 메모 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              전략 메모
            </Label>
            <Textarea
              value={memo}
              onChange={(e) => saveMemo(e.target.value)}
              placeholder="전략 운영 메모, 진입/퇴출 조건, 주의사항 등을 자유롭게 기록하세요..."
              className="text-sm min-h-[120px] resize-y"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AddSkillDialog({ skills, open, onClose, onSuccess }: {
  skills: TradingSkillDef[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"select" | "configure">("select");
  const [selectedSkill, setSelectedSkill] = useState<TradingSkillDef | null>(null);
  const [filterCat, setFilterCat] = useState("all");
  const [label, setLabel] = useState("");
  const [stockCode, setStockCode] = useState("");
  const [stockName, setStockName] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [orderMethod, setOrderMethod] = useState("limit");
  const [skillParams, setSkillParams] = useState<Record<string, any>>({});
  const [stockSearch, setStockSearch] = useState("");

  const filteredSkills = filterCat === "all" ? skills.filter(s => s.isEnabled) : skills.filter(s => s.isEnabled && s.category === filterCat);

  const filteredStocks = stockSearch.trim()
    ? POPULAR_STOCKS.filter(s => s.name.includes(stockSearch) || s.code.includes(stockSearch)).slice(0, 8)
    : [];

  const selectSkill = (skill: TradingSkillDef) => {
    setSelectedSkill(skill);
    setSkillParams(skill.defaultParams ? JSON.parse(skill.defaultParams) : {});
    setStep("configure");
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/trading/skill-instances", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "스킬 등록 완료", description: data.message });
      onSuccess();
    },
    onError: (e: Error) => {
      toast({ title: "등록 실패", description: e.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!selectedSkill) return;
    mutation.mutate({
      skillId: selectedSkill.id,
      label: label || `${selectedSkill.name} - ${stockName || "전체"}`,
      stockCode: stockCode || undefined,
      stockName: stockName || undefined,
      quantity,
      orderMethod,
      params: skillParams,
      priority: 0,
    });
  };

  const paramsSchema: Array<{ key: string; label: string; type: string; default?: any; required?: boolean; unit?: string }> = selectedSkill?.paramsSchema ? JSON.parse(selectedSkill.paramsSchema) : [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            {step === "select" ? "스킬 선택" : `${selectedSkill?.icon} ${selectedSkill?.name} 설정`}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === "select" ? "등록할 매매 스킬을 선택하세요" : "스킬 파라미터와 적용 종목을 설정하세요"}
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <div className="space-y-3">
            <div className="flex gap-1.5">
              <Button variant={filterCat === "all" ? "default" : "outline"} size="sm" className="text-[11px] h-7" onClick={() => setFilterCat("all")}>전체</Button>
              <Button variant={filterCat === "entry" ? "default" : "outline"} size="sm" className="text-[11px] h-7" onClick={() => setFilterCat("entry")}>🟢 매수</Button>
              <Button variant={filterCat === "exit" ? "default" : "outline"} size="sm" className="text-[11px] h-7" onClick={() => setFilterCat("exit")}>🔴 매도</Button>
              <Button variant={filterCat === "risk" ? "default" : "outline"} size="sm" className="text-[11px] h-7" onClick={() => setFilterCat("risk")}>🛡️ 리스크</Button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
              {filteredSkills.map(skill => {
                const cat = CATEGORY_LABELS[skill.category];
                return (
                  <button key={skill.id} onClick={() => selectSkill(skill)}
                    className="text-left p-3 border rounded-lg hover:border-primary hover:bg-muted/30 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{skill.icon}</span>
                      <span className="font-medium text-sm">{skill.name}</span>
                    </div>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${cat?.color?.split(" ")[0] || ""}`}>{cat?.label || skill.category}</Badge>
                    <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{skill.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" className="text-xs gap-1 -ml-2" onClick={() => setStep("select")}>
              <ArrowLeft className="w-3 h-3" /> 스킬 다시 선택
            </Button>

            {selectedSkill?.category !== "risk" && (
              <div className="space-y-1.5">
                <Label className="text-xs">종목 <span className="text-red-500">*</span></Label>
                <Input value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} placeholder="종목명 또는 종목코드 검색..." className="text-sm h-9" />
                {filteredStocks.length > 0 && (
                  <div className="border rounded-md max-h-36 overflow-y-auto">
                    {filteredStocks.map(s => (
                      <button key={s.code} onClick={() => { setStockCode(s.code); setStockName(s.name); setStockSearch(`${s.name} (${s.code})`); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 flex justify-between"
                      >
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground">{s.code} · {s.market}</span>
                      </button>
                    ))}
                  </div>
                )}
                {stockCode && <p className="text-[11px] text-green-600">✓ {stockName} ({stockCode}) 선택됨</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">별칭</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`예: ${selectedSkill?.name} - ${stockName || "삼성전자"}`} className="text-sm h-9" />
            </div>

            {paramsSchema.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">파라미터 설정</Label>
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  {paramsSchema.map(p => (
                    <div key={p.key} className="flex items-center gap-2">
                      <Label className="text-xs w-28 shrink-0">{p.label} {p.required && <span className="text-red-500">*</span>}</Label>
                      <Input
                        type="number"
                        value={skillParams[p.key] ?? p.default ?? ""}
                        onChange={(e) => setSkillParams({ ...skillParams, [p.key]: parseFloat(e.target.value) || 0 })}
                        className="text-sm h-8 font-mono"
                      />
                      {p.unit && <span className="text-xs text-muted-foreground shrink-0">{p.unit}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedSkill?.category !== "risk" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">주문 수량 (주)</Label>
                  <Input type="number" value={quantity || ""} onChange={(e) => setQuantity(parseInt(e.target.value) || 0)} placeholder="0" className="text-sm h-9 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">주문 방식</Label>
                  <Select value={orderMethod} onValueChange={setOrderMethod}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="limit">지정가</SelectItem>
                      <SelectItem value="market">시장가</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="text-[11px] text-blue-600 dark:text-blue-400 space-y-0.5">
                <p>스킬은 "조건 체크" 시에만 실행됩니다.</p>
                <p>조건 발동 후 "실행" 버튼을 눌러야 실제 주문이 진행됩니다.</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} className="text-xs">취소</Button>
              <Button onClick={handleSubmit} disabled={mutation.isPending} className="text-xs gap-1">
                {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                스킬 등록
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

