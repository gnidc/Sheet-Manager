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

export default function Home() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [countryFilter, setCountryFilter] = useState("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const { data: etfs, isLoading, error } = useEtfs({ 
    search, 
    category: categoryFilter, 
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

  const getCategories = () => {
    if (!etfs) return [];
    const cats = new Set(etfs.map(e => e.category).filter(Boolean));
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
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
              {etfs ? new Set(etfs.map(e => e.category)).size : 0}
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

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {getCategories().map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
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
                    <TableHead className="w-[100px]">Gen</TableHead>
                    <TableHead className="min-w-[250px]">Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Yield</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Dividend</TableHead>
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
                      <TableCell>
                        <StatusBadge variant={
                          etf.generation === '1세대' ? 'secondary' :
                          etf.generation === '2세대' ? 'default' : 'accent'
                        }>
                          {etf.generation || 'N/A'}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {etf.name}
                          </span>
                          <span className="text-xs text-muted-foreground">{etf.country}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{etf.category}</TableCell>
                      <TableCell>
                        <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                          {etf.yield}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{etf.fee}</TableCell>
                      <TableCell className="text-sm">{etf.marketCap}</TableCell>
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
      </main>
    </div>
  );
}
