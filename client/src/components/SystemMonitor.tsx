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
  Gauge, Wifi, Shield, Calendar,
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
    </div>
  );
}

