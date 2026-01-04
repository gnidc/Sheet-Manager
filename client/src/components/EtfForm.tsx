import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEtfSchema, type InsertEtf } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface EtfFormProps {
  defaultValues?: Partial<InsertEtf>;
  onSubmit: (data: InsertEtf) => void;
  isPending: boolean;
  submitLabel: string;
}

export function EtfForm({ defaultValues, onSubmit, isPending, submitLabel }: EtfFormProps) {
  const form = useForm<InsertEtf>({
    resolver: zodResolver(insertEtfSchema),
    defaultValues: defaultValues || {
      name: "",
      code: "",
      generation: "2세대",
      category: "",
      country: "미국",
      fee: "",
      yield: "",
      marketCap: "",
      dividendCycle: "월지급",
      optionType: "",
      underlyingAsset: "",
      callOption: "",
      listingDate: "",
      notes: "",
      linkProduct: "",
      linkBlog: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>ETF Name</FormLabel>
                <FormControl>
                  <Input placeholder="TIGER 미국30년국채커버드콜액티브(H)" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code (Ticker)</FormLabel>
                <FormControl>
                  <Input placeholder="476550" className="font-mono" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="generation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Generation</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select generation" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1세대">1세대 (Passive)</SelectItem>
                    <SelectItem value="2세대">2세대 (Active/Target)</SelectItem>
                    <SelectItem value="3세대">3세대 (Daily/Weekly)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="미국">미국 (USA)</SelectItem>
                    <SelectItem value="한국">한국 (Korea)</SelectItem>
                    <SelectItem value="CN">중국 (China)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <Input placeholder="미국국채, 나스닥100..." {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fee (%)</FormLabel>
                <FormControl>
                  <Input placeholder="0.39%" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="yield"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Yield</FormLabel>
                <FormControl>
                  <Input placeholder="12% (Target)" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

           <FormField
            control={form.control}
            name="marketCap"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Market Cap</FormLabel>
                <FormControl>
                  <Input placeholder="1.1조" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="dividendCycle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dividend Cycle</FormLabel>
                <FormControl>
                  <Input placeholder="월지급(말일)" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="optionType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Option Type</FormLabel>
                <FormControl>
                  <Input placeholder="위클리(30%)" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="callOption"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Call Option Asset</FormLabel>
                <FormControl>
                  <Input placeholder="TLT, NASDAQ100..." {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="listingDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Listing Date</FormLabel>
                <FormControl>
                  <Input placeholder="24.02" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="underlyingAsset"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Underlying Index/Asset</FormLabel>
              <FormControl>
                <Input placeholder="KEDI US Treasury 30Y..." {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="linkProduct"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product Link</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="linkBlog"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Blog/Analysis Link</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Any specific features like currency hedging..." className="min-h-[100px]" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-4 border-t">
          <Button 
            type="submit" 
            disabled={isPending}
            className="min-w-[150px]"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
