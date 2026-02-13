/**
 * 시가급등 추세추종 전략 관리 패널
 * - 전략 설정 (매수/매도 조건, 리스크 관리)
 * - 활성 포지션 모니터링
 * - 실행 로그 확인
 * - 수동 실행 (테스트용)
 */

import React, { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  TrendingUp, Settings, Play, Pause, RefreshCw, Loader2,
  Target, ArrowUpRight, ArrowDownRight, Activity, AlertTriangle,
  Clock, Search, Zap, XCircle, CheckCircle2, BarChart3, ChevronDown, ChevronUp,
} from "lucide-react";

// ========== Types ==========

interface GapStrategyConfig {
  id?: number;
  userId: number;
  name: string;
  isActive: boolean;
  universeType: string;
  minGapPercent: string;
  maxGapPercent: string;
  maAligned: boolean;
  priceAboveMa5: boolean;
  firstBuyRatio: number;
  addBuyRatio: number;
  addBuyTriggerPercent: string;
  sellMaPeriod: number;
  maxPositionRatio: number;
  maxStocksCount: number;
  candidates?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface GapPosition {
  id: number;
  strategyId: number;
  stockCode: string;
  stockName: string;
  status: string;
  prevClose: string;
  openPrice: string;
  gapPercent: string;
  targetAmount: string;
  totalBuyQty: number;
  totalBuyAmount: string;
  avgBuyPrice: string;
  buyPhase: number;
  lastBuyPrice: string;
  sellPrice: string;
  sellQty: number;
  sellAmount: string;
  profitLoss: string;
  profitRate: string;
  ma5: string;
  ma10: string;
  ma20: string;
  ma60: string;
  openedAt: string;
  closedAt: string;
}

interface GapLog {
  id: number;
  strategyId: number;
  positionId: number | null;
  action: string;
  stockCode: string | null;
  stockName: string | null;
  detail: string | null;
  createdAt: string;
}

// ========== 설정 컴포넌트 ==========
function StrategySettings({
  config,
  onSave,
  saving,
}: {
  config: GapStrategyConfig | null;
  onSave: (data: Partial<GapStrategyConfig>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<GapStrategyConfig>>({
    name: config?.name || "시가급등 추세추종",
    universeType: config?.universeType || "both",
    minGapPercent: config?.minGapPercent || "3",
    maxGapPercent: config?.maxGapPercent || "7",
    maAligned: config?.maAligned ?? true,
    priceAboveMa5: config?.priceAboveMa5 ?? true,
    firstBuyRatio: config?.firstBuyRatio ?? 30,
    addBuyRatio: config?.addBuyRatio ?? 20,
    addBuyTriggerPercent: config?.addBuyTriggerPercent || "1",
    sellMaPeriod: config?.sellMaPeriod ?? 5,
    maxPositionRatio: config?.maxPositionRatio ?? 50,
    maxStocksCount: config?.maxStocksCount ?? 5,
  });

  const handleChange = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          전략 설정
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 전략명 */}
        <div className="grid grid-cols-4 gap-2 items-center">
          <Label className="text-right text-xs">전략명</Label>
          <Input
            value={form.name}
            onChange={e => handleChange("name", e.target.value)}
            className="col-span-3 h-8 text-sm"
          />
        </div>

        {/* 유니버스 */}
        <div className="grid grid-cols-4 gap-2 items-center">
          <Label className="text-right text-xs">종목군</Label>
          <Select value={form.universeType} onValueChange={v => handleChange("universeType", v)}>
            <SelectTrigger className="col-span-3 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">코스피200 + 코스닥150</SelectItem>
              <SelectItem value="kospi200">코스피200만</SelectItem>
              <SelectItem value="kosdaq150">코스닥150만</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 갭 범위 */}
        <div className="grid grid-cols-4 gap-2 items-center">
          <Label className="text-right text-xs">갭 상승(%)</Label>
          <div className="col-span-3 flex gap-2 items-center">
            <Input
              type="number"
              value={form.minGapPercent}
              onChange={e => handleChange("minGapPercent", e.target.value)}
              className="h-8 text-sm w-20"
              step="0.5"
            />
            <span className="text-xs text-muted-foreground">~</span>
            <Input
              type="number"
              value={form.maxGapPercent}
              onChange={e => handleChange("maxGapPercent", e.target.value)}
              className="h-8 text-sm w-20"
              step="0.5"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </div>

        {/* 이동평균선 */}
        <div className="grid grid-cols-4 gap-2 items-center">
          <Label className="text-right text-xs">MA 정배열</Label>
          <div className="col-span-3 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.maAligned}
                onCheckedChange={v => handleChange("maAligned", v)}
              />
              <span className="text-xs text-muted-foreground">5&gt;10&gt;20&gt;60</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.priceAboveMa5}
                onCheckedChange={v => handleChange("priceAboveMa5", v)}
              />
              <span className="text-xs text-muted-foreground">현재가&gt;5일선</span>
            </div>
          </div>
        </div>

        {/* 분할매수 */}
        <div className="grid grid-cols-4 gap-2 items-center">
          <Label className="text-right text-xs">분할매수</Label>
          <div className="col-span-3 flex gap-2 items-center">
            <span className="text-xs">1차</span>
            <Input
              type="number"
              value={form.firstBuyRatio}
              onChange={e => handleChange("firstBuyRatio", parseInt(e.target.value))}
              className="h-8 text-sm w-16"
            />
            <span className="text-xs">% / 추가</span>
            <Input
              type="number"
              value={form.addBuyRatio}
              onChange={e => handleChange("addBuyRatio", parseInt(e.target.value))}
              className="h-8 text-sm w-16"
            />
            <span className="text-xs">%씩</span>
          </div>
        </div>

        {/* 추가매수 트리거 */}
        <div className="grid grid-cols-4 gap-2 items-center">
          <Label className="text-right text-xs">추가매수 트리거</Label>
          <div className="col-span-3 flex gap-2 items-center">
            <span className="text-xs">+</span>
            <Input
              type="number"
              value={form.addBuyTriggerPercent}
              onChange={e => handleChange("addBuyTriggerPercent", e.target.value)}
              className="h-8 text-sm w-20"
              step="0.5"
            />
            <span className="text-xs">% 상승 시 추가매수</span>
          </div>
        </div>

        {/* 매도 MA */}
        <div className="grid grid-cols-4 gap-2 items-center">
          <Label className="text-right text-xs">매도 기준선</Label>
          <div className="col-span-3 flex gap-2 items-center">
            <Input
              type="number"
              value={form.sellMaPeriod}
              onChange={e => handleChange("sellMaPeriod", parseInt(e.target.value))}
              className="h-8 text-sm w-16"
            />
            <span className="text-xs">일선 이탈 시 전량 매도</span>
          </div>
        </div>

        {/* 리스크 관리 */}
        <div className="grid grid-cols-4 gap-2 items-center">
          <Label className="text-right text-xs">리스크 관리</Label>
          <div className="col-span-3 flex gap-2 items-center">
            <span className="text-xs">최대</span>
            <Input
              type="number"
              value={form.maxPositionRatio}
              onChange={e => handleChange("maxPositionRatio", parseInt(e.target.value))}
              className="h-8 text-sm w-16"
            />
            <span className="text-xs">% /</span>
            <Input
              type="number"
              value={form.maxStocksCount}
              onChange={e => handleChange("maxStocksCount", parseInt(e.target.value))}
              className="h-8 text-sm w-16"
            />
            <span className="text-xs">종목</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" onClick={() => onSave(form)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            설정 저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ========== 포지션 목록 ==========
function PositionList({ positions, onClose, closingId }: {
  positions: GapPosition[];
  onClose: (id: number) => void;
  closingId: number | null;
}) {
  const statusLabels: Record<string, { label: string; color: string }> = {
    scanning: { label: "스캔중", color: "bg-gray-100 text-gray-600" },
    gap_detected: { label: "갭감지", color: "bg-yellow-100 text-yellow-700" },
    buying: { label: "매수중", color: "bg-blue-100 text-blue-700" },
    holding: { label: "보유중", color: "bg-green-100 text-green-700" },
    selling: { label: "매도중", color: "bg-orange-100 text-orange-700" },
    closed: { label: "청산", color: "bg-gray-100 text-gray-500" },
  };

  if (positions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <Target className="h-8 w-8 mx-auto mb-2 opacity-40" />
        활성 포지션이 없습니다
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">종목</TableHead>
            <TableHead className="text-xs">상태</TableHead>
            <TableHead className="text-xs text-right">갭(%)</TableHead>
            <TableHead className="text-xs text-right">매수단계</TableHead>
            <TableHead className="text-xs text-right">총수량</TableHead>
            <TableHead className="text-xs text-right">평균단가</TableHead>
            <TableHead className="text-xs text-right">손익</TableHead>
            <TableHead className="text-xs text-center">관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map(pos => {
            const st = statusLabels[pos.status] || statusLabels.scanning;
            const pnl = parseFloat(pos.profitRate || "0");
            return (
              <TableRow key={pos.id}>
                <TableCell className="text-xs font-medium">
                  <div>{pos.stockName}</div>
                  <div className="text-muted-foreground">{pos.stockCode}</div>
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
                </TableCell>
                <TableCell className="text-xs text-right font-mono text-red-500">
                  +{parseFloat(pos.gapPercent || "0").toFixed(1)}%
                </TableCell>
                <TableCell className="text-xs text-right">{pos.buyPhase || 0}차</TableCell>
                <TableCell className="text-xs text-right">{(pos.totalBuyQty || 0).toLocaleString()}주</TableCell>
                <TableCell className="text-xs text-right font-mono">
                  {pos.avgBuyPrice ? parseInt(pos.avgBuyPrice).toLocaleString() : "-"}원
                </TableCell>
                <TableCell className={`text-xs text-right font-mono font-semibold ${pnl > 0 ? "text-red-500" : pnl < 0 ? "text-blue-500" : ""}`}>
                  {pos.status === "closed" ? (
                    <>{pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%</>
                  ) : "-"}
                </TableCell>
                <TableCell className="text-center">
                  {pos.status !== "closed" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-red-500 hover:text-red-700"
                      onClick={() => onClose(pos.id)}
                      disabled={closingId === pos.id}
                    >
                      {closingId === pos.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                      청산
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ========== 실행 로그 ==========
function LogList({ logs }: { logs: GapLog[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayLogs = showAll ? logs : logs.slice(0, 15);

  const actionIcons: Record<string, React.ReactNode> = {
    scan_start: <Search className="h-3 w-3 text-blue-500" />,
    scan_progress: <Activity className="h-3 w-3 text-blue-400" />,
    scan_complete: <CheckCircle2 className="h-3 w-3 text-green-500" />,
    gap_detected: <Zap className="h-3 w-3 text-yellow-500" />,
    gap_scan: <Search className="h-3 w-3 text-gray-500" />,
    gap_scan_complete: <CheckCircle2 className="h-3 w-3 text-green-500" />,
    buy_filled: <ArrowUpRight className="h-3 w-3 text-red-500" />,
    buy_complete: <CheckCircle2 className="h-3 w-3 text-red-500" />,
    buy_failed: <AlertTriangle className="h-3 w-3 text-orange-500" />,
    sell_filled: <ArrowDownRight className="h-3 w-3 text-blue-500" />,
    ma_check: <BarChart3 className="h-3 w-3 text-gray-400" />,
    error: <AlertTriangle className="h-3 w-3 text-red-600" />,
  };

  if (logs.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        <Clock className="h-6 w-6 mx-auto mb-2 opacity-40" />
        실행 로그가 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {displayLogs.map(log => (
        <div key={log.id} className="flex items-start gap-2 py-1 px-2 rounded hover:bg-muted/50 text-xs">
          <div className="mt-0.5 shrink-0">
            {actionIcons[log.action] || <Activity className="h-3 w-3 text-gray-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-muted-foreground">
              {new Date(log.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            {log.stockName && <span className="ml-1 font-medium">[{log.stockName}]</span>}
            <span className="ml-1">{log.detail}</span>
          </div>
        </div>
      ))}
      {logs.length > 15 && (
        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowAll(!showAll)}>
          {showAll ? <><ChevronUp className="h-3 w-3 mr-1" /> 접기</> : <><ChevronDown className="h-3 w-3 mr-1" /> 전체 {logs.length}개 보기</>}
        </Button>
      )}
    </div>
  );
}

// ========== 메인 패널 ==========
export default function GapStrategyPanel() {
  const { toast } = useToast();
  const [closingPosId, setClosingPosId] = useState<number | null>(null);
  const [executingPhase, setExecutingPhase] = useState<string | null>(null);

  // 전략 설정 조회
  const { data: strategy, isLoading: strategyLoading } = useQuery<GapStrategyConfig | null>({
    queryKey: ["gap-strategy"],
    queryFn: async () => {
      const res = await fetch("/api/trading/gap-strategy", { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  // 포지션 조회
  const { data: positions = [], isLoading: posLoading } = useQuery<GapPosition[]>({
    queryKey: ["gap-strategy-positions"],
    queryFn: async () => {
      const res = await fetch("/api/trading/gap-strategy/positions", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
  });

  // 로그 조회
  const { data: logs = [], isLoading: logsLoading } = useQuery<GapLog[]>({
    queryKey: ["gap-strategy-logs"],
    queryFn: async () => {
      const res = await fetch("/api/trading/gap-strategy/logs?limit=100", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15000,
  });

  // 전략 저장
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<GapStrategyConfig>) => {
      const res = await apiRequest("POST", "/api/trading/gap-strategy", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "전략 설정이 저장되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["gap-strategy"] });
    },
    onError: (error: any) => {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    },
  });

  // 활성화 토글
  const toggleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trading/gap-strategy/toggle");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data.isActive ? "전략이 활성화되었습니다 🚀" : "전략이 비활성화되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["gap-strategy"] });
    },
    onError: (error: any) => {
      toast({ title: "토글 실패", description: error.message, variant: "destructive" });
    },
  });

  // 수동 실행
  const executeMutation = useMutation({
    mutationFn: async (phase: string) => {
      setExecutingPhase(phase);
      const res = await apiRequest("POST", "/api/trading/gap-strategy/execute", { phase });
      return res.json();
    },
    onSuccess: (data: any) => {
      const msgs = data.results?.join("\n") || "실행 완료";
      toast({ title: `${executingPhase === "auto" ? "자동" : executingPhase} 실행 결과`, description: msgs });
      queryClient.invalidateQueries({ queryKey: ["gap-strategy-positions"] });
      queryClient.invalidateQueries({ queryKey: ["gap-strategy-logs"] });
      setExecutingPhase(null);
    },
    onError: (error: any) => {
      toast({ title: "실행 실패", description: error.message, variant: "destructive" });
      setExecutingPhase(null);
    },
  });

  // 포지션 청산
  const closeMutation = useMutation({
    mutationFn: async (posId: number) => {
      setClosingPosId(posId);
      const res = await apiRequest("POST", `/api/trading/gap-strategy/positions/${posId}/close`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "포지션이 청산되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["gap-strategy-positions"] });
      queryClient.invalidateQueries({ queryKey: ["gap-strategy-logs"] });
      setClosingPosId(null);
    },
    onError: (error: any) => {
      toast({ title: "청산 실패", description: error.message, variant: "destructive" });
      setClosingPosId(null);
    },
  });

  const activePositions = positions.filter(p => p.status !== "closed");
  const closedPositions = positions.filter(p => p.status === "closed");

  // 후보종목 수
  let candidateCount = 0;
  if (strategy?.candidates) {
    try { candidateCount = JSON.parse(strategy.candidates).length; } catch { /* empty */ }
  }

  if (strategyLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 상단: 전략 상태 & 제어 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-red-500" />
              시가급등 추세추종 전략
            </div>
            <div className="flex items-center gap-2">
              {strategy && (
                <>
                  <span className={`text-xs px-2 py-0.5 rounded ${strategy.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {strategy.isActive ? "🟢 활성" : "⚪ 비활성"}
                  </span>
                  <Button
                    size="sm"
                    variant={strategy.isActive ? "destructive" : "default"}
                    onClick={() => toggleMutation.mutate()}
                    disabled={toggleMutation.isPending}
                    className="h-7 text-xs"
                  >
                    {toggleMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : strategy.isActive ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                    {strategy.isActive ? "중지" : "시작"}
                  </Button>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 전략 요약 */}
          {strategy && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">종목군</div>
                <div className="text-sm font-medium">
                  {strategy.universeType === "both" ? "코스피200+코스닥150" : strategy.universeType === "kospi200" ? "코스피200" : "코스닥150"}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">후보종목</div>
                <div className="text-sm font-medium">{candidateCount}종목</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">활성 포지션</div>
                <div className="text-sm font-medium text-red-500">{activePositions.length}종목</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">갭 범위</div>
                <div className="text-sm font-medium">{strategy.minGapPercent}~{strategy.maxGapPercent}%</div>
              </div>
            </div>
          )}

          {/* 수동 실행 버튼 */}
          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
            <span className="text-xs text-muted-foreground self-center mr-1">수동실행:</span>
            {[
              { phase: "scan", label: "📊 사전스캔", desc: "MA 정배열 필터" },
              { phase: "gap", label: "⚡ 갭감지", desc: "시초가 갭 체크" },
              { phase: "buy", label: "🛒 매수모니터", desc: "분할매수 실행" },
              { phase: "sell", label: "📤 매도체크", desc: "5일선 이탈 체크" },
              { phase: "auto", label: "🤖 자동", desc: "시간대 자동 판단" },
            ].map(({ phase, label }) => (
              <Button
                key={phase}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => executeMutation.mutate(phase)}
                disabled={executeMutation.isPending}
              >
                {executingPhase === phase ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                {label}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs ml-auto"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["gap-strategy-positions"] });
                queryClient.invalidateQueries({ queryKey: ["gap-strategy-logs"] });
              }}
            >
              <RefreshCw className="h-3 w-3 mr-1" /> 새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 전략 설정 폼 */}
      <StrategySettings
        config={strategy || null}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
      />

      {/* 활성 포지션 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-green-500" />
            활성 포지션 ({activePositions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PositionList
            positions={activePositions}
            onClose={(id) => closeMutation.mutate(id)}
            closingId={closingPosId}
          />
        </CardContent>
      </Card>

      {/* 청산 이력 */}
      {closedPositions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-gray-500" />
              청산 이력 ({closedPositions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PositionList
              positions={closedPositions}
              onClose={() => {}}
              closingId={null}
            />
          </CardContent>
        </Card>
      )}

      {/* 실행 로그 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            실행 로그 ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <LogList logs={logs} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

