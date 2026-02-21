import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Globe, Landmark, Droplets, BarChart3, Bitcoin, DollarSign, Flag, Star } from "lucide-react";

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
  const { data, isLoading, refetch, isFetching } = useQuery<WeeklyStatsData>({
    queryKey: ["/api/markets/weekly-stats"],
    queryFn: async () => {
      const res = await fetch("/api/markets/weekly-stats");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
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
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : data ? (
        <div className="space-y-4">
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
