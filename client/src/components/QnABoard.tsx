import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageCircle,
  Plus,
  ArrowLeft,
  Send,
  Trash2,
  Pencil,
  MessageSquare,
  Lightbulb,
  HelpCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";

interface QnaPost {
  id: number;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
  title: string;
  content: string;
  category: string | null;
  replyCount: number | null;
  createdAt: string;
  updatedAt: string;
  replies?: QnaReply[];
}

interface QnaReply {
  id: number;
  postId: number;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
  content: string;
  createdAt: string;
}

const categoryLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  improvement: { label: "개선제안", icon: <Lightbulb className="w-3.5 h-3.5" />, color: "text-amber-600 bg-amber-50 border-amber-200" },
  question: { label: "질문", icon: <HelpCircle className="w-3.5 h-3.5" />, color: "text-blue-600 bg-blue-50 border-blue-200" },
  general: { label: "일반", icon: <MessageSquare className="w-3.5 h-3.5" />, color: "text-gray-600 bg-gray-50 border-gray-200" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatFullDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function QnABoard() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "detail" | "write" | "edit">("list");
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [writeTitle, setWriteTitle] = useState("");
  const [writeContent, setWriteContent] = useState("");
  const [writeCategory, setWriteCategory] = useState("general");
  const [replyContent, setReplyContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("general");

  const { isAdmin, isLoggedIn, userId } = useAuth();
  const { toast } = useToast();
  const [hasNewPosts, setHasNewPosts] = useState(false);

  const QNA_LAST_SEEN_KEY = "qna_last_seen_time";

  const { data: latestPosts = [] } = useQuery<QnaPost[]>({
    queryKey: ["/api/qna/posts", "notification-check"],
    queryFn: () => apiRequest("GET", "/api/qna/posts").then((r) => r.json()),
    enabled: isAdmin && !open,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  useEffect(() => {
    if (!isAdmin || open || latestPosts.length === 0) return;
    const lastSeen = localStorage.getItem(QNA_LAST_SEEN_KEY);
    const lastSeenTime = lastSeen ? new Date(lastSeen).getTime() : 0;
    const hasNew = latestPosts.some(
      (post) => new Date(post.createdAt).getTime() > lastSeenTime
    );
    setHasNewPosts(hasNew);
  }, [isAdmin, open, latestPosts]);

  const markAsSeen = useCallback(() => {
    localStorage.setItem(QNA_LAST_SEEN_KEY, new Date().toISOString());
    setHasNewPosts(false);
  }, []);

  // 게시글 목록
  const { data: posts = [], isLoading: postsLoading } = useQuery<QnaPost[]>({
    queryKey: ["/api/qna/posts"],
    queryFn: () => apiRequest("GET", "/api/qna/posts").then((r) => r.json()),
    enabled: open,
    refetchInterval: open ? 30000 : false,
  });

  // 게시글 상세
  const { data: postDetail, isLoading: detailLoading } = useQuery<QnaPost>({
    queryKey: ["/api/qna/posts", selectedPostId],
    queryFn: () => apiRequest("GET", `/api/qna/posts/${selectedPostId}`).then((r) => r.json()),
    enabled: !!selectedPostId && view === "detail",
  });

  // 게시글 작성
  const createPostMutation = useMutation({
    mutationFn: (data: { title: string; content: string; category: string }) =>
      apiRequest("POST", "/api/qna/posts", data).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "게시글이 등록되었습니다" });
      setWriteTitle("");
      setWriteContent("");
      setWriteCategory("general");
      setView("list");
      queryClient.invalidateQueries({ queryKey: ["/api/qna/posts"] });
    },
    onError: (err: any) => {
      toast({ title: "등록 실패", description: err.message, variant: "destructive" });
    },
  });

  // 게시글 수정
  const updatePostMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; title: string; content: string; category: string }) =>
      apiRequest("PATCH", `/api/qna/posts/${id}`, data).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "게시글이 수정되었습니다" });
      setView("detail");
      queryClient.invalidateQueries({ queryKey: ["/api/qna/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qna/posts", selectedPostId] });
    },
    onError: (err: any) => {
      toast({ title: "수정 실패", description: err.message, variant: "destructive" });
    },
  });

  // 게시글 삭제
  const deletePostMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/qna/posts/${id}`),
    onSuccess: () => {
      toast({ title: "게시글이 삭제되었습니다" });
      setSelectedPostId(null);
      setView("list");
      queryClient.invalidateQueries({ queryKey: ["/api/qna/posts"] });
    },
    onError: (err: any) => {
      toast({ title: "삭제 실패", description: err.message, variant: "destructive" });
    },
  });

  // 댓글 작성
  const createReplyMutation = useMutation({
    mutationFn: (data: { postId: number; content: string }) =>
      apiRequest("POST", `/api/qna/posts/${data.postId}/replies`, { content: data.content }).then((r) => r.json()),
    onSuccess: () => {
      setReplyContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/qna/posts", selectedPostId] });
      queryClient.invalidateQueries({ queryKey: ["/api/qna/posts"] });
    },
    onError: (err: any) => {
      toast({ title: "댓글 등록 실패", description: err.message, variant: "destructive" });
    },
  });

  // 댓글 삭제
  const deleteReplyMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/qna/replies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qna/posts", selectedPostId] });
      queryClient.invalidateQueries({ queryKey: ["/api/qna/posts"] });
    },
    onError: (err: any) => {
      toast({ title: "댓글 삭제 실패", description: err.message, variant: "destructive" });
    },
  });

  const handleOpenPost = (postId: number) => {
    setSelectedPostId(postId);
    setView("detail");
  };

  const handleStartEdit = () => {
    if (postDetail) {
      setEditTitle(postDetail.title);
      setEditContent(postDetail.content);
      setEditCategory(postDetail.category || "general");
      setView("edit");
    }
  };

  const handleBack = () => {
    if (view === "detail" || view === "write") {
      setView("list");
      setSelectedPostId(null);
    } else if (view === "edit") {
      setView("detail");
    }
  };

  const canModify = (itemUserId: number | null) => {
    if (isAdmin) return true;
    if (!userId || !itemUserId) return false;
    return userId === itemUserId;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o && isAdmin) { markAsSeen(); } if (!o) { setView("list"); setSelectedPostId(null); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="relative gap-2 border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950">
          <MessageCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Q&A</span>
          {isAdmin && hasNewPosts && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2">
            {view !== "list" && (
              <Button variant="ghost" size="sm" onClick={handleBack} className="h-7 w-7 p-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <DialogTitle className="text-lg">
              {view === "list" && "💬 개선제안 및 Q&A"}
              {view === "detail" && "게시글 상세"}
              {view === "write" && "새 글 작성"}
              {view === "edit" && "글 수정"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          {/* === 게시글 목록 === */}
          {view === "list" && (
            <div className="space-y-3">
              {/* 글쓰기 버튼 */}
              {isLoggedIn && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setView("write")} className="gap-1.5">
                    <Plus className="w-4 h-4" /> 글쓰기
                  </Button>
                </div>
              )}
              {!isLoggedIn && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  글을 작성하시려면 로그인해 주세요.
                </p>
              )}

              {postsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">등록된 게시글이 없습니다</p>
                  <p className="text-xs mt-1">첫 번째 글을 작성해 보세요!</p>
                </div>
              ) : (
                <div className="divide-y">
                  {posts.map((post) => {
                    const cat = categoryLabels[post.category || "general"] || categoryLabels.general;
                    return (
                      <div
                        key={post.id}
                        className="py-3 px-2 hover:bg-muted/30 rounded-md cursor-pointer transition-colors"
                        onClick={() => handleOpenPost(post.id)}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border ${cat.color}`}>
                                {cat.icon}
                                {cat.label}
                              </span>
                              <span className="text-sm font-medium truncate">{post.title}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{post.userName || "익명"}</span>
                              <span>·</span>
                              <span>{formatDate(post.createdAt)}</span>
                              {(post.replyCount ?? 0) > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="text-primary font-medium">💬 {post.replyCount}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* === 게시글 상세 === */}
          {view === "detail" && (
            <div className="space-y-4">
              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : postDetail ? (
                <>
                  {/* 게시글 본문 */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {(() => {
                            const cat = categoryLabels[postDetail.category || "general"] || categoryLabels.general;
                            return (
                              <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border ${cat.color}`}>
                                {cat.icon} {cat.label}
                              </span>
                            );
                          })()}
                        </div>
                        <h3 className="text-base font-semibold">{postDetail.title}</h3>
                      </div>
                      {canModify(postDetail.userId) && (
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleStartEdit}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                            onClick={() => {
                              if (confirm("이 게시글을 삭제하시겠습니까?")) {
                                deletePostMutation.mutate(postDetail.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{postDetail.userName || "익명"}</span>
                      <span>·</span>
                      <span>{formatFullDate(postDetail.createdAt)}</span>
                    </div>
                    <div className="pt-2 border-t text-sm whitespace-pre-wrap leading-relaxed">
                      {postDetail.content}
                    </div>
                  </div>

                  {/* 댓글 섹션 */}
                  <div className="space-y-3">
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4" />
                      댓글 {postDetail.replies?.length || 0}
                    </div>

                    {/* 댓글 목록 */}
                    {postDetail.replies && postDetail.replies.length > 0 ? (
                      <div className="space-y-2">
                        {postDetail.replies.map((reply) => (
                          <div key={reply.id} className="bg-muted/40 rounded-lg p-3 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-medium">{reply.userName || "익명"}</span>
                                <span className="text-muted-foreground">{formatDate(reply.createdAt)}</span>
                              </div>
                              {canModify(reply.userId) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                                  onClick={() => {
                                    if (confirm("이 댓글을 삭제하시겠습니까?")) {
                                      deleteReplyMutation.mutate(reply.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-3">아직 댓글이 없습니다</p>
                    )}

                    {/* 댓글 입력 */}
                    {isLoggedIn ? (
                      <div className="flex gap-2">
                        <Textarea
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          placeholder="댓글을 입력하세요..."
                          className="min-h-[60px] text-sm flex-1"
                        />
                        <Button
                          size="sm"
                          className="shrink-0 self-end"
                          disabled={!replyContent.trim() || createReplyMutation.isPending}
                          onClick={() => {
                            if (selectedPostId && replyContent.trim()) {
                              createReplyMutation.mutate({ postId: selectedPostId, content: replyContent.trim() });
                            }
                          }}
                        >
                          {createReplyMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        댓글을 작성하시려면 로그인해 주세요.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8">게시글을 찾을 수 없습니다</p>
              )}
            </div>
          )}

          {/* === 글 작성 === */}
          {view === "write" && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">카테고리</label>
                  <Select value={writeCategory} onValueChange={setWriteCategory}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="improvement">💡 개선제안</SelectItem>
                      <SelectItem value="question">❓ 질문</SelectItem>
                      <SelectItem value="general">💬 일반</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">제목</label>
                  <Input
                    value={writeTitle}
                    onChange={(e) => setWriteTitle(e.target.value)}
                    placeholder="제목을 입력하세요"
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">내용</label>
                  <Textarea
                    value={writeContent}
                    onChange={(e) => setWriteContent(e.target.value)}
                    placeholder="내용을 입력하세요..."
                    className="min-h-[180px] text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setView("list")}>취소</Button>
                <Button
                  size="sm"
                  disabled={!writeTitle.trim() || !writeContent.trim() || createPostMutation.isPending}
                  onClick={() => {
                    createPostMutation.mutate({
                      title: writeTitle.trim(),
                      content: writeContent.trim(),
                      category: writeCategory,
                    });
                  }}
                >
                  {createPostMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  등록
                </Button>
              </div>
            </div>
          )}

          {/* === 글 수정 === */}
          {view === "edit" && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">카테고리</label>
                  <Select value={editCategory} onValueChange={setEditCategory}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="improvement">💡 개선제안</SelectItem>
                      <SelectItem value="question">❓ 질문</SelectItem>
                      <SelectItem value="general">💬 일반</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">제목</label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="제목을 입력하세요"
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">내용</label>
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="내용을 입력하세요..."
                    className="min-h-[180px] text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setView("detail")}>취소</Button>
                <Button
                  size="sm"
                  disabled={!editTitle.trim() || !editContent.trim() || updatePostMutation.isPending}
                  onClick={() => {
                    if (selectedPostId) {
                      updatePostMutation.mutate({
                        id: selectedPostId,
                        title: editTitle.trim(),
                        content: editContent.trim(),
                        category: editCategory,
                      });
                    }
                  }}
                >
                  {updatePostMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  수정완료
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

