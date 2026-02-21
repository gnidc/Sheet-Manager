import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Plus,
  Minus,
  X,
  ExternalLink,
  ThumbsUp,
  MessageCircle,
  DollarSign,
  User,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Heart,
  AlertTriangle,
  CheckCircle2,
  Type,
  MessageSquare,
  Reply,
  BookOpen,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  requestVote: (
    account: string,
    permlink: string,
    author: string,
    weight: number,
    callback: (response: SteemKeychainResponse) => void
  ) => void;
  requestHandshake: (callback: (response: SteemKeychainResponse) => void) => void;
}

declare global {
  interface Window {
    steem_keychain?: SteemKeychain;
  }
}

const STORAGE_KEY = "steem_reader_authors";
const DEFAULT_AUTHORS = [
  "seraphim502", "jungjunghoon", "skuld2000", "banguri", "prettyjoo", "yann03", "kimyg18", "epitt925",
  "talkit", "goodhello", "soonhwan", "lucky2015", "parkname", "steem-agora", "pys", "oldstone",
  "cjsdns", "blockstudent", "ayogom", "greentree", "blackeyedm", "futurecurrency", "libera-tor",
  "yonggyu01", "happycoachmate", "niikii", "cancerdoctor", "newiz", "successgr", "peterchung", "jamislee",
  "tradingideas", "khaiyoui", "rtytf2", "anpigon", "centering", "leemikyung", "luminaryhmo", "kyju",
  "powerego", "ezen", "yoghurty",
];

interface SteemPost {
  author: string;
  permlink: string;
  title: string;
  body: string;
  created: string;
  category: string;
  tags: string[];
  net_votes: number;
  children: number;
  pending_payout_value: string;
  total_payout_value: string;
  curator_payout_value: string;
  url: string;
  isReblog: boolean;
  voters?: string[]; // 보팅한 사용자 목록
}

const STORAGE_VERSION_KEY = "steem_reader_authors_v";
const CURRENT_VERSION = "2"; // 버전 변경 시 기본 목록으로 리셋

function getAuthorsFromStorage(): string[] {
  try {
    const savedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
    // 버전이 다르면 기본 목록으로 리셋
    if (savedVersion !== CURRENT_VERSION) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_AUTHORS));
      localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
      return [...DEFAULT_AUTHORS];
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // 기존 데이터에 공백이 포함된 경우 정리
        const cleaned = parsed.map((a: string) => a.trim().replace("@", "").toLowerCase()).filter((a: string) => a.length > 0);
        // 중복 제거
        const unique = [...new Set(cleaned)] as string[];
        // 정리된 데이터 다시 저장
        if (JSON.stringify(unique) !== JSON.stringify(parsed)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
        }
        return unique;
      }
    }
  } catch {}
  localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
  return [...DEFAULT_AUTHORS];
}

function saveAuthorsToStorage(authors: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(authors));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "Z"); // Steem은 UTC
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (hours < 1) return "방금 전";
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

function formatPayout(pending: string, total: string, curator: string): string {
  const p = parseFloat(pending) || 0;
  const t = parseFloat(total) || 0;
  const c = parseFloat(curator) || 0;
  const sum = p + t + c;
  if (sum === 0) return "$0.00";
  return `$${sum.toFixed(2)}`;
}

// Markdown을 간단히 텍스트로 변환
function stripMarkdown(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, "") // 이미지 제거
    .replace(/\[([^\]]*)\]\(.*?\)/g, "$1") // 링크 텍스트만
    .replace(/#{1,6}\s*/g, "") // 헤더 제거
    .replace(/\*\*|__/g, "") // 볼드 제거
    .replace(/\*|_/g, "") // 이탤릭 제거
    .replace(/`{1,3}[^`]*`{1,3}/g, "") // 코드 제거
    .replace(/<[^>]+>/g, "") // HTML 태그 제거
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

export default function SteemReader() {
  const { toast } = useToast();
  const [authors, setAuthors] = useState<string[]>(getAuthorsFromStorage);
  const [newAuthor, setNewAuthor] = useState("");
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [selectedAuthorFilter, setSelectedAuthorFilter] = useState<string>("all");

  // ===== 보팅 관련 상태 =====
  const [steemAccount, setSteemAccount] = useState(() => localStorage.getItem("steem_account") || "seraphim502");
  const [keychainStatus, setKeychainStatus] = useState<"checking" | "available" | "not-installed">("checking");
  const [votingPost, setVotingPost] = useState<string | null>(null); // "author/permlink" of currently voting post
  const [voteWeight, setVoteWeight] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem("steem_vote_weight") || "100");
    return isNaN(saved) ? 100 : saved;
  });
  const [votingInProgress, setVotingInProgress] = useState<string | null>(null); // key of post being voted

  // ===== 폰트 크기 상태 =====
  const [bodyFontSize, setBodyFontSize] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem("steem_body_font_size") || "14");
    return isNaN(saved) ? 14 : saved;
  });
  const [listFontSize, setListFontSize] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem("steem_list_font_size") || "14");
    return isNaN(saved) ? 14 : saved;
  });

  const increaseFontSize = useCallback(() => {
    setBodyFontSize((prev) => {
      const next = Math.min(prev + 2, 28);
      localStorage.setItem("steem_body_font_size", String(next));
      return next;
    });
  }, []);

  const decreaseFontSize = useCallback(() => {
    setBodyFontSize((prev) => {
      const next = Math.max(prev - 2, 10);
      localStorage.setItem("steem_body_font_size", String(next));
      return next;
    });
  }, []);

  const increaseListFont = useCallback(() => {
    setListFontSize((prev) => {
      const next = Math.min(prev + 2, 24);
      localStorage.setItem("steem_list_font_size", String(next));
      return next;
    });
  }, []);

  const decreaseListFont = useCallback(() => {
    setListFontSize((prev) => {
      const next = Math.max(prev - 2, 10);
      localStorage.setItem("steem_list_font_size", String(next));
      return next;
    });
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
    const timer = setTimeout(checkKeychain, 1500);
    if (window.steem_keychain) {
      setKeychainStatus("available");
      clearTimeout(timer);
    }
    return () => clearTimeout(timer);
  }, []);

  // ===== 스팀 계정명 동기화 =====
  useEffect(() => {
    localStorage.setItem("steem_account", steemAccount);
  }, [steemAccount]);

  // ===== 보팅 가중치 저장 =====
  useEffect(() => {
    localStorage.setItem("steem_vote_weight", String(voteWeight));
  }, [voteWeight]);

  // ===== 보팅 핸들러 =====
  const handleVote = useCallback((author: string, permlink: string) => {
    const key = `${author}/${permlink}`;

    if (!window.steem_keychain) {
      toast({
        title: "Steem Keychain 미설치",
        description: "크롬 웹스토어에서 Steem Keychain을 설치해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!steemAccount.trim()) {
      toast({ title: "스팀 계정명을 입력해주세요", variant: "destructive" });
      return;
    }

    setVotingInProgress(key);

    // weight: Steem Keychain은 10000 = 100%
    const weight = Math.round(voteWeight * 100);

    window.steem_keychain!.requestVote(
      steemAccount,
      permlink,
      author,
      weight,
      (response: SteemKeychainResponse) => {
        setVotingInProgress(null);

        if (response.success) {
          toast({
            title: "✅ 보팅 성공!",
            description: `@${author}의 글에 ${voteWeight}% 보팅하였습니다.`,
          });
        } else {
          const errorMsg = response.error || response.message || "알 수 없는 오류";
          toast({
            title: "보팅 실패",
            description: errorMsg,
            variant: "destructive",
          });
        }
      }
    );
  }, [steemAccount, voteWeight, toast]);

  // 저장소 동기화
  useEffect(() => {
    saveAuthorsToStorage(authors);
  }, [authors]);

  // 통합 피드 조회
  const {
    data: feedData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["/api/steem/feed", authors],
    queryFn: async () => {
      const res = await fetch("/api/steem/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authors, limit: 20 }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("스팀 피드 조회 실패");
      return res.json() as Promise<{ posts: SteemPost[]; authors: string[] }>;
    },
    enabled: authors.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // ===== 내 글에 달린 Replies 조회 =====
  interface SteemReply {
    author: string;
    permlink: string;
    body: string;
    created: string;
    parent_author: string;
    parent_permlink: string;
    net_votes: number;
    children: number;
    url: string;
  }

  const {
    data: repliesData,
    isLoading: isRepliesLoading,
    refetch: refetchReplies,
    isFetching: isRepliesFetching,
  } = useQuery({
    queryKey: ["/api/steem/replies", steemAccount],
    queryFn: async () => {
      const account = steemAccount.trim().toLowerCase();
      if (!account) throw new Error("스팀 계정 없음");
      const res = await fetch(`/api/steem/replies/${account}?limit=7`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Replies 조회 실패");
      return res.json() as Promise<{ replies: SteemReply[]; account: string }>;
    },
    enabled: !!steemAccount.trim(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // 개별 글 전문 가져오기
  const {
    data: fullPost,
    isLoading: isLoadingFull,
  } = useQuery({
    queryKey: ["/api/steem/post", expandedPost],
    queryFn: async () => {
      if (!expandedPost) return null;
      const [author, permlink] = expandedPost.split("/");
      const res = await fetch(`/api/steem/post/${author}/${permlink}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("글 조회 실패");
      return res.json() as Promise<SteemPost>;
    },
    enabled: !!expandedPost,
    staleTime: 10 * 60 * 1000,
  });

  const addAuthor = useCallback(() => {
    const id = newAuthor.trim().replace("@", "").toLowerCase();
    if (!id) return;
    if (authors.includes(id)) {
      toast({ title: "이미 추가된 ID입니다", variant: "destructive" });
      return;
    }
    setAuthors((prev) => [...prev, id]);
    setNewAuthor("");
    toast({ title: `@${id} 추가됨` });
  }, [newAuthor, authors, toast]);

  const removeAuthor = useCallback(
    (id: string) => {
      setAuthors((prev) => prev.filter((a) => a !== id));
      if (selectedAuthorFilter === id) setSelectedAuthorFilter("all");
      toast({ title: `@${id} 제거됨` });
    },
    [selectedAuthorFilter, toast]
  );

  const filteredPosts = feedData?.posts?.filter((post) => {
    if (selectedAuthorFilter === "all") return true;
    return post.author === selectedAuthorFilter;
  }) || [];

  // ===== Notion 저장 기능 =====
  const [selectedForNotion, setSelectedForNotion] = useState<Set<string>>(new Set());

  const toggleNotionSelect = useCallback((key: string) => {
    setSelectedForNotion(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedForNotion.size === filteredPosts.length) {
      setSelectedForNotion(new Set());
    } else {
      setSelectedForNotion(new Set(filteredPosts.map(p => `${p.author}/${p.permlink}`)));
    }
  }, [filteredPosts, selectedForNotion.size]);

  const { data: notionSteemConfig } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/user/notion-config", "steem"],
    queryFn: async () => {
      const res = await fetch("/api/user/notion-config?purpose=steem", { credentials: "include" });
      if (!res.ok) return { configured: false };
      return res.json();
    },
  });

  const notionExportMutation = useMutation({
    mutationFn: async (posts: SteemPost[]) => {
      const res = await fetch("/api/steem/export-notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          posts: posts.map(p => ({
            title: p.title,
            author: p.author,
            created: p.created,
            body: stripMarkdown(p.body).slice(0, 2000),
            url: p.url || `https://steemit.com/@${p.author}/${p.permlink}`,
            permlink: p.permlink,
            tags: p.tags,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Notion 내보내기 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedForNotion(new Set());
      toast({ title: data.message || "Notion 내보내기 완료" });
    },
    onError: (error: Error) => {
      toast({ title: "Notion 내보내기 실패", description: error.message, variant: "destructive" });
    },
  });

  const handleNotionExport = useCallback(() => {
    const selected = filteredPosts.filter(p => selectedForNotion.has(`${p.author}/${p.permlink}`));
    if (selected.length === 0) {
      toast({ title: "선택된 글이 없습니다", variant: "destructive" });
      return;
    }
    notionExportMutation.mutate(selected);
  }, [filteredPosts, selectedForNotion, notionExportMutation, toast]);

  const handleSingleNotionExport = useCallback((post: SteemPost) => {
    notionExportMutation.mutate([post]);
  }, [notionExportMutation]);

  return (
    <div className="space-y-4">
      {/* 사용자 ID 관리 + 보팅 설정 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            스팀 사용자 관리
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 추가 입력 */}
          <div className="flex gap-2">
            <Input
              placeholder="스팀 ID 입력 (예: seraphim502)"
              value={newAuthor}
              onChange={(e) => setNewAuthor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAuthor()}
              className="flex-1"
            />
            <Button onClick={addAuthor} size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> 추가
            </Button>
          </div>

          {/* 등록된 사용자 목록 */}
          <div className="flex flex-wrap gap-2">
            {authors.map((author) => (
              <Badge
                key={author}
                variant={selectedAuthorFilter === author ? "default" : "secondary"}
                className="cursor-pointer gap-1 py-1 px-2"
                onClick={() =>
                  setSelectedAuthorFilter((prev) => (prev === author ? "all" : author))
                }
              >
                @{author}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAuthor(author);
                  }}
                  className="ml-1 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedAuthorFilter !== "all" && (
              <Badge
                variant="outline"
                className="cursor-pointer"
                onClick={() => setSelectedAuthorFilter("all")}
              >
                전체보기
              </Badge>
            )}
          </div>

          {/* 보팅 설정 */}
          <div className="pt-3 border-t space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Keychain 상태 */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Keychain:</span>
                {keychainStatus === "checking" && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 gap-0.5">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> 확인 중
                  </Badge>
                )}
                {keychainStatus === "available" && (
                  <Badge variant="default" className="bg-green-600 text-[10px] py-0 px-1.5 gap-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" /> 연결됨
                  </Badge>
                )}
                {keychainStatus === "not-installed" && (
                  <Badge variant="destructive" className="text-[10px] py-0 px-1.5 gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" /> 미설치
                  </Badge>
                )}
              </div>

              {/* 스팀 계정 */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">@</span>
                <Input
                  value={steemAccount}
                  onChange={(e) => setSteemAccount(e.target.value)}
                  placeholder="내 스팀 ID"
                  className="w-32 h-7 text-xs"
                />
              </div>

              {/* 보팅 가중치 */}
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Heart className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <Slider
                  value={[voteWeight]}
                  onValueChange={([v]) => setVoteWeight(v)}
                  min={1}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs font-bold text-red-500 w-10 text-right">{voteWeight}%</span>
              </div>
            </div>
            {keychainStatus === "not-installed" && (
              <a
                href="https://chromewebstore.google.com/detail/steem-keychain/jhgnbkkipaallpehbohjmkbjofjdmeid"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-500 underline flex items-center gap-1"
              >
                Steem Keychain 설치하기 <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== 최근 Replies 섹션 ===== */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Reply className="h-4 w-4 text-blue-500" />
              최근 Replies
              <span className="text-xs font-normal text-muted-foreground">
                @{steemAccount}
              </span>
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <a
                href={`https://www.steempro.com/@${steemAccount.trim()}/replies`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5"
              >
                SteemPro <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => refetchReplies()}
                disabled={isRepliesFetching}
              >
                <RefreshCw className={`h-3 w-3 ${isRepliesFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isRepliesLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : repliesData?.replies && repliesData.replies.length > 0 ? (
            <div className="space-y-1.5">
              {repliesData.replies.map((reply, idx) => {
                const replyBody = stripMarkdown(reply.body).slice(0, 120);
                const timeAgo = (() => {
                  const diff = Date.now() - new Date(reply.created + "Z").getTime();
                  const mins = Math.floor(diff / 60000);
                  if (mins < 60) return `${mins}분 전`;
                  const hours = Math.floor(mins / 60);
                  if (hours < 24) return `${hours}시간 전`;
                  const days = Math.floor(hours / 24);
                  return `${days}일 전`;
                })();
                return (
                  <a
                    key={`${reply.author}-${reply.permlink}-${idx}`}
                    href={reply.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <MessageSquare className="h-3 w-3 text-blue-400 shrink-0" />
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        @{reply.author}
                      </span>
                      <span className="text-[10px] text-muted-foreground">→</span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {reply.parent_permlink.slice(0, 30)}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                        {timeAgo}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 pl-4">
                      {replyBody || "(내용 없음)"}
                    </p>
                  </a>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">
              최근 replies가 없습니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 피드 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {filteredPosts.length > 0 && (
            <Checkbox
              checked={selectedForNotion.size === filteredPosts.length && filteredPosts.length > 0}
              onCheckedChange={toggleSelectAll}
              className="h-4 w-4"
            />
          )}
          <h3 className="text-sm font-medium text-muted-foreground">
            {selectedAuthorFilter === "all"
              ? `최근 3일 전체글 (${filteredPosts.length}건)`
              : `@${selectedAuthorFilter}의 글 (${filteredPosts.length}건)`}
            {selectedForNotion.size > 0 && (
              <span className="text-primary ml-1">({selectedForNotion.size}건 선택)</span>
            )}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {selectedForNotion.size > 0 && notionSteemConfig?.configured && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs h-7 text-purple-600 border-purple-300 hover:bg-purple-50"
              onClick={handleNotionExport}
              disabled={notionExportMutation.isPending}
            >
              {notionExportMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
              Notion ({selectedForNotion.size})
            </Button>
          )}
          {selectedForNotion.size > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedForNotion(new Set())}>
              선택해제
            </Button>
          )}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={decreaseListFont}
              disabled={listFontSize <= 10}
              title="리스트 글자 축소"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-xs font-medium w-7 text-center text-muted-foreground">
              {listFontSize}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={increaseListFont}
              disabled={listFontSize >= 24}
              title="리스트 글자 확대"
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Type className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* 글 목록 */}
      {!isLoading && filteredPosts.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {authors.length === 0
            ? "스팀 ID를 추가해주세요"
            : "조회된 글이 없습니다"}
        </div>
      )}

      <div className="space-y-2">
        {filteredPosts.map((post) => {
          const key = `${post.author}/${post.permlink}`;
          const isExpanded = expandedPost === key;

          return (
            <Card
              key={key}
              className={`transition-all ${isExpanded ? "ring-1 ring-primary/30" : ""}`}
            >
              <CardContent className="p-3">
                {/* 글 헤더 */}
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={selectedForNotion.has(key)}
                    onCheckedChange={() => toggleNotionSelect(key)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <Badge variant="outline" className="text-xs py-0 px-1.5 shrink-0">
                        @{post.author}
                      </Badge>
                      {post.isReblog && (
                        <Badge variant="secondary" className="text-xs py-0 px-1.5">
                          리블로그
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(post.created)}
                      </span>
                    </div>

                    <button
                      className="text-left w-full"
                      onClick={() => setExpandedPost(isExpanded ? null : key)}
                    >
                      <h4
                        className="font-medium leading-snug hover:text-primary transition-colors line-clamp-2"
                        style={{ fontSize: `${listFontSize}px` }}
                      >
                        {post.title}
                      </h4>
                    </button>

                    {/* 미리보기 (축소 상태) */}
                    {!isExpanded && (
                      <p
                        className="text-muted-foreground mt-1 line-clamp-2"
                        style={{ fontSize: `${Math.max(listFontSize - 2, 10)}px` }}
                      >
                        {stripMarkdown(post.body)}
                      </p>
                    )}

                    {/* 통계 + 보팅 버튼 */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {/* 보팅 버튼 */}
                      {(() => {
                        const alreadyVoted = post.voters && post.voters.length > 0 && post.voters.includes(steemAccount.trim().toLowerCase());
                        return (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-6 px-1.5 gap-0.5 text-xs ${
                              alreadyVoted
                                ? "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                : "hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                            }`}
                            disabled={
                              keychainStatus !== "available" ||
                              votingInProgress === `${post.author}/${post.permlink}` ||
                              !steemAccount.trim()
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              if (alreadyVoted) {
                                toast({ title: "이미 보팅한 글입니다", description: `@${steemAccount}가 이미 보팅했습니다.` });
                                return;
                              }
                              if (votingPost === `${post.author}/${post.permlink}`) {
                                handleVote(post.author, post.permlink);
                                setVotingPost(null);
                              } else {
                                setVotingPost(`${post.author}/${post.permlink}`);
                              }
                            }}
                            title={
                              alreadyVoted
                                ? "이미 보팅한 글입니다"
                                : keychainStatus !== "available"
                                  ? "Steem Keychain을 설치해주세요"
                                  : `${voteWeight}% 보팅`
                            }
                          >
                            {votingInProgress === `${post.author}/${post.permlink}` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" />
                            ) : (
                              <Heart
                                className={`h-3.5 w-3.5 ${
                                  alreadyVoted
                                    ? "text-red-500 fill-red-500"
                                    : votingPost === `${post.author}/${post.permlink}`
                                      ? "text-red-500 fill-red-500"
                                      : ""
                                }`}
                              />
                            )}
                          </Button>
                        );
                      })()}
                      <span className="flex items-center gap-0.5">
                        <ThumbsUp className="h-3 w-3" />
                        {post.net_votes}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <MessageCircle className="h-3 w-3" />
                        {post.children}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <DollarSign className="h-3 w-3" />
                        {formatPayout(
                          post.pending_payout_value,
                          post.total_payout_value,
                          post.curator_payout_value
                        )}
                      </span>
                      {post.tags.length > 0 && (
                        <span className="flex items-center gap-1">
                          {post.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[10px] bg-muted px-1 rounded">
                              #{tag}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>

                    {/* 보팅 확인 패널 */}
                    {votingPost === `${post.author}/${post.permlink}` && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800/50 flex items-center gap-2 flex-wrap">
                        <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500 shrink-0" />
                        <span className="text-xs font-medium text-red-600 dark:text-red-400">
                          @{steemAccount} → @{post.author} ({voteWeight}%)
                        </span>
                        <Button
                          size="sm"
                          className="h-6 text-xs gap-1 bg-red-500 hover:bg-red-600 text-white"
                          disabled={votingInProgress !== null}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVote(post.author, post.permlink);
                            setVotingPost(null);
                          }}
                        >
                          {votingInProgress === `${post.author}/${post.permlink}` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Heart className="h-3 w-3" />
                          )}
                          보팅하기
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVotingPost(null);
                          }}
                        >
                          취소
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* 외부 링크 & Notion 저장 & 접기/펼치기 */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary"
                      title="Steemit에서 보기"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    {notionSteemConfig?.configured && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSingleNotionExport(post); }}
                        className="text-muted-foreground hover:text-purple-600"
                        title="Notion에 저장"
                        disabled={notionExportMutation.isPending}
                      >
                        <BookOpen className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedPost(isExpanded ? null : key)}
                      className="text-muted-foreground hover:text-primary"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* 확장된 본문 */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t">
                    {isLoadingFull ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : fullPost ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        {/* 폰트 크기 조절 바 */}
                        <div className="flex items-center justify-between mb-2 not-prose">
                          <span className="text-xs text-muted-foreground">본문</span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => { e.stopPropagation(); decreaseFontSize(); }}
                              disabled={bodyFontSize <= 10}
                              title="글자 축소"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-xs font-medium w-8 text-center text-muted-foreground">
                              {bodyFontSize}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => { e.stopPropagation(); increaseFontSize(); }}
                              disabled={bodyFontSize >= 28}
                              title="글자 확대"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Type className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
                          </div>
                        </div>
                        <div
                          className="whitespace-pre-wrap leading-relaxed break-words"
                          style={{ maxHeight: "500px", overflowY: "auto", fontSize: `${bodyFontSize}px` }}
                        >
                          {fullPost.body}
                        </div>
                        <div className="flex justify-end mt-3">
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            Steemit에서 전체 보기 <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">로딩 중...</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

