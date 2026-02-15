import { useState, useMemo, useCallback, useEffect, useRef, useTransition, memo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search, Filter, BarChart3, Loader2, TrendingUp, TrendingDown,
  ArrowUpDown, Star, Copy, Zap, LayoutGrid, List, RefreshCw, Brain,
  ChevronDown, ChevronUp, X, Scale, Layers, ExternalLink, PieChart, Calendar, Info,
  Key, CheckCircle
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";

interface EtfItem {
  code: string;
  name: string;
  nowVal: number;
  changeVal: number;
  changeRate: number;
  risefall: string;
  nav: number;
  quant: number;
  amount: number;
  marketCap: number;
  threeMonthEarnRate: number;
}

interface EtfDetail {
  code: string;
  name: string;
  currentPrice: string;
  changePrice: string;
  changeRate: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  marketCap: string;
  nav: string;
  trackingError: string;
  dividendYield: string;
  totalExpenseRatio: string;
  listingDate: string;
  indexName: string;
  managementCompany: string;
  totalAssets: string;
}

interface ThemeStat {
  name: string;
  icon: string;
  count: number;
  avgChangeRate: number;
  avg3mReturn: number;
  topEtfs: EtfItem[];
}

interface CompareEtf extends EtfItem {
  dividendYield?: number | string | null;
  totalExpenseRatio?: number | string | null;
  indexName?: string | null;
  managementCompany?: string | null;
  totalAssets?: string | null;
  totalNav?: string | null;
  trackingError?: string | null;
  highPrice52w?: number | null;
  lowPrice52w?: number | null;
  listingDate?: string | null;
  riskGrade?: string | null;
  stockType?: string | null;
  amount?: number;
  performance?: {
    week1?: number | null;
    month1?: number | null;
    month3?: number | null;
    month6?: number | null;
    year1?: number | null;
    year3?: number | null;
    year5?: number | null;
    ytd?: number | null;
  };
  costDetail?: {
    managementFee?: number | string | null;
    sellingFee?: number | string | null;
    trustFee?: number | string | null;
    officeFee?: number | string | null;
    totalFee?: number | string | null;
    syntheticTotalFee?: number | string | null;
    realExpenseRatio?: number | string | null;
    monthlyDividend?: string | null;
    annualDividendRate?: number | string | null;
    annualDividendCount?: number | null;
  };
  holdings?: { name: string; code: string; weight: number; price?: string; changePercent?: string }[];
}

interface EtfSearchProps {
  isAdmin: boolean;
  onNavigate?: (tab: string) => void;
}

export default function EtfSearch({ isAdmin, onNavigate }: EtfSearchProps) {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState("search");
  const [isPending, startTransition] = useTransition();

  const handleTabChange = useCallback((value: string) => {
    startTransition(() => {
      setActiveSection(value);
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            ETF 통합 검색
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            검색, 스크리너, 비교, 테마맵, AI 추천 - 모든 ETF 정보를 한 곳에서
          </p>
        </div>
      </div>

      {/* 섹션 탭 */}
      <Tabs value={activeSection} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="search" className="text-xs sm:text-sm gap-1 py-2">
            <Search className="h-3.5 w-3.5" /> 검색
          </TabsTrigger>
          <TabsTrigger value="screener" className="text-xs sm:text-sm gap-1 py-2">
            <Filter className="h-3.5 w-3.5" /> 스크리너
          </TabsTrigger>
          <TabsTrigger value="compare" className="text-xs sm:text-sm gap-1 py-2">
            <Scale className="h-3.5 w-3.5" /> 비교
          </TabsTrigger>
          <TabsTrigger value="themes" className="text-xs sm:text-sm gap-1 py-2">
            <LayoutGrid className="h-3.5 w-3.5" /> 테마맵
          </TabsTrigger>
          <TabsTrigger value="ai" className="text-xs sm:text-sm gap-1 py-2">
            <Brain className="h-3.5 w-3.5" /> AI추천
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search"><SearchSection onNavigate={onNavigate} /></TabsContent>
        <TabsContent value="screener"><ScreenerSection onNavigate={onNavigate} /></TabsContent>
        <TabsContent value="compare"><CompareSection /></TabsContent>
        <TabsContent value="themes"><ThemeMapSection onNavigate={onNavigate} /></TabsContent>
        <TabsContent value="ai"><AiRecommendSection /></TabsContent>
      </Tabs>
    </div>
  );
}

// =============================================
// 공통: ETF 상세보기 (새 창으로 열기 - 국내/해외주식 상세보기와 동일)
// =============================================
function openEtfStockDetail(code: string, name: string) {
  const url = `/stock-detail?code=${code}&name=${encodeURIComponent(name)}&market=domestic&exchange=KOSPI&type=etf`;
  window.open(url, `stock_${code}`, "width=1000,height=800,scrollbars=yes,resizable=yes");
}

// =============================================
// A. 키워드 검색
// =============================================
function SearchSection({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const { data: searchData, isLoading } = useQuery({
    queryKey: ["/api/etf/search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return null;
      const res = await apiRequest("GET", `/api/etf/search?q=${encodeURIComponent(debouncedQuery)}`);
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  const results = searchData?.results || [];

  return (
    <div className="space-y-4">
      {/* 검색바 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ETF 이름 또는 코드 검색 (예: 반도체, 2차전지, 461580)"
          className="pl-10 pr-10 h-12 text-base"
        />
        {query && (
          <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => { setQuery(""); setDebouncedQuery(""); }}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 인기 키워드 */}
      {!debouncedQuery && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">인기 검색:</span>
          {["반도체", "2차전지", "AI", "배당", "미국", "채권", "금", "코스피200"].map(kw => (
            <Badge key={kw} variant="secondary" className="cursor-pointer hover:bg-primary/10"
              onClick={() => setQuery(kw)}>
              {kw}
            </Badge>
          ))}
        </div>
      )}

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* 검색 결과 */}
      {results.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>검색 결과 ({results.length}건)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium">종목명</th>
                    <th className="text-right px-3 py-2 font-medium">현재가</th>
                    <th className="text-right px-3 py-2 font-medium">등락률</th>
                    <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">3개월수익률</th>
                    <th className="text-right px-3 py-2 font-medium hidden md:table-cell">시가총액</th>
                    <th className="text-right px-3 py-2 font-medium hidden lg:table-cell">거래량</th>
                    <th className="text-center px-3 py-2 font-medium">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((etf: EtfItem) => (
                    <tr key={etf.code} className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => openEtfStockDetail(etf.code, etf.name)}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-xs sm:text-sm">{etf.name}</div>
                        <div className="text-xs text-muted-foreground">{etf.code}</div>
                      </td>
                      <td className="text-right px-3 py-2 font-mono">{etf.nowVal?.toLocaleString()}</td>
                      <td className={`text-right px-3 py-2 font-mono font-semibold ${etf.changeRate > 0 ? "text-red-500" : etf.changeRate < 0 ? "text-blue-500" : ""}`}>
                        {etf.changeRate > 0 ? "+" : ""}{etf.changeRate?.toFixed(2)}%
                      </td>
                      <td className={`text-right px-3 py-2 font-mono hidden sm:table-cell ${etf.threeMonthEarnRate > 0 ? "text-red-500" : etf.threeMonthEarnRate < 0 ? "text-blue-500" : ""}`}>
                        {etf.threeMonthEarnRate > 0 ? "+" : ""}{etf.threeMonthEarnRate?.toFixed(2)}%
                      </td>
                      <td className="text-right px-3 py-2 hidden md:table-cell">
                        {etf.marketCap ? `${Math.round(etf.marketCap / 100000000).toLocaleString()}억` : "-"}
                      </td>
                      <td className="text-right px-3 py-2 hidden lg:table-cell font-mono text-xs">
                        {etf.quant?.toLocaleString()}
                      </td>
                      <td className="text-center px-3 py-2">
                        <Button variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={(e) => { e.stopPropagation(); openEtfStockDetail(etf.code, etf.name); }}>
                          상세
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {debouncedQuery && debouncedQuery.length >= 2 && !isLoading && results.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">검색 결과가 없습니다.</div>
      )}
    </div>
  );
}

// =============================================
// B. 스크리너
// =============================================
function ScreenerSection({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    keyword: "",
    minChangeRate: "",
    maxChangeRate: "",
    minMarketCap: "",
    minVolume: "",
    min3mReturn: "",
    max3mReturn: "",
    excludeLeverage: true,
    excludeInverse: true,
    sortBy: "changeRate",
    sortOrder: "desc",
    limit: "50",
  });
  const [showFilters, setShowFilters] = useState(true);
  const [shouldFetch, setShouldFetch] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  const buildQueryStr = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.keyword) params.set("keyword", filters.keyword);
    if (filters.minChangeRate) params.set("minChangeRate", filters.minChangeRate);
    if (filters.maxChangeRate) params.set("maxChangeRate", filters.maxChangeRate);
    if (filters.minMarketCap) params.set("minMarketCap", (parseFloat(filters.minMarketCap) * 100000000).toString());
    if (filters.minVolume) params.set("minVolume", (parseFloat(filters.minVolume) * 10000).toString());
    if (filters.min3mReturn) params.set("min3mReturn", filters.min3mReturn);
    if (filters.max3mReturn) params.set("max3mReturn", filters.max3mReturn);
    params.set("excludeLeverage", String(filters.excludeLeverage));
    params.set("excludeInverse", String(filters.excludeInverse));
    params.set("sortBy", filters.sortBy);
    params.set("sortOrder", filters.sortOrder);
    params.set("limit", filters.limit);
    return params.toString();
  }, [filters]);

  const { data: screenData, isLoading, refetch } = useQuery({
    queryKey: ["/api/etf/screener", buildQueryStr()],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/etf/screener?${buildQueryStr()}`);
      return res.json();
    },
    enabled: shouldFetch,
  });

  const results: EtfItem[] = screenData?.results || [];

  const handleSearch = () => {
    setShouldFetch(true);
    setTimeout(() => refetch(), 0);
  };

  const toggleCode = (code: string) => {
    setSelectedCodes(prev => {
      const n = new Set(prev);
      if (n.has(code)) n.delete(code); else n.add(code);
      return n;
    });
  };

  // 프리셋
  const presets = [
    { label: "🔥 오늘 급등 ETF", fn: () => setFilters(f => ({...f, minChangeRate: "2", excludeLeverage: true, excludeInverse: true, sortBy: "changeRate", sortOrder: "desc"})) },
    { label: "💰 고배당 안정형", fn: () => setFilters(f => ({...f, keyword: "배당", minMarketCap: "1000", sortBy: "marketCap", sortOrder: "desc"})) },
    { label: "📈 3개월 수익률 TOP", fn: () => setFilters(f => ({...f, min3mReturn: "5", excludeLeverage: true, excludeInverse: true, sortBy: "threeMonthEarnRate", sortOrder: "desc"})) },
    { label: "🏦 대형 ETF (시총순)", fn: () => setFilters(f => ({...f, minMarketCap: "5000", sortBy: "marketCap", sortOrder: "desc"})) },
    { label: "📉 하락 저가매수 기회", fn: () => setFilters(f => ({...f, maxChangeRate: "-2", excludeLeverage: true, excludeInverse: true, sortBy: "changeRate", sortOrder: "asc"})) },
  ];

  return (
    <div className="space-y-4">
      {/* 프리셋 버튼 */}
      <div className="flex flex-wrap gap-2">
        {presets.map((p, i) => (
          <Button key={i} variant="outline" size="sm" className="text-xs"
            onClick={() => { p.fn(); setShouldFetch(false); }}>
            {p.label}
          </Button>
        ))}
      </div>

      {/* 필터 패널 */}
      <Card>
        <CardHeader className="py-3 cursor-pointer" onClick={() => setShowFilters(!showFilters)}>
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2"><Filter className="h-4 w-4" /> 필터 조건</span>
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        {showFilters && (
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs mb-1 block">키워드</Label>
                <Input value={filters.keyword} onChange={e => setFilters(f => ({...f, keyword: e.target.value}))}
                  placeholder="예: 반도체" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">최소 등락률 (%)</Label>
                <Input type="number" value={filters.minChangeRate} onChange={e => setFilters(f => ({...f, minChangeRate: e.target.value}))}
                  placeholder="예: 1" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">최대 등락률 (%)</Label>
                <Input type="number" value={filters.maxChangeRate} onChange={e => setFilters(f => ({...f, maxChangeRate: e.target.value}))}
                  placeholder="예: 10" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">최소 시총 (억원)</Label>
                <Input type="number" value={filters.minMarketCap} onChange={e => setFilters(f => ({...f, minMarketCap: e.target.value}))}
                  placeholder="예: 1000" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">최소 거래량 (만주)</Label>
                <Input type="number" value={filters.minVolume} onChange={e => setFilters(f => ({...f, minVolume: e.target.value}))}
                  placeholder="예: 10" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">최소 3개월 수익률 (%)</Label>
                <Input type="number" value={filters.min3mReturn} onChange={e => setFilters(f => ({...f, min3mReturn: e.target.value}))}
                  placeholder="예: 5" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">최대 3개월 수익률 (%)</Label>
                <Input type="number" value={filters.max3mReturn} onChange={e => setFilters(f => ({...f, max3mReturn: e.target.value}))}
                  placeholder="예: 30" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">표시 개수</Label>
                <Select value={filters.limit} onValueChange={v => setFilters(f => ({...f, limit: v}))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20개</SelectItem>
                    <SelectItem value="50">50개</SelectItem>
                    <SelectItem value="100">100개</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox checked={filters.excludeLeverage} onCheckedChange={(c) => setFilters(f => ({...f, excludeLeverage: !!c}))} />
                <span className="text-xs">레버리지 제외</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={filters.excludeInverse} onCheckedChange={(c) => setFilters(f => ({...f, excludeInverse: !!c}))} />
                <span className="text-xs">인버스 제외</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">정렬:</Label>
                <Select value={filters.sortBy} onValueChange={v => setFilters(f => ({...f, sortBy: v}))}>
                  <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="changeRate">등락률</SelectItem>
                    <SelectItem value="threeMonthEarnRate">3개월수익률</SelectItem>
                    <SelectItem value="marketCap">시가총액</SelectItem>
                    <SelectItem value="quant">거래량</SelectItem>
                    <SelectItem value="nowVal">현재가</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.sortOrder} onValueChange={v => setFilters(f => ({...f, sortOrder: v}))}>
                  <SelectTrigger className="h-8 w-[80px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">내림차순</SelectItem>
                    <SelectItem value="asc">오름차순</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSearch} className="gap-1" size="sm">
                <Search className="h-3.5 w-3.5" /> 검색
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                setFilters({ keyword: "", minChangeRate: "", maxChangeRate: "", minMarketCap: "",
                  minVolume: "", min3mReturn: "", max3mReturn: "", excludeLeverage: true,
                  excludeInverse: true, sortBy: "changeRate", sortOrder: "desc", limit: "50" });
                setShouldFetch(false);
              }}>
                초기화
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 결과 */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>스크리닝 결과 (총 {screenData?.total || 0}건 중 {results.length}건)</span>
              {selectedCodes.size > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedCodes.size}개 선택</Badge>
                  {onNavigate && (
                    <Button size="sm" variant="default" className="h-7 text-xs gap-1"
                      onClick={() => {
                        const code = Array.from(selectedCodes)[0];
                        onNavigate(`trading?code=${code}`);
                      }}>
                      매수
                    </Button>
                  )}
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-8 px-2 py-2"></th>
                    <th className="text-left px-3 py-2 font-medium">종목명</th>
                    <th className="text-right px-3 py-2 font-medium">현재가</th>
                    <th className="text-right px-3 py-2 font-medium">등락률</th>
                    <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">3개월수익률</th>
                    <th className="text-right px-3 py-2 font-medium hidden md:table-cell">시가총액</th>
                    <th className="text-right px-3 py-2 font-medium hidden lg:table-cell">거래량</th>
                    <th className="text-center px-3 py-2 font-medium">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((etf: EtfItem) => (
                    <tr key={etf.code} className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => openEtfStockDetail(etf.code, etf.name)}>
                      <td className="px-2 py-2 text-center" onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selectedCodes.has(etf.code)} onCheckedChange={() => toggleCode(etf.code)} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-xs sm:text-sm">{etf.name}</div>
                        <div className="text-xs text-muted-foreground">{etf.code}</div>
                      </td>
                      <td className="text-right px-3 py-2 font-mono">{etf.nowVal?.toLocaleString()}</td>
                      <td className={`text-right px-3 py-2 font-mono font-semibold ${etf.changeRate > 0 ? "text-red-500" : etf.changeRate < 0 ? "text-blue-500" : ""}`}>
                        {etf.changeRate > 0 ? "+" : ""}{etf.changeRate?.toFixed(2)}%
                      </td>
                      <td className={`text-right px-3 py-2 font-mono hidden sm:table-cell ${etf.threeMonthEarnRate > 0 ? "text-red-500" : etf.threeMonthEarnRate < 0 ? "text-blue-500" : ""}`}>
                        {etf.threeMonthEarnRate > 0 ? "+" : ""}{etf.threeMonthEarnRate?.toFixed(2)}%
                      </td>
                      <td className="text-right px-3 py-2 hidden md:table-cell">
                        {etf.marketCap ? `${Math.round(etf.marketCap / 100000000).toLocaleString()}억` : "-"}
                      </td>
                      <td className="text-right px-3 py-2 hidden lg:table-cell font-mono text-xs">
                        {etf.quant?.toLocaleString()}
                      </td>
                      <td className="text-center px-3 py-2">
                        <Button variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={(e) => { e.stopPropagation(); openEtfStockDetail(etf.code, etf.name); }}>
                          상세
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =============================================
// C. ETF 비교
// =============================================
const COMPARE_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6"];

function CompareSection() {
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [compareCodes, setCompareCodes] = useState<string[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [compareTab, setCompareTab] = useState<"performance" | "info" | "holdings">("performance");

  // 검색
  const { data: searchData } = useQuery({
    queryKey: ["/api/etf/search", searchInput],
    queryFn: async () => {
      if (!searchInput || searchInput.length < 2) return null;
      const res = await apiRequest("GET", `/api/etf/search?q=${encodeURIComponent(searchInput)}`);
      return res.json();
    },
    enabled: searchInput.length >= 2,
  });

  // 비교 데이터
  const { data: compareData, isLoading } = useQuery<{ etfs: CompareEtf[]; summary?: string[] }>({
    queryKey: ["/api/etf/compare", compareCodes.join(",")],
    queryFn: async () => {
      if (compareCodes.length < 2) return { etfs: [] };
      const res = await apiRequest("GET", `/api/etf/compare?codes=${compareCodes.join(",")}`);
      return res.json();
    },
    enabled: compareCodes.length >= 2,
  });

  // 비교 차트 데이터 (수익률 추이)
  const { data: chartDataMap } = useQuery<Record<string, { date: string; close: number }[]>>({
    queryKey: ["/api/etf/compare-chart", compareCodes.join(",")],
    queryFn: async () => {
      const results: Record<string, { date: string; close: number }[]> = {};
      await Promise.all(compareCodes.map(async (code) => {
        try {
          const res = await fetch(`/api/etf/chart/${code}?period=1y`, { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            // API가 { chartData: [...] } 형태로 반환하므로 배열 추출
            const arr = Array.isArray(data) ? data : (data?.chartData || []);
            if (arr.length > 0) {
              results[code] = arr;
            }
          }
        } catch {}
      }));
      return results;
    },
    enabled: compareCodes.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  // 차트 데이터를 수익률로 변환
  const chartLines = useMemo(() => {
    if (!chartDataMap || Object.keys(chartDataMap).length === 0) return [];
    
    try {
      // 모든 ETF의 날짜를 합치고 정렬
      const allDates = new Set<string>();
      Object.values(chartDataMap).forEach(data => {
        if (Array.isArray(data)) {
          data.forEach(d => d?.date && allDates.add(d.date));
        }
      });
      if (allDates.size === 0) return [];
      const sortedDates = Array.from(allDates).sort();

      // 각 ETF의 시작가격 대비 수익률 계산
      return sortedDates.map(date => {
        const point: any = { date: date.length >= 8 ? date.slice(2) : date }; // YY.MM.DD
        compareCodes.forEach(code => {
          const data = chartDataMap[code];
          if (!Array.isArray(data) || data.length === 0) return;
          const basePrice = data[0]?.close;
          const curr = data.find(d => d.date === date);
          if (curr && basePrice > 0) {
            point[code] = parseFloat(((curr.close - basePrice) / basePrice * 100).toFixed(2));
          }
        });
        return point;
      });
    } catch (e) {
      console.error("Chart data processing error:", e);
      return [];
    }
  }, [chartDataMap, compareCodes]);

  const addCode = (code: string, _name: string) => {
    if (compareCodes.length >= 5) {
      toast({ title: "최대 5개까지 비교 가능합니다.", variant: "destructive" });
      return;
    }
    if (compareCodes.includes(code)) return;
    setCompareCodes([...compareCodes, code]);
    setSearchInput("");
    setShowSearch(false);
  };

  const removeCode = (code: string) => {
    setCompareCodes(compareCodes.filter(c => c !== code));
  };

  const etfs: CompareEtf[] = compareData?.etfs || [];
  const summary: string[] = compareData?.summary || [];

  // 수익률 값 포맷 (빨강/파랑)
  const fmtRate = (val: number | string | null | undefined) => {
    if (val == null || val === "") return <span className="text-muted-foreground">-</span>;
    const v = typeof val === "string" ? parseFloat(val) : Number(val);
    if (isNaN(v)) return <span className="text-muted-foreground">-</span>;
    const color = v > 0 ? "text-red-500" : v < 0 ? "text-blue-500" : "text-muted-foreground";
    return <span className={`font-mono font-medium ${color}`}>{v > 0 ? "+" : ""}{v.toFixed(2)}</span>;
  };

  return (
    <div className="space-y-4">
      {/* ===== 비교 대상 카드 헤더 ===== */}
      <Card>
        <CardContent className="pt-4 pb-3">
          {/* 탭 */}
          <div className="flex gap-1 mb-4">
            {[
              { key: "performance" as const, label: "성과분석" },
              { key: "info" as const, label: "기본 정보(비용)" },
              { key: "holdings" as const, label: "구성 종목" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setCompareTab(tab.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  compareTab === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
            {etfs.length > 0 && (
              <span className="ml-auto text-xs text-muted-foreground self-center">
                {new Date().toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" })} 기준
              </span>
            )}
          </div>

          {/* ETF 선택 슬롯들 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mb-3">
            {compareCodes.map((code, idx) => {
              const etf = etfs.find(e => e.code === code);
              return (
                <div key={code} className="border rounded-lg p-3 relative bg-background">
                  <button
                    className="absolute top-1 right-1 p-0.5 rounded-full hover:bg-destructive/10"
                    onClick={() => removeCode(code)}
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <div className="text-[10px] text-muted-foreground font-mono">{code}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {etf?.stockType && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                        {etf.stockType}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm font-bold mt-1 leading-tight">{etf?.name || code}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <div
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: COMPARE_COLORS[idx] }}
                    />
                    <span className={`text-xs font-medium ${
                      (etf?.changeRate || 0) > 0 ? "text-red-500" : (etf?.changeRate || 0) < 0 ? "text-blue-500" : ""
                    }`}>
                      {etf ? `${Number(etf.nowVal).toLocaleString()}원` : ""}
                      {etf?.changeRate != null && (
                        <span className="ml-1">
                          {etf.changeRate > 0 ? "▲" : etf.changeRate < 0 ? "▼" : ""}
                          {Math.abs(etf.changeVal).toLocaleString()}({Math.abs(etf.changeRate).toFixed(2)}%)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
            {compareCodes.length < 5 && (
              <div
                className="border-2 border-dashed rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors min-h-[80px]"
                onClick={() => setShowSearch(true)}
              >
                <span className="text-lg text-muted-foreground">+</span>
                <span className="text-[10px] text-muted-foreground">상품 추가 ({compareCodes.length}/5)</span>
              </div>
            )}
          </div>

          {/* 검색 팝업 */}
          {showSearch && (
            <div className="space-y-2 bg-muted/30 rounded-lg p-3 border">
              <div className="flex items-center gap-2">
                <Input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                  placeholder="ETF 이름 또는 코드 검색..." className="h-8 text-sm flex-1" autoFocus />
                <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => { setShowSearch(false); setSearchInput(""); }}>닫기</Button>
              </div>
              {searchData?.results?.length > 0 && (
                <div className="max-h-48 overflow-y-auto border rounded-md bg-background">
                  {searchData.results.slice(0, 15).map((etf: EtfItem) => (
                    <div key={etf.code}
                      className={`flex items-center justify-between px-3 py-2 hover:bg-muted cursor-pointer text-xs border-b last:border-b-0 ${
                        compareCodes.includes(etf.code) ? "bg-primary/5 text-muted-foreground" : ""
                      }`}
                      onClick={() => !compareCodes.includes(etf.code) && addCode(etf.code, etf.name)}>
                      <div>
                        <span className="font-medium">{etf.name}</span>
                        <span className="text-muted-foreground ml-1.5">({etf.code})</span>
                      </div>
                      <span className={`font-mono ${etf.changeRate > 0 ? "text-red-500" : "text-blue-500"}`}>
                        {etf.changeRate > 0 ? "+" : ""}{etf.changeRate?.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 프리셋 비교 */}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs text-muted-foreground self-center">빠른 비교:</span>
            <Badge variant="outline" className="cursor-pointer text-xs hover:bg-primary/10"
              onClick={() => setCompareCodes(["069500", "379800"])}>
              KODEX 200 vs KODEX 미국S&P500
            </Badge>
            <Badge variant="outline" className="cursor-pointer text-xs hover:bg-primary/10"
              onClick={() => setCompareCodes(["305720", "381970", "395160"])}>
              KODEX 2차전지 vs TIGER 2차전지 vs TIGER 반도체
            </Badge>
            <Badge variant="outline" className="cursor-pointer text-xs hover:bg-primary/10"
              onClick={() => setCompareCodes(["329750", "379800", "329200"])}>
              배당 ETF 비교
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* ===== 성과분석 탭 ===== */}
      {compareTab === "performance" && etfs.length >= 2 && (
        <Card>
          <CardContent className="pt-4">
            {/* 수익률 추이 차트 */}
            {chartLines.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> 수익률 추이
                </h3>
                <div className="flex items-center gap-4 mb-2 flex-wrap">
                  {compareCodes.map((code, idx) => {
                    const etf = etfs.find(e => e.code === code);
                    return (
                      <label key={code} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COMPARE_COLORS[idx] }} />
                        {etf?.name || code}
                      </label>
                    );
                  })}
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartLines} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        const etf = etfs.find(e => e.code === name);
                        return [`${value.toFixed(2)}%`, etf?.name || name];
                      }}
                      contentStyle={{ fontSize: 11 }}
                    />
                    {compareCodes.map((code, idx) => (
                      <Line
                        key={code}
                        type="monotone"
                        dataKey={code}
                        stroke={COMPARE_COLORS[idx]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-muted-foreground mt-1">
                  · 수익률(NAV) 그래프는 분배금 재투자를 가정한 수정기준가로 제공합니다.
                </p>
              </div>
            )}

            {/* 수익률(%) 테이블 */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> 수익률(%)
              </h3>
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-semibold w-[80px] text-center"></TableHead>
                      {etfs.map((etf, idx) => (
                        <TableHead key={etf.code} className="text-center min-w-[120px]">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COMPARE_COLORS[idx] }} />
                            <span className="text-xs font-semibold truncate">{etf.name}</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { label: "1개월", key: "month1" },
                      { label: "3개월", key: "month3" },
                      { label: "6개월", key: "month6" },
                      { label: "1년", key: "year1" },
                      { label: "3년", key: "year3" },
                      { label: "5년", key: "year5" },
                    ].map(row => (
                      <TableRow key={row.key} className="hover:bg-muted/20">
                        <TableCell className="text-center text-xs font-semibold bg-muted/30">{row.label}</TableCell>
                        {etfs.map(etf => (
                          <TableCell key={etf.code} className="text-center text-sm">
                            {fmtRate(etf.performance?.[row.key as keyof typeof etf.performance] as number | null)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== 기본 정보(비용) 탭 ===== */}
      {compareTab === "info" && etfs.length >= 2 && (
        <Card>
          <CardContent className="pt-4">
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-semibold w-[120px] text-center"></TableHead>
                    {etfs.map((etf, idx) => (
                      <TableHead key={etf.code} className="text-center min-w-[140px]">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COMPARE_COLORS[idx] }} />
                          <span className="text-xs font-semibold">{etf.name}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">{etf.code}</div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* 기본 정보 */}
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="text-xs font-semibold text-center bg-muted/30">운용사</TableCell>
                    {etfs.map(e => <TableCell key={e.code} className="text-center text-xs">{e.managementCompany || "-"}</TableCell>)}
                  </TableRow>
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="text-xs font-semibold text-center bg-muted/30">상장일</TableCell>
                    {etfs.map(e => <TableCell key={e.code} className="text-center text-xs">{e.listingDate || "-"}</TableCell>)}
                  </TableRow>
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="text-xs font-semibold text-center bg-muted/30">순자산총액</TableCell>
                    {etfs.map(e => <TableCell key={e.code} className="text-center text-xs font-mono">
                      {e.totalAssets || (e.marketCap ? `${Math.round(e.marketCap).toLocaleString()}억` : "-")}
                    </TableCell>)}
                  </TableRow>
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="text-xs font-semibold text-center bg-muted/30">거래량(주)</TableCell>
                    {etfs.map(e => <TableCell key={e.code} className="text-center text-xs font-mono">{e.quant ? Number(e.quant).toLocaleString() : "-"}</TableCell>)}
                  </TableRow>
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="text-xs font-semibold text-center bg-muted/30">거래대금(백만)</TableCell>
                    {etfs.map(e => <TableCell key={e.code} className="text-center text-xs font-mono">{e.amount ? Number(e.amount).toLocaleString() : "-"}</TableCell>)}
                  </TableRow>
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="text-xs font-semibold text-center bg-muted/30">현재가(원)</TableCell>
                    {etfs.map(e => {
                      const cr = e.changeRate || 0;
                      return (
                        <TableCell key={e.code} className="text-center text-xs">
                          <span className="font-mono font-medium">{Number(e.nowVal).toLocaleString()}</span>
                          <span className={`ml-1 text-[10px] ${cr > 0 ? "text-red-500" : cr < 0 ? "text-blue-500" : ""}`}>
                            {cr > 0 ? "▲" : cr < 0 ? "▼" : ""}{Math.abs(e.changeVal).toLocaleString()}({Math.abs(cr).toFixed(2)}%)
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="text-xs font-semibold text-center bg-muted/30">투자위험</TableCell>
                    {etfs.map(e => <TableCell key={e.code} className="text-center text-xs">{e.riskGrade || "-"}</TableCell>)}
                  </TableRow>

                  {/* 비용 구조 */}
                  <TableRow className="bg-blue-50/50 dark:bg-blue-950/20">
                    <TableCell colSpan={etfs.length + 1} className="text-xs font-bold text-center py-1.5">
                      총보수 (연, %)
                    </TableCell>
                  </TableRow>
                  {[
                    { label: "운용보수(%)", key: "managementFee" },
                    { label: "판매보수(%)", key: "sellingFee" },
                    { label: "수탁보수(%)", key: "trustFee" },
                    { label: "사무보수(%)", key: "officeFee" },
                  ].map(row => (
                    <TableRow key={row.key} className="hover:bg-muted/20">
                      <TableCell className="text-xs text-center bg-muted/20 pl-6">{row.label}</TableCell>
                      {etfs.map(e => (
                        <TableCell key={e.code} className="text-center text-xs font-mono">
                          {(e.costDetail as any)?.[row.key] ?? "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  <TableRow className="hover:bg-muted/20 font-semibold">
                    <TableCell className="text-xs text-center bg-muted/30">총보수(%)</TableCell>
                    {etfs.map(e => {
                      const fee = e.totalExpenseRatio ?? e.costDetail?.totalFee;
                      return (
                        <TableCell key={e.code} className="text-center text-xs font-mono font-semibold text-primary">
                          {fee != null ? `${fee}%` : "-"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  {[
                    { label: "합성 총보수(%)", key: "syntheticTotalFee" },
                    { label: "실부담비율(%)", key: "realExpenseRatio" },
                  ].map(row => (
                    <TableRow key={row.key} className="hover:bg-muted/20">
                      <TableCell className="text-xs font-semibold text-center bg-muted/30">{row.label}</TableCell>
                      {etfs.map(e => (
                        <TableCell key={e.code} className="text-center text-xs font-mono">
                          {(e.costDetail as any)?.[row.key] ?? "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                  {/* 배당 */}
                  <TableRow className="bg-green-50/50 dark:bg-green-950/20">
                    <TableCell colSpan={etfs.length + 1} className="text-xs font-bold text-center py-1.5">
                      배당 정보
                    </TableCell>
                  </TableRow>
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="text-xs font-semibold text-center bg-muted/30">월배당 여부</TableCell>
                    {etfs.map(e => <TableCell key={e.code} className="text-center text-xs">{e.costDetail?.monthlyDividend || "-"}</TableCell>)}
                  </TableRow>
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="text-xs font-semibold text-center bg-muted/30">연분배율(%)</TableCell>
                    {etfs.map(e => <TableCell key={e.code} className="text-center text-xs font-mono">
                      {e.dividendYield || e.costDetail?.annualDividendRate || "-"}
                    </TableCell>)}
                  </TableRow>
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="text-xs font-semibold text-center bg-muted/30">연간배당이력(회)</TableCell>
                    {etfs.map(e => <TableCell key={e.code} className="text-center text-xs font-mono">{e.costDetail?.annualDividendCount ?? "-"}</TableCell>)}
                  </TableRow>

                  {/* 추적 정보 */}
                  <TableRow className="bg-orange-50/50 dark:bg-orange-950/20">
                    <TableCell colSpan={etfs.length + 1} className="text-xs font-bold text-center py-1.5">
                      추적 정보
                    </TableCell>
                  </TableRow>
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="text-xs font-semibold text-center bg-muted/30">추적지수</TableCell>
                    {etfs.map(e => <TableCell key={e.code} className="text-center text-xs">{e.indexName || "-"}</TableCell>)}
                  </TableRow>
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="text-xs font-semibold text-center bg-muted/30">추적오차</TableCell>
                    {etfs.map(e => <TableCell key={e.code} className="text-center text-xs font-mono">{e.trackingError || "-"}</TableCell>)}
                  </TableRow>
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="text-xs font-semibold text-center bg-muted/30">52주 최고</TableCell>
                    {etfs.map(e => <TableCell key={e.code} className="text-center text-xs font-mono text-red-500">{e.highPrice52w ? Number(e.highPrice52w).toLocaleString() : "-"}</TableCell>)}
                  </TableRow>
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="text-xs font-semibold text-center bg-muted/30">52주 최저</TableCell>
                    {etfs.map(e => <TableCell key={e.code} className="text-center text-xs font-mono text-blue-500">{e.lowPrice52w ? Number(e.lowPrice52w).toLocaleString() : "-"}</TableCell>)}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== 구성종목 탭 ===== */}
      {compareTab === "holdings" && etfs.length >= 2 && (
        <Card>
          <CardContent className="pt-4">
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-semibold w-[120px] text-center"></TableHead>
                    {etfs.map((etf, idx) => (
                      <TableHead key={etf.code} className="text-center min-w-[180px]" colSpan={1}>
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COMPARE_COLORS[idx] }} />
                          <span className="text-xs font-semibold">{etf.name}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">{etf.code}</div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* 추적지수 */}
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="text-xs font-semibold text-center bg-muted/30">추적지수</TableCell>
                    {etfs.map(e => <TableCell key={e.code} className="text-center text-xs">{e.indexName || "-"}</TableCell>)}
                  </TableRow>
                  {/* TOP10 종목 */}
                  {Array.from({ length: 10 }).map((_, rowIdx) => (
                    <TableRow key={rowIdx} className="hover:bg-muted/20">
                      <TableCell className="text-center bg-muted/20">
                        <span className="text-xs font-bold text-primary">{rowIdx + 1}</span>
                      </TableCell>
                      {etfs.map(etf => {
                        const h = etf.holdings?.[rowIdx];
                        const chg = h?.changePercent ? parseFloat(h.changePercent) : null;
                        return (
                          <TableCell key={etf.code} className="text-xs">
                            {h ? (
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium leading-tight truncate">{h.name}</div>
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                                    <span>{h.code}</span>
                                    {h.price && <span className="text-foreground">{Number(h.price).toLocaleString()}</span>}
                                    {chg != null && !isNaN(chg) && chg !== 0 && (
                                      <span className={chg > 0 ? "text-red-500" : "text-blue-500"}>
                                        {chg > 0 ? "+" : ""}{chg}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-mono font-semibold text-primary">{h.weight.toFixed(1)}%</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              · 종목비중 TOP10 (종목 / 비중(%))
            </p>
          </CardContent>
        </Card>
      )}

      {/* ===== 하단 요약 ===== */}
      {etfs.length >= 2 && summary.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          {summary.map((line, idx) => (
            <p key={idx} className="text-xs leading-relaxed">
              <span className="font-semibold text-primary">{line.replace(/(.*?)은\s|이며|입니다\./g, (match) => match)}</span>
              {idx < summary.length - 1 && <br />}
            </p>
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {compareCodes.length < 2 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <Scale className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">2개 이상의 ETF를 추가하여 비교를 시작하세요</p>
          <p className="text-xs mt-1">최대 5개까지 비교 가능합니다</p>
        </div>
      )}
    </div>
  );
}

// =============================================
// D. 테마맵
// =============================================
function ThemeMapSection({ onNavigate }: { onNavigate?: (tab: string) => void } = {}) {
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);

  const { data: themeData, isLoading, refetch } = useQuery({
    queryKey: ["/api/etf/themes"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/etf/themes");
      return res.json();
    },
  });

  const themes: ThemeStat[] = themeData?.themes || [];

  // 테마 등락률에 따른 색상
  const getHeatColor = (rate: number) => {
    if (rate >= 2) return "bg-red-500 text-white";
    if (rate >= 1) return "bg-red-400 text-white";
    if (rate >= 0.3) return "bg-red-200 text-red-900";
    if (rate >= 0) return "bg-gray-100 text-gray-700";
    if (rate >= -0.3) return "bg-blue-100 text-blue-900";
    if (rate >= -1) return "bg-blue-300 text-white";
    return "bg-blue-500 text-white";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          전체 {themeData?.totalEtfs || 0}개 ETF를 테마별로 분류하여 시장 동향을 한눈에 파악합니다.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1">
          <RefreshCw className="h-3.5 w-3.5" /> 새로고침
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* 히트맵 그리드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {themes.map(theme => (
              <div key={theme.name}
                className={`rounded-lg p-3 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${getHeatColor(theme.avgChangeRate)}
                  ${expandedTheme === theme.name ? "ring-2 ring-primary" : ""}`}
                onClick={() => setExpandedTheme(expandedTheme === theme.name ? null : theme.name)}>
                <div className="text-lg mb-1">{theme.icon}</div>
                <div className="font-bold text-xs">{theme.name}</div>
                <div className="text-lg font-bold font-mono">
                  {theme.avgChangeRate > 0 ? "+" : ""}{theme.avgChangeRate.toFixed(2)}%
                </div>
                <div className="text-xs opacity-80 mt-1">
                  {theme.count}개 · 3M {theme.avg3mReturn > 0 ? "+" : ""}{theme.avg3mReturn.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>

          {/* 선택된 테마 상세 */}
          {expandedTheme && (() => {
            const theme = themes.find(t => t.name === expandedTheme);
            if (!theme) return null;
            return (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span>{theme.icon}</span>
                    {theme.name} 테마 - TOP 5
                    <Badge variant="secondary" className="ml-auto">{theme.count}개 ETF</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-3 py-2 font-medium">종목명</th>
                          <th className="text-right px-3 py-2 font-medium">현재가</th>
                          <th className="text-right px-3 py-2 font-medium">등락률</th>
                          <th className="text-right px-3 py-2 font-medium">3개월수익률</th>
                          <th className="text-right px-3 py-2 font-medium hidden md:table-cell">시가총액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {theme.topEtfs.map((etf: any, i: number) => (
                          <tr key={etf.code} className="border-b hover:bg-muted/30 cursor-pointer"
                            onClick={() => openEtfStockDetail(etf.code, etf.name)}>
                            <td className="px-3 py-2">
                              <span className="font-medium">{i + 1}. {etf.name}</span>
                              <span className="text-xs text-muted-foreground ml-1">({etf.code})</span>
                            </td>
                            <td className="text-right px-3 py-2 font-mono">{etf.nowVal?.toLocaleString()}</td>
                            <td className={`text-right px-3 py-2 font-mono font-semibold ${etf.changeRate > 0 ? "text-red-500" : etf.changeRate < 0 ? "text-blue-500" : ""}`}>
                              {etf.changeRate > 0 ? "+" : ""}{etf.changeRate?.toFixed(2)}%
                            </td>
                            <td className={`text-right px-3 py-2 font-mono ${etf.threeMonthEarnRate > 0 ? "text-red-500" : etf.threeMonthEarnRate < 0 ? "text-blue-500" : ""}`}>
                              {etf.threeMonthEarnRate > 0 ? "+" : ""}{etf.threeMonthEarnRate?.toFixed(2)}%
                            </td>
                            <td className="text-right px-3 py-2 hidden md:table-cell">
                              {etf.marketCap ? `${Math.round(etf.marketCap / 100000000).toLocaleString()}억` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* 범례 */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">범례:</span>
            <span className="px-2 py-1 rounded bg-red-500 text-white">+2%↑</span>
            <span className="px-2 py-1 rounded bg-red-400 text-white">+1~2%</span>
            <span className="px-2 py-1 rounded bg-red-200 text-red-900">+0.3~1%</span>
            <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">±0.3%</span>
            <span className="px-2 py-1 rounded bg-blue-100 text-blue-900">-0.3~-1%</span>
            <span className="px-2 py-1 rounded bg-blue-300 text-white">-1~-2%</span>
            <span className="px-2 py-1 rounded bg-blue-500 text-white">-2%↓</span>
          </div>
        </>
      )}

    </div>
  );
}

// =============================================
// E. AI 추천
// =============================================
function AiRecommendSection() {
  const { toast } = useToast();
  const [purpose, setPurpose] = useState("");
  const [riskLevel, setRiskLevel] = useState("중간");
  const [keywords, setKeywords] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [fontSize, setFontSize] = useState(14);

  // AI API 키 관련 상태
  const [showAiKeyDialog, setShowAiKeyDialog] = useState(false);
  const [aiKeyProvider, setAiKeyProvider] = useState<"gemini" | "openai">("gemini");
  const [aiKeyGemini, setAiKeyGemini] = useState("");
  const [aiKeyOpenai, setAiKeyOpenai] = useState("");
  const [aiKeySaving, setAiKeySaving] = useState(false);
  const [pendingRecommend, setPendingRecommend] = useState(false);

  // 사용자 AI 키 설정 조회
  const { data: aiConfigData, refetch: refetchAiConfig } = useQuery({
    queryKey: ["/api/user/ai-config"],
    queryFn: async () => {
      const res = await fetch("/api/user/ai-config", { credentials: "include" });
      if (!res.ok) return { config: null };
      return res.json();
    },
    staleTime: 60000,
  });

  const hasAiKey = aiConfigData?.config?.hasGeminiKey || aiConfigData?.config?.hasOpenaiKey;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/etf/ai-recommend", {
        purpose, riskLevel, keywords,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setRecommendation(data.recommendation || "추천 결과를 가져올 수 없습니다.");
    },
    onError: (error: any) => {
      toast({ title: "AI 추천 실패", description: error.message, variant: "destructive" });
    },
  });

  // AI 추천 버튼 클릭 핸들러 (API 키 확인)
  const handleRecommendClick = () => {
    if (hasAiKey) {
      mutation.mutate();
    } else {
      setPendingRecommend(true);
      setShowAiKeyDialog(true);
    }
  };

  // AI API 키 저장
  const saveAiKey = async () => {
    setAiKeySaving(true);
    try {
      const res = await fetch("/api/user/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          aiProvider: aiKeyProvider,
          geminiApiKey: aiKeyProvider === "gemini" ? aiKeyGemini : null,
          openaiApiKey: aiKeyProvider === "openai" ? aiKeyOpenai : null,
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      await refetchAiConfig();
      toast({ title: "AI API 키가 저장되었습니다" });
      setShowAiKeyDialog(false);
      setAiKeyGemini("");
      setAiKeyOpenai("");
      if (pendingRecommend) {
        setPendingRecommend(false);
        setTimeout(() => mutation.mutate(), 500);
      }
    } catch (err: any) {
      toast({ title: "API 키 저장 실패: " + (err.message || ""), variant: "destructive" });
    } finally {
      setAiKeySaving(false);
    }
  };

  const purposePresets = [
    "수익률 극대화", "안정적 배당 수익", "장기 성장 투자",
    "단기 트레이딩", "포트폴리오 분산", "은퇴 자금 운용",
  ];

  const keywordPresets = [
    "반도체,AI", "2차전지,전기차", "배당,고배당", "미국,S&P500",
    "채권,국채", "금,원자재", "바이오,헬스케어", "코스피200",
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-500" />
            AI ETF 추천 - 나에게 맞는 ETF 찾기
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 투자 목적 */}
          <div>
            <Label className="text-sm font-medium mb-2 block">투자 목적</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {purposePresets.map(p => (
                <Badge key={p} variant={purpose === p ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/10"
                  onClick={() => setPurpose(p)}>
                  {p}
                </Badge>
              ))}
            </div>
            <Input value={purpose} onChange={e => setPurpose(e.target.value)}
              placeholder="투자 목적을 직접 입력하세요 (예: 월 50만원 적립식 투자)" className="text-sm" />
          </div>

          {/* 위험 성향 */}
          <div>
            <Label className="text-sm font-medium mb-2 block">위험 성향</Label>
            <div className="flex gap-2">
              {["안정형", "안정추구형", "중간", "적극투자형", "공격형"].map(level => (
                <Badge key={level} variant={riskLevel === level ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/10"
                  onClick={() => setRiskLevel(level)}>
                  {level}
                </Badge>
              ))}
            </div>
          </div>

          {/* 관심 키워드 */}
          <div>
            <Label className="text-sm font-medium mb-2 block">관심 키워드 (쉼표로 구분)</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {keywordPresets.map(kw => (
                <Badge key={kw} variant={keywords === kw ? "default" : "outline"}
                  className="cursor-pointer text-xs hover:bg-primary/10"
                  onClick={() => setKeywords(kw)}>
                  {kw}
                </Badge>
              ))}
            </div>
            <Input value={keywords} onChange={e => setKeywords(e.target.value)}
              placeholder="관심 키워드 입력 (예: 반도체,AI,미국)" className="text-sm" />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleRecommendClick} disabled={mutation.isPending} className="flex-1 gap-2">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {mutation.isPending ? "AI가 분석 중..." : "AI ETF 추천 받기"}
            </Button>
            {hasAiKey ? (
              <Badge variant="outline" className="text-xs text-green-600 border-green-300 gap-1 h-9 px-3">
                <CheckCircle className="h-3 w-3" /> API 등록됨
              </Badge>
            ) : (
              <Button variant="outline" size="sm" className="h-9 gap-1 text-xs"
                onClick={() => setShowAiKeyDialog(true)}>
                <Key className="h-3 w-3" /> API 키 등록
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 추천 결과 */}
      {recommendation && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" /> AI 추천 결과
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setFontSize(f => Math.max(10, f - 1))}>A-</Button>
                <span className="text-xs text-muted-foreground">{fontSize}</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setFontSize(f => Math.min(22, f + 1))}>A+</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(recommendation);
                    toast({ title: "복사 완료" });
                  }}>
                  <Copy className="h-3 w-3" /> 복사
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap leading-relaxed" style={{ fontSize }}>
              {recommendation}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI API 키 등록 다이얼로그 */}
      <Dialog open={showAiKeyDialog} onOpenChange={(open) => {
        setShowAiKeyDialog(open);
        if (!open) setPendingRecommend(false);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-purple-500" />
              AI API 키 설정
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 안내문 */}
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-sm space-y-2">
              <p className="font-medium text-blue-700 dark:text-blue-300">🔑 AI 추천을 위해 API 키가 필요합니다</p>
              <p className="text-blue-600/80 dark:text-blue-400/80 text-xs leading-relaxed">
                AI ETF 추천 기능은 Google Gemini 또는 OpenAI의 API를 사용합니다.
                아래 링크에서 무료 API 키를 발급받아 등록해주세요.
                등록된 키는 본인의 계정에서만 사용됩니다.
              </p>
              <div className="flex flex-col gap-1 text-xs">
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Google Gemini API 키 발급 (무료)
                </a>
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> OpenAI API 키 발급 (유료)
                </a>
              </div>
            </div>

            {/* 현재 등록 상태 */}
            {hasAiKey && (
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2.5 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-xs text-green-700 dark:text-green-300">
                  현재 등록된 키: {aiConfigData?.config?.aiProvider === "openai" ? "OpenAI" : "Gemini"}
                </span>
              </div>
            )}

            {/* AI 제공자 선택 */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">AI 제공자</label>
              <div className="flex gap-2">
                <Button variant={aiKeyProvider === "gemini" ? "default" : "outline"} size="sm" className="flex-1 text-xs"
                  onClick={() => setAiKeyProvider("gemini")}>
                  Google Gemini (추천)
                </Button>
                <Button variant={aiKeyProvider === "openai" ? "default" : "outline"} size="sm" className="flex-1 text-xs"
                  onClick={() => setAiKeyProvider("openai")}>
                  OpenAI
                </Button>
              </div>
            </div>

            {/* API 키 입력 */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {aiKeyProvider === "gemini" ? "Gemini API Key" : "OpenAI API Key"}
              </label>
              {aiKeyProvider === "gemini" ? (
                <Input type="password" placeholder="Gemini API 키를 입력하세요"
                  value={aiKeyGemini} onChange={e => setAiKeyGemini(e.target.value)} className="text-sm" />
              ) : (
                <Input type="password" placeholder="OpenAI API 키를 입력하세요 (sk-...)"
                  value={aiKeyOpenai} onChange={e => setAiKeyOpenai(e.target.value)} className="text-sm" />
              )}
            </div>

            {/* 저장 버튼 */}
            <Button onClick={saveAiKey} disabled={aiKeySaving || (aiKeyProvider === "gemini" ? !aiKeyGemini : !aiKeyOpenai)}
              className="w-full gap-2">
              {aiKeySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              {pendingRecommend ? "저장 후 AI 추천 시작" : "저장"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
