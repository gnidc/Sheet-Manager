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
  Gauge, Wifi, Lightbulb, ArrowRight, Copy, Check,
} from "lucide-react";

interface QueryTiming {
  name: string;
  ms: number;
  cached: boolean;
  query?: string;
}

interface DbDebug {
  queryTimings: QueryTiming[];
  totalDbQueryMs: number;
  poolStats?: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
    maxConnections: number | string;
    idleTimeoutMs: number | string;
    connectionTimeoutMs: number | string;
  };
  cacheStatus: {
    systemStatusCache: {
      active: boolean;
      ttlSeconds: number;
      remainingSeconds?: number;
      note: string;
    };
    dbDetailCache: {
      active: boolean;
      ttlSeconds: number;
      remainingSeconds: number;
      note: string;
    };
  };
  executionMode: string;
  note: string;
}

interface SystemStatus {
  timestamp: string;
  _cached?: boolean;
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
    coldStartMs?: number;
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
  dbDebug?: DbDebug;
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
    // Cold Start가 있었으면 별도 표시
    if (data.database.coldStartMs && data.database.coldStartMs > 500) {
      recs.push({ level: "info", category: "데이터베이스", title: `DB Cold Start 감지 (${data.database.coldStartMs}ms)`, detail: `TCP+SSL 핸드셰이크에 ${data.database.coldStartMs}ms 소요. 실제 DB 응답시간은 ${data.database.pingMs}ms입니다. Cold Start는 서버리스 환경에서 정상적인 현상입니다.` });
    }
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
            <p className="text-[10px] text-muted-foreground">
              {data.database.coldStartMs
                ? `Cold ${data.database.coldStartMs}ms · ${data.database.dbSize}`
                : data.database.dbSize || "N/A"}
            </p>
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
              응답시간 {data.database.pingMs}ms
              {data.database.coldStartMs ? ` (Cold Start ${data.database.coldStartMs}ms)` : ""}
              {" "}· 크기 {data.database.dbSize} · 활성 커넥션 {data.database.activeConnections}
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

      {/* DB 쿼리 상세 분석 (디버그) */}
      {data.dbDebug && <DbDebugPanel dbDebug={data.dbDebug} isCached={!!data._cached} />}

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
                    <span>{err.ip_address || err.ip || "-"}</span>
                    <span>{new Date(err.visited_at || err.created_at).toLocaleString("ko-KR")}</span>
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

// ===== DB 쿼리 상세 분석 패널 =====
function DbDebugPanel({ dbDebug, isCached }: { dbDebug: DbDebug; isCached: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // 클립보드 복사
  function handleCopy() {
    const lines: string[] = [];
    lines.push("=== DB 쿼리 상세 분석 ===");
    lines.push(`조회 시간: ${new Date().toLocaleString("ko-KR")}`);
    lines.push(`응답 소스: ${isCached ? "캐시" : "실시간 조회"}`);
    lines.push(`실행 모드: ${dbDebug.executionMode}`);
    lines.push("");

    lines.push("── 개별 쿼리 실행시간 ──");
    dbDebug.queryTimings.forEach(q => {
      lines.push(`  ${q.cached ? "[캐시]" : "[쿼리]"} ${q.name}: ${q.cached ? "0ms (캐시)" : `${q.ms}ms`}`);
      if (q.query) lines.push(`         └ ${q.query}`);
    });
    lines.push(`  합계: ${dbDebug.totalDbQueryMs}ms`);
    lines.push("");

    if (dbDebug.poolStats) {
      lines.push("── 커넥션 풀 상태 ──");
      lines.push(`  활성 연결: ${dbDebug.poolStats.totalCount - dbDebug.poolStats.idleCount} / ${dbDebug.poolStats.maxConnections}`);
      lines.push(`  유휴 연결: ${dbDebug.poolStats.idleCount}`);
      lines.push(`  대기 요청: ${dbDebug.poolStats.waitingCount}`);
      lines.push(`  전체 연결: ${dbDebug.poolStats.totalCount}`);
      lines.push(`  유휴 타임아웃: ${dbDebug.poolStats.idleTimeoutMs}ms`);
      lines.push(`  연결 타임아웃: ${dbDebug.poolStats.connectionTimeoutMs}ms`);
      lines.push("");
    }

    lines.push("── 캐시 상태 ──");
    const sc = dbDebug.cacheStatus.systemStatusCache;
    lines.push(`  시스템 상태 캐시: ${sc.active ? "활성" : "비활성"} (TTL: ${sc.ttlSeconds}초${sc.remainingSeconds !== undefined ? `, 남은시간: ${sc.remainingSeconds}초` : ""})`);
    lines.push(`    └ ${sc.note}`);
    const dc = dbDebug.cacheStatus.dbDetailCache;
    lines.push(`  DB 상세 캐시: ${dc.active ? "활성" : "비활성"} (TTL: ${dc.ttlSeconds}초${dc.remainingSeconds > 0 ? `, 남은시간: ${dc.remainingSeconds}초` : ""})`);
    lines.push(`    └ ${dc.note}`);
    lines.push("");
    lines.push(`참고: ${dbDebug.note}`);

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // 쿼리 시간 색상 결정
  function getTimeColor(ms: number, cached: boolean): string {
    if (cached) return "text-blue-500";
    if (ms > 500) return "text-red-500 font-bold";
    if (ms > 200) return "text-amber-500";
    if (ms > 50) return "text-yellow-600";
    return "text-green-500";
  }

  // 바 너비 계산 (최대 쿼리 시간 기준)
  const maxMs = Math.max(...dbDebug.queryTimings.map(q => q.ms), 1);

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <CardTitle className="text-sm flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-500" />
          DB 쿼리 상세 분석
          <Badge variant="secondary" className="text-[10px] ml-1">
            {dbDebug.queryTimings.length}개 쿼리
          </Badge>
          <Badge variant={dbDebug.totalDbQueryMs > 500 ? "destructive" : "outline"} className="text-[10px]">
            합계 {dbDebug.totalDbQueryMs}ms
          </Badge>
          {isCached && (
            <Badge className="text-[10px] bg-blue-500">캐시 응답</Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            {expanded && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1"
                onClick={(e) => { e.stopPropagation(); handleCopy(); }}
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                {copied ? "복사됨" : "복사"}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">{expanded ? "▲ 접기" : "▼ 펼치기"}</span>
          </div>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          {/* 쿼리 타이밍 시각화 */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Activity className="w-3 h-3" /> 개별 쿼리 실행 시간
            </h4>
            <div className="space-y-1.5">
              {dbDebug.queryTimings.map((q, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-48 shrink-0">
                    <div className="flex items-center gap-1.5">
                      {q.cached ? (
                        <Badge variant="secondary" className="text-[8px] px-1 py-0">캐시</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[8px] px-1 py-0">쿼리</Badge>
                      )}
                      <span className="text-xs truncate">{q.name}</span>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          q.cached ? "bg-blue-400" :
                          q.ms > 500 ? "bg-red-400" :
                          q.ms > 200 ? "bg-amber-400" :
                          q.ms > 50 ? "bg-yellow-400" : "bg-green-400"
                        }`}
                        style={{ width: `${Math.max((q.ms / maxMs) * 100, q.cached ? 5 : 2)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono w-14 text-right ${getTimeColor(q.ms, q.cached)}`}>
                      {q.cached ? "0ms" : `${q.ms}ms`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {/* 쿼리 상세 */}
            <div className="mt-3 space-y-1">
              {dbDebug.queryTimings.map((q, idx) => (
                <div key={idx} className="text-[10px] font-mono text-muted-foreground bg-muted/30 rounded px-2 py-1">
                  <span className="text-foreground font-medium">{q.name}:</span>{" "}
                  <span className="opacity-75">{q.query || "-"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 커넥션 풀 상태 */}
          {dbDebug.poolStats && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Database className="w-3 h-3" /> 커넥션 풀 상태
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div className="bg-muted/50 rounded-lg p-2.5">
                  <span className="text-[10px] text-muted-foreground block">활성 연결</span>
                  <span className={`text-sm font-mono font-bold ${
                    dbDebug.poolStats.totalCount - dbDebug.poolStats.idleCount > 0 ? "text-blue-500" : "text-green-500"
                  }`}>
                    {dbDebug.poolStats.totalCount - dbDebug.poolStats.idleCount}
                  </span>
                  <span className="text-[10px] text-muted-foreground"> / {dbDebug.poolStats.maxConnections}</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-2.5">
                  <span className="text-[10px] text-muted-foreground block">유휴 연결</span>
                  <span className="text-sm font-mono font-bold text-green-500">{dbDebug.poolStats.idleCount}</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-2.5">
                  <span className="text-[10px] text-muted-foreground block">대기 요청</span>
                  <span className={`text-sm font-mono font-bold ${
                    dbDebug.poolStats.waitingCount > 0 ? "text-red-500" : "text-green-500"
                  }`}>
                    {dbDebug.poolStats.waitingCount}
                  </span>
                </div>
                <div className="bg-muted/50 rounded-lg p-2.5">
                  <span className="text-[10px] text-muted-foreground block">전체 연결</span>
                  <span className="text-sm font-mono font-bold">{dbDebug.poolStats.totalCount}</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-2.5">
                  <span className="text-[10px] text-muted-foreground block">유휴 타임아웃</span>
                  <span className="text-sm font-mono">{dbDebug.poolStats.idleTimeoutMs}ms</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-2.5">
                  <span className="text-[10px] text-muted-foreground block">연결 타임아웃</span>
                  <span className="text-sm font-mono">{dbDebug.poolStats.connectionTimeoutMs}ms</span>
                </div>
              </div>
            </div>
          )}

          {/* 캐시 상태 */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <HardDrive className="w-3 h-3" /> 캐시 상태
            </h4>
            <div className="space-y-1.5">
              <div className={`flex items-center justify-between rounded-lg p-2.5 text-xs ${
                dbDebug.cacheStatus.systemStatusCache.active ? "bg-blue-50 dark:bg-blue-950/30" : "bg-muted/50"
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${dbDebug.cacheStatus.systemStatusCache.active ? "bg-blue-500" : "bg-gray-400"}`} />
                  <span className="font-medium">시스템 상태 캐시</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>TTL: {dbDebug.cacheStatus.systemStatusCache.ttlSeconds}초</span>
                  {dbDebug.cacheStatus.systemStatusCache.remainingSeconds !== undefined && (
                    <Badge variant="outline" className="text-[10px]">
                      남은시간: {dbDebug.cacheStatus.systemStatusCache.remainingSeconds}초
                    </Badge>
                  )}
                  <span className="text-[10px]">{dbDebug.cacheStatus.systemStatusCache.note}</span>
                </div>
              </div>
              <div className={`flex items-center justify-between rounded-lg p-2.5 text-xs ${
                dbDebug.cacheStatus.dbDetailCache.active ? "bg-blue-50 dark:bg-blue-950/30" : "bg-muted/50"
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${dbDebug.cacheStatus.dbDetailCache.active ? "bg-blue-500" : "bg-gray-400"}`} />
                  <span className="font-medium">DB 상세 캐시</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>TTL: {dbDebug.cacheStatus.dbDetailCache.ttlSeconds}초</span>
                  {dbDebug.cacheStatus.dbDetailCache.remainingSeconds > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      남은시간: {dbDebug.cacheStatus.dbDetailCache.remainingSeconds}초
                    </Badge>
                  )}
                  <span className="text-[10px]">{dbDebug.cacheStatus.dbDetailCache.note}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 실행 모드 및 참고 */}
          <div className="bg-muted/30 rounded-lg p-3 text-[11px] text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="w-3 h-3 text-yellow-500 shrink-0" />
              <span><strong>실행 모드:</strong> {dbDebug.executionMode}</span>
            </div>
            <p className="ml-4.5">{dbDebug.note}</p>
          </div>
        </CardContent>
      )}
    </Card>
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

