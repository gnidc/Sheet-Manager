import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Send,
  Save,
  Trash2,
  Eye,
  ExternalLink,
  RefreshCw,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Plus,
  Edit3,
  Link2,
  BrainCircuit,
  ImagePlus,
} from "lucide-react";

// ===== Steem Keychain 타입 정의 =====
interface SteemKeychainResponse {
  success: boolean;
  error?: string;
  message?: string;
  result?: {
    id?: string;
    block_num?: number;
    trx_num?: number;
    expired?: boolean;
  };
}

interface SteemKeychain {
  requestPost: (
    account: string,
    title: string,
    body: string,
    parent_permlink: string,
    parent_author: string,
    json_metadata: string,
    permlink: string,
    comment_options: string,
    callback: (response: SteemKeychainResponse) => void
  ) => void;
  requestBroadcast: (
    account: string,
    operations: any[][],
    key_type: string,
    callback: (response: SteemKeychainResponse) => void
  ) => void;
  requestHandshake: (callback: (response: SteemKeychainResponse) => void) => void;
}

declare global {
  interface Window {
    steem_keychain?: SteemKeychain;
  }
}

// ===== 타입 정의 =====
interface SteemPost {
  id: number;
  author: string;
  permlink: string;
  title: string;
  body: string;
  tags: string;
  category: string;
  status: string;
  steemUrl: string | null;
  txId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

// ===== 유틸리티 =====
function generatePermlink(title: string): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  // 한글 제거 후 영문/숫자만 남기고, slug 생성
  const slug = title
    .toLowerCase()
    .replace(/[^\w\s\uAC00-\uD7AF]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/[^\w-]/g, "")
    .slice(0, 40);
  return `${slug || "post"}-${dateStr}-${timeStr}`;
}

// ===== 기본 템플릿 =====
const DEFAULT_TEMPLATE = `# 📊 ETF 시장 일일 보고서

## 📈 시장 개요

오늘의 시장 동향을 정리합니다.

## 🔥 주요 상승 ETF

| 순위 | ETF명 | 등락률 |
|------|--------|--------|
| 1 | - | - |
| 2 | - | - |
| 3 | - | - |

## 📉 주요 하락 ETF

| 순위 | ETF명 | 등락률 |
|------|--------|--------|
| 1 | - | - |
| 2 | - | - |
| 3 | - | - |

## 💡 투자 전략

- 

## 📌 참고 링크

- [네이버 증권](https://stock.naver.com/)
- [FunETF](https://www.funetf.co.kr/)

---
*이 보고서는 Sheet-Manager에서 자동 생성되었습니다.*
`;

const DEFAULT_TAGS = ["kr", "krsuccess", "avle", "investment"];

// ===== DB API에서 AI 분석 보고서 불러오기 (공통보고서 우선) =====
const PERIOD_LABELS: Record<string, string> = {
  daily: "일간", weekly: "주간", monthly: "월간", yearly: "연간",
};

// 시장 보고서 JSON 데이터를 마크다운 텍스트로 변환
function formatReportToMarkdown(report: any): string {
  if (typeof report === "string") return report;
  if (report.fullReport) return report.fullReport;

  // 텍스트 형태 필드 우선
  if (report.market || report.analysis || report.strategy || report.summary) {
    const sections: string[] = [];
    if (report.market) sections.push(`## 📈 시장 동향\n${report.market}`);
    if (report.analysis) sections.push(`## 🔍 분석\n${report.analysis}`);
    if (report.strategy) sections.push(`## 💡 전략\n${report.strategy}`);
    if (report.summary) sections.push(`## 📋 요약\n${report.summary}`);
    if (sections.length > 0) return sections.join('\n\n');
  }

  // 구조화된 시장 데이터를 마크다운으로 변환
  const parts: string[] = [];

  // 기간 정보
  if (report.periodRange) {
    parts.push(`**📅 ${report.periodRange}**`);
    parts.push('');
  }

  // 시장 요약
  if (report.marketSummary) {
    parts.push(`## 📊 시장 요약`);
    parts.push('');
    parts.push(report.marketSummary);
    parts.push('');
  }

  // 주요 지수
  if (report.indices && Array.isArray(report.indices) && report.indices.length > 0) {
    parts.push(`## 📈 주요 지수`);
    parts.push('');
    parts.push('| 지수 | 현재가 | 등락 | 등락률 |');
    parts.push('|------|--------|------|--------|');
    for (const idx of report.indices) {
      const sign = parseFloat(idx.change) >= 0 ? "▲" : "▼";
      const changeStr = parseFloat(idx.change) >= 0 ? `+${idx.change}` : idx.change;
      parts.push(`| ${idx.name} | ${idx.price} | ${sign} ${Math.abs(parseFloat(idx.change))} | ${idx.changePercent}% |`);
    }
    parts.push('');
  }

  // 거래량 상위
  if (report.volumeRanking && Array.isArray(report.volumeRanking) && report.volumeRanking.length > 0) {
    parts.push(`## 🔥 거래량 상위 종목`);
    parts.push('');
    parts.push('| 순위 | 종목명 | 현재가 | 등락률 | 거래량 |');
    parts.push('|------|--------|--------|--------|--------|');
    report.volumeRanking.forEach((item: any, i: number) => {
      parts.push(`| ${i + 1} | ${item.name || item.stockName || '-'} | ${item.price || item.currentPrice || '-'} | ${item.changePercent || item.change || '-'}% | ${item.volume || '-'} |`);
    });
    parts.push('');
  }

  // 투자자 동향
  if (report.investorTrends && Array.isArray(report.investorTrends) && report.investorTrends.length > 0) {
    parts.push(`## 👥 투자자 동향`);
    parts.push('');
    parts.push('| 투자자 | 매수 | 매도 | 순매수 |');
    parts.push('|--------|------|------|--------|');
    for (const inv of report.investorTrends) {
      parts.push(`| ${inv.investor || inv.name || '-'} | ${inv.buy || '-'} | ${inv.sell || '-'} | ${inv.net || '-'} |`);
    }
    parts.push('');
  }

  // 상승 ETF
  if (report.topEtfs && Array.isArray(report.topEtfs) && report.topEtfs.length > 0) {
    parts.push(`## 🚀 주요 ETF`);
    parts.push('');
    parts.push('| ETF명 | 현재가 | 등락률 |');
    parts.push('|-------|--------|--------|');
    for (const etf of report.topEtfs) {
      parts.push(`| ${etf.name || etf.etfName || '-'} | ${etf.price || etf.currentPrice || '-'} | ${etf.changePercent || etf.change || '-'}% |`);
    }
    parts.push('');
  }

  // 뉴스
  if (report.news && Array.isArray(report.news) && report.news.length > 0) {
    parts.push(`## 📰 주요 뉴스`);
    parts.push('');
    for (const n of report.news) {
      const title = n.title || n.headline || '';
      const link = n.link || n.url || '';
      if (title) {
        parts.push(link ? `- [${title}](${link})` : `- ${title}`);
      }
    }
    parts.push('');
  }

  // 아무 데이터도 포맷팅되지 않았다면, 알려진 메타 필드를 제외한 나머지를 표시
  if (parts.length === 0) {
    return JSON.stringify(report, null, 2);
  }

  return parts.join('\n');
}

// DB에서 일일보고서 > 공통보고서의 최신 항목을 가져오기
async function fetchLatestReportFromDB(): Promise<{ text: string; periodLabel: string } | null> {
  try {
    // 1) 일일 AI 분석 (공통보고서) - 최신 1건
    try {
      const res = await fetch(`/api/strategy-analyses/daily?scope=common`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const analyses = data.analyses || [];
        if (analyses.length > 0) {
          const newest = analyses[0]; // 서버에서 최신순 반환
          const analysis = newest.result?.analysis || "";
          if (analysis) {
            const lines: string[] = [];
            lines.push(`# Comment`);
            lines.push(''); lines.push(''); lines.push('');
            lines.push(`# 📊 AI 일간 분석 보고서`);
            lines.push('');
            lines.push(`> 생성 시간: ${newest.createdAt}`);
            lines.push('');
            lines.push(analysis);
            lines.push('');
            lines.push('---');
            lines.push('*이 보고서는 AI가 자동 수집 데이터를 기반으로 생성한 내용입니다.*');
            lines.push('*데이터 출처: 네이버 금융, Yahoo Finance, CoinGecko, 한국투자증권 API 등*');
            return { text: lines.join('\n'), periodLabel: "일간" };
          }
        }
      }
    } catch { /* skip */ }

    // 2) 일일 시장 보고서 (공통보고서) - AI분석이 없으면
    try {
      const res = await fetch(`/api/strategy-reports/daily?scope=common`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const reports = data.reports || [];
        if (reports.length > 0) {
          const newest = reports[0];
          if (newest.report) {
            const body = formatReportToMarkdown(newest.report);
            const lines: string[] = [];
            lines.push(`# Comment`);
            lines.push(''); lines.push(''); lines.push('');
            lines.push(`# 📊 일간 시장 보고서`);
            lines.push('');
            lines.push(`> 생성 시간: ${newest.createdAt}`);
            lines.push('');
            lines.push(body);
            lines.push('');
            lines.push('---');
            lines.push('*이 보고서는 자동 수집된 시장 데이터를 기반으로 생성한 보고서입니다.*');
            return { text: lines.join('\n'), periodLabel: "일간" };
          }
        }
      }
    } catch { /* skip */ }

    // 3) ETF 실시간 분석 결과 (localStorage fallback)
    try {
      const etfSaved = localStorage.getItem("etf_analysis_result");
      if (etfSaved) {
        const etfData = JSON.parse(etfSaved) as {
          analysis: string;
          analyzedAt: string;
          dataPoints?: { risingCount: number; fallingCount: number; newsCount: number; market: string };
        };
        if (etfData.analysis) {
          const lines: string[] = [];
          lines.push(`# Comment`);
          lines.push(''); lines.push(''); lines.push('');
          lines.push(`# 📊 AI 트렌드 분석 보고서`);
          lines.push('');
          lines.push(`> 분석 시간: ${etfData.analyzedAt}`);
          if (etfData.dataPoints) {
            lines.push(`> 📈 상승 ETF ${etfData.dataPoints.risingCount}개 | 📉 하락 ETF ${etfData.dataPoints.fallingCount}개 | 📰 뉴스 ${etfData.dataPoints.newsCount}건 | ${etfData.dataPoints.market || ""}`);
          }
          lines.push(''); lines.push(etfData.analysis); lines.push('');
          lines.push('---');
          lines.push('*이 보고서는 AI(Gemini)가 실시간 데이터를 기반으로 자동 생성한 내용입니다.*');
          lines.push('*데이터 출처: 네이버 금융, FnGuide, 한국투자증권 API*');
          return { text: lines.join('\n'), periodLabel: "실시간ETF" };
        }
      }
    } catch { /* skip */ }

    return null;
  } catch {
    return null;
  }
}

// 오늘 날짜를 YYMMDD 형식으로 반환
function getTodayYYMMDD(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

const PERIOD_TITLE_MAP: Record<string, string> = {
  "일간": "오늘의 자산시장 동향",
  "주간": "금주의 자산시장 동향",
  "월간": "이달의 자산시장 동향",
  "연간": "올해의 자산시장 동향",
  "실시간ETF": "오늘의 자산시장 동향",
};

function getDefaultTitle(periodLabel?: string): string {
  const suffix = PERIOD_TITLE_MAP[periodLabel || ""] || "오늘의 자산시장 동향";
  return `(${getTodayYYMMDD()}) ${suffix}`;
}

export default function SteemReport() {
  const { toast } = useToast();
  const [keychainStatus, setKeychainStatus] = useState<"checking" | "available" | "not-installed">("checking");

  // ===== 폼 상태 =====
  const [steemAccount, setSteemAccount] = useState(() => localStorage.getItem("steem_account") || "seraphim502");
  const [postTitle, setPostTitle] = useState(() => getDefaultTitle());
  const [postBody, setPostBody] = useState("");
  const [tagsInput, setTagsInput] = useState(DEFAULT_TAGS.join(", "));
  const [mainTag, setMainTag] = useState("kr");
  const [isPosting, setIsPosting] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [viewingPost, setViewingPost] = useState<SteemPost | null>(null);
  const [editingDraft, setEditingDraft] = useState<SteemPost | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const initialLoadDone = useRef(false);

  // ===== 컴포넌트 마운트 시 DB에서 최신 보고서 자동 로드 =====
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    
    (async () => {
      setIsLoadingReport(true);
      try {
        const report = await fetchLatestReportFromDB();
        if (report) {
          setPostBody(report.text);
          setPostTitle(getDefaultTitle(report.periodLabel));
        }
      } catch {
        // 실패 시 빈 상태 유지
      } finally {
        setIsLoadingReport(false);
      }
    })();
  }, []);

  // ===== Steem Keychain 감지 =====
  useEffect(() => {
    const checkKeychain = () => {
      if (window.steem_keychain) {
        setKeychainStatus("available");
      } else {
        setKeychainStatus("not-installed");
      }
    };

    // Keychain은 페이지 로드 후 약간의 지연이 있을 수 있음
    const timer = setTimeout(checkKeychain, 1500);
    // 즉시도 체크
    if (window.steem_keychain) {
      setKeychainStatus("available");
      clearTimeout(timer);
    }

    return () => clearTimeout(timer);
  }, []);

  // ===== 계정명 저장 =====
  useEffect(() => {
    localStorage.setItem("steem_account", steemAccount);
  }, [steemAccount]);

  // ===== 포스팅 이력 조회 =====
  const { data: postsData, isLoading: isLoadingPosts, refetch: refetchPosts } = useQuery<SteemPost[]>({
    queryKey: ["/api/steem-posts"],
    queryFn: async () => {
      const res = await fetch("/api/steem-posts", { credentials: "include" });
      if (!res.ok) throw new Error("스팀 포스팅 이력 조회 실패");
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const posts = postsData || [];

  // ===== 포스팅 저장 (DB) =====
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<SteemPost>) => {
      const res = await apiRequest("POST", "/api/steem-posts", data);
      return res.json();
    },
    onSuccess: () => {
      refetchPosts();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<SteemPost> }) => {
      const res = await apiRequest("PUT", `/api/steem-posts/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      refetchPosts();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/steem-posts/${id}`);
    },
    onSuccess: () => {
      toast({ title: "포스팅 삭제 완료" });
      refetchPosts();
    },
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  // ===== 임시저장 =====
  const handleSaveDraft = useCallback(async () => {
    if (!postTitle.trim() || !postBody.trim()) {
      toast({ title: "제목과 본문을 입력해주세요", variant: "destructive" });
      return;
    }
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const permlink = generatePermlink(postTitle);

    try {
      if (editingDraft) {
        await updateMutation.mutateAsync({
          id: editingDraft.id,
          updates: {
            title: postTitle,
            body: postBody,
            tags: JSON.stringify(tags),
            category: mainTag,
            permlink,
          },
        });
        setEditingDraft(null);
        toast({ title: "임시저장 수정 완료" });
      } else {
        await saveMutation.mutateAsync({
          author: steemAccount,
          title: postTitle,
          body: postBody,
          tags: JSON.stringify(tags),
          category: mainTag,
          permlink,
          status: "draft",
        });
        toast({ title: "임시저장 완료" });
      }
    } catch (error: any) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    }
  }, [postTitle, postBody, tagsInput, mainTag, steemAccount, editingDraft]);

  // ===== Steem Keychain을 통한 포스팅 =====
  const handlePostToSteem = useCallback(async () => {
    if (!postTitle.trim() || !postBody.trim()) {
      toast({ title: "제목과 본문을 입력해주세요", variant: "destructive" });
      return;
    }

    if (!window.steem_keychain) {
      toast({
        title: "Steem Keychain이 설치되지 않았습니다",
        description: "크롬 웹스토어에서 Steem Keychain을 설치해주세요",
        variant: "destructive",
      });
      return;
    }

    if (!steemAccount.trim()) {
      toast({ title: "스팀 계정명을 입력해주세요", variant: "destructive" });
      return;
    }

    setIsPosting(true);

    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const permlink = generatePermlink(postTitle);
    const parentPermlink = mainTag || tags[0] || "kr";

    const bodyImageUrls = Array.from(postBody.matchAll(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g)).map(m => m[1]);
    const allImages = Array.from(new Set(uploadedImages.concat(bodyImageUrls)));

    const jsonMetadata = JSON.stringify({
      tags,
      app: "sheet-manager/1.0",
      format: "markdown",
      image: allImages,
    });

    try {
      // Steem Keychain requestPost 호출
      window.steem_keychain.requestPost(
        steemAccount,
        postTitle,
        postBody,
        parentPermlink,
        "", // parent_author (빈 문자열 = 루트 포스트)
        jsonMetadata,
        permlink,
        "", // comment_options (빈 문자열 = 기본값)
        async (response: SteemKeychainResponse) => {
          setIsPosting(false);

          if (response.success) {
            const steemUrl = `https://steemit.com/@${steemAccount}/${permlink}`;
            const txId = response.result?.id || "";

            // DB에 포스팅 기록 저장
            try {
              if (editingDraft) {
                await updateMutation.mutateAsync({
                  id: editingDraft.id,
                  updates: {
                    title: postTitle,
                    body: postBody,
                    tags: JSON.stringify(tags),
                    category: mainTag,
                    permlink,
                    status: "published",
                    steemUrl,
                    txId,
                  },
                });
              } else {
                await saveMutation.mutateAsync({
                  author: steemAccount,
                  title: postTitle,
                  body: postBody,
                  tags: JSON.stringify(tags),
                  category: mainTag,
                  permlink,
                  status: "published",
                  steemUrl,
                  txId,
                });
              }
            } catch (err) {
              console.error("DB 저장 실패:", err);
            }

            toast({
              title: "🎉 스팀 포스팅 성공!",
              description: (
                <div className="flex flex-col gap-1">
                  <span>포스팅이 스팀 블록체인에 게시되었습니다.</span>
                  <a
                    href={steemUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline text-xs"
                  >
                    {steemUrl}
                  </a>
                </div>
              ),
            });

            // 폼 초기화
            setPostTitle(getDefaultTitle());
            setPostBody("");
            setEditingDraft(null);
          } else {
            const errorMsg = response.error || response.message || "알 수 없는 오류";

            // 실패 기록 저장
            try {
              await saveMutation.mutateAsync({
                author: steemAccount,
                title: postTitle,
                body: postBody,
                tags: JSON.stringify(tags),
                category: mainTag,
                permlink,
                status: "failed",
                errorMessage: errorMsg,
              });
            } catch (err) {
              console.error("DB 저장 실패:", err);
            }

            toast({
              title: "포스팅 실패",
              description: errorMsg,
              variant: "destructive",
            });
          }
        }
      );
    } catch (error: any) {
      setIsPosting(false);
      toast({
        title: "Keychain 호출 오류",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [postTitle, postBody, tagsInput, mainTag, steemAccount, editingDraft]);

  // ===== 템플릿 로드 =====
  const loadTemplate = useCallback(() => {
    const today = new Date().toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
    setPostTitle(`📊 ETF 시장 일일 보고서 - ${today}`);
    setPostBody(DEFAULT_TEMPLATE);
    toast({ title: "템플릿이 로드되었습니다" });
  }, []);

  // ===== 드래프트 편집 =====
  const handleEditDraft = useCallback((post: SteemPost) => {
    setEditingDraft(post);
    setPostTitle(post.title);
    setPostBody(post.body);
    setSteemAccount(post.author);
    try {
      const tags = JSON.parse(post.tags);
      setTagsInput(tags.join(", "));
      setMainTag(post.category || tags[0] || "kr");
    } catch {
      setTagsInput(post.tags);
    }
    toast({ title: "초안을 편집 모드로 불러왔습니다" });
  }, []);

  // ===== AI 보고서 선택 다이얼로그 =====
  const [reportPickerOpen, setReportPickerOpen] = useState(false);
  const [reportList, setReportList] = useState<{
    id: string;
    createdAt: string;
    prompt: string;
    source: string;
    period: string;
    result: { analysis: string; analyzedAt?: string; dataPoints?: any };
    createdBy: string;
  }[]>([]);
  const [isLoadingReportList, setIsLoadingReportList] = useState(false);
  const [reportFilter, setReportFilter] = useState<"all" | "strategy" | "weekly-stats" | "etf-realtime">("all");

  const handleOpenReportPicker = useCallback(async () => {
    setReportPickerOpen(true);
    setIsLoadingReportList(true);
    try {
      const periods = ["daily", "weekly", "monthly", "yearly"] as const;
      const results = await Promise.all(
        periods.map(async (period) => {
          try {
            const res = await fetch(`/api/strategy-analyses/${period}`, { credentials: "include" });
            if (res.ok) {
              const data = await res.json();
              return (data.analyses || []).map((a: any) => ({ ...a, period }));
            }
          } catch {}
          return [];
        })
      );
      const all = results.flat().sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setReportList(all);
    } catch {
      setReportList([]);
    } finally {
      setIsLoadingReportList(false);
    }
  }, []);

  const periodLabelMap: Record<string, string> = { daily: "일간", weekly: "주간", monthly: "월간", yearly: "연간" };

  const handleSelectReport = useCallback((report: typeof reportList[number]) => {
    const analysis = report.result?.analysis || "";
    if (!analysis) {
      toast({ title: "본문 없음", description: "이 보고서에는 분석 내용이 없습니다.", variant: "destructive" });
      return;
    }
    const pLabel = periodLabelMap[report.period] || "일간";
    const sourceLabel = report.source === "etf-realtime"
      ? "AI 트렌드 분석 보고서"
      : report.source === "weekly-stats"
        ? "AI 주간통계 분석 보고서"
        : `AI ${pLabel} 분석 보고서`;

    let bodyContent = analysis;
    if (report.source === "weekly-stats") {
      bodyContent = analysis
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/h[1-6]>/gi, "\n\n")
        .replace(/<\/tr>/gi, "\n")
        .replace(/<\/th>/gi, " | ")
        .replace(/<\/td>/gi, " | ")
        .replace(/<li>/gi, "- ")
        .replace(/<\/li>/gi, "\n")
        .replace(/<hr\s*\/?>/gi, "\n---\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    const lines: string[] = [];
    lines.push("# Comment");
    lines.push(""); lines.push(""); lines.push("");
    lines.push(`# 📊 ${sourceLabel}`);
    lines.push("");
    lines.push(`> 생성 시간: ${report.createdAt}`);
    lines.push("");
    lines.push(bodyContent);
    lines.push("");
    lines.push("---");
    lines.push("*이 보고서는 AI가 자동 수집 데이터를 기반으로 생성한 내용입니다.*");
    lines.push("*데이터 출처: 네이버 금융, Yahoo Finance, CoinGecko, 한국투자증권 API 등*");

    setPostBody(lines.join("\n"));
    const titleLabel = report.source === "etf-realtime" ? "실시간ETF" : report.source === "weekly-stats" ? "주간통계" : pLabel;
    setPostTitle(getDefaultTitle(titleLabel));
    setReportPickerOpen(false);
    toast({ title: `✅ ${sourceLabel}를 불러왔습니다`, description: `작성일: ${report.createdAt}` });
  }, [toast]);

  // ===== 본문 복사 =====
  const handleCopyBody = useCallback(() => {
    navigator.clipboard.writeText(postBody);
    toast({ title: "본문이 클립보드에 복사되었습니다" });
  }, [postBody]);

  // ===== 이미지 업로드 =====
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "이미지 파일만 업로드 가능합니다", variant: "destructive" });
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "파일 크기 제한 초과", description: "10MB 이하의 이미지만 업로드 가능합니다.", variant: "destructive" });
      return null;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload/image", { method: "POST", credentials: "include", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "업로드 실패");
      }
      const data = await res.json();
      setUploadedImages((prev) => [...prev, data.url]);
      return data.url as string;
    } catch (error: any) {
      toast({ title: "이미지 업로드 실패", description: error.message, variant: "destructive" });
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  const insertImageAtCursor = useCallback((url: string) => {
    const textarea = bodyRef.current;
    if (!textarea) {
      setPostBody((prev) => prev + `\n![image](${url})\n`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = postBody.slice(0, start);
    const after = postBody.slice(end);
    const imageMarkdown = `\n![image](${url})\n`;
    const newBody = before + imageMarkdown + after;
    setPostBody(newBody);
    requestAnimationFrame(() => {
      const pos = start + imageMarkdown.length;
      textarea.setSelectionRange(pos, pos);
      textarea.focus();
    });
  }, [postBody]);

  const handleImageUploadAndInsert = useCallback(async (file: File) => {
    const url = await uploadImage(file);
    if (url) {
      insertImageAtCursor(url);
      toast({ title: "이미지 삽입 완료", description: "본문에 이미지가 추가되었습니다." });
    }
  }, [uploadImage, insertImageAtCursor, toast]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleImageUploadAndInsert(file);
        return;
      }
    }
  }, [handleImageUploadAndInsert]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.type.startsWith("image/")) {
      e.preventDefault();
      handleImageUploadAndInsert(file);
    }
  }, [handleImageUploadAndInsert]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
  }, []);

  // ===== 상태 배지 =====
  function StatusBadgeComponent({ status }: { status: string }) {
    switch (status) {
      case "published":
        return (
          <Badge variant="default" className="bg-green-600 gap-1 text-xs">
            <CheckCircle2 className="w-3 h-3" /> 게시됨
          </Badge>
        );
      case "draft":
        return (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Edit3 className="w-3 h-3" /> 초안
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1 text-xs">
            <XCircle className="w-3 h-3" /> 실패
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      {/* ===== 상단: Keychain 상태 + 계정 설정 ===== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            스팀 블록체인 포스팅
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Steem Keychain 크롬 확장을 통해 스팀 블록체인에 보고서를 게시합니다.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {/* Keychain 상태 */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Keychain:</span>
              {keychainStatus === "checking" && (
                <Badge variant="outline" className="gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> 확인 중...
                </Badge>
              )}
              {keychainStatus === "available" && (
                <Badge variant="default" className="bg-green-600 gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 연결됨
                </Badge>
              )}
              {keychainStatus === "not-installed" && (
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="w-3 h-3" /> 미설치
                  </Badge>
                  <a
                    href="https://chromewebstore.google.com/detail/steem-keychain/jhgnbkkipaallpehbohjmkbjofjdmeid"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 underline flex items-center gap-1"
                  >
                    설치하기 <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={() => {
                setKeychainStatus("checking");
                setTimeout(() => {
                  setKeychainStatus(window.steem_keychain ? "available" : "not-installed");
                }, 500);
              }}>
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>

            {/* 스팀 계정 */}
            <div className="flex items-center gap-2">
              <Label htmlFor="steem-account" className="text-sm font-medium whitespace-nowrap">스팀 계정:</Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">@</span>
                <Input
                  id="steem-account"
                  value={steemAccount}
                  onChange={(e) => setSteemAccount(e.target.value)}
                  placeholder="steemit username"
                  className="w-40 h-8 text-sm"
                />
              </div>
              <a
                href={`https://steemit.com/@${steemAccount}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 flex items-center gap-1"
              >
                프로필 <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== 포스팅 작성 영역 ===== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Edit3 className="w-5 h-5" />
              {editingDraft ? "초안 편집" : "새 포스팅 작성"}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleOpenReportPicker} className="gap-1 text-xs text-purple-600 border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950">
                <BrainCircuit className="w-3 h-3" /> AI 보고서
              </Button>
              <Button variant="outline" size="sm" onClick={loadTemplate} className="gap-1 text-xs">
                <FileText className="w-3 h-3" /> 템플릿
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyBody} disabled={!postBody} className="gap-1 text-xs">
                <Copy className="w-3 h-3" /> 복사
              </Button>
              {editingDraft && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setEditingDraft(null);
                  setPostTitle(getDefaultTitle());
                  setPostBody("");
                  setTagsInput(DEFAULT_TAGS.join(", "));
                }} className="gap-1 text-xs text-muted-foreground">
                  취소
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 제목 */}
          <div>
            <Label htmlFor="post-title" className="text-sm font-medium">제목</Label>
            <Input
              id="post-title"
              value={postTitle}
              onChange={(e) => setPostTitle(e.target.value)}
              placeholder="포스팅 제목을 입력하세요"
              className="mt-1"
            />
          </div>

          {/* 태그 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="post-tags" className="text-sm font-medium">태그 (쉼표로 구분)</Label>
              <Input
                id="post-tags"
                value={tagsInput}
                onChange={(e) => {
                  setTagsInput(e.target.value);
                  const first = e.target.value.split(",")[0]?.trim();
                  if (first) setMainTag(first);
                }}
                placeholder="kr, etf, investment, market"
                className="mt-1"
              />
              <div className="flex gap-1 mt-1 flex-wrap">
                {tagsInput.split(",").map((t) => t.trim()).filter(Boolean).map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="main-tag" className="text-sm font-medium">메인 태그 (카테고리)</Label>
              <Input
                id="main-tag"
                value={mainTag}
                onChange={(e) => setMainTag(e.target.value)}
                placeholder="kr"
                className="mt-1"
              />
            </div>
          </div>

          {/* 본문 (마크다운) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="post-body" className="text-sm font-medium">본문 (Markdown)</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUploadAndInsert(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="h-6 text-[11px] gap-1 px-2"
                >
                  {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
                  이미지 첨부
                </Button>
                <span className="text-xs text-muted-foreground">
                  {isLoadingReport ? "보고서 불러오는 중..." : `${postBody.length} 자`}
                </span>
              </div>
            </div>
            {isLoadingReport ? (
              <div className="min-h-[400px] flex items-center justify-center border rounded-md bg-muted/20">
                <div className="text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                  <p className="text-sm text-muted-foreground">DB에서 최신 보고서를 불러오는 중...</p>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Textarea
                  ref={bodyRef}
                  id="post-body"
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  onPaste={handlePaste}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  placeholder="마크다운 형식으로 본문을 작성하세요...&#10;&#10;💡 이미지를 붙여넣기(Ctrl+V) 하거나 드래그하여 첨부할 수 있습니다."
                  className="min-h-[400px] font-mono text-sm"
                />
                {isUploading && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded-md">
                    <div className="text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">이미지 업로드 중...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handlePostToSteem}
              disabled={isPosting || !postTitle.trim() || !postBody.trim() || keychainStatus !== "available"}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {isPosting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Steem Keychain으로 포스팅
            </Button>

            <Button
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              disabled={!postTitle.trim() || !postBody.trim()}
              className="gap-2"
            >
              <Eye className="w-4 h-4" />
              미리보기
            </Button>

            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={saveMutation.isPending || updateMutation.isPending || !postTitle.trim() || !postBody.trim()}
              className="gap-2"
            >
              {(saveMutation.isPending || updateMutation.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {editingDraft ? "초안 수정" : "임시저장"}
            </Button>

            {keychainStatus === "not-installed" && (
              <p className="text-xs text-yellow-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Keychain 미설치 시 "임시저장" 후 Keychain 설치 후 포스팅 가능
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== 포스팅 이력 ===== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              포스팅 이력
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetchPosts()} disabled={isLoadingPosts}>
              {isLoadingPosts ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPosts ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">로딩 중...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">아직 포스팅 이력이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadgeComponent status={post.status} />
                      <span className="text-xs text-muted-foreground">
                        @{post.author} · {new Date(post.createdAt).toLocaleString("ko-KR")}
                      </span>
                    </div>
                    <h4 className="text-sm font-medium truncate">{post.title}</h4>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(() => {
                        try {
                          return JSON.parse(post.tags).map((t: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
                          ));
                        } catch {
                          return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{post.tags}</Badge>;
                        }
                      })()}
                    </div>
                    {post.errorMessage && (
                      <p className="text-xs text-red-500 mt-1 truncate">⚠️ {post.errorMessage}</p>
                    )}
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-1">
                    {post.steemUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => window.open(post.steemUrl!, "_blank")}
                      >
                        <Link2 className="w-3.5 h-3.5 text-blue-500" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setViewingPost(post)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {post.status === "draft" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEditDraft(post)}
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        if (window.confirm("이 포스팅 기록을 삭제하시겠습니까?")) {
                          deleteMutation.mutate(post.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== 포스트 미리보기 다이얼로그 ===== */}
      <Dialog open={!!viewingPost} onOpenChange={() => setViewingPost(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {viewingPost?.title}
            </DialogTitle>
          </DialogHeader>
          {viewingPost && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <StatusBadgeComponent status={viewingPost.status} />
                <span>@{viewingPost.author}</span>
                <span>·</span>
                <span>{new Date(viewingPost.createdAt).toLocaleString("ko-KR")}</span>
                {viewingPost.txId && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-xs">TX: {viewingPost.txId.substring(0, 12)}...</span>
                  </>
                )}
              </div>
              {viewingPost.steemUrl && (
                <a
                  href={viewingPost.steemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Steemit에서 보기
                </a>
              )}
              <div className="flex gap-1 flex-wrap">
                {(() => {
                  try {
                    return JSON.parse(viewingPost.tags).map((t: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                    ));
                  } catch {
                    return <Badge variant="outline" className="text-xs">{viewingPost.tags}</Badge>;
                  }
                })()}
              </div>
              <div className="border rounded-lg p-4 bg-muted/20">
                <pre className="whitespace-pre-wrap text-sm font-mono">{viewingPost.body}</pre>
              </div>
              {viewingPost.errorMessage && (
                <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <XCircle className="w-4 h-4" />
                    {viewingPost.errorMessage}
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                {viewingPost.status === "draft" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      handleEditDraft(viewingPost);
                      setViewingPost(null);
                    }}
                    className="gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> 편집하기
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(viewingPost.body);
                    toast({ title: "본문이 복사되었습니다" });
                  }}
                  className="gap-1"
                >
                  <Copy className="w-3 h-3" /> 본문 복사
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== 미리보기 다이얼로그 ===== */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              포스팅 미리보기
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-2 px-2">
            <div className="border rounded-lg p-6 bg-white dark:bg-slate-950">
              <div className="mb-4 pb-4 border-b">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-muted-foreground">@{steemAccount}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</span>
                </div>
                <h1 className="text-2xl font-bold">{postTitle || "(제목 없음)"}</h1>
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {tagsInput.split(",").map(t => t.trim()).filter(Boolean).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
              <div
                className="prose prose-sm dark:prose-invert max-w-none
                  [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3
                  [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2
                  [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2
                  [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_table]:my-3
                  [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted/50 [&_th]:font-medium [&_th]:text-left
                  [&_td]:border [&_td]:px-2 [&_td]:py-1
                  [&_blockquote]:border-l-4 [&_blockquote]:border-blue-400 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground
                  [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-3
                  [&_hr]:my-4
                  [&_a]:text-blue-600 [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: steemMarkdownToHtml(postBody) }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => {
              navigator.clipboard.writeText(postBody);
              toast({ title: "본문이 클립보드에 복사되었습니다" });
            }} className="gap-1">
              <Copy className="w-3 h-3" /> 본문 복사
            </Button>
            <Button size="sm" onClick={() => { setPreviewOpen(false); }} className="gap-1">
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== AI 보고서 선택 다이얼로그 ===== */}
      <Dialog open={reportPickerOpen} onOpenChange={(open) => { setReportPickerOpen(open); if (!open) setReportFilter("all"); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-purple-600" />
              AI 분석 보고서 선택
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-1 mb-2 flex-wrap">
            {([
              ["all", "전체"],
              ["strategy", "투자전략"],
              ["weekly-stats", "주간통계"],
              ["etf-realtime", "실시간ETF"],
            ] as const).map(([key, label]) => {
              const count = key === "all"
                ? reportList.length
                : reportList.filter(r => key === "strategy" ? (r.source !== "weekly-stats" && r.source !== "etf-realtime") : r.source === key).length;
              return (
                <Button
                  key={key}
                  variant={reportFilter === key ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setReportFilter(key)}
                >
                  {label} <span className="text-[10px] opacity-70">({count})</span>
                </Button>
              );
            })}
          </div>
          <div className="overflow-y-auto flex-1 -mx-2 px-2">
            {isLoadingReportList ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
                <span className="text-sm text-muted-foreground">보고서 목록 불러오는 중...</span>
              </div>
            ) : reportList.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">저장된 AI 보고서가 없습니다.</p>
                <p className="text-xs text-muted-foreground mt-1">투자전략 탭에서 AI 분석을 실행하고 저장해주세요.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reportList
                  .filter(r => {
                    if (reportFilter === "all") return true;
                    if (reportFilter === "strategy") return r.source !== "weekly-stats" && r.source !== "etf-realtime";
                    return r.source === reportFilter;
                  })
                  .map((report) => (
                  <button
                    key={report.id}
                    onClick={() => handleSelectReport(report)}
                    className="w-full text-left border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={report.source === "etf-realtime" ? "default" : report.source === "weekly-stats" ? "default" : "secondary"} className={`text-[10px] ${report.source === "weekly-stats" ? "bg-indigo-600" : ""}`}>
                          {report.source === "etf-realtime" ? "실시간ETF" : report.source === "weekly-stats" ? "주간통계" : "투자전략"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {periodLabelMap[report.period] || "일간"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{report.createdBy}</span>
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {report.createdAt}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {report.prompt || "프롬프트 없음"}
                    </p>
                    <p className="text-xs mt-1.5 line-clamp-2 text-foreground/80">
                      {(report.result?.analysis || "").replace(/<[^>]+>/g, "").slice(0, 150)}...
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function steemMarkdownToHtml(md: string): string {
  let html = md
    .replace(/^---$/gm, '<hr/>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');

  html = html.replace(/<\/blockquote>(<br\/>)*<blockquote>/g, '<br/>');

  return html;
}
