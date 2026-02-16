import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX,
  Play, Loader2, RefreshCw, Clock,
  CheckCircle2, AlertTriangle, XCircle, Zap,
  FileSearch, Bug, Lock, Server,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuditCheck {
  name: string;
  status: "pass" | "warning" | "critical";
  detail: string;
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

export default function SecurityAudit() {
  const [activeTab, setActiveTab] = useState<"audit" | "drill">("audit");
  const [selectedAuditId, setSelectedAuditId] = useState<number | null>(null);
  const [selectedDrillId, setSelectedDrillId] = useState<number | null>(null);
  const [drillType, setDrillType] = useState<string>("full");
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

  // 보안점검 실행
  const runAuditMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/security/run-audit");
      return res.json();
    },
    onSuccess: (data) => {
      refetchAudits();
      setSelectedAuditId(data.id);
      toast({
        title: "보안점검 완료",
        description: data.summary,
      });
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
      toast({
        title: "모의훈련 완료",
        description: data.summary,
      });
    },
    onError: (error: any) => {
      toast({ title: "모의훈련 실패", description: error.message, variant: "destructive" });
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

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            보안점검
          </h2>
          <p className="text-sm text-muted-foreground mt-1">시스템 보안 점검 및 모의훈련</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b">
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "audit"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("audit")}
        >
          🔍 보안점검
        </button>
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "drill"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("drill")}
        >
          🛡️ 모의훈련
        </button>
      </div>

      {/* 보안점검 탭 */}
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

                {/* 상세 항목 */}
                <div className="border-t">
                  {parseChecks(selectedAudit.details).map((check, i) => (
                    <div key={i} className={`flex items-start gap-3 px-4 py-2.5 border-b last:border-b-0 ${
                      check.status === "critical" ? "bg-red-50/50 dark:bg-red-950/10" :
                      check.status === "warning" ? "bg-amber-50/30 dark:bg-amber-950/10" : ""
                    }`}>
                      <div className="mt-0.5">{STATUS_ICON[check.status]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium flex items-center gap-2">
                          {check.name}
                          {STATUS_BADGE[check.status]}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{check.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
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

      {/* 모의훈련 탭 */}
      {activeTab === "drill" && (
        <div className="space-y-4">
          {/* 실행 버튼 + 옵션 */}
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

          {/* 최근 훈련 결과 상세 */}
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
                {/* 요약 카드 */}
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

                {/* 상세 테스트 */}
                <div className="border-t">
                  {(() => {
                    const tests = parseTests(selectedDrill.details);
                    // 카테고리별 그룹핑
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
    </div>
  );
}

