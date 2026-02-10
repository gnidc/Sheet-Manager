import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2,
  RefreshCw,
  FileText,
  ExternalLink,
  Clock,
  AlertCircle,
  Download,
  Building2,
} from "lucide-react";

interface ResearchItem {
  title: string;
  link: string;
  source: string;
  date: string;
  file: string;
}

interface ResearchResponse {
  research: ResearchItem[];
  updatedAt: string;
  total: number;
}

export default function ResearchList() {
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<ResearchResponse>({
    queryKey: ["/api/news/research"],
    queryFn: async () => {
      const res = await fetch("/api/news/research", { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "리서치 데이터를 불러올 수 없습니다");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground">증권사 리서치 리포트를 가져오고 있습니다...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <p className="text-muted-foreground">
          {error?.message || "리서치를 불러올 수 없습니다."}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          재시도
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-500" />
              증권사 투자전략 리서치
            </CardTitle>
            <div className="flex items-center gap-3">
              {data?.updatedAt && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{data.updatedAt} 기준</span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-2"
              >
                {isFetching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                새로고침
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            네이버 금융 증권사 투자전략 리포트를 보여드립니다
          </p>
        </CardHeader>
      </Card>

      {/* 리서치 리스트 */}
      {data?.research && data.research.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[50px] text-center">#</TableHead>
                    <TableHead>제목</TableHead>
                    <TableHead className="w-[120px]">증권사</TableHead>
                    <TableHead className="w-[100px] text-center">날짜</TableHead>
                    <TableHead className="w-[80px] text-center">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.research.map((item, index) => (
                    <TableRow
                      key={index}
                      className="hover:bg-muted/30 cursor-pointer group"
                      onClick={() => {
                        if (item.link) window.open(item.link, "_blank", "noopener,noreferrer");
                      }}
                    >
                      <TableCell className="text-center text-muted-foreground font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                            {item.title}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant="outline" className="text-xs">
                          {item.source || "-"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {item.date || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.file ? (
                          <a
                            href={item.file}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            PDF
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">리서치 리포트가 없습니다</h3>
            <p className="text-sm text-muted-foreground mt-1">잠시 후 다시 시도해주세요.</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center py-2">
        데이터 출처: 네이버 금융 (증권사 투자전략 리포트) | 리포트 원문은 해당 증권사에 저작권이 있습니다
      </p>
    </div>
  );
}

