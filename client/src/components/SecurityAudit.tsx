import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX,
  Play, Loader2, RefreshCw, Clock,
  CheckCircle2, AlertTriangle, XCircle, Zap,
  FileSearch, Bug, Lock, Server,
  Wrench, Ban, Trash2, Plus, ShieldOff, History,
  Globe, MapPin, Building2, Wifi, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WhoisInfo {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
  asName: string;
  reverse: string;
  mobile: boolean;
  proxy: boolean;
  hosting: boolean;
  extra?: {
    type: string | null;
    connectionType: string | null;
    continent: string | null;
    currencyCode: string | null;
  };
}

interface SuspiciousIpInfo {
  ip: string;
  count: number;
  accounts: string[];
}

interface AuditCheck {
  name: string;
  status: "pass" | "warning" | "critical";
  detail: string;
  remediable?: boolean;
  remediationAction?: string;
  remediationLabel?: string;
  suspiciousIps?: SuspiciousIpInfo[];
}

interface AuditLog {
  id: number;
  auditType: string;
  status: string;
  summary: string;
  details: string;
  totalChecks: number;
  passedChecks: number;
  warningChecks: number;
  criticalChecks: number;
  executedAt: string;
}

interface DrillTest {
  name: string;
  category: string;
  status: "pass" | "fail";
  detail: string;
}

interface DrillResult {
  id: number;
  drillType: string;
  status: string;
  summary: string;
  details: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  executedBy: string;
  executedAt: string;
}

interface BlockedIp {
  id: number;
  ipAddress: string;
  reason: string;
  blockedBy: string | null;
  accessCount: number | null;
  isActive: boolean;
  blockedAt: string;
  expiresAt: string | null;
}

interface Remediation {
  id: number;
  actionType: string;
  status: string;
  summary: string;
  details: string;
  affectedCount: number;
  executedBy: string | null;
  executedAt: string;
}

const STATUS_ICON = {
  pass: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  critical: <XCircle className="h-4 w-4 text-red-500" />,
  fail: <XCircle className="h-4 w-4 text-red-500" />,
};

const STATUS_BADGE = {
  pass: <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 text-xs">통과</Badge>,
  warning: <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 text-xs">경고</Badge>,
  critical: <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 text-xs">위험</Badge>,
  fail: <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 text-xs">실패</Badge>,
  success: <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 text-xs">성공</Badge>,
  partial: <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 text-xs">부분</Badge>,
  failed: <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 text-xs">실패</Badge>,
};

const DRILL_TYPE_LABELS: Record<string, string> = {
  full: "전체 테스트",
  auth: "인증 보안",
  injection: "인젝션 방어",
  api: "API 보안",
};

const DRILL_CATEGORY_ICON: Record<string, React.ReactNode> = {
  "인증": <Lock className="h-3.5 w-3.5 text-blue-500" />,
  "인젝션": <Bug className="h-3.5 w-3.5 text-purple-500" />,
  "API": <Server className="h-3.5 w-3.5 text-emerald-500" />,
};

const REMEDIATION_LABELS: Record<string, string> = {
  "encrypt-ai-keys": "AI 키 암호화",
  "encrypt-trading-keys": "KIS 키 암호화",
  "block-suspicious-ips": "의심 IP 차단",
  "cleanup-old-logs": "로그 정리",
  "block-ip": "IP 수동 차단",
  "unblock-ip": "IP 차단 해제",
};

// 가이드 메시지
const GUIDE_MESSAGES: Record<string, { title: string; steps: string[] }> = {
  "guide-encryption-key": {
    title: "ENCRYPTION_KEY 설정 가이드",
    steps: [
      "1. 터미널에서 실행: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      "2. 생성된 64자 hex 문자열을 복사",
      "3. Vercel Dashboard → Settings → Environment Variables",
      "4. ENCRYPTION_KEY 키로 값 추가 후 재배포",
    ],
  },
  "guide-session-secret": {
    title: "SESSION_SECRET 설정 가이드",
    steps: [
      "1. 터미널에서 실행: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      "2. Vercel Dashboard → Settings → Environment Variables",
      "3. SESSION_SECRET 키로 값 추가 후 재배포",
    ],
  },
  "guide-admin-password": {
    title: "ADMIN_PASSWORD_HASH 설정 가이드",
    steps: [
      "1. bcrypt 해시 생성 (https://bcrypt-generator.com/)",
      "2. Vercel Dashboard → Settings → Environment Variables",
      "3. ADMIN_PASSWORD_HASH 키로 해시값 추가 후 재배포",
    ],
  },
  "guide-production": {
    title: "프로덕션 모드 설정 가이드",
    steps: [
      "1. Vercel Dashboard → Settings → Environment Variables",
      "2. NODE_ENV=production 추가 후 재배포",
    ],
  },
  "guide-google-oauth": {
    title: "Google OAuth 설정 가이드",
    steps: [
      "1. Google Cloud Console → APIs → Credentials",
      "2. OAuth 2.0 Client ID 생성",
      "3. Vercel Dashboard → Settings → Environment Variables",
      "4. GOOGLE_CLIENT_ID와 VITE_GOOGLE_CLIENT_ID에 Client ID 추가 후 재배포",
    ],
  },
};

export default function SecurityAudit() {
  const [activeTab, setActiveTab] = useState<"audit" | "drill" | "blocked-ips" | "remediations">("audit");
  const [selectedAuditId, setSelectedAuditId] = useState<number | null>(null);
  const [selectedDrillId, setSelectedDrillId] = useState<number | null>(null);
  const [drillType, setDrillType] = useState<string>("full");
  const [showGuide, setShowGuide] = useState<string | null>(null);
  const [newBlockIp, setNewBlockIp] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [remediatingAction, setRemediatingAction] = useState<string | null>(null);
  const [whoisData, setWhoisData] = useState<WhoisInfo | null>(null);
  const [whoisLoading, setWhoisLoading] = useState<string | null>(null); // loading IP
  const [whoisError, setWhoisError] = useState<string | null>(null);
  const { toast } = useToast();

  // 보안점검 로그 조회
  const { data: auditLogs = [], isLoading: auditLoading, refetch: refetchAudits } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/security/audit-logs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/security/audit-logs?limit=50");
      return res.json();
    },
    refetchInterval: 60000,
  });

  // 모의훈련 결과 조회
  const { data: drillResults = [], isLoading: drillLoading, refetch: refetchDrills } = useQuery<DrillResult[]>({
    queryKey: ["/api/admin/security/drill-results"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/security/drill-results?limit=50");
      return res.json();
    },
    refetchInterval: 60000,
  });

  // 차단 IP 목록 조회
  const { data: blockedIps = [], isLoading: blockedIpsLoading, refetch: refetchBlockedIps } = useQuery<BlockedIp[]>({
    queryKey: ["/api/admin/security/blocked-ips"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/security/blocked-ips");
      return res.json();
    },
    refetchInterval: 60000,
  });

  // 보안조치 이력 조회
  const { data: remediations = [], isLoading: remediationsLoading, refetch: refetchRemediations } = useQuery<Remediation[]>({
    queryKey: ["/api/admin/security/remediations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/security/remediations");
      return res.json();
    },
    refetchInterval: 60000,
  });

  // 보안점검 실행
  const runAuditMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/security/run-audit");
      return res.json();
    },
    onSuccess: (data) => {
      refetchAudits();
      setSelectedAuditId(data.id);
      toast({ title: "보안점검 완료", description: data.summary });
    },
    onError: (error: any) => {
      toast({ title: "보안점검 실패", description: error.message, variant: "destructive" });
    },
  });

  // 모의훈련 실행
  const runDrillMutation = useMutation({
    mutationFn: async (type: string) => {
      const res = await apiRequest("POST", "/api/admin/security/run-drill", { drillType: type });
      return res.json();
    },
    onSuccess: (data) => {
      refetchDrills();
      setSelectedDrillId(data.id);
      toast({ title: "모의훈련 완료", description: data.summary });
    },
    onError: (error: any) => {
      toast({ title: "모의훈련 실패", description: error.message, variant: "destructive" });
    },
  });

  // 보안조치 실행
  const remediateMutation = useMutation({
    mutationFn: async (params: { action: string; ip?: string; reason?: string; blockedIpId?: number }) => {
      const res = await apiRequest("POST", "/api/admin/security/remediate", params);
      return res.json();
    },
    onSuccess: (data) => {
      setRemediatingAction(null);
      refetchAudits();
      refetchBlockedIps();
      refetchRemediations();
      toast({
        title: "보안조치 완료",
        description: data.result.summary,
      });
    },
    onError: (error: any) => {
      setRemediatingAction(null);
      toast({ title: "보안조치 실패", description: error.message, variant: "destructive" });
    },
  });

  // IP 차단 해제
  const unblockIpMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/security/blocked-ips/${id}`);
      return res.json();
    },
    onSuccess: () => {
      refetchBlockedIps();
      toast({ title: "IP 차단 해제 완료" });
    },
    onError: (error: any) => {
      toast({ title: "IP 차단 해제 실패", description: error.message, variant: "destructive" });
    },
  });

  // 수동 IP 차단
  const blockIpMutation = useMutation({
    mutationFn: async (data: { ipAddress: string; reason: string }) => {
      const res = await apiRequest("POST", "/api/admin/security/blocked-ips", data);
      return res.json();
    },
    onSuccess: () => {
      setNewBlockIp("");
      setNewBlockReason("");
      refetchBlockedIps();
      toast({ title: "IP 차단 완료" });
    },
    onError: (error: any) => {
      toast({ title: "IP 차단 실패", description: error.message, variant: "destructive" });
    },
  });

  const selectedAudit = selectedAuditId ? auditLogs.find(l => l.id === selectedAuditId) : auditLogs[0];
  const selectedDrill = selectedDrillId ? drillResults.find(r => r.id === selectedDrillId) : drillResults[0];

  const parseChecks = (details: string): AuditCheck[] => {
    try { return JSON.parse(details); } catch { return []; }
  };
  const parseTests = (details: string): DrillTest[] => {
    try { return JSON.parse(details); } catch { return []; }
  };

  const handleRemediation = (action: string) => {
    if (action.startsWith("guide-")) {
      setShowGuide(action);
      return;
    }
    setRemediatingAction(action);
    remediateMutation.mutate({ action });
  };

  // IP 추출 (점검 detail에서 IP:건수 패턴)
  const extractIpsFromDetail = (detail: string): { ip: string; count: string }[] => {
    const matches = detail.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):?(\d+건)?/g);
    if (!matches) return [];
    return matches.map(m => {
      const [ip, count] = m.split(":");
      return { ip, count: count || "" };
    });
  };

  // WHOIS 조회
  const handleWhoisLookup = async (ip: string) => {
    setWhoisLoading(ip);
    setWhoisError(null);
    setWhoisData(null);
    try {
      const res = await apiRequest("GET", `/api/admin/security/whois/${ip}`);
      const data = await res.json();
      setWhoisData(data);
    } catch (error: any) {
      setWhoisError(error.message || "WHOIS 조회 실패");
      toast({ title: "WHOIS 조회 실패", description: error.message, variant: "destructive" });
    } finally {
      setWhoisLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            보안점검
          </h2>
          <p className="text-sm text-muted-foreground mt-1">시스템 보안 점검, 모의훈련, 보안조치</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {([
          { key: "audit" as const, label: "🔍 보안점검" },
          { key: "drill" as const, label: "🛡️ 모의훈련" },
          { key: "blocked-ips" as const, label: "🚫 IP 차단관리" },
          { key: "remediations" as const, label: "🔧 조치이력" },
        ]).map(tab => (
          <button
            key={tab.key}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.key === "blocked-ips" && blockedIps.filter(ip => ip.isActive).length > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0">
                {blockedIps.filter(ip => ip.isActive).length}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* 가이드 모달 */}
      {showGuide && GUIDE_MESSAGES[showGuide] && (
        <Card className="border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-700 dark:text-blue-300">
              📋 {GUIDE_MESSAGES[showGuide].title}
              <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs" onClick={() => setShowGuide(null)}>닫기</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="space-y-1">
              {GUIDE_MESSAGES[showGuide].steps.map((step, i) => (
                <p key={i} className="text-xs text-blue-700 dark:text-blue-300">{step}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== 보안점검 탭 ===== */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          {/* 실행 버튼 + 요약 */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => runAuditMutation.mutate()}
              disabled={runAuditMutation.isPending}
              className="gap-2"
              variant="default"
            >
              {runAuditMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSearch className="h-4 w-4" />
              )}
              {runAuditMutation.isPending ? "점검 중..." : "보안점검 실행"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetchAudits()} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> 새로고침
            </Button>
            {selectedAudit && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
                <Clock className="h-3.5 w-3.5" />
                최근 점검: {new Date(selectedAudit.executedAt).toLocaleString("ko-KR")}
                ({selectedAudit.auditType === "scheduled" ? "자동" : "수동"})
              </div>
            )}
          </div>

          {/* 자동점검 안내 */}
          <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                매일 00:00 (UTC) 자동 보안점검이 Vercel Cron으로 실행됩니다. 수동 점검도 언제든 실행 가능합니다.
              </p>
            </CardContent>
          </Card>

          {/* 최근 점검 결과 상세 */}
          {selectedAudit && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {selectedAudit.status === "pass" ? (
                    <ShieldCheck className="h-4 w-4 text-green-500" />
                  ) : selectedAudit.status === "warning" ? (
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                  ) : (
                    <ShieldX className="h-4 w-4 text-red-500" />
                  )}
                  점검 결과
                  {STATUS_BADGE[selectedAudit.status as keyof typeof STATUS_BADGE]}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* 요약 카드 */}
                <div className="grid grid-cols-4 gap-2 px-4 pb-3">
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <div className="text-lg font-bold">{selectedAudit.totalChecks}</div>
                    <div className="text-xs text-muted-foreground">전체</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
                    <div className="text-lg font-bold text-green-600">{selectedAudit.passedChecks}</div>
                    <div className="text-xs text-green-600">통과</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                    <div className="text-lg font-bold text-amber-600">{selectedAudit.warningChecks}</div>
                    <div className="text-xs text-amber-600">경고</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/30">
                    <div className="text-lg font-bold text-red-600">{selectedAudit.criticalChecks}</div>
                    <div className="text-xs text-red-600">위험</div>
                  </div>
                </div>

                {/* 상세 항목 + 조치/WHOIS 버튼 */}
                <div className="border-t">
                  {parseChecks(selectedAudit.details).map((check, i) => {
                    // suspiciousIps 필드 우선, 없으면 detail에서 추출
                    const suspiciousIps: SuspiciousIpInfo[] = check.suspiciousIps
                      || (check.remediationAction === "block-suspicious-ips"
                        ? extractIpsFromDetail(check.detail).map(({ ip, count }) => ({ ip, count: parseInt(count) || 0, accounts: [] }))
                        : []);
                    return (
                      <div key={i} className={`border-b last:border-b-0 ${
                        check.status === "critical" ? "bg-red-50/50 dark:bg-red-950/10" :
                        check.status === "warning" ? "bg-amber-50/30 dark:bg-amber-950/10" : ""
                      }`}>
                        <div className="flex items-start gap-3 px-4 py-2.5">
                          <div className="mt-0.5">{STATUS_ICON[check.status]}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                              {check.name}
                              {STATUS_BADGE[check.status]}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{check.detail}</div>
                            {/* 의심 IP별 상세 목록 + WHOIS 버튼 */}
                            {suspiciousIps.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                {suspiciousIps.map(({ ip, count, accounts }) => (
                                  <div key={ip} className="flex items-center gap-2 flex-wrap bg-muted/40 rounded px-2 py-1.5">
                                    <span className="text-xs font-mono font-medium text-foreground">{ip}</span>
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count}건</Badge>
                                    {accounts.length > 0 ? (
                                      <div className="flex items-center gap-1 flex-wrap">
                                        <span className="text-[10px] text-muted-foreground">접속계정:</span>
                                        {accounts.map((acc, ai) => (
                                          <Badge key={ai} variant="outline" className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400">
                                            {acc}
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground">비로그인 접속</span>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-5 text-[10px] gap-0.5 px-1.5 ml-auto border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950"
                                      disabled={whoisLoading === ip}
                                      onClick={() => handleWhoisLookup(ip)}
                                    >
                                      {whoisLoading === ip ? (
                                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                      ) : (
                                        <Globe className="h-2.5 w-2.5" />
                                      )}
                                      WHOIS
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* 조치 버튼 */}
                          <div className="flex gap-1 shrink-0">
                            {check.remediable && check.remediationAction && (
                              <Button
                                variant={check.remediationAction.startsWith("guide-") ? "outline" : "default"}
                                size="sm"
                                className="h-7 text-xs gap-1"
                                disabled={remediatingAction === check.remediationAction}
                                onClick={() => handleRemediation(check.remediationAction!)}
                              >
                                {remediatingAction === check.remediationAction ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : check.remediationAction.startsWith("guide-") ? (
                                  <FileSearch className="h-3 w-3" />
                                ) : (
                                  <Wrench className="h-3 w-3" />
                                )}
                                {check.remediationLabel || "조치"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* WHOIS 결과 패널 */}
          {(whoisData || whoisError) && (
            <Card className="border-blue-300 dark:border-blue-700">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-500" />
                  IP WHOIS 조회 결과
                  {whoisData && (
                    <Badge variant="outline" className="text-xs ml-1">{whoisData.ip}</Badge>
                  )}
                  <Button variant="ghost" size="sm" className="ml-auto h-6 px-2" onClick={() => { setWhoisData(null); setWhoisError(null); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-4">
                {whoisError ? (
                  <p className="text-xs text-red-500">{whoisError}</p>
                ) : whoisData && (
                  <div className="space-y-3">
                    {/* 위치 정보 */}
                    <div>
                      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground mb-1.5">
                        <MapPin className="h-3 w-3" /> 위치 정보
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <InfoItem label="국가" value={`${whoisData.country} (${whoisData.countryCode})`} flag={whoisData.countryCode} />
                        <InfoItem label="지역" value={whoisData.region || "-"} />
                        <InfoItem label="도시" value={whoisData.city || "-"} />
                        <InfoItem label="우편번호" value={whoisData.zip || "-"} />
                        <InfoItem label="위도" value={whoisData.lat?.toString() || "-"} />
                        <InfoItem label="경도" value={whoisData.lon?.toString() || "-"} />
                        <InfoItem label="타임존" value={whoisData.timezone || "-"} />
                      </div>
                    </div>
                    {/* 네트워크 정보 */}
                    <div>
                      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground mb-1.5">
                        <Wifi className="h-3 w-3" /> 네트워크 정보
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <InfoItem label="ISP" value={whoisData.isp || "-"} />
                        <InfoItem label="조직" value={whoisData.org || "-"} />
                        <InfoItem label="AS" value={whoisData.asName || whoisData.as || "-"} />
                        <InfoItem label="Reverse DNS" value={whoisData.reverse || "-"} />
                      </div>
                    </div>
                    {/* 위험 플래그 */}
                    <div>
                      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground mb-1.5">
                        <Shield className="h-3 w-3" /> 보안 플래그
                      </h4>
                      <div className="flex gap-2 flex-wrap">
                        <FlagBadge label="모바일" value={whoisData.mobile} />
                        <FlagBadge label="프록시/VPN" value={whoisData.proxy} danger />
                        <FlagBadge label="호스팅/DC" value={whoisData.hosting} warning />
                        {whoisData.extra?.type && (
                          <Badge variant="outline" className="text-xs">{whoisData.extra.type}</Badge>
                        )}
                        {whoisData.extra?.connectionType && (
                          <Badge variant="outline" className="text-xs">연결: {whoisData.extra.connectionType}</Badge>
                        )}
                      </div>
                    </div>
                    {/* 지도 링크 */}
                    {whoisData.lat && whoisData.lon && (
                      <div className="pt-1">
                        <a
                          href={`https://www.google.com/maps/@${whoisData.lat},${whoisData.lon},12z`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                        >
                          <MapPin className="h-3 w-3" /> Google Maps에서 보기 →
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 점검 이력 */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> 점검 이력
                <Badge variant="secondary" className="ml-auto">{auditLogs.length}건</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {auditLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">점검 이력이 없습니다. 보안점검을 실행해주세요.</div>
              ) : (
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium">시간</th>
                        <th className="text-center px-3 py-2 font-medium">유형</th>
                        <th className="text-center px-3 py-2 font-medium">상태</th>
                        <th className="text-left px-3 py-2 font-medium">요약</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr
                          key={log.id}
                          className={`border-b hover:bg-muted/30 cursor-pointer ${selectedAuditId === log.id ? 'bg-primary/5' : ''}`}
                          onClick={() => setSelectedAuditId(log.id)}
                        >
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.executedAt).toLocaleString("ko-KR", {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </td>
                          <td className="text-center px-3 py-2">
                            <Badge variant="outline" className="text-xs">
                              {log.auditType === "scheduled" ? "자동" : "수동"}
                            </Badge>
                          </td>
                          <td className="text-center px-3 py-2">
                            {STATUS_BADGE[log.status as keyof typeof STATUS_BADGE]}
                          </td>
                          <td className="px-3 py-2 text-xs truncate max-w-[200px]">{log.summary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== 모의훈련 탭 ===== */}
      {activeTab === "drill" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={drillType} onValueChange={setDrillType}>
              <SelectTrigger className="w-[150px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">🛡️ 전체 테스트</SelectItem>
                <SelectItem value="auth">🔐 인증 보안</SelectItem>
                <SelectItem value="injection">💉 인젝션 방어</SelectItem>
                <SelectItem value="api">🔌 API 보안</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => runDrillMutation.mutate(drillType)}
              disabled={runDrillMutation.isPending}
              className="gap-2"
              variant="destructive"
            >
              {runDrillMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {runDrillMutation.isPending ? "훈련 중..." : "모의훈련 실행"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetchDrills()} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> 새로고침
            </Button>
          </div>

          {selectedDrill && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  모의훈련 결과 - {DRILL_TYPE_LABELS[selectedDrill.drillType] || selectedDrill.drillType}
                  {STATUS_BADGE[selectedDrill.status as keyof typeof STATUS_BADGE]}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {selectedDrill.duration}ms · {selectedDrill.executedBy}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-3 gap-2 px-4 pb-3">
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <div className="text-lg font-bold">{selectedDrill.totalTests}</div>
                    <div className="text-xs text-muted-foreground">전체</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
                    <div className="text-lg font-bold text-green-600">{selectedDrill.passedTests}</div>
                    <div className="text-xs text-green-600">통과</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/30">
                    <div className="text-lg font-bold text-red-600">{selectedDrill.failedTests}</div>
                    <div className="text-xs text-red-600">실패</div>
                  </div>
                </div>
                <div className="border-t">
                  {(() => {
                    const tests = parseTests(selectedDrill.details);
                    const categories = [...new Set(tests.map(t => t.category))];
                    return categories.map(cat => (
                      <div key={cat}>
                        <div className="px-4 py-2 bg-muted/30 border-b flex items-center gap-2">
                          {DRILL_CATEGORY_ICON[cat] || <Shield className="h-3.5 w-3.5" />}
                          <span className="text-xs font-semibold">{cat}</span>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {tests.filter(t => t.category === cat && t.status === "pass").length}/
                            {tests.filter(t => t.category === cat).length}
                          </Badge>
                        </div>
                        {tests.filter(t => t.category === cat).map((test, i) => (
                          <div key={i} className={`flex items-start gap-3 px-4 py-2 border-b last:border-b-0 ${
                            test.status === "fail" ? "bg-red-50/50 dark:bg-red-950/10" : ""
                          }`}>
                            <div className="mt-0.5">
                              {test.status === "pass" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium">{test.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{test.detail}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 훈련 이력 */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> 훈련 이력
                <Badge variant="secondary" className="ml-auto">{drillResults.length}건</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {drillLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : drillResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">훈련 이력이 없습니다. 모의훈련을 실행해주세요.</div>
              ) : (
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium">시간</th>
                        <th className="text-center px-3 py-2 font-medium">유형</th>
                        <th className="text-center px-3 py-2 font-medium">상태</th>
                        <th className="text-center px-3 py-2 font-medium">결과</th>
                        <th className="text-right px-3 py-2 font-medium">시간(ms)</th>
                        <th className="text-left px-3 py-2 font-medium">실행자</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillResults.map((result) => (
                        <tr
                          key={result.id}
                          className={`border-b hover:bg-muted/30 cursor-pointer ${selectedDrillId === result.id ? 'bg-primary/5' : ''}`}
                          onClick={() => setSelectedDrillId(result.id)}
                        >
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(result.executedAt).toLocaleString("ko-KR", {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </td>
                          <td className="text-center px-3 py-2">
                            <Badge variant="outline" className="text-xs">
                              {DRILL_TYPE_LABELS[result.drillType] || result.drillType}
                            </Badge>
                          </td>
                          <td className="text-center px-3 py-2">
                            {STATUS_BADGE[result.status as keyof typeof STATUS_BADGE]}
                          </td>
                          <td className="text-center px-3 py-2 text-xs">
                            <span className="text-green-600">{result.passedTests}</span>
                            /
                            <span>{result.totalTests}</span>
                          </td>
                          <td className="text-right px-3 py-2 text-xs font-mono text-muted-foreground">
                            {result.duration}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{result.executedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== IP 차단관리 탭 ===== */}
      {activeTab === "blocked-ips" && (
        <div className="space-y-4">
          {/* 수동 IP 차단 */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Plus className="h-4 w-4" /> IP 수동 차단
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="IP 주소 (예: 192.168.1.1)"
                  value={newBlockIp}
                  onChange={(e) => setNewBlockIp(e.target.value)}
                  className="h-8 text-xs flex-1"
                />
                <Input
                  placeholder="차단 사유"
                  value={newBlockReason}
                  onChange={(e) => setNewBlockReason(e.target.value)}
                  className="h-8 text-xs flex-1"
                />
                <Button
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  disabled={!newBlockIp || blockIpMutation.isPending}
                  onClick={() => blockIpMutation.mutate({ ipAddress: newBlockIp, reason: newBlockReason || "관리자 수동 차단" })}
                >
                  {blockIpMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                  차단
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 차단 IP 목록 */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Ban className="h-4 w-4 text-red-500" /> 차단 IP 목록
                <Badge variant="secondary" className="ml-auto">
                  {blockedIps.filter(ip => ip.isActive).length}개 활성
                </Badge>
                <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => refetchBlockedIps()}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {blockedIpsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : blockedIps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">차단된 IP가 없습니다.</div>
              ) : (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium">IP 주소</th>
                        <th className="text-left px-3 py-2 font-medium">사유</th>
                        <th className="text-center px-3 py-2 font-medium">접속수</th>
                        <th className="text-center px-3 py-2 font-medium">상태</th>
                        <th className="text-left px-3 py-2 font-medium">차단일</th>
                        <th className="text-left px-3 py-2 font-medium">차단자</th>
                        <th className="text-center px-3 py-2 font-medium">조치</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blockedIps.map((ip) => (
                        <tr key={ip.id} className={`border-b hover:bg-muted/30 ${!ip.isActive ? 'opacity-50' : ''}`}>
                          <td className="px-3 py-2 text-xs font-mono font-medium">
                            <div className="flex items-center gap-1">
                              {ip.ipAddress}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1.5 text-[10px] text-blue-500 hover:text-blue-600 gap-0.5"
                                disabled={whoisLoading === ip.ipAddress}
                                onClick={() => handleWhoisLookup(ip.ipAddress)}
                              >
                                {whoisLoading === ip.ipAddress ? (
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                ) : (
                                  <Globe className="h-2.5 w-2.5" />
                                )}
                                WHOIS
                              </Button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate">{ip.reason}</td>
                          <td className="text-center px-3 py-2 text-xs">{ip.accessCount || "-"}</td>
                          <td className="text-center px-3 py-2">
                            {ip.isActive ? (
                              <Badge variant="destructive" className="text-xs">차단중</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">해제됨</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(ip.blockedAt).toLocaleString("ko-KR", {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{ip.blockedBy || "-"}</td>
                          <td className="text-center px-3 py-2">
                            {ip.isActive && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-red-500 hover:text-red-600 gap-1"
                                onClick={() => unblockIpMutation.mutate(ip.id)}
                                disabled={unblockIpMutation.isPending}
                              >
                                <ShieldOff className="h-3 w-3" /> 해제
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* WHOIS 결과 패널 (IP 차단관리 탭) */}
          {(whoisData || whoisError) && (
            <Card className="border-blue-300 dark:border-blue-700">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-500" />
                  IP WHOIS 조회 결과
                  {whoisData && (
                    <Badge variant="outline" className="text-xs ml-1">{whoisData.ip}</Badge>
                  )}
                  <Button variant="ghost" size="sm" className="ml-auto h-6 px-2" onClick={() => { setWhoisData(null); setWhoisError(null); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-4">
                {whoisError ? (
                  <p className="text-xs text-red-500">{whoisError}</p>
                ) : whoisData && (
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground mb-1.5">
                        <MapPin className="h-3 w-3" /> 위치 정보
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <InfoItem label="국가" value={`${whoisData.country} (${whoisData.countryCode})`} flag={whoisData.countryCode} />
                        <InfoItem label="지역" value={whoisData.region || "-"} />
                        <InfoItem label="도시" value={whoisData.city || "-"} />
                        <InfoItem label="타임존" value={whoisData.timezone || "-"} />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground mb-1.5">
                        <Wifi className="h-3 w-3" /> 네트워크 정보
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <InfoItem label="ISP" value={whoisData.isp || "-"} />
                        <InfoItem label="조직" value={whoisData.org || "-"} />
                        <InfoItem label="AS" value={whoisData.asName || whoisData.as || "-"} />
                        <InfoItem label="Reverse DNS" value={whoisData.reverse || "-"} />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground mb-1.5">
                        <Shield className="h-3 w-3" /> 보안 플래그
                      </h4>
                      <div className="flex gap-2 flex-wrap">
                        <FlagBadge label="모바일" value={whoisData.mobile} />
                        <FlagBadge label="프록시/VPN" value={whoisData.proxy} danger />
                        <FlagBadge label="호스팅/DC" value={whoisData.hosting} warning />
                      </div>
                    </div>
                    {whoisData.lat && whoisData.lon && (
                      <div className="pt-1">
                        <a
                          href={`https://www.google.com/maps/@${whoisData.lat},${whoisData.lon},12z`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                        >
                          <MapPin className="h-3 w-3" /> Google Maps에서 보기 →
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ===== 조치이력 탭 ===== */}
      {activeTab === "remediations" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => refetchRemediations()} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> 새로고침
            </Button>
          </div>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" /> 보안조치 이력
                <Badge variant="secondary" className="ml-auto">{remediations.length}건</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {remediationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : remediations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">보안조치 이력이 없습니다.</div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium">시간</th>
                        <th className="text-center px-3 py-2 font-medium">유형</th>
                        <th className="text-center px-3 py-2 font-medium">상태</th>
                        <th className="text-left px-3 py-2 font-medium">요약</th>
                        <th className="text-center px-3 py-2 font-medium">영향</th>
                        <th className="text-left px-3 py-2 font-medium">실행자</th>
                      </tr>
                    </thead>
                    <tbody>
                      {remediations.map((rem) => (
                        <tr key={rem.id} className="border-b hover:bg-muted/30">
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(rem.executedAt).toLocaleString("ko-KR", {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </td>
                          <td className="text-center px-3 py-2">
                            <Badge variant="outline" className="text-xs">
                              {REMEDIATION_LABELS[rem.actionType] || rem.actionType}
                            </Badge>
                          </td>
                          <td className="text-center px-3 py-2">
                            {STATUS_BADGE[rem.status as keyof typeof STATUS_BADGE]}
                          </td>
                          <td className="px-3 py-2 text-xs max-w-[250px] truncate">{rem.summary}</td>
                          <td className="text-center px-3 py-2 text-xs font-medium">
                            {rem.affectedCount > 0 ? (
                              <span className="text-blue-600">{rem.affectedCount}건</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{rem.executedBy || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// WHOIS 결과 표시용 헬퍼 컴포넌트
function InfoItem({ label, value, flag }: { label: string; value: string; flag?: string }) {
  return (
    <div className="bg-muted/40 rounded px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-xs font-medium truncate flex items-center gap-1">
        {flag && (
          <img
            src={`https://flagcdn.com/16x12/${flag.toLowerCase()}.png`}
            alt={flag}
            className="h-3 w-4 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        {value}
      </div>
    </div>
  );
}

function FlagBadge({ label, value, danger, warning }: { label: string; value: boolean; danger?: boolean; warning?: boolean }) {
  if (value) {
    return (
      <Badge className={`text-xs gap-1 ${
        danger ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" :
        warning ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" :
        "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
      }`}>
        {danger ? <AlertTriangle className="h-2.5 w-2.5" /> : <CheckCircle2 className="h-2.5 w-2.5" />}
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs gap-1 opacity-60">
      <XCircle className="h-2.5 w-2.5" /> {label} 아님
    </Badge>
  );
}
