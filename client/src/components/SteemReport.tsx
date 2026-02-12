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

// ===== localStorage에서 AI 트렌드 분석 보고서 불러오기 =====
function loadAIAnalysisFromStorage(): string | null {
  try {
    const saved = localStorage.getItem("etf_analysis_result");
    if (!saved) return null;
    const data = JSON.parse(saved) as {
      analysis: string;
      analyzedAt: string;
      dataPoints?: { risingCount: number; fallingCount: number; newsCount: number; market: string };
    };
    if (!data.analysis) return null;

    const lines: string[] = [];
    lines.push(`# Comment`);
    lines.push('');
    lines.push('');
    lines.push('');
    lines.push(`# 📊 AI 트렌드 분석 보고서`);
    lines.push('');
    lines.push(`> 분석 시간: ${data.analyzedAt}`);
    if (data.dataPoints) {
      lines.push(`> 📈 상승 ETF ${data.dataPoints.risingCount}개 | 📉 하락 ETF ${data.dataPoints.fallingCount}개 | 📰 뉴스 ${data.dataPoints.newsCount}건 | ${data.dataPoints.market || ""}`);
    }
    lines.push('');
    lines.push(data.analysis);
    lines.push('');
    lines.push('---');
    lines.push('*이 보고서는 AI(Gemini)가 실시간 데이터를 기반으로 자동 생성한 내용입니다.*');
    lines.push('*데이터 출처: 네이버 금융, FnGuide, 한국투자증권 API*');
    return lines.join('\n');
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

function getDefaultTitle(): string {
  return `(${getTodayYYMMDD()}) 오늘의 자산시장 동향`;
}

export default function SteemReport() {
  const { toast } = useToast();
  const [keychainStatus, setKeychainStatus] = useState<"checking" | "available" | "not-installed">("checking");

  // ===== 폼 상태 =====
  const [steemAccount, setSteemAccount] = useState(() => localStorage.getItem("steem_account") || "seraphim502");
  const [postTitle, setPostTitle] = useState(getDefaultTitle());
  const [postBody, setPostBody] = useState(() => loadAIAnalysisFromStorage() || "");
  const [tagsInput, setTagsInput] = useState(DEFAULT_TAGS.join(", "));
  const [mainTag, setMainTag] = useState("kr");
  const [isPosting, setIsPosting] = useState(false);
  const [viewingPost, setViewingPost] = useState<SteemPost | null>(null);
  const [editingDraft, setEditingDraft] = useState<SteemPost | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

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

    const jsonMetadata = JSON.stringify({
      tags,
      app: "sheet-manager/1.0",
      format: "markdown",
      image: [],
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

  // ===== AI 분석 보고서 불러오기 =====
  const handleLoadAIReport = useCallback(() => {
    const aiReport = loadAIAnalysisFromStorage();
    if (aiReport) {
      setPostBody(aiReport);
      toast({ title: "✅ AI 트렌드 분석 보고서를 불러왔습니다" });
    } else {
      toast({
        title: "보고서 없음",
        description: "AI 트렌드 분석 보고서가 없습니다. ETF실시간 탭에서 먼저 AI 분석을 실행해주세요.",
        variant: "destructive",
      });
    }
  }, []);

  // ===== 본문 복사 =====
  const handleCopyBody = useCallback(() => {
    navigator.clipboard.writeText(postBody);
    toast({ title: "본문이 클립보드에 복사되었습니다" });
  }, [postBody]);

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
              <Button variant="outline" size="sm" onClick={handleLoadAIReport} className="gap-1 text-xs text-purple-600 border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950">
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
              <span className="text-xs text-muted-foreground">{postBody.length} 자</span>
            </div>
            <Textarea
              ref={bodyRef}
              id="post-body"
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              placeholder="마크다운 형식으로 본문을 작성하세요..."
              className="min-h-[400px] font-mono text-sm"
            />
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
    </div>
  );
}

