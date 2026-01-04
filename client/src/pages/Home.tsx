import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useEtfs, useUpdateEtf } from "@/hooks/use-etfs";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EtfForm } from "@/components/EtfForm";
import { useCreateEtf } from "@/hooks/use-etfs";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Plus, ExternalLink, SlidersHorizontal, ArrowRight, TrendingUp, Wallet, Globe, Loader2, Star, Lightbulb } from "lucide-react";
import { type InsertEtf } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { LoginDialog } from "@/components/LoginDialog";

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
          <TabsList className="grid w-full grid-cols-4 max-w-lg mx-auto">
            <TabsTrigger value="all">Tracked ETFs</TabsTrigger>
            <TabsTrigger value="trends">Markets</TabsTrigger>
            <TabsTrigger value="strategies">Strategies</TabsTrigger>
            <TabsTrigger value="favorites" className="gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              추천ETF
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

          <TabsContent value="strategies">
            <div className="p-8 text-center text-muted-foreground">Strategies section content goes here</div>
          </TabsContent>

          <TabsContent value="favorites">
             <FavoriteSection etfs={etfs || []} onToggleFavorite={handleToggleFavorite} isAdmin={isAdmin} />
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
              <Card key={etf.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <StatusBadge variant="outline">{etf.subCategory}</StatusBadge>
                    {isAdmin && (
                      <Checkbox 
                        checked={etf.isFavorite} 
                        onCheckedChange={() => onToggleFavorite(etf)}
                        data-testid={`checkbox-favorite-${etf.id}`}
                      />
                    )}
                  </div>
                  <h4 className="font-bold text-base mb-1 truncate">{etf.name}</h4>
                  <p className="text-xs text-muted-foreground mb-3">{etf.code}</p>
                  <div className="flex justify-between items-end gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Yield</div>
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{etf.yield || "-"}</div>
                    </div>
                    <Link href={`/etf/${etf.id}`}>
                      <Button size="sm" variant="outline">Details</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

