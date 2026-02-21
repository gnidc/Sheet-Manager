/**
 * 멀티팩터 전략 관리 패널
 * - 5개 팩터 가중치 설정 (MA, RSI, 볼린저밴드, 거래량, 갭)
 * - 활성 포지션 모니터링 (팩터 스코어 표시)
 * - 손절/익절 설정
 * - 수동 실행 & 개별 종목 스코어 조회
 */

import React, { useState } from "react";
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
import { Progress } from "@/components/ui/progress";

import {
  TrendingUp, Settings, Play, Pause, RefreshCw, Loader2,
  Target, ArrowUpRight, ArrowDownRight, Activity, AlertTriangle,
  Clock, Search, Zap, XCircle, CheckCircle2, BarChart3,
  ChevronDown, ChevronUp, Layers, Gauge, ShieldCheck,
} from "lucide-react";

// ========== Types ==========

interface MultiFactorConfig {
  id?: number;
  userId: number;
  name: string;
  isActive: boolean;
  universeType: string;
  weightMa: number;
  weightRsi: number;
  weightBollinger: number;
  weightVolume: number;
  weightGap: number;
  rsiPeriod: number;
  rsiBuyThreshold: number;
  rsiSellThreshold: number;
  bollingerPeriod: number;
  bollingerMult: string;
  volumeTopN: number;
  minGapPercent: string;
  maxGapPercent: string;
  buyScoreThreshold: number;
  sellScoreThreshold: number;
  firstBuyRatio: number;
  addBuyRatio: number;
  addBuyTriggerPercent: string;
  stopLossPercent: string;
  takeProfitPercent: string;
  maxPositionRatio: number;
  maxStocksCount: number;
  candidates?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface MFPosition {
  id: number;
  strategyId: number;
  stockCode: string;
  stockName: string;
  status: string;
  signalScore: string;
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
  factorDetails: string;
  ma5: string;
  ma20: string;
  rsi: string;
  bollingerUpper: string;
  bollingerLower: string;
  openedAt: string;
  closedAt: string;
}

interface MFLog {
  id: number;
  strategyId: number;
  positionId: number | null;
  action: string;
  stockCode: string | null;
  stockName: string | null;
  detail: string | null;
  createdAt: string;
}

// ========== 팩터 가중치 시각화 ==========
function FactorWeightBar({ label, weight, color }: { label: string; weight: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 text-right text-muted-foreground">{label}</span>
      <div className="flex-1">
        <Progress value={weight} className="h-2" />
      </div>
      <span className={`w-8 text-right font-mono font-semibold ${color}`}>{weight}%</span>
    </div>
  );
}

// ========== 설정 ==========
function StrategySettings({
  config,
  onSave,
  saving,
}: {
  config: MultiFactorConfig | null;
  onSave: (data: Partial<MultiFactorConfig>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<MultiFactorConfig>>({
    name: config?.name || "멀티팩터 전략",
    universeType: config?.universeType || "both",
    weightMa: config?.weightMa ?? 30,
    weightRsi: config?.weightRsi ?? 20,
    weightBollinger: config?.weightBollinger ?? 20,
    weightVolume: config?.weightVolume ?? 15,
    weightGap: config?.weightGap ?? 15,
    rsiPeriod: config?.rsiPeriod ?? 14,
    rsiBuyThreshold: config?.rsiBuyThreshold ?? 30,
    rsiSellThreshold: config?.rsiSellThreshold ?? 70,
    bollingerPeriod: config?.bollingerPeriod ?? 20,
    bollingerMult: config?.bollingerMult || "2",
    minGapPercent: config?.minGapPercent || "2",
    maxGapPercent: config?.maxGapPercent || "8",
    buyScoreThreshold: config?.buyScoreThreshold ?? 70,
    sellScoreThreshold: config?.sellScoreThreshold ?? 30,
    firstBuyRatio: config?.firstBuyRatio ?? 40,
    addBuyRatio: config?.addBuyRatio ?? 30,
    addBuyTriggerPercent: config?.addBuyTriggerPercent || "2",
    stopLossPercent: config?.stopLossPercent || "5",
    takeProfitPercent: config?.takeProfitPercent || "10",
    maxPositionRatio: config?.maxPositionRatio ?? 50,
    maxStocksCount: config?.maxStocksCount ?? 5,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleChange = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const totalWeight = (form.weightMa || 0) + (form.weightRsi || 0) + (form.weightBollinger || 0) + (form.weightVolume || 0) + (form.weightGap || 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          전략 설정
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-2 items-center">
          <Label className="text-right text-xs">전략명</Label>
          <Input value={form.name} onChange={e => handleChange("name", e.target.value)} className="col-span-3 h-8 text-sm" />
        </div>

        <div className="grid grid-cols-4 gap-2 items-center">
          <Label className="text-right text-xs">종목군</Label>
          <Select value={form.universeType} onValueChange={v => handleChange("universeType", v)}>
            <SelectTrigger className="col-span-3 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="both">코스피200 + 코스닥150</SelectItem>
              <SelectItem value="kospi200">코스피200만</SelectItem>
              <SelectItem value="kosdaq150">코스닥150만</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 팩터 가중치 */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">팩터 가중치</span>
            <span className={`text-xs font-mono ${totalWeight === 100 ? "text-green-600" : "text-red-500"}`}>
              합계: {totalWeight}% {totalWeight !== 100 && "(100% 권장)"}
            </span>
          </div>

          {[
            { key: "weightMa", label: "MA정배열", color: "text-blue-600" },
            { key: "weightRsi", label: "RSI", color: "text-purple-600" },
            { key: "weightBollinger", label: "볼린저", color: "text-orange-600" },
            { key: "weightVolume", label: "거래량", color: "text-green-600" },
            { key: "weightGap", label: "갭상승", color: "text-red-600" },
          ].map(({ key, label, color }) => (
            <div key={key} className="grid grid-cols-6 gap-2 items-center">
              <span className={`text-xs text-right font-medium ${color}`}>{label}</span>
              <div className="col-span-4">
                <Progress value={(form as any)[key] || 0} className="h-2" />
              </div>
              <Input
                type="number"
                value={(form as any)[key]}
                onChange={e => handleChange(key, parseInt(e.target.value) || 0)}
                className="h-7 text-xs text-center"
                min={0} max={100}
              />
            </div>
          ))}
        </div>

        {/* 매수/매도 신호 임계값 */}
        <div className="grid grid-cols-4 gap-2 items-center">
          <Label className="text-right text-xs">매수 기준점</Label>
          <div className="col-span-3 flex gap-2 items-center">
            <Input type="number" value={form.buyScoreThreshold} onChange={e => handleChange("buyScoreThreshold", parseInt(e.target.value))} className="h-8 text-sm w-20" min={0} max={100} />
            <span className="text-xs text-muted-foreground">점 이상이면 매수 신호</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 items-center">
          <Label className="text-right text-xs">매도 기준점</Label>
          <div className="col-span-3 flex gap-2 items-center">
            <Input type="number" value={form.sellScoreThreshold} onChange={e => handleChange("sellScoreThreshold", parseInt(e.target.value))} className="h-8 text-sm w-20" min={0} max={100} />
            <span className="text-xs text-muted-foreground">점 이하이면 매도 신호</span>
          </div>
        </div>

        {/* 고급 설정 토글 */}
        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
          고급 설정 {showAdvanced ? "접기" : "펼치기"}
        </Button>

        {showAdvanced && (
          <div className="space-y-3 pt-2 border-t">
            <div className="grid grid-cols-4 gap-2 items-center">
              <Label className="text-right text-xs">RSI 기간</Label>
              <div className="col-span-3 flex gap-2 items-center">
                <Input type="number" value={form.rsiPeriod} onChange={e => handleChange("rsiPeriod", parseInt(e.target.value))} className="h-8 text-sm w-16" />
                <span className="text-xs text-muted-foreground">일</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 items-center">
              <Label className="text-right text-xs">RSI 범위</Label>
              <div className="col-span-3 flex gap-2 items-center">
                <span className="text-xs">과매도</span>
                <Input type="number" value={form.rsiBuyThreshold} onChange={e => handleChange("rsiBuyThreshold", parseInt(e.target.value))} className="h-8 text-sm w-16" />
                <span className="text-xs">~ 과매수</span>
                <Input type="number" value={form.rsiSellThreshold} onChange={e => handleChange("rsiSellThreshold", parseInt(e.target.value))} className="h-8 text-sm w-16" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 items-center">
              <Label className="text-right text-xs">볼린저밴드</Label>
              <div className="col-span-3 flex gap-2 items-center">
                <Input type="number" value={form.bollingerPeriod} onChange={e => handleChange("bollingerPeriod", parseInt(e.target.value))} className="h-8 text-sm w-16" />
                <span className="text-xs">일 ×</span>
                <Input type="number" value={form.bollingerMult} onChange={e => handleChange("bollingerMult", e.target.value)} className="h-8 text-sm w-16" step="0.1" />
                <span className="text-xs">σ</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 items-center">
              <Label className="text-right text-xs">갭 범위</Label>
              <div className="col-span-3 flex gap-2 items-center">
                <Input type="number" value={form.minGapPercent} onChange={e => handleChange("minGapPercent", e.target.value)} className="h-8 text-sm w-20" step="0.5" />
                <span className="text-xs">~</span>
                <Input type="number" value={form.maxGapPercent} onChange={e => handleChange("maxGapPercent", e.target.value)} className="h-8 text-sm w-20" step="0.5" />
                <span className="text-xs">%</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 items-center">
              <Label className="text-right text-xs">분할매수</Label>
              <div className="col-span-3 flex gap-2 items-center">
                <span className="text-xs">1차</span>
                <Input type="number" value={form.firstBuyRatio} onChange={e => handleChange("firstBuyRatio", parseInt(e.target.value))} className="h-8 text-sm w-16" />
                <span className="text-xs">% / 2차</span>
                <Input type="number" value={form.addBuyRatio} onChange={e => handleChange("addBuyRatio", parseInt(e.target.value))} className="h-8 text-sm w-16" />
                <span className="text-xs">%</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 items-center">
              <Label className="text-right text-xs">추가매수 트리거</Label>
              <div className="col-span-3 flex gap-2 items-center">
                <span className="text-xs">+</span>
                <Input type="number" value={form.addBuyTriggerPercent} onChange={e => handleChange("addBuyTriggerPercent", e.target.value)} className="h-8 text-sm w-20" step="0.5" />
                <span className="text-xs">% 상승 시</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 items-center">
              <Label className="text-right text-xs">손절/익절</Label>
              <div className="col-span-3 flex gap-2 items-center">
                <span className="text-xs text-blue-500">손절</span>
                <Input type="number" value={form.stopLossPercent} onChange={e => handleChange("stopLossPercent", e.target.value)} className="h-8 text-sm w-16" step="0.5" />
                <span className="text-xs">% /</span>
                <span className="text-xs text-red-500">익절</span>
                <Input type="number" value={form.takeProfitPercent} onChange={e => handleChange("takeProfitPercent", e.target.value)} className="h-8 text-sm w-16" step="0.5" />
                <span className="text-xs">%</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 items-center">
              <Label className="text-right text-xs">리스크 관리</Label>
              <div className="col-span-3 flex gap-2 items-center">
                <span className="text-xs">최대</span>
                <Input type="number" value={form.maxPositionRatio} onChange={e => handleChange("maxPositionRatio", parseInt(e.target.value))} className="h-8 text-sm w-16" />
                <span className="text-xs">% /</span>
                <Input type="number" value={form.maxStocksCount} onChange={e => handleChange("maxStocksCount", parseInt(e.target.value))} className="h-8 text-sm w-16" />
                <span className="text-xs">종목</span>
              </div>
            </div>
          </div>
        )}

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

// ========== 포지션 스코어 뱃지 ==========
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "bg-green-100 text-green-700" : score >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold ${color}`}>{score}점</span>;
}

// ========== 포지션 목록 ==========
function PositionList({ positions, onClose, closingId }: {
  positions: MFPosition[];
  onClose: (id: number) => void;
  closingId: number | null;
}) {
  const statusLabels: Record<string, { label: string; color: string }> = {
    signal_detected: { label: "신호감지", color: "bg-yellow-100 text-yellow-700" },
    buying: { label: "매수중", color: "bg-blue-100 text-blue-700" },
    holding: { label: "보유중", color: "bg-green-100 text-green-700" },
    closed: { label: "청산", color: "bg-gray-100 text-gray-500" },
  };

  if (positions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <Target className="h-8 w-8 mx-auto mb-2 opacity-40" />
        포지션이 없습니다
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
            <TableHead className="text-xs text-center">스코어</TableHead>
            <TableHead className="text-xs text-right">매수단계</TableHead>
            <TableHead className="text-xs text-right">총수량</TableHead>
            <TableHead className="text-xs text-right">평균단가</TableHead>
            <TableHead className="text-xs text-right">손익</TableHead>
            <TableHead className="text-xs text-center">관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map(pos => {
            const st = statusLabels[pos.status] || statusLabels.signal_detected;
            const pnl = parseFloat(pos.profitRate || "0");
            const score = parseInt(pos.signalScore || "0");
            return (
              <TableRow key={pos.id}>
                <TableCell className="text-xs font-medium">
                  <div>{pos.stockName}</div>
                  <div className="text-muted-foreground">{pos.stockCode}</div>
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
                </TableCell>
                <TableCell className="text-center">
                  <ScoreBadge score={score} />
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
                      variant="ghost" size="sm"
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
function LogList({ logs }: { logs: MFLog[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayLogs = showAll ? logs : logs.slice(0, 15);

  const actionIcons: Record<string, React.ReactNode> = {
    scan_start: <Search className="h-3 w-3 text-blue-500" />,
    scan_progress: <Activity className="h-3 w-3 text-blue-400" />,
    scan_complete: <CheckCircle2 className="h-3 w-3 text-green-500" />,
    universe_loaded: <Layers className="h-3 w-3 text-blue-500" />,
    scoring: <Gauge className="h-3 w-3 text-purple-500" />,
    scoring_complete: <CheckCircle2 className="h-3 w-3 text-purple-500" />,
    signal_detected: <Zap className="h-3 w-3 text-yellow-500" />,
    buy_filled: <ArrowUpRight className="h-3 w-3 text-red-500" />,
    sell_filled: <ArrowDownRight className="h-3 w-3 text-blue-500" />,
    factor_check: <BarChart3 className="h-3 w-3 text-gray-400" />,
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

// ========== 종목 스코어 조회 ==========
function StockScoreChecker() {
  const { toast } = useToast();
  const [stockCode, setStockCode] = useState("");
  const [scoreResult, setScoreResult] = useState<any>(null);

  const scoreMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trading/multi-factor/score", { stockCode, stockName: "" });
      return res.json();
    },
    onSuccess: (data) => setScoreResult(data),
    onError: (error: any) => toast({ title: "조회 실패", description: error.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="h-4 w-4 text-purple-500" />
          종목 스코어 조회
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            placeholder="종목코드 (예: 005930)"
            value={stockCode}
            onChange={e => setStockCode(e.target.value)}
            className="h-8 text-sm"
            onKeyDown={e => e.key === "Enter" && scoreMutation.mutate()}
          />
          <Button size="sm" onClick={() => scoreMutation.mutate()} disabled={scoreMutation.isPending || !stockCode.trim()}>
            {scoreMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {scoreResult && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">종합 스코어</span>
              <ScoreBadge score={scoreResult.totalScore} />
            </div>
            <div className="grid grid-cols-5 gap-1 text-xs text-center">
              {[
                { label: "MA", score: scoreResult.maScore, color: "text-blue-600" },
                { label: "RSI", score: scoreResult.rsiScore, color: "text-purple-600" },
                { label: "BB", score: scoreResult.bollingerScore, color: "text-orange-600" },
                { label: "거래량", score: scoreResult.volumeScore, color: "text-green-600" },
                { label: "갭", score: scoreResult.gapScore, color: "text-red-600" },
              ].map(({ label, score, color }) => (
                <div key={label} className="p-1 rounded bg-background">
                  <div className={`font-medium ${color}`}>{label}</div>
                  <div className="font-mono">{score}</div>
                </div>
              ))}
            </div>
            {scoreResult.details && (
              <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t">
                <div>현재가: {scoreResult.details.currentPrice?.toLocaleString()}원 | RSI: {scoreResult.details.rsi}</div>
                <div>MA5: {scoreResult.details.ma5?.toLocaleString()} | MA20: {scoreResult.details.ma20?.toLocaleString()}</div>
                <div>BB: {scoreResult.details.bollingerLower?.toLocaleString()} ~ {scoreResult.details.bollingerUpper?.toLocaleString()}</div>
                <div>거래량비: {scoreResult.details.volumeRatio}배 | 갭: {scoreResult.details.gapPercent}%</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ========== 메인 패널 ==========
export default function MultiFactorPanel() {
  const { toast } = useToast();
  const [closingPosId, setClosingPosId] = useState<number | null>(null);
  const [executingPhase, setExecutingPhase] = useState<string | null>(null);

  const { data: strategy, isLoading: strategyLoading } = useQuery<MultiFactorConfig | null>({
    queryKey: ["multi-factor"],
    queryFn: async () => {
      const res = await fetch("/api/trading/multi-factor", { credentials: "include" });
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const { data: positions = [] } = useQuery<MFPosition[]>({
    queryKey: ["multi-factor-positions"],
    queryFn: async () => {
      const res = await fetch("/api/trading/multi-factor/positions", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<MFLog[]>({
    queryKey: ["multi-factor-logs"],
    queryFn: async () => {
      const res = await fetch("/api/trading/multi-factor/logs?limit=100", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15000,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<MultiFactorConfig>) => {
      const res = await apiRequest("POST", "/api/trading/multi-factor", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "멀티팩터 전략 설정이 저장되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["multi-factor"] });
    },
    onError: (error: any) => toast({ title: "저장 실패", description: error.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trading/multi-factor/toggle");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data.isActive ? "멀티팩터 전략 활성화" : "멀티팩터 전략 비활성화" });
      queryClient.invalidateQueries({ queryKey: ["multi-factor"] });
    },
    onError: (error: any) => toast({ title: "토글 실패", description: error.message, variant: "destructive" }),
  });

  const executeMutation = useMutation({
    mutationFn: async (phase: string) => {
      setExecutingPhase(phase);
      const res = await apiRequest("POST", "/api/trading/multi-factor/execute", { phase });
      return res.json();
    },
    onSuccess: (data: any) => {
      const msgs = data.results?.join("\n") || "실행 완료";
      toast({ title: `${executingPhase} 실행 결과`, description: msgs });
      queryClient.invalidateQueries({ queryKey: ["multi-factor-positions"] });
      queryClient.invalidateQueries({ queryKey: ["multi-factor-logs"] });
      setExecutingPhase(null);
    },
    onError: (error: any) => {
      toast({ title: "실행 실패", description: error.message, variant: "destructive" });
      setExecutingPhase(null);
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (posId: number) => {
      setClosingPosId(posId);
      const res = await apiRequest("POST", `/api/trading/multi-factor/positions/${posId}/close`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "포지션이 청산되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["multi-factor-positions"] });
      setClosingPosId(null);
    },
    onError: (error: any) => {
      toast({ title: "청산 실패", description: error.message, variant: "destructive" });
      setClosingPosId(null);
    },
  });

  const activePositions = positions.filter(p => p.status !== "closed");
  const closedPositions = positions.filter(p => p.status === "closed");

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
      {/* 상단 전략 상태 & 제어 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base">
              <Layers className="h-5 w-5 text-purple-500" />
              멀티팩터 전략
            </div>
            <div className="flex items-center gap-2">
              {strategy && (
                <>
                  <span className={`text-xs px-2 py-0.5 rounded ${strategy.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {strategy.isActive ? "활성" : "비활성"}
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
          {strategy && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">종목군</div>
                <div className="text-sm font-medium">
                  {strategy.universeType === "both" ? "코스피+코스닥" : strategy.universeType === "kospi200" ? "코스피200" : "코스닥150"}
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
                <div className="text-xs text-muted-foreground">매수/매도 기준</div>
                <div className="text-sm font-medium">{strategy.buyScoreThreshold}/{strategy.sellScoreThreshold}점</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground">손절/익절</div>
                <div className="text-sm font-medium">{strategy.stopLossPercent}/{strategy.takeProfitPercent}%</div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
            <span className="text-xs text-muted-foreground self-center mr-1">수동실행:</span>
            {[
              { phase: "scan", label: "사전스캔", icon: <Search className="h-3 w-3 mr-1" /> },
              { phase: "score", label: "스코어링", icon: <Gauge className="h-3 w-3 mr-1" /> },
              { phase: "buy", label: "매수실행", icon: <ArrowUpRight className="h-3 w-3 mr-1" /> },
              { phase: "sell", label: "매도체크", icon: <ArrowDownRight className="h-3 w-3 mr-1" /> },
              { phase: "auto", label: "자동", icon: <Zap className="h-3 w-3 mr-1" /> },
            ].map(({ phase, label, icon }) => (
              <Button
                key={phase}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => executeMutation.mutate(phase)}
                disabled={executeMutation.isPending}
              >
                {executingPhase === phase ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : icon}
                {label}
              </Button>
            ))}
            <Button
              variant="ghost" size="sm" className="h-7 text-xs ml-auto"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["multi-factor-positions"] });
                queryClient.invalidateQueries({ queryKey: ["multi-factor-logs"] });
              }}
            >
              <RefreshCw className="h-3 w-3 mr-1" /> 새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 전략 설정 */}
      <StrategySettings
        config={strategy || null}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
      />

      {/* 종목 스코어 조회 */}
      <StockScoreChecker />

      {/* 활성 포지션 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-green-500" />
            활성 포지션 ({activePositions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PositionList positions={activePositions} onClose={(id) => closeMutation.mutate(id)} closingId={closingPosId} />
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
            <PositionList positions={closedPositions} onClose={() => {}} closingId={null} />
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
            <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : (
            <LogList logs={logs} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
