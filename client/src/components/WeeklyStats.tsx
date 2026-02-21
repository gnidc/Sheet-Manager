import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Globe, Landmark, Droplets, BarChart3, Bitcoin, DollarSign, Flag, Star, Sparkles, X, Copy, ClipboardPaste, Save, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

async function copyAsRichText(markdown: string): Promise<boolean> {
  try {
    let html = markdown
      .replace(/^#### (.+)$/gm, '<h4 style="font-size:14px;font-weight:bold;margin:12px 0 4px;">$1</h4>')
      .replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:bold;margin:14px 0 6px;">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:bold;margin:16px 0 6px;">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:bold;margin:18px 0 8px;">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.+?)\*/g, '<i>$1</i>')
      .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #ccc;margin:12px 0;">')
      .replace(/^(\d+)\. (.+)$/gm, '<div style="margin-left:16px;">$1. $2</div>')
      .replace(/^[-*] (.+)$/gm, '<div style="margin-left:16px;">• $1</div>')
      .replace(/`(.+?)`/g, '<code style="background:#f1f1f1;padding:1px 4px;border-radius:3px;font-size:13px;">$1</code>')
      .replace(/\n\n/g, '</p><p style="margin:8px 0;">')
      .replace(/\n/g, '<br>');
    html = `<div style="font-family:'Malgun Gothic','맑은 고딕',sans-serif;font-size:14px;line-height:1.7;color:#333;"><p style="margin:8px 0;">${html}</p></div>`;
    const htmlBlob = new Blob([html], { type: "text/html" });
    const textBlob = new Blob([markdown], { type: "text/plain" });
    await navigator.clipboard.write([new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob })]);
    return true;
  } catch {
    try { await navigator.clipboard.writeText(markdown); return true; } catch { return false; }
  }
}

interface WeeklyStatsData {
  globalIndices: { name: string; price: number; weekChange: number; dayChange: number }[];
  domesticIndices: { name: string; price: number; weekChange: number; dayChange: number }[];
  bonds: { name: string; value: number; weekChange: number; dayChange: number }[];
  commodities: { name: string; price: number; weekChange: number; dayChange: number }[];
  etfs: { name: string; price: number; weekChange: number }[];
  domesticEtfs: { name: string; code: string; price: number; weekReturn: number }[];
  coreEtfs: { name: string; code: string; sector: string; price: number; weekReturn: number }[];
  crypto: { symbol: string; name: string; price: number; change24h: number; change7d: number; marketCap: number }[];
  cryptoTop10: { symbol: string; name: string; price: number; change7d: number; marketCap: number }[];
  forex: { name: string; value: number; weekChange: number }[];
  updatedAt: string;
}

function ChangeCell({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const color = value > 0 ? "text-red-500" : value < 0 ? "text-blue-500" : "text-muted-foreground";
  const prefix = value > 0 ? "+" : "";
  return <span className={`font-medium ${color}`}>{prefix}{value}{suffix}</span>;
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">{icon} {title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {children}
      </CardContent>
    </Card>
  );
}

export default function WeeklyStats() {
  const { toast } = useToast();
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  const captureSnapshot = useCallback(async () => {
    if (!statsRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const dataUrl = await toPng(statsRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        style: { padding: "16px" },
      });
      const blob = await (await fetch(dataUrl)).blob();
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast({ title: "스냅샷 복사 완료", description: "이미지가 클립보드에 복사되었습니다." });
      } catch {
        const link = document.createElement("a");
        link.download = `주간통계_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = dataUrl;
        link.click();
        toast({ title: "스냅샷 다운로드", description: "이미지가 다운로드되었습니다." });
      }
    } catch (e: any) {
      toast({ title: "스냅샷 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, toast]);

  const { data, isLoading, refetch, isFetching } = useQuery<WeeklyStatsData>({
    queryKey: ["/api/markets/weekly-stats"],
    queryFn: async () => {
      const res = await fetch("/api/markets/weekly-stats");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const aiMutation = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("통계 데이터가 없습니다.");
      const res = await fetch("/api/markets/weekly-stats/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ statsData: data }),
      });
      const text = await res.text();
      let json: any;
      try { json = JSON.parse(text); } catch { throw new Error("서버 응답 오류 - 로그인 상태를 확인하세요."); }
      if (!res.ok) throw new Error(json.message || "AI 분석 실패");
      return json as { analysis: string };
    },
    onSuccess: (result) => {
      setAiResult(result.analysis);
      toast({ title: "AI 분석 완료", description: "주간통계 분석 보고서가 생성되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "AI 분석 실패", description: error.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!aiResult) throw new Error("저장할 분석 결과가 없습니다.");
      const res = await fetch("/api/strategy-analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          period: "weekly",
          prompt: "주간통계 AI 분석",
          urls: [],
          fileNames: [],
          source: "weekly-stats",
          result: { analysis: aiResult, analyzedAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) },
          isShared: true,
        }),
      });
      const text = await res.text();
      let json: any;
      try { json = JSON.parse(text); } catch { throw new Error("서버 응답 오류 - 로그인 상태를 확인하세요."); }
      if (!res.ok) throw new Error(json.message || "저장 실패");
      return json;
    },
    onSuccess: () => {
      toast({ title: "저장 완료", description: "주간보고서가 저장되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">📊 주간통계</h2>
        <div className="flex items-center gap-2">
          {data?.updatedAt && <span className="text-xs text-muted-foreground">{data.updatedAt}</span>}
          <Button variant="outline" size="sm" className="gap-1" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            새로고침
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={captureSnapshot} disabled={isCapturing || !data}>
            {isCapturing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            스냅샷
          </Button>
          <Button
            size="sm"
            className="gap-1"
            onClick={() => aiMutation.mutate()}
            disabled={aiMutation.isPending || !data || isLoading}
          >
            {aiMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            AI분석
          </Button>
        </div>
      </div>

      {/* AI 분석 결과 */}
      {aiResult && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> AI 주간통계 분석 보고서
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                  navigator.clipboard.writeText(aiResult).then(() => {
                    toast({ title: "복사 완료", description: "텍스트가 클립보드에 복사되었습니다." });
                  }).catch(() => {
                    toast({ title: "복사 실패", variant: "destructive" });
                  });
                }}>
                  <Copy className="w-3 h-3" /> 복사
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                  copyAsRichText(aiResult).then((ok) => {
                    if (ok) toast({ title: "서식 복사 완료", description: "서식이 포함된 텍스트가 복사되었습니다." });
                    else toast({ title: "서식 복사 실패", variant: "destructive" });
                  });
                }}>
                  <ClipboardPaste className="w-3 h-3" /> 서식복사
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  주간보고서 저장
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAiResult(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
              {aiResult}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : data ? (
        <div ref={statsRef} className="space-y-4">
          {/* 글로벌 지수 */}
          <SectionCard title="글로벌 주요 지수" icon={<Globe className="w-4 h-4 text-blue-500" />}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[130px]">지수</TableHead>
                    <TableHead className="text-xs text-right">현재가</TableHead>
                    <TableHead className="text-xs text-right">주간 등락</TableHead>
                    <TableHead className="text-xs text-right">전일 대비</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.globalIndices.map((idx) => (
                    <TableRow key={idx.name}>
                      <TableCell className="text-xs font-medium py-1.5">{idx.name}</TableCell>
                      <TableCell className="text-xs text-right py-1.5">{idx.price.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right py-1.5"><ChangeCell value={idx.weekChange} /></TableCell>
                      <TableCell className="text-xs text-right py-1.5"><ChangeCell value={idx.dayChange} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          {/* 국내 주요 지수 */}
          {data.domesticIndices?.length > 0 && (
            <SectionCard title="국내 주요 지수" icon={<Flag className="w-4 h-4 text-red-500" />}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-[130px]">지수</TableHead>
                      <TableHead className="text-xs text-right">현재가</TableHead>
                      <TableHead className="text-xs text-right">주간 등락</TableHead>
                      <TableHead className="text-xs text-right">전일 대비</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.domesticIndices.map((idx) => (
                      <TableRow key={idx.name}>
                        <TableCell className="text-xs font-medium py-1.5">{idx.name}</TableCell>
                        <TableCell className="text-xs text-right py-1.5">{idx.price.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-right py-1.5"><ChangeCell value={idx.weekChange} /></TableCell>
                        <TableCell className="text-xs text-right py-1.5"><ChangeCell value={idx.dayChange} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </SectionCard>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 채권/금리 */}
            <SectionCard title="채권/금리" icon={<Landmark className="w-4 h-4 text-amber-600" />}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">종목</TableHead>
                      <TableHead className="text-xs text-right">금리(%)</TableHead>
                      <TableHead className="text-xs text-right">주간 변동</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.bonds.map((b) => (
                      <TableRow key={b.name}>
                        <TableCell className="text-xs font-medium py-1.5">{b.name}</TableCell>
                        <TableCell className="text-xs text-right py-1.5">{b.value}</TableCell>
                        <TableCell className="text-xs text-right py-1.5"><ChangeCell value={b.weekChange} suffix="%p" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </SectionCard>

            {/* 환율 */}
            <SectionCard title="주요 환율" icon={<DollarSign className="w-4 h-4 text-green-600" />}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">통화쌍</TableHead>
                      <TableHead className="text-xs text-right">현재가</TableHead>
                      <TableHead className="text-xs text-right">주간 등락</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.forex.map((fx) => (
                      <TableRow key={fx.name}>
                        <TableCell className="text-xs font-medium py-1.5">{fx.name}</TableCell>
                        <TableCell className="text-xs text-right py-1.5">{fx.value.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-right py-1.5"><ChangeCell value={fx.weekChange} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </SectionCard>
          </div>

          {/* 원자재 */}
          <SectionCard title="원자재" icon={<Droplets className="w-4 h-4 text-orange-500" />}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[100px]">종목</TableHead>
                    <TableHead className="text-xs text-right">현재가($)</TableHead>
                    <TableHead className="text-xs text-right">주간 등락</TableHead>
                    <TableHead className="text-xs text-right">전일 대비</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.commodities.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell className="text-xs font-medium py-1.5">{c.name}</TableCell>
                      <TableCell className="text-xs text-right py-1.5">${c.price.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right py-1.5"><ChangeCell value={c.weekChange} /></TableCell>
                      <TableCell className="text-xs text-right py-1.5"><ChangeCell value={c.dayChange} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          {/* 글로벌 주요 ETF 등락률 */}
          <SectionCard title="글로벌 주요ETF 등락률" icon={<BarChart3 className="w-4 h-4 text-purple-500" />}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">순위</TableHead>
                    <TableHead className="text-xs">ETF</TableHead>
                    <TableHead className="text-xs text-right">현재가($)</TableHead>
                    <TableHead className="text-xs text-right">주간 등락</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.etfs.map((e, i) => (
                    <TableRow key={e.name}>
                      <TableCell className="text-xs py-1.5">{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium py-1.5">
                        <div className="flex items-center gap-1.5">
                          {e.weekChange > 0 ? <TrendingUp className="w-3 h-3 text-red-500" /> : <TrendingDown className="w-3 h-3 text-blue-500" />}
                          {e.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-right py-1.5">${e.price.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right py-1.5">
                        <Badge variant={e.weekChange > 0 ? "destructive" : "default"} className="text-[10px] px-1.5 py-0">
                          {e.weekChange > 0 ? "+" : ""}{e.weekChange}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          {/* 국내 ETF 주간 수익률 TOP 10 */}
          {data.domesticEtfs?.length > 0 && (
            <SectionCard title="국내 ETF 주간 수익률 TOP 10" icon={<Flag className="w-4 h-4 text-red-500" />}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">순위</TableHead>
                      <TableHead className="text-xs">ETF</TableHead>
                      <TableHead className="text-xs text-right">현재가(원)</TableHead>
                      <TableHead className="text-xs text-right">주간 수익률</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.domesticEtfs.map((e, i) => (
                      <TableRow key={e.code}>
                        <TableCell className="text-xs py-1.5">{i + 1}</TableCell>
                        <TableCell className="text-xs font-medium py-1.5">
                          <div className="flex items-center gap-1.5">
                            {e.weekReturn > 0 ? <TrendingUp className="w-3 h-3 text-red-500" /> : <TrendingDown className="w-3 h-3 text-blue-500" />}
                            {e.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-right py-1.5">{e.price.toLocaleString()}원</TableCell>
                        <TableCell className="text-xs text-right py-1.5">
                          <Badge variant={e.weekReturn > 0 ? "destructive" : "default"} className="text-[10px] px-1.5 py-0">
                            {e.weekReturn > 0 ? "+" : ""}{e.weekReturn}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </SectionCard>
          )}

          {/* 관심ETF(Core) 주간 수익률 */}
          {data.coreEtfs?.length > 0 && (
            <SectionCard title="관심ETF(Core) 주간 수익률" icon={<Star className="w-4 h-4 text-yellow-500" />}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">순위</TableHead>
                      <TableHead className="text-xs">ETF</TableHead>
                      <TableHead className="text-xs">섹터</TableHead>
                      <TableHead className="text-xs text-right">현재가(원)</TableHead>
                      <TableHead className="text-xs text-right">주간 수익률</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.coreEtfs.map((e, i) => (
                      <TableRow key={e.code}>
                        <TableCell className="text-xs py-1.5">{i + 1}</TableCell>
                        <TableCell className="text-xs font-medium py-1.5">
                          <div className="flex items-center gap-1.5">
                            {e.weekReturn > 0 ? <TrendingUp className="w-3 h-3 text-red-500" /> : e.weekReturn < 0 ? <TrendingDown className="w-3 h-3 text-blue-500" /> : null}
                            {e.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-1.5">{e.sector}</TableCell>
                        <TableCell className="text-xs text-right py-1.5">{e.price.toLocaleString()}원</TableCell>
                        <TableCell className="text-xs text-right py-1.5">
                          <Badge variant={e.weekReturn > 0 ? "destructive" : "default"} className="text-[10px] px-1.5 py-0">
                            {e.weekReturn > 0 ? "+" : ""}{e.weekReturn}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </SectionCard>
          )}

          {/* 암호화폐(관심) */}
          <SectionCard title="암호화폐(관심)" icon={<Bitcoin className="w-4 h-4 text-yellow-500" />}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">순위</TableHead>
                    <TableHead className="text-xs">코인</TableHead>
                    <TableHead className="text-xs text-right">현재가($)</TableHead>
                    <TableHead className="text-xs text-right">24h</TableHead>
                    <TableHead className="text-xs text-right">7d</TableHead>
                    <TableHead className="text-xs text-right">시가총액</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.crypto.map((c, i) => (
                    <TableRow key={c.symbol}>
                      <TableCell className="text-xs py-1.5">{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium py-1.5">
                        {c.name} <span className="text-muted-foreground">({c.symbol})</span>
                      </TableCell>
                      <TableCell className="text-xs text-right py-1.5">${c.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-xs text-right py-1.5"><ChangeCell value={c.change24h} /></TableCell>
                      <TableCell className="text-xs text-right py-1.5"><ChangeCell value={c.change7d} /></TableCell>
                      <TableCell className="text-xs text-right py-1.5">${(c.marketCap / 1e9).toFixed(1)}B</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          {/* 암호화폐 주간상승률 TOP 10 */}
          {data.cryptoTop10?.length > 0 && (
            <SectionCard title="암호화폐 주간상승률 TOP 10" icon={<TrendingUp className="w-4 h-4 text-orange-500" />}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">순위</TableHead>
                      <TableHead className="text-xs">코인</TableHead>
                      <TableHead className="text-xs text-right">현재가($)</TableHead>
                      <TableHead className="text-xs text-right">7일 등락</TableHead>
                      <TableHead className="text-xs text-right">시가총액</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.cryptoTop10.map((c, i) => (
                      <TableRow key={c.symbol}>
                        <TableCell className="text-xs py-1.5">{i + 1}</TableCell>
                        <TableCell className="text-xs font-medium py-1.5">
                          {c.name} <span className="text-muted-foreground">({c.symbol})</span>
                        </TableCell>
                        <TableCell className="text-xs text-right py-1.5">${c.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-xs text-right py-1.5">
                          <Badge variant={c.change7d > 0 ? "destructive" : "default"} className="text-[10px] px-1.5 py-0">
                            {c.change7d > 0 ? "+" : ""}{c.change7d}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right py-1.5">${(c.marketCap / 1e9).toFixed(1)}B</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </SectionCard>
          )}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">데이터를 불러올 수 없습니다.</div>
      )}
    </div>
  );
}
