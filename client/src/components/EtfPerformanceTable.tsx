/**
 * ETF 기간별 수익률 테이블 컴포넌트
 * - /api/etf/performance/:code API에서 데이터 조회
 * - 1개월~상장이후 수익률 + 주요 지표(NAV, 총보수, 배당수익률 등) 표시
 */
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, Loader2 } from "lucide-react";

interface EtfPerformance {
  return1w?: number | string | null;
  return1m?: number | string | null;
  return3m?: number | string | null;
  return6m?: number | string | null;
  return1y?: number | string | null;
  return3y?: number | string | null;
  return5y?: number | string | null;
  returnYtd?: number | string | null;
  returnSinceListing?: number | string | null;
  nav?: number | string | null;
  trackingError?: number | string | null;
  premiumDiscount?: number | string | null;
  dividendYield?: number | string | null;
  totalExpenseRatio?: number | string | null;
}

function fmtRate(val: number | string | null | undefined) {
  if (val == null || val === "") return <span className="text-muted-foreground">-</span>;
  const v = typeof val === "string" ? parseFloat(val) : Number(val);
  if (isNaN(v)) return <span className="text-muted-foreground">-</span>;
  const color = v > 0 ? "text-red-500" : v < 0 ? "text-blue-500" : "text-muted-foreground";
  return <span className={`font-mono font-medium ${color}`}>{v > 0 ? "+" : ""}{v.toFixed(2)}</span>;
}

interface EtfPerformanceTableProps {
  etfCode: string;
  enabled?: boolean;
  className?: string;
}

export function EtfPerformanceTable({ etfCode, enabled = true, className }: EtfPerformanceTableProps) {
  const { data: perfData, isLoading } = useQuery<EtfPerformance>({
    queryKey: ["/api/etf/performance", etfCode],
    queryFn: async () => {
      const res = await fetch(`/api/etf/performance/${etfCode}`, { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: enabled && !!etfCode && /^[0-9A-Za-z]{6}$/.test(etfCode),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-3 text-xs text-muted-foreground gap-2 ${className || ""}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        수익률 조회 중...
      </div>
    );
  }

  if (!perfData || (perfData.return1m == null && perfData.return3m == null && perfData.returnYtd == null)) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className || ""}`}>
      <h4 className="text-sm font-semibold flex items-center gap-1.5">
        <CalendarDays className="w-4 h-4 text-primary" />
        기간별 수익률
        <span className="text-[10px] font-normal text-muted-foreground ml-1">
          ({new Date().toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" })} 기준)
        </span>
      </h4>
      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-center text-xs font-semibold w-[60px]">구분</TableHead>
              <TableHead className="text-center text-xs font-semibold min-w-[55px]">1개월</TableHead>
              <TableHead className="text-center text-xs font-semibold min-w-[55px]">3개월</TableHead>
              <TableHead className="text-center text-xs font-semibold min-w-[55px]">6개월</TableHead>
              <TableHead className="text-center text-xs font-semibold min-w-[55px]">1년</TableHead>
              <TableHead className="text-center text-xs font-semibold min-w-[55px]">3년</TableHead>
              <TableHead className="text-center text-xs font-semibold min-w-[55px]">5년</TableHead>
              <TableHead className="text-center text-xs font-semibold min-w-[55px]">연초이후</TableHead>
              <TableHead className="text-center text-xs font-semibold min-w-[55px]">상장이후</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="hover:bg-muted/20">
              <TableCell className="text-center text-xs font-semibold bg-muted/30">수익률(%)</TableCell>
              <TableCell className="text-center text-sm">{fmtRate(perfData.return1m)}</TableCell>
              <TableCell className="text-center text-sm">{fmtRate(perfData.return3m)}</TableCell>
              <TableCell className="text-center text-sm">{fmtRate(perfData.return6m)}</TableCell>
              <TableCell className="text-center text-sm">{fmtRate(perfData.return1y)}</TableCell>
              <TableCell className="text-center text-sm">{fmtRate(perfData.return3y)}</TableCell>
              <TableCell className="text-center text-sm">{fmtRate(perfData.return5y)}</TableCell>
              <TableCell className="text-center text-sm">{fmtRate(perfData.returnYtd)}</TableCell>
              <TableCell className="text-center text-sm">{fmtRate(perfData.returnSinceListing)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {(perfData.nav != null || perfData.totalExpenseRatio != null || perfData.dividendYield != null) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {perfData.nav != null && (
            <span>NAV: <span className="font-mono font-medium text-foreground">{Number(perfData.nav).toLocaleString()}</span></span>
          )}
          {perfData.totalExpenseRatio != null && (
            <span>총보수: <span className="font-mono font-medium text-foreground">{perfData.totalExpenseRatio}%</span></span>
          )}
          {perfData.dividendYield != null && (
            <span>배당수익률: <span className="font-mono font-medium text-foreground">{perfData.dividendYield}%</span></span>
          )}
          {perfData.trackingError != null && (
            <span>추적오차: <span className="font-mono font-medium text-foreground">{perfData.trackingError}%</span></span>
          )}
          {perfData.premiumDiscount != null && (
            <span>괴리율: {fmtRate(perfData.premiumDiscount)}<span className="text-[10px]">%</span></span>
          )}
        </div>
      )}
    </div>
  );
}
