import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Bookmark,
  Plus,
  Trash2,
  ExternalLink,
  Star,
  GripVertical,
  X,
  Pencil,
  Check,
} from "lucide-react";

interface BookmarkItem {
  id: number;
  title: string;
  url: string;
  sortOrder: number;
  createdAt: string;
}

export default function Bookmarks() {
  const { isAdmin, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const canEdit = isAdmin || isLoggedIn; // 로그인한 사용자는 자신의 즐겨찾기 관리 가능
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const { data: bookmarks, isLoading } = useQuery<BookmarkItem[]>({
    queryKey: ["/api/bookmarks"],
    queryFn: async () => {
      const res = await fetch("/api/bookmarks", { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("즐겨찾기를 불러올 수 없습니다");
      return res.json();
    },
    enabled: canEdit, // 로그인 상태에서만 조회
    staleTime: 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; url: string }) => {
      const res = await apiRequest("POST", "/api/bookmarks", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      setNewTitle("");
      setNewUrl("");
      setIsAdding(false);
      toast({ title: "추가 완료", description: "즐겨찾기가 추가되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { title: string; url: string } }) => {
      const res = await apiRequest("PUT", `/api/bookmarks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      setEditingId(null);
      toast({ title: "수정 완료", description: "즐겨찾기가 수정되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/bookmarks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      toast({ title: "삭제 완료", description: "즐겨찾기가 삭제되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const handleAdd = () => {
    if (!newTitle.trim() || !newUrl.trim()) {
      toast({ title: "입력 오류", description: "제목과 URL을 모두 입력해주세요.", variant: "destructive" });
      return;
    }
    let url = newUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    createMutation.mutate({ title: newTitle.trim(), url });
  };

  const handleEdit = (bookmark: BookmarkItem) => {
    setEditingId(bookmark.id);
    setEditTitle(bookmark.title);
    setEditUrl(bookmark.url);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editTitle.trim() || !editUrl.trim()) return;
    let url = editUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    updateMutation.mutate({ id: editingId, data: { title: editTitle.trim(), url } });
  };

  const handleDelete = (id: number) => {
    if (confirm("이 즐겨찾기를 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  if (!canEdit) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Star className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
          <h3 className="text-lg font-semibold">로그인이 필요합니다</h3>
          <p className="text-sm text-muted-foreground mt-2">
            로그인 후 개인 즐겨찾기를 등록하고 관리할 수 있습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground">즐겨찾기를 불러오는 중...</p>
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
              <Star className="w-5 h-5 text-yellow-500" />
              즐겨찾기
            </CardTitle>
            {canEdit && (
              <Button
                variant={isAdding ? "ghost" : "default"}
                size="sm"
                onClick={() => setIsAdding(!isAdding)}
                className="gap-2"
              >
                {isAdding ? (
                  <>
                    <X className="w-4 h-4" />
                    취소
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    추가
                  </>
                )}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            자주 방문하는 사이트를 즐겨찾기에 등록하세요
          </p>
        </CardHeader>

        {/* 추가 폼 */}
        {canEdit && isAdding && (
          <CardContent className="pt-0 pb-4">
            <div className="flex flex-col sm:flex-row gap-3 p-4 bg-muted/30 rounded-lg border border-dashed">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="제목 (예: 네이버 금융)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && document.getElementById("bookmark-url-input")?.focus()}
                  autoFocus
                />
                <Input
                  id="bookmark-url-input"
                  placeholder="URL (예: https://finance.naver.com)"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
              <Button
                onClick={handleAdd}
                disabled={createMutation.isPending || !newTitle.trim() || !newUrl.trim()}
                className="gap-2 self-end"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                등록
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 즐겨찾기 리스트 */}
      {bookmarks && bookmarks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bookmarks.map((item) => (
            <Card
              key={item.id}
              className="group overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/30"
            >
              <CardContent className="p-0">
                {editingId === item.id ? (
                  /* 수정 모드 */
                  <div className="p-4 space-y-3">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="제목"
                      autoFocus
                    />
                    <Input
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      placeholder="URL"
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={updateMutation.isPending}
                        className="gap-1"
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        저장
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* 보기 모드 */
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Bookmark className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                          {item.title}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {item.url}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {canEdit && (
                          <>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleEdit(item);
                              }}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all"
                              title="수정"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDelete(item.id);
                              }}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Star className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-semibold">즐겨찾기가 비어있습니다</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {canEdit
                ? "상단의 '추가' 버튼을 눌러 자주 방문하는 사이트를 등록하세요."
                : "로그인 후 즐겨찾기를 등록할 수 있습니다."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

