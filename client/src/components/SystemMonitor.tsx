import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw, Server, Database, Globe, Key, Activity, Clock, HardDrive,
  Cpu, MemoryStick, CheckCircle2, XCircle, AlertTriangle, Loader2,
  Gauge, Wifi, Lightbulb, ArrowRight, Copy, Check, Trash2,
  Camera, Download, FileSearch, Info, Monitor, TrendingUp,
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

interface MemoryBreakdownItem {
  name: string;
  sizeBytes: number;
  sizeFormatted: string;
  percent: string;
  category: string;
}

interface MemoryBreakdown {
  items: MemoryBreakdownItem[];
  totalRss: number;
  totalRssFormatted: string;
  heapStats: {
    totalHeapSize: string;
    usedHeapSize: string;
    heapSizeLimit: string;
    mallocedMemory: string;
    peakMallocedMemory: string;
    numberOfNativeContexts: number;
    numberOfDetachedContexts: number;
  } | null;
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
    memoryBreakdown?: MemoryBreakdown;
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
    recs.push({ level: "critical", category: "메모리", title: `Heap 사용률 위험 (${data.server.memory.heapUsagePercent})`, detail: "메모리 사용률이 90%를 초과했습니다. 메모리 누수 가능성이 높습니다. 위의 Heap Snapshot 패널에서 스냅샷을 2~3개 생성한 뒤 Chrome DevTools에서 Comparison 분석을 권장합니다." });
  } else if (heapPct > 75) {
    recs.push({ level: "warning", category: "메모리", title: `Heap 사용률 주의 (${data.server.memory.heapUsagePercent})`, detail: "메모리 사용률이 75%를 초과했습니다. 시간 경과에 따라 계속 증가하는지 확인하세요. 증가 추세가 보이면 Heap Snapshot 비교 분석을 권장합니다." });
  } else {
    recs.push({ level: "good", category: "메모리", title: `메모리 사용량 정상 (${data.server.memory.heapUsagePercent})`, detail: "Heap 메모리 사용률이 안정적입니다." });
  }

  // Detached Context 경고 (메모리 누수 강력한 신호)
  const detachedContexts = data.server.memoryBreakdown?.heapStats?.numberOfDetachedContexts ?? 0;
  if (detachedContexts > 0) {
    recs.push({
      level: detachedContexts > 3 ? "warning" : "info",
      category: "메모리",
      title: `Detached Context ${detachedContexts}개 감지`,
      detail: `V8에서 분리된 컨텍스트(Detached Context)가 ${detachedContexts}개 발견되었습니다. 이는 메모리 누수의 강력한 신호입니다. Heap Snapshot을 찍어 (Detached) 접두사가 붙은 객체를 추적하세요. 주로 이벤트 리스너 미해제, 클로저 참조, 타이머 미정리가 원인입니다.`,
    });
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

function MainSystemMonitor() {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [clearResult, setClearResult] = useState<{ cleared: string[]; memory: any; timestamp: string } | null>(null);

  // enabled: false → 탭 진입 시 자동 API 호출 안 함 (캐시된 데이터만 표시)
  const { data, isLoading, error, refetch, isFetching } = useQuery<SystemStatus>({
    queryKey: ["/api/admin/system/status"],
    enabled: false, // 수동 점검만 실행
    refetchInterval: autoRefresh ? 30000 : false,
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유효
    gcTime: 30 * 60 * 1000, // 30분간 캐시 유지
  });

  const clearCacheMutation = useMutation({
    mutationFn: async (target: "all" | "caches" | "gc") => {
      const res = await fetch("/api/admin/system/clear-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target }),
      });
      if (!res.ok) throw new Error("캐시 클리어 실패");
      return res.json();
    },
    onSuccess: (data) => {
      setClearResult(data);
      refetch();
    },
  });

  // 점검 실행 중 (첫 로딩)
  if (isLoading && !data) {
    return (
      <div className="flex justify-center items-center h-60">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">시스템 상태 조회 중...</span>
      </div>
    );
  }

  // 데이터 없음: 초기 화면 (점검 시작 버튼)
  if (!data && !isFetching) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-16 text-center">
            <Activity className="w-14 h-14 mx-auto text-blue-400/60 mb-4" />
            <h3 className="text-lg font-bold">Vercel System 점검</h3>
            <p className="text-sm text-muted-foreground mt-2 mb-6">
              시스템 점검을 실행하면 서버 상태, DB 연결, API 상태, 메모리 사용량 등을 분석합니다.
            </p>
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <p className="text-sm text-red-500 flex items-center gap-1.5 justify-center">
                  <XCircle className="w-4 h-4" />
                  이전 점검 실패: {(error as Error).message}
                </p>
              </div>
            )}
            <Button 
              size="lg" 
              className="gap-2 px-8"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Activity className="w-5 h-5" />
              )}
              시스템 점검 실행
            </Button>
            <p className="text-[11px] text-muted-foreground mt-3">
              DB 쿼리, 외부 API 연결 확인 등으로 약 2~5초 소요됩니다
            </p>
          </CardContent>
        </Card>
        <HeapSnapshotPanel />
      </div>
    );
  }

  // 점검 실행 중 (데이터 없이 fetching)
  if (!data && isFetching) {
    return (
      <div className="flex justify-center items-center h-60">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">시스템 점검 실행 중...</span>
      </div>
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            Vercel System 점검
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            마지막 점검: {new Date(data.timestamp).toLocaleString("ko-KR")}
            {data._cached && <span className="ml-1.5 text-blue-500">(캐시됨)</span>}
            {(() => {
              const ageMs = Date.now() - new Date(data.timestamp).getTime();
              const ageMin = Math.floor(ageMs / 60000);
              if (ageMin >= 1) return <span className="ml-1.5 text-muted-foreground">({ageMin}분 전)</span>;
              return <span className="ml-1.5 text-green-600">(방금)</span>;
            })()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="destructive"
            size="sm"
            className="text-xs gap-1"
            onClick={() => clearCacheMutation.mutate("all")}
            disabled={clearCacheMutation.isPending}
          >
            {clearCacheMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            캐시/메모리 클리어
          </Button>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            className="text-xs gap-1"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Clock className="w-3 h-3" />
            {autoRefresh ? "자동갱신 ON" : "자동갱신 OFF"}
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            className="text-xs gap-1" 
            onClick={() => refetch()} 
            disabled={isFetching}
          >
            {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
            {isFetching ? "점검 중..." : "새 점검 실행"}
          </Button>
        </div>
      </div>

      {/* 점검 중 오버레이 알림 */}
      {isFetching && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          <span className="text-sm text-blue-700 dark:text-blue-300">새로운 시스템 점검을 실행 중입니다... 아래는 이전 점검 결과입니다.</span>
        </div>
      )}

      {/* 캐시 클리어 결과 */}
      {clearResult && (
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  캐시/메모리 클리어 완료
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(clearResult.timestamp).toLocaleString("ko-KR")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {clearResult.cleared.map((item, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{item}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  클리어 후 메모리: RSS {clearResult.memory.rss} · Heap {clearResult.memory.heapUsed} / {clearResult.memory.heapTotal} ({clearResult.memory.heapUsagePercent})
                </p>
              </div>
              <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => setClearResult(null)}>
                <XCircle className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

          {/* 프로세스별 메모리 사용률 (Top 10) */}
          {data.server.memoryBreakdown && (
            <MemoryBreakdownPanel breakdown={data.server.memoryBreakdown} />
          )}
        </CardContent>
      </Card>

      {/* Heap Snapshot 관리 */}
      <HeapSnapshotPanel />

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

// ===== 프로세스별 메모리 사용률 (Top 10) 패널 =====
function MemoryBreakdownPanel({ breakdown }: { breakdown: MemoryBreakdown }) {
  const [expanded, setExpanded] = useState(false);

  // 색상 배열 (막대 그래프용)
  const barColors = [
    "bg-blue-500", "bg-purple-500", "bg-orange-500", "bg-emerald-500", "bg-red-500",
    "bg-cyan-500", "bg-yellow-500", "bg-pink-500", "bg-indigo-500", "bg-lime-500",
  ];

  const items = breakdown.items || [];
  const maxSize = items.length > 0 ? items[0].sizeBytes : 1;

  return (
    <div className="mt-4 border rounded-lg">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 rounded-t-lg transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-purple-500" />
          프로세스별 메모리 사용률 (Top 10)
          <Badge variant="outline" className="text-[9px] px-1 ml-1">
            RSS {breakdown.totalRssFormatted}
          </Badge>
        </span>
        <span className="text-[10px]">{expanded ? "▲ 접기" : "▼ 펼치기"}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* 메모리 영역별 막대 그래프 */}
          <div className="space-y-1.5">
            {items.map((item, idx) => {
              const pct = (item.sizeBytes / breakdown.totalRss) * 100;
              const barWidth = (item.sizeBytes / maxSize) * 100;
              return (
                <div key={idx} className="group">
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className={`inline-block w-2 h-2 rounded-sm flex-shrink-0 ${barColors[idx % barColors.length]}`} />
                      <span className="truncate font-medium">{item.name}</span>
                      <Badge variant="outline" className="text-[8px] px-1 flex-shrink-0 opacity-60">
                        {item.category}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="font-mono text-muted-foreground">{item.sizeFormatted}</span>
                      <span className={`font-mono font-medium w-12 text-right ${pct > 30 ? "text-red-500" : pct > 15 ? "text-yellow-500" : "text-green-600"}`}>
                        {item.percent}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColors[idx % barColors.length]} opacity-70`}
                      style={{ width: `${Math.max(barWidth, 1)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* V8 힙 통계 요약 */}
          {breakdown.heapStats ? (
            <div className="border-t pt-2 mt-2">
              <h5 className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Cpu className="w-3 h-3" /> V8 엔진 통계
              </h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                <div className="bg-muted/50 rounded p-1.5">
                  <span className="text-muted-foreground">Heap 한도</span>
                  <p className="font-mono font-medium">{breakdown.heapStats.heapSizeLimit}</p>
                </div>
                <div className="bg-muted/50 rounded p-1.5">
                  <span className="text-muted-foreground">Malloc 메모리</span>
                  <p className="font-mono font-medium">{breakdown.heapStats.mallocedMemory}</p>
                </div>
                <div className="bg-muted/50 rounded p-1.5">
                  <span className="text-muted-foreground">Peak Malloc</span>
                  <p className="font-mono font-medium">{breakdown.heapStats.peakMallocedMemory}</p>
                </div>
                <div className="bg-muted/50 rounded p-1.5">
                  <span className="text-muted-foreground">Native Context</span>
                  <p className="font-mono font-medium">{breakdown.heapStats.numberOfNativeContexts}개</p>
                </div>
              </div>
              {breakdown.heapStats.numberOfDetachedContexts > 0 && (
                <p className="text-[10px] text-yellow-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Detached Context {breakdown.heapStats.numberOfDetachedContexts}개 감지 (메모리 누수 가능성)
                </p>
              )}
            </div>
          ) : (
            <div className="border-t pt-2 mt-2">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-yellow-500" />
                V8 상세 통계를 사용할 수 없는 환경입니다 (ESM/Serverless)
              </p>
            </div>
          )}
        </div>
      )}
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

// ===== Heap Snapshot 관리 패널 =====
interface SnapshotInfo {
  filename: string;
  sizeMB: string;
  sizeBytes: number;
  createdAt: string;
}

interface SnapshotListResponse {
  snapshots: SnapshotInfo[];
  totalCount: number;
  maxSnapshots: number;
}

function HeapSnapshotPanel() {
  const [expanded, setExpanded] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState<{
    filename: string;
    sizeMB: string;
    memoryBefore: { heapUsed: string; heapTotal: string };
    memoryAfter: { heapUsed: string; heapTotal: string };
  } | null>(null);

  const snapshotListQuery = useQuery<SnapshotListResponse>({
    queryKey: ["/api/admin/system/heap-snapshots"],
    queryFn: async () => {
      const res = await fetch("/api/admin/system/heap-snapshots", { credentials: "include" });
      if (!res.ok) throw new Error("목록 조회 실패");
      return res.json();
    },
    enabled: expanded,
    staleTime: 10_000,
  });

  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/system/heap-snapshot", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "스냅샷 생성 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSnapshotResult(data);
      snapshotListQuery.refetch();
    },
  });

  const deleteSnapshotMutation = useMutation({
    mutationFn: async (filename: string) => {
      const res = await fetch(`/api/admin/system/heap-snapshot/${filename}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("삭제 실패");
      return res.json();
    },
    onSuccess: () => {
      snapshotListQuery.refetch();
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/system/heap-snapshots", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("전체 삭제 실패");
      return res.json();
    },
    onSuccess: () => {
      snapshotListQuery.refetch();
      setSnapshotResult(null);
    },
  });

  const snapshots = snapshotListQuery.data?.snapshots ?? [];
  const maxSnapshots = snapshotListQuery.data?.maxSnapshots ?? 5;

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <CardTitle className="text-sm flex items-center gap-2">
          <Camera className="w-4 h-4 text-violet-500" />
          Heap Snapshot (메모리 누수 분석)
          {snapshots.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-1">
              {snapshots.length}/{maxSnapshots}개
            </Badge>
          )}
          <span className="ml-auto text-xs text-muted-foreground font-normal">
            {expanded ? "▲ 접기" : "▼ 펼치기"}
          </span>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          {/* 안내 */}
          <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg p-3 text-xs space-y-1.5">
            <p className="font-medium flex items-center gap-1.5 text-violet-700 dark:text-violet-300">
              <FileSearch className="w-3.5 h-3.5" />
              Heap Snapshot으로 메모리 누수 원인 찾기
            </p>
            <ol className="list-decimal list-inside text-muted-foreground space-y-0.5 ml-1">
              <li>아래 버튼으로 스냅샷 2~3개를 <strong>시간 간격</strong>을 두고 생성</li>
              <li>생성된 .heapsnapshot 파일을 로컬로 다운로드</li>
              <li>Chrome → <code className="px-1 py-0.5 bg-muted rounded text-[10px]">chrome://inspect</code> → Open dedicated DevTools for Node → Memory 탭</li>
              <li>Load로 스냅샷 로드 → <strong>Comparison</strong> 모드에서 증가분 확인</li>
            </ol>
            <p className="text-[10px] text-muted-foreground mt-1">
              Summary 탭에서 (Constructor)별 크기 확인 → (array), (string), closure 등이 크면 해당 코드 추적
            </p>
          </div>

          {/* 스냅샷 생성 버튼 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => createSnapshotMutation.mutate()}
              disabled={createSnapshotMutation.isPending || snapshots.length >= maxSnapshots}
            >
              {createSnapshotMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
              {createSnapshotMutation.isPending ? "스냅샷 생성 중..." : "Heap Snapshot 생성"}
            </Button>
            {snapshots.length >= maxSnapshots && (
              <span className="text-[10px] text-amber-600">최대 {maxSnapshots}개까지 저장 가능</span>
            )}
            {snapshots.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1 text-xs ml-auto"
                onClick={() => {
                  if (confirm("모든 스냅샷을 삭제하시겠습니까?")) deleteAllMutation.mutate();
                }}
                disabled={deleteAllMutation.isPending}
              >
                {deleteAllMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                전체 삭제
              </Button>
            )}
          </div>

          {/* 생성 에러 */}
          {createSnapshotMutation.isError && (
            <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-2.5 text-xs text-red-600 flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              {(createSnapshotMutation.error as Error).message}
            </div>
          )}

          {/* 생성 결과 */}
          {snapshotResult && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-semibold flex items-center gap-1.5 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    스냅샷 생성 완료
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1 font-mono">{snapshotResult.filename} ({snapshotResult.sizeMB})</p>
                  <div className="mt-1.5 text-[10px] text-muted-foreground grid grid-cols-2 gap-x-4">
                    <span>생성 전: Heap {snapshotResult.memoryBefore.heapUsed} / {snapshotResult.memoryBefore.heapTotal}</span>
                    <span>생성 후: Heap {snapshotResult.memoryAfter.heapUsed} / {snapshotResult.memoryAfter.heapTotal}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-5 px-1" onClick={() => setSnapshotResult(null)}>
                  <XCircle className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {/* 스냅샷 목록 */}
          {snapshotListQuery.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              스냅샷 목록 로드 중...
            </div>
          ) : snapshots.length > 0 ? (
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                저장된 스냅샷 ({snapshots.length}개)
              </h4>
              {snapshots.map((snap) => (
                <div key={snap.filename} className="flex items-center justify-between bg-muted/30 rounded-lg p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono truncate">{snap.filename}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(snap.createdAt).toLocaleString("ko-KR")} · {snap.sizeMB}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[10px] gap-1"
                      onClick={() => {
                        window.open(`/api/admin/system/heap-snapshot/${snap.filename}`, "_blank");
                      }}
                    >
                      <Download className="w-3 h-3" />
                      다운로드
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => {
                        if (confirm(`${snap.filename}을 삭제하시겠습니까?`)) {
                          deleteSnapshotMutation.mutate(snap.filename);
                        }
                      }}
                      disabled={deleteSnapshotMutation.isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-1">저장된 스냅샷이 없습니다.</p>
          )}

          {/* 분석 팁 */}
          {snapshots.length >= 2 && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2.5 text-[11px] text-blue-700 dark:text-blue-300">
              <p className="font-medium flex items-center gap-1 mb-1">
                <Info className="w-3 h-3" />
                비교 분석 가능
              </p>
              <p className="text-muted-foreground">
                스냅샷 {snapshots.length}개가 있습니다. 모두 다운로드하여 Chrome DevTools Memory 탭에서
                Comparison 모드로 비교하면 시간에 따른 메모리 증가 객체를 정확히 식별할 수 있습니다.
              </p>
            </div>
          )}
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

// ========== Trading App 시스템 모니터 ==========

const TRADING_APP_URL = "https://lifefit2.vercel.app";

function TradingSystemMonitor() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [data, setData] = useState<any>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);

  const runCheck = async () => {
    setStatus("loading");

    const checks: { name: string; status: string; responseTime?: number; error?: string }[] = [];
    const start = Date.now();

    // 1. 기본 연결 (ping)
    try {
      const pingStart = Date.now();
      const res = await fetch(`${TRADING_APP_URL}/api/ping`, { mode: "cors" });
      const pingTime = Date.now() - pingStart;
      setPingMs(pingTime);
      checks.push({ name: "서버 연결 (ping)", status: res.ok ? "ok" : "error", responseTime: pingTime, error: res.ok ? undefined : `HTTP ${res.status}` });
    } catch (e: any) {
      setPingMs(null);
      checks.push({ name: "서버 연결 (ping)", status: "error", error: e.message });
    }

    // 2. 인증 API
    try {
      const s = Date.now();
      const res = await fetch(`${TRADING_APP_URL}/api/auth/me`, { mode: "cors" });
      checks.push({ name: "인증 API (/api/auth/me)", status: res.ok || res.status === 401 ? "ok" : "error", responseTime: Date.now() - s, error: res.ok || res.status === 401 ? undefined : `HTTP ${res.status}` });
    } catch (e: any) {
      checks.push({ name: "인증 API (/api/auth/me)", status: "error", error: e.message });
    }

    // 3. 트레이딩 상태 API
    try {
      const s = Date.now();
      const res = await fetch(`${TRADING_APP_URL}/api/trading/status`, { mode: "cors" });
      checks.push({ name: "트레이딩 API (/api/trading/status)", status: res.ok || res.status === 401 ? "ok" : "error", responseTime: Date.now() - s, error: res.ok || res.status === 401 ? undefined : `HTTP ${res.status}` });
    } catch (e: any) {
      checks.push({ name: "트레이딩 API (/api/trading/status)", status: "error", error: e.message });
    }

    const totalMs = Date.now() - start;
    const okCount = checks.filter(c => c.status === "ok").length;

    setData({ checks, totalMs, okCount, totalCount: checks.length, checkedAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) });
    setStatus(okCount === checks.length ? "success" : "error");
  };

  if (status === "idle") {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <TrendingUp className="w-14 h-14 mx-auto text-emerald-400/60 mb-4" />
          <h3 className="text-lg font-bold">Trading App 시스템 점검</h3>
          <p className="text-sm text-muted-foreground mt-2 mb-1">
            배포 URL: <a href={TRADING_APP_URL} target="_blank" rel="noreferrer" className="text-primary hover:underline">{TRADING_APP_URL}</a>
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Trading App의 서버 연결, 인증 API, 트레이딩 API 상태를 확인합니다.
          </p>
          <Button size="lg" className="gap-2 px-8" onClick={runCheck}>
            <Activity className="w-5 h-5" />
            시스템 점검 실행
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center h-60">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Trading App 점검 중...</span>
      </div>
    );
  }

  const overallOk = data?.okCount === data?.totalCount;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${overallOk ? "bg-green-100 dark:bg-green-950/40" : "bg-red-100 dark:bg-red-950/40"}`}>
              {overallOk ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-500" />}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">종합 상태</p>
              <p className={`text-sm font-bold ${overallOk ? "text-green-600" : "text-red-500"}`}>
                {overallOk ? "정상" : "이상 감지"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/40">
              <Wifi className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">서버 응답</p>
              <p className="text-sm font-bold">{pingMs !== null ? `${pingMs}ms` : "N/A"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/40">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">총 점검 시간</p>
              <p className="text-sm font-bold">{data?.totalMs}ms</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4" />
              API 연결 상태 ({data?.okCount}/{data?.totalCount})
            </CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={runCheck}>
              <RefreshCw className="w-3.5 h-3.5" />
              재점검
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>API</TableHead>
                <TableHead className="w-24 text-center">상태</TableHead>
                <TableHead className="w-28 text-right">응답시간</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.checks.map((check: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-sm">{check.name}</TableCell>
                  <TableCell className="text-center">
                    {check.status === "ok" ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">정상</Badge>
                    ) : (
                      <Badge variant="destructive">오류</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {check.responseTime ? `${check.responseTime}ms` : "-"}
                    {check.error && <p className="text-[10px] text-red-500 mt-0.5">{check.error}</p>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-[11px] text-muted-foreground mt-3 text-right">
            점검 시각: {data?.checkedAt}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ========== 통합 시스템 모니터 (탭 래퍼) ==========

export default function SystemMonitor() {
  const [activeSystem, setActiveSystem] = useState("main");

  return (
    <div className="space-y-4">
      <Tabs value={activeSystem} onValueChange={setActiveSystem}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="main" className="gap-1.5">
            <Monitor className="w-4 h-4" />
            시스템1 (메인)
          </TabsTrigger>
          <TabsTrigger value="trading" className="gap-1.5">
            <TrendingUp className="w-4 h-4" />
            시스템2 (트레이딩)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="main">
          <MainSystemMonitor />
        </TabsContent>
        <TabsContent value="trading">
          <TradingSystemMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

