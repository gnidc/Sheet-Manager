import { useRoute, useLocation } from "wouter";
import { useEtf, useUpdateEtf, useDeleteEtf } from "@/hooks/use-etfs";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Trash2, Edit2, ExternalLink, Info, Calendar, DollarSign, BarChart3, TrendingUp, FileText } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { DataCard } from "@/components/DataCard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EtfForm } from "@/components/EtfForm";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { InsertEtf } from "@shared/schema";

export default function EtfDetail() {
  const [match, params] = useRoute("/etf/:id");
  const [, setLocation] = useLocation();
  const id = params ? parseInt(params.id) : 0;
  
  const { data: etf, isLoading, error } = useEtf(id);
  const updateEtf = useUpdateEtf();
  const deleteEtf = useDeleteEtf();
  const { toast } = useToast();
  
  const [isEditOpen, setIsEditOpen] = useState(false);

  if (isLoading) return (
    <div className="h-screen w-full flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (error || !etf) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-4">
      <h1 className="text-2xl font-bold">ETF Not Found</h1>
      <Button onClick={() => setLocation("/")}>Go Home</Button>
    </div>
  );

  const handleUpdate = async (data: InsertEtf) => {
    try {
      await updateEtf.mutateAsync({ id, ...data });
      setIsEditOpen(false);
      toast({ title: "Updated", description: "ETF details updated successfully" });
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Failed to update ETF", 
        variant: "destructive" 
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEtf.mutateAsync(id);
      toast({ title: "Deleted", description: "ETF removed from database" });
      setLocation("/");
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Failed to delete ETF", 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-white dark:bg-card border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Button variant="ghost" className="mb-4 pl-0 hover:bg-transparent hover:text-primary" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
          
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <StatusBadge variant="outline" className="font-mono">{etf.code}</StatusBadge>
                <StatusBadge variant={
                  etf.generation === '1세대' ? 'secondary' : 
                  etf.generation === '2세대' ? 'default' : 'accent'
                }>{etf.generation}</StatusBadge>
                <StatusBadge variant="secondary">{etf.country}</StatusBadge>
              </div>
              <h1 className="text-3xl font-bold font-display text-foreground tracking-tight">{etf.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-muted-foreground text-sm">
                <span className="flex items-center gap-1"><Info className="w-3 h-3" /> {etf.category}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Listed: {etf.listingDate}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Edit2 className="w-4 h-4 mr-2" /> Edit
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit ETF</DialogTitle>
                    <DialogDescription>Update the details for this ETF.</DialogDescription>
                  </DialogHeader>
                  <EtfForm 
                    defaultValues={etf}
                    onSubmit={handleUpdate} 
                    isPending={updateEtf.isPending} 
                    submitLabel="Save Changes"
                  />
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the ETF from the database.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <DataCard 
            label="Target Yield" 
            value={etf.yield} 
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            className="border-l-4 border-l-emerald-500"
          />
          <DataCard 
            label="Fee" 
            value={etf.fee} 
            icon={<DollarSign className="w-5 h-5" />}
          />
          <DataCard 
            label="Market Cap" 
            value={etf.marketCap} 
            icon={<BarChart3 className="w-5 h-5" />}
          />
          <DataCard 
            label="Dividend Cycle" 
            value={etf.dividendCycle} 
            icon={<Calendar className="w-5 h-5" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white dark:bg-card rounded-2xl p-6 border shadow-sm">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Strategy Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Option Type</label>
                  <p className="text-lg">{etf.optionType || "—"}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Underlying Asset</label>
                  <p className="text-lg">{etf.underlyingAsset || "—"}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Call Option</label>
                  <p className="text-lg">{etf.callOption || "—"}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Notes & Features</label>
                  <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 p-4 rounded-lg border">
                    {etf.notes || "No additional notes provided."}
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar / Links */}
          <div className="space-y-6">
            <section className="bg-white dark:bg-card rounded-2xl p-6 border shadow-sm">
              <h3 className="text-lg font-bold mb-4">Resources</h3>
              <div className="space-y-3">
                {etf.linkProduct ? (
                  <a 
                    href={etf.linkProduct} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary transition-colors border border-primary/10"
                  >
                    <span className="font-medium">Official Product Page</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <div className="p-3 rounded-xl bg-muted text-muted-foreground text-sm border border-dashed text-center">
                    No product link available
                  </div>
                )}

                {etf.linkBlog ? (
                  <a 
                    href={etf.linkBlog} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
                  >
                    <span className="font-medium">Analysis Blog</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <div className="p-3 rounded-xl bg-muted text-muted-foreground text-sm border border-dashed text-center">
                    No blog link available
                  </div>
                )}
              </div>
            </section>

            <section className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
              <h3 className="font-bold text-lg mb-2">Pro Tip</h3>
              <p className="text-indigo-100 text-sm leading-relaxed">
                Check the "Dividend Cycle" and "Option Type" carefully. Weekly options often provide higher yield but may limit upside potential more aggressively than monthly options.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
