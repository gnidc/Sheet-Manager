import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useEtfs, useUpdateEtf } from "@/hooks/use-etfs";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EtfForm } from "@/components/EtfForm";
import { useCreateEtf } from "@/hooks/use-etfs";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Plus, ExternalLink, SlidersHorizontal, ArrowRight, TrendingUp, Wallet, Globe, Loader2, Star, Lightbulb, Newspaper, Youtube, FileText, Link as LinkIcon, Trash2, Pencil, Scale, X, BarChart3 } from "lucide-react";
import { type InsertEtf, type HistoryPeriod } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { LoginDialog } from "@/components/LoginDialog";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useQuery, useMutation, useQueries } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

export default function Home() {
  const [search, setSearch] = useState("");
  const [mainCategoryFilter, setMainCategoryFilter] = useState("ALL");
  const [subCategoryFilter, setSubCategoryFilter] = useState("ALL");
  const [countryFilter, setCountryFilter] = useState("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const { data: etfs, isLoading, error } = useEtfs({ 
    search, 
    mainCategory: mainCategoryFilter,
    subCategory: subCategoryFilter,
    country: countryFilter
  });
  
  const createEtf = useCreateEtf();
  const updateEtf = useUpdateEtf();
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const handleCreate = async (data: InsertEtf) => {
    try {
      await createEtf.mutateAsync(data);
      setIsCreateOpen(false);
      toast({ title: "Success", description: "ETF added successfully" });
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err instanceof Error ? err.message : "Failed to create", 
        variant: "destructive" 
      });
    }
  };

  const handleToggleFavorite = async (etf: any) => {
    try {
      await updateEtf.mutateAsync({
        id: etf.id,
        data: { isFavorite: !etf.isFavorite }
      });
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Failed to update favorite", 
        variant: "destructive" 
      });
    }
  };

  const getSubCategories = () => {
    if (!etfs) return [];
    const cats = new Set(etfs.map(e => e.subCategory).filter(Boolean));
    return Array.from(cats) as string[];
  };

  const filteredEtfs = useMemo(() => {
    if (!etfs) return [];
    return etfs;
  }, [etfs]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header / Hero */}
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">Life Fitness ETF (투자와 함께 하는 삶)</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Advanced ETF Analytics Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <LoginDialog />
              {isAdmin && (
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                      <Plus className="w-4 h-4 mr-2" />
                      Add New ETF
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Covered Call ETF</DialogTitle>
                  <DialogDescription>
                    Enter the details for a new ETF product to track in the dashboard.
                  </DialogDescription>
                </DialogHeader>
                <EtfForm 
                  onSubmit={handleCreate} 
                  isPending={createEtf.isPending} 
                  submitLabel="Create ETF"
                />
              </DialogContent>
              </Dialog>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="all" className="space-y-8">
          <TabsList className="grid w-full grid-cols-6 max-w-3xl mx-auto">
            <TabsTrigger value="all">Tracked ETFs</TabsTrigger>
            <TabsTrigger value="compare" className="gap-2">
              <Scale className="h-4 w-4" />
              Compare
            </TabsTrigger>
            <TabsTrigger value="trends">Markets</TabsTrigger>
            <TabsTrigger value="strategies">Strategies</TabsTrigger>
            <TabsTrigger value="favorites" className="gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              추천ETF
            </TabsTrigger>
            <TabsTrigger value="etf-trends" className="gap-2">
              <Newspaper className="h-4 w-4" />
              ETF 동향
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-8">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-6 border border-primary/10 shadow-sm">
                <div className="flex items-center gap-4 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-foreground">Tracked ETFs</h3>
                </div>
                <div className="text-3xl font-bold text-primary font-display">
                  {etfs?.length || 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Total listings in database</p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border shadow-sm">
                <div className="flex items-center gap-4 mb-2">
                  <div className="p-2 bg-accent/10 rounded-lg text-accent-foreground dark:text-accent">
                    <Globe className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-foreground">Markets</h3>
                </div>
                <div className="text-3xl font-bold font-display">
                  {etfs ? new Set(etfs.map(e => e.country)).size : 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Countries represented</p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border shadow-sm">
                <div className="flex items-center gap-4 mb-2">
                  <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600 dark:text-purple-400">
                    <SlidersHorizontal className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-foreground">Strategies</h3>
                </div>
                <div className="text-3xl font-bold font-display">
                  {etfs ? new Set(etfs.map(e => e.subCategory)).size : 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Unique asset classes</p>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-card rounded-xl p-4 border shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between sticky top-[73px] z-20">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input 
                  placeholder="Search by name or code..." 
                  className="pl-9 bg-muted/30 border-muted-foreground/20 focus:bg-background transition-colors"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Select value={mainCategoryFilter} onValueChange={setMainCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="M.Cat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 M.Cat</SelectItem>
                    <SelectItem value="해외.커버드콜">해외.커버드콜</SelectItem>
                    <SelectItem value="해외.액티브">해외.액티브</SelectItem>
                    <SelectItem value="해외패시브&기타">해외패시브&기타</SelectItem>
                    <SelectItem value="국내자산">국내자산</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={subCategoryFilter} onValueChange={setSubCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="S.Cat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 S.Cat</SelectItem>
                    {getSubCategories().map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Countries</SelectItem>
                    <SelectItem value="미국">미국 (USA)</SelectItem>
                    <SelectItem value="한국">한국 (Korea)</SelectItem>
                    <SelectItem value="CN">중국 (China)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white dark:bg-card rounded-xl border shadow-sm overflow-hidden min-h-[500px] flex flex-col">
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <span className="sr-only">Loading...</span>
                </div>
              ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center text-destructive p-8 text-center">
                  <p className="font-medium mb-2">Error loading data</p>
                  <p className="text-sm opacity-80">{error.message}</p>
                  <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
                </div>
              ) : etfs?.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 opacity-50" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">No ETFs Found</h3>
                  <p className="max-w-xs mx-auto">Try adjusting your filters or search query, or add a new ETF.</p>
                  <Button className="mt-6" onClick={() => setIsCreateOpen(true)}>Add First ETF</Button>
                </div>
              ) : (
                <div className="overflow-x-auto scrollbar-thin">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        {isAdmin && <TableHead className="w-[50px] text-center">Fav.</TableHead>}
                        <TableHead className="w-[80px]">Code</TableHead>
                        <TableHead>M.Cat</TableHead>
                        <TableHead>S.Cat</TableHead>
                        <TableHead className="min-w-[200px]">Name</TableHead>
                        <TableHead>Yield</TableHead>
                        <TableHead>Fee</TableHead>
                        <TableHead>Cycle</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {etfs?.map((etf) => (
                        <TableRow key={etf.id} className="group hover:bg-muted/20 transition-colors">
                          {isAdmin && (
                            <TableCell className="text-center">
                              <Checkbox 
                                checked={etf.isFavorite || false} 
                                onCheckedChange={() => handleToggleFavorite(etf)}
                                data-testid={`checkbox-fav-${etf.id}`}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-mono text-sm font-medium text-muted-foreground">
                            {etf.code}
                          </TableCell>
                          <TableCell className="text-xs font-medium">{etf.mainCategory}</TableCell>
                          <TableCell className="text-xs">{etf.subCategory}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <Link href={`/etf/${etf.id}`}>
                                <span className="font-semibold text-foreground hover:text-primary hover:underline transition-colors cursor-pointer" data-testid={`link-etf-name-${etf.id}`}>
                                  {etf.name}
                                </span>
                              </Link>
                              <span className="text-[10px] text-muted-foreground">{etf.country} | {etf.generation}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                                {etf.yield}
                              </span>
                              {etf.currentPrice && (
                                <span className="text-[10px] text-muted-foreground">
                                  {parseFloat(etf.currentPrice).toLocaleString()}원
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{etf.fee}</TableCell>
                          <TableCell>
                             <StatusBadge variant={
                              etf.dividendCycle?.includes('월') ? 'success' : 'outline'
                            }>
                              {etf.dividendCycle}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/etf/${etf.id}`}>
                              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                Details <ArrowRight className="ml-1 w-3 h-3" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="compare">
            <CompareSection etfs={etfs || []} />
          </TabsContent>

          <TabsContent value="trends">
            <div className="p-8 text-center text-muted-foreground">Markets section</div>
          </TabsContent>

          <TabsContent value="strategies">
            <div className="p-8 text-center text-muted-foreground">Strategies section content goes here</div>
          </TabsContent>

          <TabsContent value="favorites">
             <FavoriteSection etfs={etfs || []} onToggleFavorite={handleToggleFavorite} isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="etf-trends">
            <EtfTrendsSection isAdmin={isAdmin} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

const CHART_COLORS = ["#2563eb", "#dc2626", "#16a34a"];
const PERIODS: { value: HistoryPeriod; label: string }[] = [
  { value: "1M", label: "1개월" },
  { value: "3M", label: "3개월" },
  { value: "6M", label: "6개월" },
  { value: "1Y", label: "1년" },
];

function CompareSection({ etfs }: { etfs: any[] }) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<HistoryPeriod>("3M");

  // Maintain order matching selectedIds for correct chart data alignment
  const selectedEtfs = selectedIds.map(id => etfs.find(e => e.id === id)).filter(Boolean);
  const filteredEtfs = etfs.filter(e => 
    !selectedIds.includes(e.id) && 
    ((e.name?.toLowerCase() ?? "").includes(searchTerm.toLowerCase()) || 
     (e.code?.toLowerCase() ?? "").includes(searchTerm.toLowerCase()))
  );

  // Fetch price history for selected ETFs (for chart)
  const historyQueries = useQueries({
    queries: selectedIds.map(id => ({
      queryKey: ["/api/etfs", id, "history", selectedPeriod],
      queryFn: async () => {
        const res = await fetch(`/api/etfs/${id}/history?period=${selectedPeriod}`);
        if (!res.ok) throw new Error("Failed to fetch history");
        return res.json();
      },
      enabled: selectedIds.length >= 2,
    })),
  });

  // Fetch all periods data for performance metrics table
  const allPeriodsQueries = useQueries({
    queries: selectedIds.flatMap(id => 
      PERIODS.map(period => ({
        queryKey: ["/api/etfs", id, "history", period.value, "metrics"],
        queryFn: async () => {
          const res = await fetch(`/api/etfs/${id}/history?period=${period.value}`);
          if (!res.ok) throw new Error("Failed to fetch history");
          const data = await res.json();
          return { etfId: id, period: period.value, data };
        },
        enabled: selectedIds.length >= 2,
      }))
    ),
  });

  const isLoadingHistory = historyQueries.some(q => q.isLoading);
  const hasHistoryData = historyQueries.every(q => q.data && q.data.length > 0);
  const isLoadingMetrics = allPeriodsQueries.some(q => q.isLoading);

  // Calculate performance metrics for each ETF
  const performanceMetrics = useMemo(() => {
    if (isLoadingMetrics || selectedIds.length < 2) return [];

    const calculateMetrics = (history: any[]) => {
      if (!history || history.length < 2) return null;
      
      const prices = history.map(h => parseFloat(h.closePrice));
      const firstPrice = prices[0];
      const lastPrice = prices[prices.length - 1];
      
      // Return calculation
      const returnPct = ((lastPrice - firstPrice) / firstPrice) * 100;
      
      // Daily returns for Sharpe and MDD
      const dailyReturns: number[] = [];
      for (let i = 1; i < prices.length; i++) {
        dailyReturns.push((prices[i] - prices[i-1]) / prices[i-1]);
      }
      
      // Sharpe Ratio (annualized, assuming 252 trading days)
      const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
      const stdDev = Math.sqrt(dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length);
      const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
      
      // MDD (Maximum Drawdown)
      let peak = prices[0];
      let maxDrawdown = 0;
      for (const price of prices) {
        if (price > peak) peak = price;
        const drawdown = (peak - price) / peak;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }
      
      return {
        return: returnPct,
        sharpe: sharpeRatio,
        mdd: maxDrawdown * 100,
      };
    };

    return selectedIds.map(etfId => {
      const etf = etfs.find(e => e.id === etfId);
      const metrics: Record<string, any> = { etfId, name: etf?.name || `ETF ${etfId}` };
      
      PERIODS.forEach(period => {
        const query = allPeriodsQueries.find(q => 
          q.data?.etfId === etfId && q.data?.period === period.value
        );
        if (query?.data?.data) {
          const result = calculateMetrics(query.data.data);
          metrics[period.value] = result;
        }
      });
      
      return metrics;
    });
  }, [allPeriodsQueries, selectedIds, etfs, isLoadingMetrics]);

  // Prepare chart data by merging history from all selected ETFs
  const chartData = useMemo(() => {
    if (!hasHistoryData || selectedIds.length < 2) return [];
    
    const allDates = new Map<string, any>();
    
    historyQueries.forEach((query, idx) => {
      const etf = selectedEtfs[idx];
      const history = query.data || [];
      const firstPrice = history[0]?.closePrice ? parseFloat(history[0].closePrice) : 1;
      
      history.forEach((point: any) => {
        const dateKey = format(new Date(point.date), "MM/dd");
        const normalizedValue = ((parseFloat(point.closePrice) / firstPrice) - 1) * 100;
        
        if (!allDates.has(dateKey)) {
          allDates.set(dateKey, { date: dateKey });
        }
        // Keep as number for Recharts
        allDates.get(dateKey)[etf?.name || `ETF ${idx + 1}`] = Math.round(normalizedValue * 100) / 100;
      });
    });
    
    return Array.from(allDates.values());
  }, [historyQueries, selectedEtfs, hasHistoryData, selectedIds.length]);

  const handleSelect = (id: number) => {
    if (selectedIds.length < 3) {
      setSelectedIds([...selectedIds, id]);
      setSearchTerm("");
    }
  };

  const handleRemove = (id: number) => {
    setSelectedIds(selectedIds.filter(i => i !== id));
  };

  const handleReset = () => {
    setSelectedIds([]);
    setSearchTerm("");
  };

  const compareRows = [
    { label: "종목코드", key: "code" },
    { label: "M.Category", key: "mainCategory" },
    { label: "S.Category", key: "subCategory" },
    { label: "수익률 (Yield)", key: "yield", highlight: true },
    { label: "수수료 (Fee)", key: "fee" },
    { label: "배당주기", key: "dividendCycle" },
    { label: "시가총액", key: "marketCap" },
    { label: "현재가", key: "currentPrice", format: (v: string) => v ? `${parseFloat(v).toLocaleString()}원` : "-" },
    { label: "국가", key: "country" },
    { label: "세대", key: "generation" },
    { label: "기초자산", key: "underlyingAsset" },
    { label: "운용사", key: "issuer" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            ETF 비교 (최대 3개)
          </h3>
          
          {/* Selected ETFs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedEtfs.map(etf => (
              <StatusBadge 
                key={etf.id} 
                variant="secondary" 
                className="gap-2 py-2 px-3"
              >
                <span className="font-medium">{etf.name}</span>
                <span className="text-muted-foreground text-xs">({etf.code})</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-4 w-4 ml-1"
                  onClick={() => handleRemove(etf.id)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </StatusBadge>
            ))}
            {selectedIds.length === 0 && (
              <span className="text-muted-foreground text-sm">ETF를 선택해주세요</span>
            )}
          </div>

          {/* Search & Select */}
          {selectedIds.length < 3 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="ETF 이름 또는 코드로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-compare-search"
              />
              {searchTerm && filteredEtfs.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredEtfs.slice(0, 10).map(etf => (
                    <div
                      key={etf.id}
                      className="p-3 hover:bg-muted cursor-pointer flex justify-between items-center"
                      onClick={() => handleSelect(etf.id)}
                      data-testid={`option-compare-${etf.id}`}
                    >
                      <div>
                        <div className="font-medium">{etf.name}</div>
                        <div className="text-xs text-muted-foreground">{etf.code} | {etf.mainCategory}</div>
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reset Button */}
          {selectedIds.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReset} 
              className="mt-4"
              data-testid="button-reset-compare"
            >
              초기화
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Comparison Table */}
      {selectedEtfs.length >= 2 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4">비교 결과</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px] bg-muted/30">항목</TableHead>
                    {selectedEtfs.map(etf => (
                      <TableHead key={etf.id} className="min-w-[200px] text-center">
                        <Link href={`/etf/${etf.id}`}>
                          <span className="font-bold text-primary hover:underline cursor-pointer">
                            {etf.name}
                          </span>
                        </Link>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compareRows.map(row => (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium bg-muted/20">{row.label}</TableCell>
                      {selectedEtfs.map(etf => {
                        const value = etf[row.key];
                        const displayValue = row.format ? row.format(value) : (value || "-");
                        return (
                          <TableCell 
                            key={etf.id} 
                            className={`text-center ${row.highlight ? 'font-bold text-emerald-600 dark:text-emerald-400 text-lg' : ''}`}
                          >
                            {displayValue}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Chart */}
      {selectedEtfs.length >= 2 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                기간별 성과 비교
              </h3>
              <div className="flex gap-2">
                {PERIODS.map(period => (
                  <Button
                    key={period.value}
                    variant={selectedPeriod === period.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPeriod(period.value)}
                    data-testid={`button-period-${period.value}`}
                  >
                    {period.label}
                  </Button>
                ))}
              </div>
            </div>
            
            {isLoadingHistory ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">데이터 로딩 중...</span>
              </div>
            ) : chartData.length > 0 ? (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      tickFormatter={(value) => `${value}%`}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: any) => [`${parseFloat(value).toFixed(2)}%`, '']}
                    />
                    <Legend />
                    {selectedEtfs.map((etf, idx) => (
                      <Line
                        key={etf.id}
                        type="monotone"
                        dataKey={etf.name}
                        stroke={CHART_COLORS[idx]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                차트 데이터를 불러올 수 없습니다.
              </div>
            )}
            
            <p className="text-xs text-muted-foreground mt-4 text-center">
              * 성과는 기간 시작일 대비 가격 변화율(%)로 표시됩니다. 시뮬레이션 데이터일 수 있습니다.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics Table */}
      {selectedEtfs.length >= 2 && performanceMetrics.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              기간별 성과 지표
            </h3>
            
            {isLoadingMetrics ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">성과 지표 계산 중...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px] bg-muted/30">ETF</TableHead>
                      <TableHead className="text-center bg-muted/30">지표</TableHead>
                      {PERIODS.map(period => (
                        <TableHead key={period.value} className="text-center min-w-[100px]">
                          {period.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceMetrics.map((etfMetrics, etfIdx) => (
                      <>
                        {/* Return row */}
                        <TableRow key={`${etfMetrics.etfId}-return`}>
                          <TableCell 
                            rowSpan={3} 
                            className="font-bold align-middle bg-muted/10"
                            style={{ borderRight: '1px solid hsl(var(--border))' }}
                          >
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: CHART_COLORS[etfIdx] }}
                              />
                              <span className="text-sm">{etfMetrics.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-center bg-muted/5">수익률</TableCell>
                          {PERIODS.map(period => {
                            const metrics = etfMetrics[period.value];
                            const value = metrics?.return;
                            return (
                              <TableCell 
                                key={period.value} 
                                className={`text-center font-mono font-bold ${
                                  value > 0 ? 'text-red-500' : value < 0 ? 'text-blue-500' : ''
                                }`}
                              >
                                {value !== undefined ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : '-'}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        {/* Sharpe Ratio row */}
                        <TableRow key={`${etfMetrics.etfId}-sharpe`}>
                          <TableCell className="font-medium text-center bg-muted/5">Sharpe</TableCell>
                          {PERIODS.map(period => {
                            const metrics = etfMetrics[period.value];
                            const value = metrics?.sharpe;
                            return (
                              <TableCell key={period.value} className="text-center font-mono">
                                {value !== undefined ? value.toFixed(2) : '-'}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        {/* MDD row */}
                        <TableRow key={`${etfMetrics.etfId}-mdd`} className="border-b-2">
                          <TableCell className="font-medium text-center bg-muted/5">MDD</TableCell>
                          {PERIODS.map(period => {
                            const metrics = etfMetrics[period.value];
                            const value = metrics?.mdd;
                            return (
                              <TableCell key={period.value} className="text-center font-mono text-blue-500">
                                {value !== undefined ? `-${value.toFixed(2)}%` : '-'}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            <div className="mt-4 text-xs text-muted-foreground space-y-1">
              <p>* <strong>수익률</strong>: 기간 시작일 대비 종료일 가격 변화율</p>
              <p>* <strong>Sharpe Ratio</strong>: 위험 대비 수익률 (높을수록 좋음, 일반적으로 1 이상이면 양호)</p>
              <p>* <strong>MDD</strong>: 최대낙폭 (Maximum Drawdown), 기간 중 고점 대비 최대 하락률</p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedEtfs.length === 1 && (
        <div className="p-8 text-center border-2 border-dashed rounded-xl">
          <Scale className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">1개 더 선택해주세요</h3>
          <p className="text-muted-foreground">비교하려면 최소 2개 ETF를 선택해야 합니다.</p>
        </div>
      )}

      {selectedEtfs.length === 0 && (
        <div className="p-12 text-center border-2 border-dashed rounded-xl">
          <Scale className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">ETF를 선택하여 비교해보세요</h3>
          <p className="text-muted-foreground">최대 3개 ETF를 선택하여 수익률, 수수료, 배당주기 등을 나란히 비교할 수 있습니다.</p>
        </div>
      )}
    </div>
  );
}


const MCAT_ORDER = ["해외.커버드콜", "해외.액티브", "해외패시브&기타", "국내자산"];

function FavoriteSection({ etfs, onToggleFavorite, isAdmin }: { etfs: any[], onToggleFavorite: (etf: any) => void, isAdmin: boolean }) {
  const favorites = etfs.filter(e => e.isFavorite);

  if (favorites.length === 0) {
    return (
      <div className="p-12 text-center border-2 border-dashed rounded-xl">
        <Star className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold">추천 리스트가 비어있습니다</h3>
        <p className="text-muted-foreground">리스트에서 Fav. 체크박스를 클릭하여 나만의 추천 ETF를 만들어보세요.</p>
      </div>
    );
  }

  const groupedByMcat: Record<string, any[]> = {};
  favorites.forEach(etf => {
    const mcat = etf.mainCategory || "기타";
    if (!groupedByMcat[mcat]) groupedByMcat[mcat] = [];
    groupedByMcat[mcat].push(etf);
  });

  const orderedCategories = MCAT_ORDER.filter(cat => groupedByMcat[cat]?.length > 0);
  const otherCategories = Object.keys(groupedByMcat).filter(cat => !MCAT_ORDER.includes(cat));

  return (
    <div className="space-y-8">
      {[...orderedCategories, ...otherCategories].map(category => (
        <div key={category}>
          <h3 
            className="text-lg font-bold mb-4 pb-2 border-b flex items-center gap-2"
            data-testid={`heading-mcat-${category.replace(/[.&]/g, '-')}`}
          >
            <Star className="w-4 h-4 text-amber-500" />
            {category}
            <span className="text-sm font-normal text-muted-foreground">({groupedByMcat[category].length})</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedByMcat[category].map((etf: any) => (
              <Link key={etf.id} href={`/etf/${etf.id}`} data-testid={`link-fav-card-${etf.id}`}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <StatusBadge variant="outline">{etf.subCategory}</StatusBadge>
                      {isAdmin && (
                        <div onClick={(e) => e.preventDefault()}>
                          <Checkbox 
                            checked={etf.isFavorite} 
                            onCheckedChange={() => onToggleFavorite(etf)}
                            data-testid={`checkbox-favorite-${etf.id}`}
                          />
                        </div>
                      )}
                    </div>
                    <h4 className="font-bold text-base mb-1 truncate">{etf.name}</h4>
                    <p className="text-xs text-muted-foreground mb-3">{etf.code}</p>
                    <div className="flex justify-between items-end gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground">Yield</div>
                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{etf.yield || "-"}</div>
                      </div>
                      <Button size="sm" variant="outline">Details</Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface EtfTrend {
  id: number;
  url: string;
  title: string;
  comment: string | null;
  thumbnail: string | null;
  sourceType: string;
  createdAt: string;
}

function EtfTrendsSection({ isAdmin }: { isAdmin: boolean }) {
  const [urlInput, setUrlInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [editingTrend, setEditingTrend] = useState<EtfTrend | null>(null);
  const [editComment, setEditComment] = useState("");
  const { toast } = useToast();
  
  const { data: trends, isLoading } = useQuery<EtfTrend[]>({ 
    queryKey: ["/api/etf-trends"] 
  });

  const createTrend = useMutation({
    mutationFn: async ({ url, comment }: { url: string; comment: string }) => {
      return apiRequest("POST", "/api/etf-trends", { url, comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/etf-trends"] });
      setUrlInput("");
      setCommentInput("");
      toast({ title: "성공", description: "ETF 동향이 추가되었습니다." });
    },
    onError: (error: any) => {
      toast({ 
        title: "오류", 
        description: error.message || "동향 추가에 실패했습니다.", 
        variant: "destructive" 
      });
    }
  });

  const updateTrend = useMutation({
    mutationFn: async ({ id, comment }: { id: number; comment: string }) => {
      return apiRequest("PATCH", `/api/etf-trends/${id}`, { comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/etf-trends"] });
      setEditingTrend(null);
      setEditComment("");
      toast({ title: "수정됨", description: "코멘트가 수정되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "수정에 실패했습니다.", variant: "destructive" });
    }
  });

  const deleteTrend = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/etf-trends/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/etf-trends"] });
      toast({ title: "삭제됨", description: "동향이 삭제되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
    }
  });

  const handleEdit = (trend: EtfTrend) => {
    setEditingTrend(trend);
    setEditComment(trend.comment || "");
  };

  const handleSaveEdit = () => {
    if (editingTrend) {
      updateTrend.mutate({ id: editingTrend.id, comment: editComment });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    createTrend.mutate({ url: urlInput.trim(), comment: commentInput.trim() });
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case "youtube":
        return <Youtube className="w-4 h-4 text-red-500" />;
      case "blog":
        return <FileText className="w-4 h-4 text-green-500" />;
      default:
        return <LinkIcon className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSourceLabel = (sourceType: string) => {
    switch (sourceType) {
      case "youtube":
        return "YouTube";
      case "blog":
        return "블로그";
      default:
        return "Article";
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
        <span className="text-muted-foreground">동향 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              새 동향 추가
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                placeholder="YouTube, 블로그, 뉴스 URL을 입력하세요..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                data-testid="input-trend-url"
              />
              <Textarea
                placeholder="코멘트를 입력하세요 (선택사항)..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                rows={3}
                data-testid="input-trend-comment"
              />
              <Button 
                type="submit" 
                disabled={createTrend.isPending || !urlInput.trim()}
                data-testid="button-add-trend"
              >
                {createTrend.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    추가중...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    추가
                  </>
                )}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              URL과 함께 코멘트를 입력하면 동향 정보로 저장됩니다. (YouTube, 네이버 블로그, 일반 기사 지원)
            </p>
          </CardContent>
        </Card>
      )}

      {(!trends || trends.length === 0) ? (
        <div className="p-12 text-center border-2 border-dashed rounded-xl">
          <Newspaper className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">동향 정보가 없습니다</h3>
          <p className="text-muted-foreground">
            {isAdmin ? "URL을 추가하여 ETF 관련 콘텐츠를 요약해보세요." : "관리자가 ETF 동향을 추가하면 여기에 표시됩니다."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trends.map((trend) => (
            <a 
              key={trend.id} 
              href={trend.url} 
              target="_blank" 
              rel="noopener noreferrer"
              data-testid={`link-trend-card-${trend.id}`}
            >
              <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow h-full">
                <CardContent className="p-0">
                  {trend.thumbnail && (
                    <div className="aspect-video relative overflow-hidden bg-muted">
                      <img 
                        src={trend.thumbnail} 
                        alt={trend.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <StatusBadge variant="outline" className="gap-1">
                        {getSourceIcon(trend.sourceType)}
                        {getSourceLabel(trend.sourceType)}
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(trend.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <h4 className="font-bold text-base mb-2 line-clamp-2">{trend.title}</h4>
                    {trend.comment && (
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap mb-3 line-clamp-5">
                        {trend.comment}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        원문 보기
                      </Button>
                      {isAdmin && (
                        <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleEdit(trend); }}
                            data-testid={`button-edit-trend-${trend.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); deleteTrend.mutate(trend.id); }}
                            disabled={deleteTrend.isPending}
                            data-testid={`button-delete-trend-${trend.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      )}

      <Dialog open={!!editingTrend} onOpenChange={(open) => !open && setEditingTrend(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>코멘트 수정</DialogTitle>
            <DialogDescription>
              {editingTrend?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="코멘트를 입력하세요..."
              value={editComment}
              onChange={(e) => setEditComment(e.target.value)}
              rows={5}
              data-testid="input-edit-comment"
            />
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setEditingTrend(null)}
              >
                취소
              </Button>
              <Button 
                onClick={handleSaveEdit}
                disabled={updateTrend.isPending}
                data-testid="button-save-edit"
              >
                {updateTrend.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

