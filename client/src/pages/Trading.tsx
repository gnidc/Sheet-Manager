import React, { useState, useMemo } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";


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
  ArrowUpRight, ArrowDownRight, Zap, Clock, Settings, ShieldCheck, ShieldAlert,
} from "lucide-react";

// ========== Types ==========
interface TradingStatus {
  configured: boolean;
  tradingConfigured: boolean;
  mockTrading: boolean;
  accountNo: string;
  accountProductCd: string;
  needsSetup?: boolean; // 일반 유저가 인증정보 미등록 시
}

interface TradingConfig {
  configured: boolean;
  isAdmin?: boolean;
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
                <h1 className="text-xl font-bold text-foreground tracking-tight">KIS 자동매매</h1>
                <p className="text-xs text-muted-foreground">한국투자증권 API 자동매매 시스템</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* 설정 버튼 (일반 유저가 이미 설정한 경우 설정 관리) */}
              {!isAdmin && tradingConfig?.configured && (
                <UserConfigManageButton config={tradingConfig} onConfigChanged={() => { refetchConfig(); refetchStatus(); }} />
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
          <Tabs defaultValue="account" className="space-y-8">
            <TabsList className="grid w-full grid-cols-4 max-w-2xl mx-auto">
              <TabsTrigger value="account" className="gap-2">
                <Wallet className="h-4 w-4" />
                계좌
              </TabsTrigger>
              <TabsTrigger value="order" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                주문
              </TabsTrigger>
              <TabsTrigger value="auto" className="gap-2">
                <Zap className="h-4 w-4" />
                자동매매
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <Clock className="h-4 w-4" />
                주문내역
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account">
              <AccountSection />
            </TabsContent>
            <TabsContent value="order">
              <OrderSection />
            </TabsContent>
            <TabsContent value="auto">
              <AutoTradeSection />
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
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          KIS API 설정 필요 (관리자)
        </CardTitle>
        <CardDescription>
          관리자 계정은 서버 환경 변수로 KIS API를 설정합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-sm">필수 환경 변수:</h4>
          <div className="space-y-2 text-sm font-mono">
            <div className="flex items-center gap-2">
              {status?.configured ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span>KIS_APP_KEY</span>
              <span className="text-muted-foreground">- 앱 키</span>
            </div>
            <div className="flex items-center gap-2">
              {status?.configured ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
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
      </CardContent>
    </Card>
  );
}

// ========== User Setup Guide (폼 입력 기반) ==========
function UserSetupGuide({ onComplete }: { onComplete: () => void }) {
  const { toast } = useToast();
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [accountProductCd, setAccountProductCd] = useState("01");
  const [mockTrading, setMockTrading] = useState(true);
  const [showSecret, setShowSecret] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/trading/config", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "설정 완료", description: data.message || "KIS API 인증 정보가 등록되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/config"] });
      onComplete();
    },
    onError: (error: Error) => {
      toast({ title: "설정 실패", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appKey || !appSecret || !accountNo) {
      toast({ title: "입력 오류", description: "필수 항목을 모두 입력하세요", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ appKey, appSecret, accountNo, accountProductCd, mockTrading });
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          KIS API 인증 정보 등록
        </CardTitle>
        <CardDescription>
          자동매매를 이용하려면 한국투자증권 API 인증 정보를 등록하세요.
          <br />
          등록 시 서버에서 실제 토큰 발급을 시도하여 유효성을 검증합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* App Key */}
          <div className="space-y-2">
            <Label htmlFor="user-app-key" className="text-sm font-medium">
              앱 키 (App Key) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="user-app-key"
              value={appKey}
              onChange={(e) => setAppKey(e.target.value)}
              placeholder="PSxxxxxxxxxxxxxxx"
              className="font-mono text-sm"
            />
          </div>

          {/* App Secret */}
          <div className="space-y-2">
            <Label htmlFor="user-app-secret" className="text-sm font-medium">
              앱 시크릿 (App Secret) <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="user-app-secret"
                type={showSecret ? "text" : "password"}
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder="앱 시크릿 입력"
                className="font-mono text-sm pr-20"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? "숨기기" : "보기"}
              </Button>
            </div>
          </div>

          {/* Account No */}
          <div className="space-y-2">
            <Label htmlFor="user-account-no" className="text-sm font-medium">
              계좌번호 (앞 8자리) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="user-account-no"
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="12345678"
              maxLength={8}
              className="font-mono text-sm"
            />
          </div>

          {/* Account Product Cd */}
          <div className="space-y-2">
            <Label htmlFor="user-product-cd" className="text-sm font-medium">
              계좌상품코드 (뒤 2자리)
            </Label>
            <Input
              id="user-product-cd"
              value={accountProductCd}
              onChange={(e) => setAccountProductCd(e.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="01"
              maxLength={2}
              className="font-mono text-sm w-24"
            />
          </div>

          {/* Mock Trading Toggle */}
          <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
            <div>
              <Label htmlFor="user-mock-trading" className="text-sm font-medium cursor-pointer">
                모의투자 모드
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                처음 사용 시 반드시 모의투자로 테스트하세요
              </p>
            </div>
            <Switch
              id="user-mock-trading"
              checked={mockTrading}
              onCheckedChange={setMockTrading}
            />
          </div>

          {/* Warning */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-700 dark:text-amber-400">주의사항</p>
                <ul className="text-amber-600 dark:text-amber-500 mt-1 space-y-1 list-disc pl-4">
                  <li>실전투자 모드에서는 <strong>실제 주문이 체결</strong>됩니다.</li>
                  <li>인증 정보는 암호화되어 서버에 저장됩니다.</li>
                  <li>한국투자증권 개발자센터에서 API 키를 발급받으세요.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                인증 검증 중...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 mr-2" />
                인증 정보 등록 및 검증
              </>
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <a href="https://apiportal.koreainvestment.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              한국투자증권 개발자센터 →
            </a>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ========== User Config Manage Button (설정 관리) ==========
function UserConfigManageButton({ config, onConfigChanged }: { config: TradingConfig; onConfigChanged: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/trading/config");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "설정 삭제", description: "KIS API 인증 정보가 삭제되었습니다" });
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
            KIS API 설정 관리
          </DialogTitle>
          <DialogDescription>
            현재 등록된 인증 정보를 확인하거나 삭제할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">앱 키</span>
              <span className="font-mono">{config.appKey}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">계좌번호</span>
              <span className="font-mono">{config.accountNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">상품코드</span>
              <span className="font-mono">{config.accountProductCd}</span>
            </div>
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

// ========== Account Section ==========
function AccountSection() {
  const { data: balance, isLoading, error, refetch } = useQuery<AccountBalance>({
    queryKey: ["/api/trading/balance"],
    retry: false,
  });

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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balance.holdings.map((item) => (
                        <TableRow key={item.stockCode}>
                          <TableCell className="font-mono text-sm">{item.stockCode}</TableCell>
                          <TableCell className="font-medium">{item.stockName}</TableCell>
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

// ========== Order Section ==========
function OrderSection() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStock, setSelectedStock] = useState<{ code: string; name: string } | null>(null);
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
  const [orderMethod, setOrderMethod] = useState<"limit" | "market">("limit");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [codeSearching, setCodeSearching] = useState(false);

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

  // 현재가로부터 종목명 업데이트 + 주문가격 기본값 설정
  React.useEffect(() => {
    if (priceData?.stockName && selectedStock && !selectedStock.name) {
      setSelectedStock(prev => prev ? { ...prev, name: priceData.stockName } : prev);
      setSearchTerm(priceData.stockName);
    }
    if (priceData?.price && !price) {
      setPrice(priceData.price);
    }
  }, [priceData?.stockName, priceData?.price]);

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
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "주문 성공", description: `${selectedStock!.name || selectedStock!.code} ${orderType === "buy" ? "매수" : "매도"} 주문이 체결되었습니다.` });
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
                            KIS API에서 실시간 조회합니다 (Enter 키)
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

