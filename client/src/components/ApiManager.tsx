import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Key, Zap, Bot, User, Plus, Trash2, CheckCircle2, Circle, Pencil, Shield, Loader2, ExternalLink, AlertTriangle, RefreshCw, BookOpen, Eye, EyeOff,
} from "lucide-react";

// ========== Interfaces ==========
interface TradingConfigItem {
  id: number;
  broker: string; // "kis" | "kiwoom"
  label: string;
  appKey: string;
  accountNo: string;
  accountProductCd: string;
  mockTrading: boolean;
  isActive: boolean;
  isSystem?: boolean; // env 기반 시스템 기본 API (Admin 전용)
  createdAt: string;
  updatedAt: string;
}

interface AiConfigItem {
  id: number;
  label: string;
  aiProvider: string;
  hasGeminiKey: boolean;
  hasOpenaiKey: boolean;
  hasGroqKey: boolean;
  geminiApiKey: string | null;
  openaiApiKey: string | null;
  groqApiKey: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LinkedAccount {
  id: number;
  user: { id: number; email: string; name: string; picture: string | null };
  linkedAt: string;
}

interface CurrentAccount {
  id: number;
  email: string;
  name: string;
  picture: string | null;
  createdAt: string;
}

// ========== Main Component ==========
export default function ApiManager() {
  const { isAdmin, isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState("trading");

  if (!isLoggedIn) {
    return (
      <Card className="max-w-2xl mx-auto mt-8">
        <CardContent className="py-12 text-center">
          <Key className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">로그인 후 API 관리 기능을 이용할 수 있습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Key className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">API 관리센터</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="trading" className="gap-1.5 text-xs">
            <Zap className="h-3.5 w-3.5" />
            자동매매 API
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5 text-xs">
            <Bot className="h-3.5 w-3.5" />
            AI API
          </TabsTrigger>
          <TabsTrigger value="notion" className="gap-1.5 text-xs">
            <BookOpen className="h-3.5 w-3.5" />
            Notion API
          </TabsTrigger>
          <TabsTrigger value="google" className="gap-1.5 text-xs">
            <User className="h-3.5 w-3.5" />
            Google 계정
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trading">
          <TradingApiSection />
        </TabsContent>
        <TabsContent value="ai">
          <AiApiSection />
        </TabsContent>
        <TabsContent value="notion">
          <NotionApiSection />
        </TabsContent>
        <TabsContent value="google">
          <GoogleAccountSection />
        </TabsContent>
      </Tabs>

      {isAdmin && (
        <AdminApiOverview />
      )}
    </div>
  );
}

// ========== Trading API Section ==========
function TradingApiSection() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<TradingConfigItem | null>(null);

  const { data: configs = [], isLoading } = useQuery<TradingConfigItem[]>({
    queryKey: ["/api/trading/configs"],
  });

  const activateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/trading/configs/${id}/activate`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ 전환 완료", description: "활성 API가 변경되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/status"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/trading/configs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "🗑️ 삭제 완료", description: "API 설정이 삭제되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/status"] });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              자동매매 API
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              한국투자증권(KIS) / 키움증권 API를 최대 5개까지 등록하고 전환할 수 있습니다
            </CardDescription>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-300 text-amber-600">
                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                동시에 1개 API만 활성 가능
              </Badge>
              {configs.filter(c => c.isActive).length > 0 && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                  현재 활성: {configs.find(c => c.isActive)?.label || "시스템"}
                  ({configs.find(c => c.isActive)?.broker === "kiwoom" ? "키움" : "KIS"})
                </Badge>
              )}
            </div>
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1 text-xs" disabled={configs.length >= 5}>
            <Plus className="w-3 h-3" /> 추가
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
            등록된 자동매매 API가 없습니다
            <br />
            <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => setShowAdd(true)}>
              <Plus className="w-3 h-3 mr-1" /> 첫 번째 API 등록하기
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {configs.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  c.isActive
                    ? c.isSystem
                      ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/20"
                      : "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20"
                    : "border-border"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {c.isActive ? (
                    <CheckCircle2 className={`w-4 h-4 shrink-0 ${c.isSystem ? "text-emerald-500" : "text-amber-500"}`} />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{c.label}</span>
                      {c.isActive && (
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${c.isSystem ? "border-emerald-400 text-emerald-600" : "border-amber-400 text-amber-600"}`}>
                          활성
                        </Badge>
                      )}
                      {c.isSystem && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-400 text-emerald-600">
                          <Shield className="w-2.5 h-2.5 mr-0.5" />시스템
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[9px] px-1 py-0">
                        {c.broker === "kiwoom" ? "키움" : "KIS"}
                      </Badge>
                      <Badge variant={c.mockTrading ? "secondary" : "destructive"} className="text-[9px] px-1 py-0">
                        {c.mockTrading ? "모의" : "실전"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      {c.appKey} · {c.accountNo}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!c.isActive && (
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] text-amber-600" onClick={() => activateMutation.mutate(c.id)} disabled={activateMutation.isPending}>
                      <RefreshCw className="w-3 h-3 mr-0.5" />활성화
                    </Button>
                  )}
                  {!c.isSystem && (
                    <>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditTarget(c)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => { if (confirm("이 API 설정을 삭제하시겠습니까?")) deleteMutation.mutate(c.id); }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* 추가 다이얼로그 */}
      <TradingConfigDialog open={showAdd} onClose={() => setShowAdd(false)} />
      {/* 수정 다이얼로그 */}
      {editTarget && (
        <TradingConfigDialog open={!!editTarget} onClose={() => setEditTarget(null)} editConfig={editTarget} />
      )}
    </Card>
  );
}

// ========== Trading Config Dialog ==========
function TradingConfigDialog({ open, onClose, editConfig }: { open: boolean; onClose: () => void; editConfig?: TradingConfigItem }) {
  const { toast } = useToast();
  const [broker, setBroker] = useState(editConfig?.broker || "kis");
  const [label, setLabel] = useState(editConfig?.label || "");
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [accountProductCd, setAccountProductCd] = useState(editConfig?.accountProductCd || "01");
  const [mockTrading, setMockTrading] = useState(editConfig?.mockTrading ?? true);
  const [showSecret, setShowSecret] = useState(false);

  const isEdit = !!editConfig;

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit) {
        const res = await apiRequest("PUT", `/api/trading/configs/${editConfig.id}`, data);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/trading/configs", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: isEdit ? "수정 완료" : "등록 완료", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/status"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "실패", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = { broker, label: label || "기본", mockTrading };
    if (broker === "kis") data.accountProductCd = accountProductCd;
    if (!isEdit && (!appKey || !appSecret || !accountNo)) {
      toast({ title: "입력 오류", description: "앱 키, 앱 시크릿, 계좌번호는 필수입니다", variant: "destructive" });
      return;
    }
    if (appKey) data.appKey = appKey;
    if (appSecret) data.appSecret = appSecret;
    if (accountNo) data.accountNo = accountNo;
    mutation.mutate(data);
  };

  const brokerLabel = broker === "kiwoom" ? "키움증권" : "한국투자증권(KIS)";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Zap className="w-4 h-4 text-amber-500" />
            {isEdit ? `${brokerLabel} API 수정` : "자동매매 API 등록"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEdit ? "변경할 항목만 입력하세요. 빈 필드는 기존 값이 유지됩니다." : "증권사를 선택하고 API 인증 정보를 입력하세요."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs">증권사 선택</Label>
              <div className="flex gap-2">
                <Button type="button" variant={broker === "kis" ? "default" : "outline"} size="sm" className="flex-1 text-xs h-9" onClick={() => setBroker("kis")}>
                  🏦 한국투자증권 (KIS)
                </Button>
                <Button type="button" variant={broker === "kiwoom" ? "default" : "outline"} size="sm" className="flex-1 text-xs h-9" onClick={() => { setBroker("kiwoom"); setMockTrading(true); }}>
                  🏦 키움증권 (REST)
                </Button>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">별칭</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`예: ${brokerLabel} 모의투자`} className="text-sm h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">앱 키 (App Key) {!isEdit && <span className="text-red-500">*</span>}</Label>
            <Input value={appKey} onChange={(e) => setAppKey(e.target.value)} placeholder={isEdit ? "변경 시 입력" : (broker === "kiwoom" ? "키움 앱 키" : "PSxxxxxxx...")} className="font-mono text-sm h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{broker === "kiwoom" ? "시크릿 키 (Secret Key)" : "앱 시크릿 (App Secret)"} {!isEdit && <span className="text-red-500">*</span>}</Label>
            <div className="relative">
              <Input type={showSecret ? "text" : "password"} value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder={isEdit ? "변경 시 입력" : (broker === "kiwoom" ? "시크릿 키" : "앱 시크릿")} className="font-mono text-sm h-9 pr-16" />
              <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 text-[10px]" onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? "숨기기" : "보기"}
              </Button>
            </div>
          </div>
          {broker === "kis" ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">계좌번호 (앞 8자리) {!isEdit && <span className="text-red-500">*</span>}</Label>
                <Input value={accountNo} onChange={(e) => setAccountNo(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder={isEdit ? "변경 시 입력" : "12345678"} maxLength={8} className="font-mono text-sm h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">상품코드</Label>
                <Input value={accountProductCd} onChange={(e) => setAccountProductCd(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="01" maxLength={2} className="font-mono text-sm h-9" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">계좌번호 {!isEdit && <span className="text-red-500">*</span>}</Label>
              <Input value={accountNo} onChange={(e) => setAccountNo(e.target.value.replace(/[^0-9-]/g, ""))} placeholder={isEdit ? "변경 시 입력" : "키움 계좌번호"} className="font-mono text-sm h-9" />
            </div>
          )}
          <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
            <div>
              <Label className="text-xs font-medium cursor-pointer">모의투자 모드</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {broker === "kiwoom" ? "키움증권은 현재 모의투자만 지원됩니다" : "처음 사용 시 모의투자로 테스트하세요"}
              </p>
            </div>
            <Switch checked={mockTrading} onCheckedChange={setMockTrading} disabled={broker === "kiwoom"} />
          </div>
          {broker === "kiwoom" && (
            <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="text-[11px] text-blue-600 dark:text-blue-400 space-y-1">
                <p><strong>키움증권 REST API 안내</strong></p>
                <p>• 현재 <strong>모의투자 전용</strong>으로만 등록 가능합니다</p>
                <p>• 실전투자 연동은 추후 업데이트 예정입니다</p>
                <p>• 모의투자 도메인: mockapi.kiwoom.com</p>
              </div>
            </div>
          )}
          {!mockTrading && broker !== "kiwoom" && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-600 dark:text-red-400">실전투자 모드에서는 <strong>실제 주문이 체결</strong>됩니다.</p>
            </div>
          )}
          <div className="text-center text-[11px] text-muted-foreground">
            {broker === "kis" ? (
              <a href="https://apiportal.koreainvestment.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                한국투자증권 API 포탈 <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ) : (
              <a href="https://openapi.kiwoom.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                키움증권 오픈API <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">취소</Button>
            <Button type="submit" disabled={mutation.isPending} className="text-xs gap-1">
              {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
              {isEdit ? "수정" : "등록 및 검증"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ========== AI API Section ==========
function AiApiSection() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<AiConfigItem | null>(null);

  const { data: configs = [], isLoading } = useQuery<AiConfigItem[]>({
    queryKey: ["/api/user/ai-configs"],
  });

  const activateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/user/ai-configs/${id}/activate`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ 전환 완료", description: "활성 AI API가 변경되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/ai-configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/ai-config"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/user/ai-configs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "🗑️ 삭제 완료" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/ai-configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/ai-config"] });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-500" />
              AI API
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Gemini/OpenAI API를 최대 3개까지 등록하고 전환할 수 있습니다
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1 text-xs" disabled={configs.length >= 3}>
            <Plus className="w-3 h-3" /> 추가
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
            등록된 AI API가 없습니다
            <br />
            <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => setShowAdd(true)}>
              <Plus className="w-3 h-3 mr-1" /> 첫 번째 AI API 등록하기
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {configs.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  c.isActive ? "border-purple-300 bg-purple-50/50 dark:border-purple-700 dark:bg-purple-950/20" : "border-border"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {c.isActive ? (
                    <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{c.label}</span>
                      {c.isActive && <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-400 text-purple-600">활성</Badge>}
                      <Badge variant="secondary" className="text-[9px] px-1 py-0">
                        {c.aiProvider === "openai" ? "OpenAI" : c.aiProvider === "groq" ? "Groq" : "Gemini"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {c.hasGeminiKey && <span className="mr-2">Gemini ✓</span>}
                      {c.hasOpenaiKey && <span className="mr-2">OpenAI ✓</span>}
                      {c.hasGroqKey && <span className="mr-2">Groq ✓</span>}
                      {!c.hasGeminiKey && !c.hasOpenaiKey && !c.hasGroqKey && "키 미등록"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!c.isActive && (
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] text-purple-600" onClick={() => activateMutation.mutate(c.id)} disabled={activateMutation.isPending}>
                      <RefreshCw className="w-3 h-3 mr-0.5" />활성화
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditTarget(c)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => { if (confirm("이 AI API 설정을 삭제하시겠습니까?")) deleteMutation.mutate(c.id); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AiConfigDialog open={showAdd} onClose={() => setShowAdd(false)} />
      {editTarget && <AiConfigDialog open={!!editTarget} onClose={() => setEditTarget(null)} editConfig={editTarget} />}
    </Card>
  );
}

// ========== AI Config Dialog ==========
function AiConfigDialog({ open, onClose, editConfig }: { open: boolean; onClose: () => void; editConfig?: AiConfigItem }) {
  const { toast } = useToast();
  const [label, setLabel] = useState(editConfig?.label || "");
  const [aiProvider, setAiProvider] = useState(editConfig?.aiProvider || "gemini");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");

  const isEdit = !!editConfig;

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit) {
        const res = await apiRequest("PUT", `/api/user/ai-configs/${editConfig.id}`, data);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/user/ai-configs", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: isEdit ? "수정 완료" : "등록 완료", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/user/ai-configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/ai-config"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "실패", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEdit && !geminiApiKey && !openaiApiKey && !groqApiKey) {
      toast({ title: "입력 오류", description: "Gemini, OpenAI 또는 Groq API 키를 하나 이상 입력하세요", variant: "destructive" });
      return;
    }
    const data: any = { label: label || "기본", aiProvider };
    if (geminiApiKey) data.geminiApiKey = geminiApiKey;
    if (openaiApiKey) data.openaiApiKey = openaiApiKey;
    if (groqApiKey) data.groqApiKey = groqApiKey;
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bot className="w-4 h-4 text-purple-500" />
            {isEdit ? "AI API 수정" : "AI API 등록"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEdit ? "변경할 항목만 입력하세요." : "Gemini 또는 OpenAI API 키를 등록하세요."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">별칭</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="예: Gemini용, OpenAI용" className="text-sm h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">기본 AI 제공자</Label>
            <div className="flex gap-2">
              <Button type="button" variant={aiProvider === "gemini" ? "default" : "outline"} size="sm" className="flex-1 text-xs h-8" onClick={() => setAiProvider("gemini")}>
                Gemini
              </Button>
              <Button type="button" variant={aiProvider === "openai" ? "default" : "outline"} size="sm" className="flex-1 text-xs h-8" onClick={() => setAiProvider("openai")}>
                OpenAI
              </Button>
              <Button type="button" variant={aiProvider === "groq" ? "default" : "outline"} size="sm" className="flex-1 text-xs h-8" onClick={() => setAiProvider("groq")}>
                Groq
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Gemini API 키</Label>
            <Input value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)} placeholder={isEdit && editConfig?.hasGeminiKey ? "등록됨 (변경 시 입력)" : "AIzaSy..."} className="font-mono text-sm h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">OpenAI API 키</Label>
            <Input value={openaiApiKey} onChange={(e) => setOpenaiApiKey(e.target.value)} placeholder={isEdit && editConfig?.hasOpenaiKey ? "등록됨 (변경 시 입력)" : "sk-proj-..."} className="font-mono text-sm h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Groq API 키</Label>
            <Input value={groqApiKey} onChange={(e) => setGroqApiKey(e.target.value)} placeholder={isEdit && editConfig?.hasGroqKey ? "등록됨 (변경 시 입력)" : "gsk_..."} className="font-mono text-sm h-9" />
          </div>
          <div className="text-center text-[11px] text-muted-foreground">
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
              Gemini <ExternalLink className="w-2.5 h-2.5" />
            </a>
            {" · "}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
              OpenAI <ExternalLink className="w-2.5 h-2.5" />
            </a>
            {" · "}
            <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
              Groq <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">취소</Button>
            <Button type="submit" disabled={mutation.isPending} className="text-xs gap-1">
              {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}
              {isEdit ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ========== Google Account Section ==========
function GoogleAccountSection() {
  const { toast } = useToast();
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const { data, isLoading } = useQuery<{ currentAccount: CurrentAccount | null; linkedAccounts: LinkedAccount[] }>({
    queryKey: ["/api/user/linked-accounts"],
  });

  const unlinkMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/user/linked-accounts/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "연결 해제", description: "계정 연결이 해제되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/linked-accounts"] });
    },
  });

  const linkMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/user/link-account", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ 연결 완료", description: "계정이 연결되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/linked-accounts"] });
    },
    onError: (error: Error) => {
      toast({ title: "연결 실패", description: error.message, variant: "destructive" });
    },
  });

  const handleLinkGoogle = () => {
    if (!GOOGLE_CLIENT_ID) {
      toast({ title: "오류", description: "Google OAuth가 설정되지 않았습니다", variant: "destructive" });
      return;
    }
    const redirectUri = `${window.location.origin}/oauth-callback.html`;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=email%20profile&prompt=select_account`;

    const popup = window.open(authUrl, "google-link", "width=500,height=600");
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "google_oauth_result" && e.newValue) {
        window.removeEventListener("storage", handleStorage);
        try {
          const result = JSON.parse(e.newValue);
          localStorage.removeItem("google_oauth_result");
          if (result.accessToken) {
            // 서버에서 userinfo 가져와서 연결
            fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
              headers: { Authorization: `Bearer ${result.accessToken}` },
            })
              .then((r) => r.json())
              .then((info) => {
                linkMutation.mutate({
                  googleId: info.sub,
                  email: info.email,
                  name: info.name,
                  picture: info.picture,
                });
              })
              .catch(() => {
                toast({ title: "연결 실패", description: "Google 계정 정보를 가져올 수 없습니다", variant: "destructive" });
              });
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="w-4 h-4 text-blue-500" />
          Google 계정 관리
        </CardTitle>
        <CardDescription className="text-xs mt-1">
          여러 Google 계정을 연결하면 API 설정과 데이터를 공유할 수 있습니다
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* 현재 계정 */}
            {data?.currentAccount && (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20">
                {data.currentAccount.picture ? (
                  <img src={data.currentAccount.picture} className="w-8 h-8 rounded-full" alt="" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-600 text-sm font-bold">
                    {(data.currentAccount.name || data.currentAccount.email)[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{data.currentAccount.name}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-400 text-blue-600">현재 로그인</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{data.currentAccount.email}</p>
                </div>
              </div>
            )}

            {/* 연결된 계정 */}
            {data?.linkedAccounts?.map((la) => (
              <div key={la.id} className="flex items-center gap-3 p-3 rounded-lg border">
                {la.user.picture ? (
                  <img src={la.user.picture} className="w-8 h-8 rounded-full" alt="" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-bold">
                    {(la.user.name || la.user.email)[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium truncate block">{la.user.name}</span>
                  <p className="text-[11px] text-muted-foreground truncate">{la.user.email}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-[10px] text-red-500" onClick={() => { if (confirm("이 계정 연결을 해제하시겠습니까?")) unlinkMutation.mutate(la.id); }}>
                  연결 해제
                </Button>
              </div>
            ))}

            {/* 계정 추가 버튼 */}
            <Button variant="outline" className="w-full gap-2 text-xs" onClick={handleLinkGoogle} disabled={linkMutation.isPending || (data?.linkedAccounts?.length ?? 0) >= 3}>
              {linkMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              다른 Google 계정 연결
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ========== Notion API Section ==========
function NotionApiSection() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [databaseId, setDatabaseId] = useState("");
  const [showKey, setShowKey] = useState(false);

  const { data: config, isLoading, refetch } = useQuery<{ configured: boolean; apiKey?: string; databaseId?: string }>({
    queryKey: ["/api/admin/notion-config"],
    queryFn: async () => {
      const res = await fetch("/api/admin/notion-config", { credentials: "include" });
      if (!res.ok) return { configured: false };
      return res.json();
    },
    enabled: isAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ apiKey, databaseId }: { apiKey: string; databaseId: string }) => {
      const res = await fetch("/api/admin/notion-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ apiKey, databaseId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "저장 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      refetch();
      setEditing(false);
      setApiKey("");
      setDatabaseId("");
      toast({ title: "Notion 설정 저장 완료" });
    },
    onError: (error: Error) => {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    },
  });

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">관리자만 Notion API를 관리할 수 있습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-gray-700" />
          Notion Integration
        </CardTitle>
        <CardDescription className="text-xs">
          주요 리서치를 Notion 데이터베이스로 내보내기 위한 설정
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : config?.configured && !editing ? (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">연동 완료</span>
              </div>
              <div className="grid gap-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20">API Key</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded">{config.apiKey}</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20">Database ID</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded">{config.databaseId}</code>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setEditing(true)}>
              <Pencil className="w-3 h-3" />
              설정 변경
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {!config?.configured && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-2">설정 방법</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li><a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="text-primary underline">Notion Integrations</a>에서 Internal Integration 생성 → API Key 복사</li>
                  <li>Notion에서 데이터베이스 생성 (속성: 제목, 증권사, 날짜, 링크, PDF)</li>
                  <li>데이터베이스 ··· → 연결(Connections)에서 Integration 연결</li>
                  <li>데이터베이스 URL에서 Database ID (32자리) 복사</li>
                </ol>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Notion API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder="ntn_xxxxx..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="text-sm pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notion Database ID</Label>
              <Input
                placeholder="32자리 영숫자 (URL에서 복사)"
                value={databaseId}
                onChange={(e) => setDatabaseId(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => saveMutation.mutate({ apiKey, databaseId })}
                disabled={!apiKey || !databaseId || saveMutation.isPending}
              >
                {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                저장
              </Button>
              {editing && (
                <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setApiKey(""); setDatabaseId(""); }}>
                  취소
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ========== Admin API Overview ==========
function AdminApiOverview() {
  const { data: overview = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/api-overview"],
  });

  if (isLoading || overview.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-500" />
          전체 사용자 API 현황 <span className="text-xs text-muted-foreground font-normal">(Admin)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2">사용자</th>
                <th className="text-center py-2 px-2">자동매매</th>
                <th className="text-center py-2 px-2">활성 매매API</th>
                <th className="text-center py-2 px-2">AI API</th>
                <th className="text-center py-2 px-2">활성 AI</th>
              </tr>
            </thead>
            <tbody>
              {overview.map((o: any) => (
                <tr key={o.userId} className="border-b last:border-0">
                  <td className="py-2 px-2">
                    <div className="font-medium">{o.name || "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{o.email}</div>
                  </td>
                  <td className="text-center py-2 px-2">{o.tradingApis}개</td>
                  <td className="text-center py-2 px-2">
                    {o.activeTradingApi ? (
                      <span className="text-amber-600">{o.activeTradingApi} ({o.activeTradingBroker === "kiwoom" ? "키움" : "KIS"}{o.tradingMock ? "/모의" : "/실전"})</span>
                    ) : "—"}
                  </td>
                  <td className="text-center py-2 px-2">{o.aiApis}개</td>
                  <td className="text-center py-2 px-2">
                    {o.activeAiApi ? (
                      <span className="text-purple-600">{o.activeAiApi} ({o.activeAiProvider})</span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

