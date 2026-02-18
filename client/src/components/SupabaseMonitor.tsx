import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw, Database, Server, Activity, HardDrive, Shield, Gauge,
  AlertTriangle, CheckCircle2, XCircle, Loader2, Copy, Check,
  Settings, Zap, Clock, Layers, Search, PlugZap,
} from "lucide-react";

interface SupabaseStatus {
  timestamp: string;
  checkDurationMs: number;
  server: {
    version: string;
    uptime: { uptime: string; startedAt: string };
    dbSize: { totalSize: string; dbName: string };
    isReplica: boolean;
  };
  connections: {
    total: number;
    active: number;
    idle: number;
    idle_in_transaction: number;
    max_connections: number;
  };
  cacheHit: {
    hits: string;
    reads: string;
    hit_ratio: string;
  };
  tables: {
    schemaname: string;
    table_name: string;
    live_rows: number;
    dead_rows: number;
    total_size: string;
    size_bytes: number;
    dead_ratio: number;
    last_vacuum: string | null;
    last_autovacuum: string | null;
    last_analyze: string | null;
    last_autoanalyze: string | null;
  }[];
  indexes: {
    schemaname: string;
    table_name: string;
    index_name: string;
    scans: number;
    index_size: string;
    size_bytes: number;
  }[];
  locks: { locktype: string; mode: string; granted: boolean; count: number }[];
  vacuum: {
    table_name: string;
    last_vacuum: string | null;
    last_autovacuum: string | null;
    dead_tuples: number;
    live_tuples: number;
  }[];
  deadTuples: {
    table_name: string;
    live: number;
    dead: number;
    dead_pct: number;
  }[];
  slowQueries: {
    query: string;
    calls: number;
    avg_time_ms: number;
    total_time_ms: number;
    total_rows: number;
  }[];
  extensions: { extname: string; extversion: string }[];
  settings: { name: string; setting: string; unit: string | null; short_desc: string }[];
  recommendations: { level: string; title: string; detail: string }[];
}

function formatUptime(uptimeStr: string): string {
  if (!uptimeStr || uptimeStr === "unknown" || uptimeStr === "조회 실패") return uptimeStr;
  // PostgreSQL interval format: "3 days 04:05:06.123"
  const match = uptimeStr.match(/(?:(\d+)\s*days?)?\s*(\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const days = parseInt(match[1] || "0");
    const hours = parseInt(match[2]);
    const mins = parseInt(match[3]);
    if (days > 0) return `${days}일 ${hours}시간 ${mins}분`;
    if (hours > 0) return `${hours}시간 ${mins}분`;
    return `${mins}분`;
  }
  return uptimeStr;
}

function LevelIcon({ level }: { level: string }) {
  switch (level) {
    case "critical": return <XCircle className="w-4 h-4 text-red-500" />;
    case "warning": return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case "info": return <Activity className="w-4 h-4 text-blue-500" />;
    case "good": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    default: return <CheckCircle2 className="w-4 h-4 text-muted-foreground" />;
  }
}

function LevelBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; variant: "destructive" | "default" | "secondary" | "outline" }> = {
    critical: { label: "긴급", variant: "destructive" },
    warning: { label: "주의", variant: "default" },
    info: { label: "참고", variant: "secondary" },
    good: { label: "양호", variant: "outline" },
  };
  const { label, variant } = map[level] || map.good;
  return <Badge variant={variant} className="text-[10px] px-1.5">{label}</Badge>;
}

export default function SupabaseMonitor() {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery<SupabaseStatus>({
    queryKey: ["/api/admin/supabase/status"],
    queryFn: async () => {
      const res = await fetch("/api/admin/supabase/status", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const handleCopy = () => {
    if (!data) return;
    const lines: string[] = [];
    lines.push("=== Supabase DB 시스템 점검 ===");
    lines.push(`조회 시간: ${new Date(data.timestamp).toLocaleString("ko-KR")}`);
    lines.push(`점검 소요: ${data.checkDurationMs}ms`);
    lines.push("");
    lines.push(`── 서버 정보 ──`);
    lines.push(`  PostgreSQL: ${data.server.version?.split(" on ")[0] || data.server.version}`);
    lines.push(`  DB 이름: ${data.server.dbSize.dbName}`);
    lines.push(`  DB 크기: ${data.server.dbSize.totalSize}`);
    lines.push(`  업타임: ${formatUptime(data.server.uptime.uptime)}`);
    lines.push(`  Replica: ${data.server.isReplica ? "예" : "아니오"}`);
    lines.push("");
    lines.push(`── 연결 상태 ──`);
    lines.push(`  전체: ${data.connections.total} / ${data.connections.max_connections}`);
    lines.push(`  활성: ${data.connections.active}, 유휴: ${data.connections.idle}, Idle in Tx: ${data.connections.idle_in_transaction}`);
    lines.push("");
    lines.push(`── 캐시 히트율 ──`);
    lines.push(`  히트율: ${data.cacheHit.hit_ratio}%`);
    lines.push("");
    lines.push(`── 권고사항 ──`);
    data.recommendations.forEach((r) => {
      const tag = r.level === "critical" ? "🔴" : r.level === "warning" ? "🟡" : r.level === "info" ? "🔵" : "🟢";
      lines.push(`  ${tag} ${r.title}`);
      lines.push(`     ${r.detail}`);
    });
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Supabase DB 점검 중...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-500">{(error as Error)?.message || "Supabase DB 점검 실패"}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>다시 시도</Button>
        </CardContent>
      </Card>
    );
  }

  const connPct = data.connections.max_connections > 0
    ? (data.connections.total / data.connections.max_connections) * 100
    : 0;
  const hitRatio = parseFloat(data.cacheHit.hit_ratio || "0");

  const criticalCount = data.recommendations.filter(r => r.level === "critical").length;
  const warningCount = data.recommendations.filter(r => r.level === "warning").length;
  const infoCount = data.recommendations.filter(r => r.level === "info").length;
  const goodCount = data.recommendations.filter(r => r.level === "good").length;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-bold">Supabase DB 시스템 점검</h2>
          <Badge variant="outline" className="text-[10px]">
            {new Date(data.timestamp).toLocaleString("ko-KR")}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1 text-xs">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "복사됨" : "복사"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1 text-xs">
            <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 권고사항 */}
      {data.recommendations.length > 0 && (
        <Card className={criticalCount > 0 ? "border-red-300" : warningCount > 0 ? "border-yellow-300" : "border-green-300"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" /> 점검 결과 및 권고사항
              <div className="flex gap-1 ml-auto">
                {criticalCount > 0 && <Badge variant="destructive" className="text-[10px]">긴급 {criticalCount}</Badge>}
                {warningCount > 0 && <Badge className="text-[10px]">주의 {warningCount}</Badge>}
                {infoCount > 0 && <Badge variant="secondary" className="text-[10px]">참고 {infoCount}</Badge>}
                {goodCount > 0 && <Badge variant="outline" className="text-[10px]">양호 {goodCount}</Badge>}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recommendations.map((rec, idx) => (
              <div key={idx} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                rec.level === "critical" ? "bg-red-50 dark:bg-red-950/20" :
                rec.level === "warning" ? "bg-yellow-50 dark:bg-yellow-950/20" :
                rec.level === "info" ? "bg-blue-50 dark:bg-blue-950/20" :
                "bg-green-50 dark:bg-green-950/20"
              }`}>
                <LevelIcon level={rec.level} />
                <div>
                  <p className="font-medium">{rec.title}</p>
                  <p className="text-muted-foreground mt-0.5">{rec.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 상단 요약 카드들 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 서버 정보 */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Server className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-medium">서버</span>
            </div>
            <p className="text-sm font-bold truncate" title={data.server.version}>
              {data.server.version?.match(/PostgreSQL (\d+\.\d+)/)?.[1] || "PG"}
            </p>
            <p className="text-[10px] text-muted-foreground">{data.server.dbSize.dbName}</p>
          </CardContent>
        </Card>
        {/* DB 크기 */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <HardDrive className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs font-medium">DB 크기</span>
            </div>
            <p className="text-sm font-bold">{data.server.dbSize.totalSize}</p>
            <p className="text-[10px] text-muted-foreground">업타임 {formatUptime(data.server.uptime.uptime)}</p>
          </CardContent>
        </Card>
        {/* 연결 상태 */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <PlugZap className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs font-medium">연결</span>
            </div>
            <p className="text-sm font-bold">{data.connections.total} / {data.connections.max_connections}</p>
            <p className="text-[10px] text-muted-foreground">
              활성 {data.connections.active} · 유휴 {data.connections.idle}
            </p>
          </CardContent>
        </Card>
        {/* 캐시 히트율 */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-medium">캐시 히트율</span>
            </div>
            <p className={`text-sm font-bold ${hitRatio >= 99 ? "text-green-500" : hitRatio >= 90 ? "text-yellow-500" : "text-red-500"}`}>
              {data.cacheHit.hit_ratio}%
            </p>
            <p className="text-[10px] text-muted-foreground">Buffer Cache</p>
          </CardContent>
        </Card>
      </div>

      {/* 연결 상태 상세 + 캐시 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PlugZap className="w-4 h-4 text-orange-500" /> 연결 상태
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>연결 사용률</span>
                <span className={`font-mono font-medium ${connPct > 80 ? "text-red-500" : connPct > 50 ? "text-yellow-500" : "text-green-500"}`}>
                  {connPct.toFixed(1)}%
                </span>
              </div>
              <Progress value={connPct} className="h-2" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/50 rounded-lg p-2">
                <span className="text-muted-foreground">활성 (Active)</span>
                <p className="font-mono font-bold text-green-600">{data.connections.active}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <span className="text-muted-foreground">유휴 (Idle)</span>
                <p className="font-mono font-bold">{data.connections.idle}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <span className="text-muted-foreground">Idle in Transaction</span>
                <p className={`font-mono font-bold ${data.connections.idle_in_transaction > 3 ? "text-yellow-500" : ""}`}>
                  {data.connections.idle_in_transaction}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <span className="text-muted-foreground">최대 연결 수</span>
                <p className="font-mono font-bold">{data.connections.max_connections}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="w-4 h-4 text-emerald-500" /> Buffer Cache 성능
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>캐시 히트율</span>
                <span className={`font-mono font-medium ${hitRatio >= 99 ? "text-green-500" : hitRatio >= 90 ? "text-yellow-500" : "text-red-500"}`}>
                  {data.cacheHit.hit_ratio}%
                </span>
              </div>
              <Progress value={hitRatio} className="h-2" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/50 rounded-lg p-2">
                <span className="text-muted-foreground">Cache Hits</span>
                <p className="font-mono font-bold">{Number(data.cacheHit.hits || 0).toLocaleString()}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <span className="text-muted-foreground">Disk Reads</span>
                <p className="font-mono font-bold">{Number(data.cacheHit.reads || 0).toLocaleString()}</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {hitRatio >= 99 ? "✅ 대부분의 데이터가 메모리에서 제공되고 있습니다." :
               hitRatio >= 90 ? "⚠️ 일부 쿼리가 디스크에서 읽기를 수행합니다." :
               "🔴 디스크 읽기가 많습니다. shared_buffers 증가를 검토하세요."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 테이블 통계 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" /> 테이블 통계 (크기순 Top 15)
          </CardTitle>
          <CardDescription className="text-xs">
            점검 소요시간: {data.checkDurationMs}ms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">테이블</TableHead>
                  <TableHead className="text-[10px] text-right">행 수</TableHead>
                  <TableHead className="text-[10px] text-right">Dead</TableHead>
                  <TableHead className="text-[10px] text-right">Dead%</TableHead>
                  <TableHead className="text-[10px] text-right">크기</TableHead>
                  <TableHead className="text-[10px]">마지막 Vacuum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.tables.map((t, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-[11px] font-mono">{t.table_name}</TableCell>
                    <TableCell className="text-[11px] text-right font-mono">{(t.live_rows || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-[11px] text-right font-mono">{(t.dead_rows || 0).toLocaleString()}</TableCell>
                    <TableCell className={`text-[11px] text-right font-mono ${Number(t.dead_ratio) > 20 ? "text-red-500 font-bold" : Number(t.dead_ratio) > 5 ? "text-yellow-500" : ""}`}>
                      {t.dead_ratio}%
                    </TableCell>
                    <TableCell className="text-[11px] text-right font-mono">{t.total_size}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">
                      {t.last_autovacuum ? new Date(t.last_autovacuum).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }) :
                       t.last_vacuum ? new Date(t.last_vacuum).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 인덱스 사용률 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="w-4 h-4 text-indigo-500" /> 인덱스 사용률 (스캔 빈도순)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[350px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">인덱스</TableHead>
                  <TableHead className="text-[10px]">테이블</TableHead>
                  <TableHead className="text-[10px] text-right">스캔 수</TableHead>
                  <TableHead className="text-[10px] text-right">크기</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.indexes.map((idx, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-[11px] font-mono truncate max-w-[200px]" title={idx.index_name}>
                      {idx.index_name}
                    </TableCell>
                    <TableCell className="text-[11px] font-mono">{idx.table_name}</TableCell>
                    <TableCell className={`text-[11px] text-right font-mono ${idx.scans === 0 ? "text-red-400" : ""}`}>
                      {(idx.scans || 0).toLocaleString()}
                      {idx.scans === 0 && <span className="text-[9px] text-red-400 ml-1">⚠</span>}
                    </TableCell>
                    <TableCell className="text-[11px] text-right font-mono">{idx.index_size}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 느린 쿼리 (있으면) + 락 상태 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.slowQueries.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-500" /> 느린 쿼리 Top 10
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {data.slowQueries.map((sq, idx) => (
                  <div key={idx} className="bg-muted/50 rounded-lg p-2 text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="font-mono text-red-500 font-medium">평균 {sq.avg_time_ms}ms</span>
                      <span className="text-muted-foreground">{sq.calls}회 호출</span>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground truncate" title={sq.query}>
                      {sq.query?.substring(0, 120)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data.locks.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-yellow-500" /> 락 상태
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">유형</TableHead>
                      <TableHead className="text-[10px]">모드</TableHead>
                      <TableHead className="text-[10px] text-center">승인</TableHead>
                      <TableHead className="text-[10px] text-right">수</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.locks.map((lock, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-[11px] font-mono">{lock.locktype}</TableCell>
                        <TableCell className="text-[11px] font-mono text-[10px]">{lock.mode}</TableCell>
                        <TableCell className="text-center">
                          {lock.granted ? <CheckCircle2 className="w-3 h-3 text-green-500 inline" /> : <XCircle className="w-3 h-3 text-red-500 inline" />}
                        </TableCell>
                        <TableCell className="text-[11px] text-right font-mono">{lock.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 확장 + DB 설정 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 설치된 확장 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PlugZap className="w-4 h-4 text-cyan-500" /> 설치된 확장 ({data.extensions.length}개)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto">
              {data.extensions.map((ext, idx) => (
                <Badge key={idx} variant="secondary" className="text-[10px] font-mono">
                  {ext.extname} <span className="text-muted-foreground ml-1">v{ext.extversion}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* DB 설정 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-500" /> 주요 DB 설정
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[200px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">설정</TableHead>
                    <TableHead className="text-[10px] text-right">값</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.settings.map((s, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-[11px] font-mono" title={s.short_desc}>{s.name}</TableCell>
                      <TableCell className="text-[11px] text-right font-mono">
                        {s.setting}{s.unit ? ` ${s.unit}` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dead Tuple 상세 */}
      {data.vacuum.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" /> Vacuum 필요 테이블 (Dead Tuple {">"}100)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[250px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">테이블</TableHead>
                    <TableHead className="text-[10px] text-right">Live</TableHead>
                    <TableHead className="text-[10px] text-right">Dead</TableHead>
                    <TableHead className="text-[10px]">마지막 Autovacuum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.vacuum.map((v, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-[11px] font-mono">{v.table_name}</TableCell>
                      <TableCell className="text-[11px] text-right font-mono">{(v.live_tuples || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-[11px] text-right font-mono text-red-500 font-medium">{(v.dead_tuples || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">
                        {v.last_autovacuum ? new Date(v.last_autovacuum).toLocaleString("ko-KR") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 푸터 */}
      <p className="text-center text-[10px] text-muted-foreground">
        점검 소요시간: {data.checkDurationMs}ms · {data.server.isReplica ? "📗 Read Replica" : "📘 Primary"} · PostgreSQL {data.server.version?.match(/PostgreSQL (\d+\.\d+)/)?.[1] || ""}
      </p>
    </div>
  );
}

