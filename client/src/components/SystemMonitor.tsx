import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw, Server, Database, Globe, Key, Activity, Clock, HardDrive,
  Cpu, MemoryStick, CheckCircle2, XCircle, AlertTriangle, Loader2,
  Gauge, Wifi, Shield, Calendar, Lightbulb, ArrowRight,
} from "lucide-react";

interface SystemStatus {
  timestamp: string;
  server: {
    platform: string;
    nodeVersion: string;
    uptime: number;
    pid: number;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      rssFormatted: string;
      heapTotalFormatted: string;
      heapUsedFormatted: string;
      heapUsagePercent: string;
    };
    cpuUsage: { user: number; system: number };
    isVercel: boolean;
    vercelRegion: string;
    vercelEnv: string;
  };
  database: {
    status: string;
    pingMs?: number;
    dbSize?: string;
    activeConnections?: number;
    tables?: { name: string; rows: number; size: string }[];
    error?: string;
  };
  api: { name: string; status: string; responseTime?: number; httpStatus?: number; error?: string; note?: string }[];
  environment: {
    configured: string[];
    missing: string[];
    total: number;
    configuredCount: number;
  };
  performance: {
    totalCheckTimeMs: number;
    eventLoopLag: number;
  };
  recentErrors: any[];
  cronJobs: {
    lastSecurityAudit: { id: number; time: string; resultCount: number } | null;
  };
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}일`);
  if (h > 0) parts.push(`${h}시간`);
  if (m > 0) parts.push(`${m}분`);
  parts.push(`${s}초`);
  return parts.join(" ");
}

interface Recommendation {
  level: "critical" | "warning" | "info" | "good";
  category: string;
  title: string;
  detail: string;
}

function generateRecommendations(data: SystemStatus): Recommendation[] {
  const recs: Recommendation[] = [];

  // === DB 관련 ===
  if (data.database.status !== "connected") {
    recs.push({ level: "critical", category: "데이터베이스", title: "DB 연결 실패", detail: `오류: ${data.database.error || "알 수 없음"}. 즉시 DATABASE_URL 환경변수와 DB 서버 상태를 확인하세요.` });
  } else {
    if (data.database.pingMs && data.database.pingMs > 500) {
      recs.push({ level: "warning", category: "데이터베이스", title: `DB 응답 느림 (${data.database.pingMs}ms)`, detail: "DB 응답시간이 500ms를 초과했습니다. DB 서버 부하 또는 네트워크 지연을 점검하세요. Connection Pool 설정 최적화를 고려하세요." });
    } else if (data.database.pingMs && data.database.pingMs > 200) {
      recs.push({ level: "info", category: "데이터베이스", title: `DB 응답시간 관찰 필요 (${data.database.pingMs}ms)`, detail: "DB 응답시간이 200ms를 초과했습니다. 지속적으로 모니터링하고, 느린 쿼리가 없는지 확인하세요." });
    } else {
      recs.push({ level: "good", category: "데이터베이스", title: `DB 연결 정상 (${data.database.pingMs}ms)`, detail: "데이터베이스 연결 상태와 응답 시간이 양호합니다." });
    }
    if (data.database.activeConnections && data.database.activeConnections > 10) {
      recs.push({ level: "warning", category: "데이터베이스", title: `활성 커넥션 과다 (${data.database.activeConnections}개)`, detail: "활성 DB 커넥션이 10개를 초과했습니다. 커넥션 누수 또는 장시간 실행 쿼리가 없는지 점검하세요." });
    }
    // 테이블 크기 분석
    if (data.database.tables) {
      const largeTables = data.database.tables.filter(t => t.rows > 10000);
      if (largeTables.length > 0) {
        recs.push({ level: "info", category: "데이터베이스", title: `대용량 테이블 ${largeTables.length}개 감지`, detail: `${largeTables.map(t => `${t.name}(${t.rows.toLocaleString()}행)`).join(", ")}. 오래된 로그 정리(방문로그, 보안로그 등)를 권장합니다.` });
      }
    }
  }

  // === 메모리 관련 ===
  const heapPct = parseFloat(data.server.memory.heapUsagePercent);
  if (heapPct > 90) {
    recs.push({ level: "critical", category: "메모리", title: `Heap 사용률 위험 (${data.server.memory.heapUsagePercent})`, detail: "메모리 사용률이 90%를 초과했습니다. 메모리 누수 가능성이 있습니다. 서버 재시작 또는 메모리 프로파일링을 권장합니다." });
  } else if (heapPct > 75) {
    recs.push({ level: "warning", category: "메모리", title: `Heap 사용률 주의 (${data.server.memory.heapUsagePercent})`, detail: "메모리 사용률이 75%를 초과했습니다. 메모리 사용 추이를 지속 모니터링하세요." });
  } else {
    recs.push({ level: "good", category: "메모리", title: `메모리 사용량 정상 (${data.server.memory.heapUsagePercent})`, detail: "Heap 메모리 사용률이 안정적입니다." });
  }

  // RSS 메모리 (Vercel 무료 플랜은 1024MB 제한)
  const rssMB = data.server.memory.rss / 1024 / 1024;
  if (rssMB > 512) {
    recs.push({ level: "warning", category: "메모리", title: `RSS 메모리 높음 (${data.server.memory.rssFormatted})`, detail: "Vercel Serverless 함수의 메모리 제한(1024MB)에 근접할 수 있습니다. 불필요한 캐시 정리를 고려하세요." });
  }

  // === Event Loop ===
  if (data.performance.eventLoopLag > 100) {
    recs.push({ level: "warning", category: "성능", title: `Event Loop 지연 높음 (${data.performance.eventLoopLag}ms)`, detail: "이벤트 루프 지연이 100ms를 초과했습니다. CPU 집약적 작업이 메인 스레드를 차단하고 있을 수 있습니다." });
  } else if (data.performance.eventLoopLag > 50) {
    recs.push({ level: "info", category: "성능", title: `Event Loop 지연 관찰 (${data.performance.eventLoopLag}ms)`, detail: "이벤트 루프 지연이 다소 높습니다. 동기 작업 최적화를 고려하세요." });
  } else {
    recs.push({ level: "good", category: "성능", title: `Event Loop 정상 (${data.performance.eventLoopLag}ms)`, detail: "서버 응답 처리 성능이 양호합니다." });
  }

  // === API 연결 ===
  const failedApis = data.api.filter(a => a.status !== "ok" && a.status !== "reachable");
  if (failedApis.length > 0) {
    recs.push({ level: "warning", category: "외부 API", title: `${failedApis.length}개 API 연결 불안정`, detail: `${failedApis.map(a => a.name).join(", ")} — 해당 서비스의 상태 페이지를 확인하거나, 네트워크 연결을 점검하세요.` });
  }
  const slowApis = data.api.filter(a => a.responseTime && a.responseTime > 3000);
  if (slowApis.length > 0) {
    recs.push({ level: "info", category: "외부 API", title: `${slowApis.length}개 API 응답 느림`, detail: `${slowApis.map(a => `${a.name}(${a.responseTime}ms)`).join(", ")} — 타임아웃 설정 검토 및 캐싱 도입을 고려하세요.` });
  }
  if (failedApis.length === 0 && slowApis.length === 0) {
    recs.push({ level: "good", category: "외부 API", title: `모든 API 연결 정상 (${data.api.length}개)`, detail: "연동된 모든 외부 API가 정상적으로 응답하고 있습니다." });
  }

  // === 환경 변수 ===
  const essentialMissing = data.environment.missing.filter(k =>
    ["DATABASE_URL", "SESSION_SECRET", "ADMIN_PASSWORD_HASH", "VITE_GOOGLE_CLIENT_ID"].includes(k)
  );
  if (essentialMissing.length > 0) {
    recs.push({ level: "critical", category: "환경 변수", title: `필수 환경변수 미설정 (${essentialMissing.length}개)`, detail: `${essentialMissing.join(", ")} — Vercel 환경변수에 즉시 등록하세요. 서비스 장애 위험이 있습니다.` });
  }
  const aiKeys = ["GEMINI_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY"];
  const hasAnyAi = aiKeys.some(k => data.environment.configured.includes(k));
  if (!hasAnyAi) {
    recs.push({ level: "warning", category: "환경 변수", title: "AI API 키 미설정", detail: "GEMINI_API_KEY, OPENAI_API_KEY, GROQ_API_KEY 중 하나 이상을 설정해야 AI 기능(보고서 생성, AI Agent 등)을 사용할 수 있습니다." });
  }
  const optionalMissing = data.environment.missing.filter(k =>
    !essentialMissing.includes(k) && !aiKeys.includes(k)
  );
  if (optionalMissing.length > 0 && optionalMissing.length <= 5) {
    recs.push({ level: "info", category: "환경 변수", title: `선택 환경변수 미설정 (${optionalMissing.length}개)`, detail: `${optionalMissing.join(", ")} — 해당 기능을 사용하지 않으면 무시해도 됩니다.` });
  }
  if (essentialMissing.length === 0 && hasAnyAi) {
    recs.push({ level: "good", category: "환경 변수", title: "필수 환경변수 모두 설정됨", detail: "핵심 운영에 필요한 환경변수가 정상적으로 설정되어 있습니다." });
  }

  // === Cron / 보안 점검 ===
  if (!data.cronJobs?.lastSecurityAudit) {
    recs.push({ level: "warning", category: "보안", title: "보안 점검 미실행", detail: "보안 점검 실행 기록이 없습니다. Dashboard > 보안점검 탭에서 수동 점검을 실행하세요." });
  } else {
    const lastAuditTime = new Date(data.cronJobs.lastSecurityAudit.time).getTime();
    const hoursSince = (Date.now() - lastAuditTime) / (1000 * 60 * 60);
    if (hoursSince > 48) {
      recs.push({ level: "warning", category: "보안", title: `보안 점검 ${Math.floor(hoursSince)}시간 경과`, detail: "마지막 보안 점검 이후 48시간 이상 경과했습니다. 정기 점검을 실행하세요." });
    } else {
      recs.push({ level: "good", category: "보안", title: "보안 점검 최신 상태", detail: `마지막 점검: ${new Date(data.cronJobs.lastSecurityAudit.time).toLocaleString("ko-KR")} (${data.cronJobs.lastSecurityAudit.resultCount}건)` });
    }
  }

  // === 에러 ===
  if (data.recentErrors && data.recentErrors.length > 5) {
    recs.push({ level: "warning", category: "에러", title: `최근 에러 ${data.recentErrors.length}건 감지`, detail: "에러 로그가 다수 발생하고 있습니다. 패턴을 분석하여 반복 에러를 해결하세요." });
  } else if (data.recentErrors && data.recentErrors.length > 0) {
    recs.push({ level: "info", category: "에러", title: `최근 에러 ${data.recentErrors.length}건`, detail: "소수의 에러가 감지되었습니다. 일시적 현상인지 지속적인지 모니터링하세요." });
  }

  // === 서버 가동 시간 ===
  if (data.server.uptime < 60) {
    recs.push({ level: "info", category: "서버", title: "서버 최근 재시작됨", detail: `가동시간이 ${Math.floor(data.server.uptime)}초입니다. Cold Start 또는 재배포 직후일 수 있습니다.` });
  }

  // 정렬: critical > warning > info > good
  const levelOrder = { critical: 0, warning: 1, info: 2, good: 3 };
  recs.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  return recs;
}

function StatusDot({ status }: { status: "ok" | "warning" | "error" }) {
  const colors = {
    ok: "bg-green-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
  };
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]} shadow-sm`} />
  );
}

export default function SystemMonitor() {
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery<SystemStatus>({
    queryKey: ["/api/admin/system/status"],
    refetchInterval: autoRefresh ? 30000 : false,
    staleTime: 10000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-60">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">시스템 상태 조회 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <XCircle className="w-10 h-10 mx-auto text-red-400 mb-3" />
          <p className="text-sm text-red-500">시스템 상태 조회 실패</p>
          <p className="text-xs text-muted-foreground mt-1">{(error as Error).message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            재시도
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const heapPercent = parseFloat(data.server.memory.heapUsagePercent);
  const envPercent = Math.round((data.environment.configuredCount / data.environment.total) * 100);
  const dbOk = data.database.status === "connected";
  const apiOkCount = data.api.filter(a => a.status === "ok" || a.status === "reachable").length;
  const apiTotalCount = data.api.length;

  // 종합 상태 판정
  const overallStatus: "ok" | "warning" | "error" =
    !dbOk ? "error" :
    heapPercent > 90 || data.performance.eventLoopLag > 100 ? "warning" :
    apiOkCount < apiTotalCount ? "warning" : "ok";

  const overallLabels = { ok: "정상", warning: "주의", error: "이상" };
  const overallColors = { ok: "text-green-600", warning: "text-yellow-600", error: "text-red-600" };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            시스템 모니터링
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            마지막 조회: {new Date(data.timestamp).toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            className="text-xs gap-1"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Clock className="w-3 h-3" />
            {autoRefresh ? "자동갱신 ON" : "자동갱신 OFF"}
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            새로고침
          </Button>
        </div>
      </div>

      {/* 종합 상태 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4 text-center">
            <StatusDot status={overallStatus} />
            <p className={`text-xl font-bold mt-1 ${overallColors[overallStatus]}`}>{overallLabels[overallStatus]}</p>
            <p className="text-[10px] text-muted-foreground">종합 상태</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Server className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-medium">서버</span>
            </div>
            <p className="text-sm font-bold">{data.server.isVercel ? "Vercel" : "Local"}</p>
            <p className="text-[10px] text-muted-foreground">{data.server.vercelRegion} · {data.server.vercelEnv}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Database className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs font-medium">DB</span>
            </div>
            <p className="text-sm font-bold">{dbOk ? `${data.database.pingMs}ms` : "오류"}</p>
            <p className="text-[10px] text-muted-foreground">{data.database.dbSize || "N/A"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <MemoryStick className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs font-medium">메모리</span>
            </div>
            <p className="text-sm font-bold">{data.server.memory.heapUsedFormatted}</p>
            <p className="text-[10px] text-muted-foreground">Heap {data.server.memory.heapUsagePercent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Gauge className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs font-medium">응답</span>
            </div>
            <p className="text-sm font-bold">{data.performance.totalCheckTimeMs}ms</p>
            <p className="text-[10px] text-muted-foreground">전체 조회 시간</p>
          </CardContent>
        </Card>
      </div>

      {/* 서버 정보 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-500" />
            서버 정보
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">플랫폼</span>
              <p className="font-medium">{data.server.platform}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Node.js</span>
              <p className="font-medium">{data.server.nodeVersion}</p>
            </div>
            <div>
              <span className="text-muted-foreground">가동 시간</span>
              <p className="font-medium">{formatUptime(data.server.uptime)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">PID</span>
              <p className="font-medium">{data.server.pid}</p>
            </div>
          </div>

          {/* 메모리 사용량 */}
          <div className="mt-4 space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <MemoryStick className="w-3 h-3" /> 메모리 사용량
            </h4>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Heap 사용률</span>
                  <span className={`font-mono font-medium ${heapPercent > 85 ? "text-red-500" : heapPercent > 70 ? "text-yellow-500" : "text-green-500"}`}>
                    {data.server.memory.heapUsagePercent}
                  </span>
                </div>
                <Progress value={heapPercent} className="h-2" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-muted/50 rounded-lg p-2">
                  <span className="text-muted-foreground">RSS</span>
                  <p className="font-mono font-medium">{data.server.memory.rssFormatted}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <span className="text-muted-foreground">Heap 전체</span>
                  <p className="font-mono font-medium">{data.server.memory.heapTotalFormatted}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <span className="text-muted-foreground">Heap 사용</span>
                  <p className="font-mono font-medium">{data.server.memory.heapUsedFormatted}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <span className="text-muted-foreground">Event Loop</span>
                  <p className={`font-mono font-medium ${data.performance.eventLoopLag > 50 ? "text-yellow-500" : "text-green-500"}`}>
                    {data.performance.eventLoopLag}ms lag
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DB 상태 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-green-500" />
            데이터베이스
            <Badge variant={dbOk ? "default" : "destructive"} className="text-[10px] ml-1">
              {dbOk ? "Connected" : "Error"}
            </Badge>
          </CardTitle>
          {dbOk && (
            <CardDescription className="text-xs">
              응답시간 {data.database.pingMs}ms · 크기 {data.database.dbSize} · 활성 커넥션 {data.database.activeConnections}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {data.database.error ? (
            <p className="text-sm text-red-500">{data.database.error}</p>
          ) : data.database.tables && data.database.tables.length > 0 ? (
            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">테이블</TableHead>
                    <TableHead className="text-xs text-right">행 수</TableHead>
                    <TableHead className="text-xs text-right">크기</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.database.tables.map((t) => (
                    <TableRow key={t.name}>
                      <TableCell className="text-xs font-mono">{t.name}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{t.rows.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{t.size}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">테이블 정보 없음</p>
          )}
        </CardContent>
      </Card>

      {/* 외부 API 상태 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wifi className="w-4 h-4 text-cyan-500" />
            외부 API 연결 상태
            <Badge variant="secondary" className="text-[10px] ml-1">
              {apiOkCount}/{apiTotalCount} 정상
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.api.map((api, idx) => (
              <div key={idx} className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <StatusDot status={api.status === "ok" || api.status === "reachable" ? "ok" : api.status === "unreachable" ? "error" : "warning"} />
                  <span className="text-xs font-medium">{api.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {api.responseTime !== undefined && (
                    <span className="font-mono text-muted-foreground">{api.responseTime}ms</span>
                  )}
                  {api.httpStatus && (
                    <Badge variant={api.httpStatus < 400 ? "secondary" : "destructive"} className="text-[10px]">
                      HTTP {api.httpStatus}
                    </Badge>
                  )}
                  <Badge
                    variant={api.status === "ok" || api.status === "reachable" ? "default" : "destructive"}
                    className="text-[10px]"
                  >
                    {api.status === "ok" ? "정상" : api.status === "reachable" ? "접속가능" : api.status === "unreachable" ? "접속불가" : api.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 환경 변수 설정 상태 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="w-4 h-4 text-orange-500" />
            환경 변수 설정 현황
            <Badge variant="secondary" className="text-[10px] ml-1">
              {data.environment.configuredCount}/{data.environment.total} 설정됨
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span>설정 완료율</span>
              <span className="font-mono font-medium">{envPercent}%</span>
            </div>
            <Progress value={envPercent} className="h-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 설정됨 ({data.environment.configured.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {data.environment.configured.map((k) => (
                  <Badge key={k} variant="outline" className="text-[10px] font-mono bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
                    {k}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-amber-600 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> 미설정 ({data.environment.missing.length})
              </p>
              {data.environment.missing.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {data.environment.missing.map((k) => (
                    <Badge key={k} variant="outline" className="text-[10px] font-mono bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
                      {k}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-green-500">모든 환경 변수가 설정되어 있습니다 ✓</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cron / 예약 작업 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            예약 작업 (Cron Jobs)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-medium">일일 보안 점검</span>
                <Badge variant="outline" className="text-[10px]">매일 00:00 KST</Badge>
              </div>
              <div className="text-xs text-right">
                {data.cronJobs?.lastSecurityAudit ? (
                  <div>
                    <span className="text-muted-foreground">마지막 실행: </span>
                    <span className="font-medium">
                      {new Date(data.cronJobs.lastSecurityAudit.time).toLocaleString("ko-KR")}
                    </span>
                    <Badge variant="secondary" className="text-[10px] ml-1">
                      {data.cronJobs.lastSecurityAudit.resultCount}건
                    </Badge>
                  </div>
                ) : (
                  <span className="text-muted-foreground">실행 기록 없음</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 최근 에러 */}
      {data.recentErrors && data.recentErrors.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              최근 에러 로그
              <Badge variant="destructive" className="text-[10px] ml-1">{data.recentErrors.length}건</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {data.recentErrors.map((err: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs bg-red-50 dark:bg-red-950/20 rounded p-2">
                  <span className="font-mono">{err.page}</span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{err.ip}</span>
                    <span>{new Date(err.created_at).toLocaleString("ko-KR")}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 조치 권고사항 */}
      <RecommendationsPanel data={data} />
    </div>
  );
}

// ===== 조치 권고사항 패널 =====
function RecommendationsPanel({ data }: { data: SystemStatus }) {
  const recs = generateRecommendations(data);
  const criticalCount = recs.filter(r => r.level === "critical").length;
  const warningCount = recs.filter(r => r.level === "warning").length;
  const infoCount = recs.filter(r => r.level === "info").length;
  const goodCount = recs.filter(r => r.level === "good").length;

  const levelStyles: Record<string, { bg: string; border: string; icon: React.ReactNode; label: string; badgeVariant: "destructive" | "default" | "secondary" | "outline" }> = {
    critical: { bg: "bg-red-50 dark:bg-red-950/30", border: "border-l-4 border-l-red-500", icon: <XCircle className="w-4 h-4 text-red-500 shrink-0" />, label: "긴급", badgeVariant: "destructive" },
    warning: { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-l-4 border-l-amber-500", icon: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />, label: "주의", badgeVariant: "default" },
    info: { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-l-4 border-l-blue-400", icon: <Lightbulb className="w-4 h-4 text-blue-500 shrink-0" />, label: "참고", badgeVariant: "secondary" },
    good: { bg: "bg-green-50 dark:bg-green-950/30", border: "border-l-4 border-l-green-500", icon: <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />, label: "양호", badgeVariant: "outline" },
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          점검 결과 및 조치 권고사항
          <div className="flex items-center gap-1 ml-2">
            {criticalCount > 0 && <Badge variant="destructive" className="text-[10px]">긴급 {criticalCount}</Badge>}
            {warningCount > 0 && <Badge className="text-[10px] bg-amber-500">주의 {warningCount}</Badge>}
            {infoCount > 0 && <Badge variant="secondary" className="text-[10px]">참고 {infoCount}</Badge>}
            {goodCount > 0 && <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">양호 {goodCount}</Badge>}
          </div>
        </CardTitle>
        <CardDescription className="text-xs">
          {criticalCount > 0
            ? "⚠️ 긴급 조치가 필요한 항목이 있습니다. 즉시 확인하세요."
            : warningCount > 0
            ? "주의 항목이 있습니다. 조치를 검토하세요."
            : "시스템이 전반적으로 양호한 상태입니다."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {recs.map((rec, idx) => {
            const style = levelStyles[rec.level];
            return (
              <div
                key={idx}
                className={`${style.bg} ${style.border} rounded-r-lg p-3`}
              >
                <div className="flex items-start gap-2.5">
                  {style.icon}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant={style.badgeVariant} className="text-[10px] px-1.5 py-0">
                        {style.label}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                        {rec.category}
                      </Badge>
                      <span className="text-xs font-semibold">{rec.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                      <ArrowRight className="w-3 h-3 inline mr-1 opacity-50" />
                      {rec.detail}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

