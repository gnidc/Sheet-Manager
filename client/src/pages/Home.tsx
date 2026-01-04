import { useState } from "react";
import { Link } from "wouter";
import { useEtfs } from "@/hooks/use-etfs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EtfForm } from "@/components/EtfForm";
import { useCreateEtf } from "@/hooks/use-etfs";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Plus, ExternalLink, SlidersHorizontal, ArrowRight, TrendingUp, Wallet, Globe, Loader2 } from "lucide-react";
import { type InsertEtf } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useQuery } from "@tanstack/react-query";

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
  const { toast } = useToast();

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

  const getSubCategories = () => {
    if (!etfs) return [];
    const cats = new Set(etfs.map(e => e.subCategory).filter(Boolean));
    return Array.from(cats) as string[];
  };

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
                <h1 className="text-xl font-bold text-foreground tracking-tight">Covered Call Intelligence</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Advanced ETF Analytics Dashboard</p>
              </div>
            </div>
            
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="all" className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="all">ETF (유형별)</TabsTrigger>
            <TabsTrigger value="trends">동향</TabsTrigger>
            <TabsTrigger value="recommended">추천 ETF</TabsTrigger>
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
                          <TableCell className="font-mono text-sm font-medium text-muted-foreground">
                            {etf.code}
                          </TableCell>
                          <TableCell className="text-xs font-medium">{etf.mainCategory}</TableCell>
                          <TableCell className="text-xs">{etf.subCategory}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                {etf.name}
                              </span>
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

          <TabsContent value="trends">
            <TrendingSection />
          </TabsContent>

          <TabsContent value="recommended">
             <RecommendedSection />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function TrendingSection() {
  const { data: trends, isLoading } = useQuery<any[]>({ queryKey: ["/api/trends"] });

  if (isLoading) return <div className="p-8 text-center">동향 분석 중...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-card rounded-xl border p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          실시간 인기 ETF
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trends?.map((etf) => (
            <Link key={etf.id} href={`/etf/${etf.id}`}>
              <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer flex justify-between items-center">
                <div>
                  <div className="font-bold">{etf.name}</div>
                  <div className="text-xs text-muted-foreground">{etf.code}</div>
                </div>
                <div className="text-primary font-mono font-bold">Score: {etf.trendScore}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecommendedSection() {
  const { data: recommended, isLoading } = useQuery<any[]>({ queryKey: ["/api/recommended"] });

  if (isLoading) return <div className="p-8 text-center">추천 리스트 불러오는 중...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {recommended?.map((etf) => (
          <Link key={etf.id} href={`/etf/${etf.id}`}>
            <div className="p-6 border rounded-xl shadow-sm bg-primary/5 border-primary/10 hover:bg-primary/10 transition-colors cursor-pointer">
              <div className="flex justify-between items-start mb-4">
                <StatusBadge variant="accent">추천</StatusBadge>
                <div className="text-xs font-mono">{etf.code}</div>
              </div>
              <h4 className="font-bold mb-1 truncate">{etf.name}</h4>
              <p className="text-xs text-muted-foreground mb-4">{etf.mainCategory} | {etf.subCategory}</p>
              <div className="flex justify-between items-end">
                <div className="text-lg font-bold text-primary">{etf.yield}</div>
                <ArrowRight className="w-4 h-4 text-primary" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
