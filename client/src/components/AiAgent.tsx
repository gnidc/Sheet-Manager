import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Bot, Send, Loader2, Plus, Trash2, Pencil, Key, MessageSquare,
  Share2, Star, Copy, Check, Settings, Sparkles, ChevronDown, ChevronUp,
  AlertTriangle, ExternalLink, TrendingUp, TrendingDown, BarChart3,
  Search, ShoppingCart, ArrowRight, Eye, Zap, Activity, Mic, MicOff, Volume2,
  AArrowUp, AArrowDown,
} from "lucide-react";

interface AiPrompt {
  id: number;
  title: string;
  content: string;
  category: string | null;
  isDefault: boolean | null;
  isShared: boolean | null;
  sharedBy: string | null;
  userId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: AgentActionResult[];
}

interface AgentActionResult {
  type: "navigate" | "data" | "error" | "confirm_required" | "open_window" | "navigate_with_action";
  dataType?: string;
  data?: any;
  target?: string;
  url?: string;
  message?: string;
  success?: boolean;
  action?: any;
  params?: any;
}

interface UserAiConfig {
  id: number;
  userId: number;
  aiProvider: string | null;
  geminiApiKey: string | null;
  openaiApiKey: string | null;
  hasGeminiKey?: boolean;
  hasOpenaiKey?: boolean;
  useOwnKey: boolean | null;
}

// JSON 데이터를 사람이 읽기 쉬운 텍스트로 변환
function formatDataToText(data: any): string {
  if (!data || typeof data !== "object") return String(data);
  
  // 잔고 데이터
  if (data.holdings && Array.isArray(data.holdings)) {
    const lines: string[] = [];
    if (data.summary) {
      const s = data.summary;
      lines.push(`📊 계좌 요약`);
      lines.push(`  예수금: ${Number(s.depositAmount || 0).toLocaleString()}원`);
      lines.push(`  총 평가금액: ${Number(s.totalEvalAmount || 0).toLocaleString()}원`);
      lines.push(`  총 매입금액: ${Number(s.totalBuyAmount || 0).toLocaleString()}원`);
      const pl = s.totalEvalProfitLoss || 0;
      lines.push(`  총 평가손익: ${pl >= 0 ? "+" : ""}${Number(pl).toLocaleString()}원 (${(s.totalEvalProfitRate || 0).toFixed(2)}%)`);
      lines.push("");
    }
    lines.push(`💼 보유종목 (${data.holdings.length}종목)`);
    data.holdings.forEach((h: any, i: number) => {
      const name = h.stockName || h.name || "";
      const code = h.stockCode || h.code || "";
      const qty = h.holdingQty || h.quantity || 0;
      const price = h.currentPrice || h.price || 0;
      const pl = h.evalProfitLoss || h.profitLoss || 0;
      const rate = h.evalProfitRate || h.profitRate || 0;
      lines.push(`  ${i + 1}. ${name}(${code}) ${Number(qty).toLocaleString()}주 × ${Number(price).toLocaleString()}원  ${pl >= 0 ? "+" : ""}${Number(pl).toLocaleString()}원 (${Number(rate).toFixed(2)}%)`);
    });
    return lines.join("\n");
  }

  // 배열 데이터 (검색 결과, 뉴스 등)
  if (Array.isArray(data)) {
    return data.map((item, i) => {
      if (item.name && item.price) {
        return `${i + 1}. ${item.name}(${item.code || ""}) ${Number(item.price).toLocaleString()}원`;
      }
      if (item.title) {
        return `${i + 1}. ${item.title}${item.source ? ` (${item.source})` : ""}`;
      }
      return `${i + 1}. ${JSON.stringify(item)}`;
    }).join("\n");
  }

  // 지수/환율 등 key-value 객체
  const entries = Object.entries(data);
  if (entries.length > 0 && entries.every(([, v]) => typeof v === "object" && v !== null)) {
    return entries.map(([key, val]: [string, any]) => {
      if (val.value !== undefined) {
        const sign = parseFloat(val.changeRate) >= 0 ? "▲" : "▼";
        return `${key}: ${Number(val.value).toLocaleString()} ${sign} ${val.changeRate || 0}%`;
      }
      return `${key}: ${JSON.stringify(val)}`;
    }).join("\n");
  }

  // 단일 종목
  if (data.name && data.currentPrice) {
    const sign = parseFloat(data.changeRate) >= 0 ? "▲" : "▼";
    return `${data.name}(${data.stockCode || ""}) 현재가: ${Number(data.currentPrice).toLocaleString()}원 ${sign} ${data.changeRate || 0}%`;
  }

  // 기타: 각 필드를 줄바꿈으로 표시
  return Object.entries(data).map(([k, v]) => {
    if (typeof v === "object" && v !== null) return `${k}: ${JSON.stringify(v)}`;
    return `${k}: ${v}`;
  }).join("\n");
}

const DEFAULT_SYSTEM_PROMPT = `너는 경제 전문가이자 투자의 마이스터야~
이 대화는 주식 및 ETF거래를 통해 투자 수익률을 극대화함과 동시에 장기적으로 안정적인 복리 수익률을 추구하고자 하는 안정적,적극적 투자성향을 모두 가지고 있는 투자스타일의 투자자를 위한 대화창이야.
최근의 매크로 동향, 최신뉴스 및 테마동향, ETF 정보, 지수동향 등을 종합 참고하여 투자자의 질문에 대답을 해주길 바래~
그리고 본 페이지에 구현된 기능을 가능하면 에이전트 방식으로 실행할 수 있도록 해줘(메뉴이동,내용입력,정보검색 등)`;

// 메뉴 이름 매핑
const TAB_NAMES: Record<string, string> = {
  "home": "🏠 홈",
  "etf-components": "📊 실시간ETF",
  "new-etf": "🆕 신규ETF",
  "watchlist-etf": "⭐ 관심(Core)",
  "satellite-etf": "🛰️ 관심(Satellite)",
  "markets-domestic": "🇰🇷 국내증시",
  "markets-global": "🌍 해외증시",
  "markets-research": "📑 리서치",
  "daily-strategy": "📋 투자전략",
  "domestic-stocks": "🏢 국내주식",
  "overseas-stocks": "🌐 해외주식",
  "tenbagger": "🚀 10X",
  "steem-report": "📝 스팀보고서",
  "steem-reader": "📖 스팀글읽기",
  "ai-agent": "🤖 AI Agent",
  "bookmarks": "⭐ 즐겨찾기",
  "/trading": "⚡ 매매A(Active)",
};

export default function AiAgent({ isAdmin, onNavigate, compact = false }: { isAdmin: boolean; onNavigate?: (tab: string) => void; compact?: boolean }) {
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 대화 상태
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // 프롬프트 관리 상태
  const [showPromptManager, setShowPromptManager] = useState(false);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AiPrompt | null>(null);
  const [promptTitle, setPromptTitle] = useState("");
  const [promptContent, setPromptContent] = useState("");
  const [promptCategory, setPromptCategory] = useState("일반");
  const [promptIsShared, setPromptIsShared] = useState(false);
  const [promptIsDefault, setPromptIsDefault] = useState(false);

  // API 키 상태
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [aiProvider, setAiProvider] = useState("gemini");
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");

  // 선택된 프롬프트
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);

  // 복사 상태
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [chatFontSize, setChatFontSize] = useState(() => {
    const saved = localStorage.getItem("ai-chat-font-size");
    return saved ? Number(saved) : 14;
  });

  // Agent 실행 결과
  const [agentResults, setAgentResults] = useState<AgentActionResult[]>([]);
  const [showAgentResult, setShowAgentResult] = useState(false);

  // 확인 다이얼로그
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingConfirmAction, setPendingConfirmAction] = useState<any>(null);
  const [confirmMessage, setConfirmMessage] = useState("");

  // 음성인식 상태
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const autoSendRef = useRef(false); // "오버" 감지 시 자동전송 플래그
  const handleSendRef = useRef<() => void>(() => {});

  // 음성인식 초기화
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.lang = "ko-KR"; // 한국어
      recognition.interimResults = true; // 중간 결과 표시
      recognition.continuous = false; // 한 문장씩 인식
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        if (finalTranscript) {
          // "오버"로 끝나면 "오버"를 제거하고 자동 전송 플래그 설정
          const overPattern = /\s*오버\s*$/;
          if (overPattern.test(finalTranscript)) {
            const cleaned = finalTranscript.replace(overPattern, "").trim();
            if (cleaned) {
              setUserInput(prev => prev + cleaned);
            }
            autoSendRef.current = true;
            // 음성인식 중지 → onend에서 자동 전송 처리
            try { recognition.stop(); } catch (e) {}
          } else {
            setUserInput(prev => prev + finalTranscript);
          }
        } else if (interimTranscript) {
          // 중간 결과는 별도 처리 가능 (현재는 최종 결과만 입력)
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // "오버" 감지로 자동전송 플래그가 설정된 경우 전송 실행
        if (autoSendRef.current) {
          autoSendRef.current = false;
          // 약간의 딜레이를 두어 setUserInput이 반영된 후 전송
          setTimeout(() => {
            handleSendRef.current?.();
          }, 200);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        autoSendRef.current = false;
        if (event.error === "not-allowed") {
          toast({
            title: "마이크 권한 필요",
            description: "브라우저 설정에서 마이크 권한을 허용해주세요.",
            variant: "destructive",
          });
        } else if (event.error === "no-speech") {
          toast({
            title: "음성이 감지되지 않았습니다",
            description: "다시 시도해주세요.",
          });
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, [toast]);

  // 음성인식 토글
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        // 이미 시작된 경우 stop 후 재시작
        recognitionRef.current.stop();
        setTimeout(() => {
          try {
            recognitionRef.current.start();
            setIsListening(true);
          } catch (e2) {
            console.error("Speech recognition start error:", e2);
          }
        }, 100);
      }
    }
  }, [isListening]);

  // API 키 조회
  const { data: aiConfig, isLoading: isConfigLoading } = useQuery<UserAiConfig>({
    queryKey: ["/api/user/ai-config"],
    queryFn: async () => {
      const res = await fetch("/api/user/ai-config", { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      return data.config || null;
    },
    enabled: isLoggedIn,
  });

  const hasApiKey = aiConfig && (aiConfig.hasGeminiKey || aiConfig.hasOpenaiKey);

  // 프롬프트 목록
  const { data: prompts = [], isLoading: isPromptsLoading } = useQuery<AiPrompt[]>({
    queryKey: ["/api/ai-prompts"],
    queryFn: async () => {
      const res = await fetch("/api/ai-prompts", { credentials: "include" });
      if (!res.ok) throw new Error("프롬프트 조회 실패");
      return res.json();
    },
  });

  // 현재 선택된 프롬프트의 내용 가져오기
  const getActiveSystemPrompt = () => {
    if (selectedPromptId) {
      const found = prompts.find((p) => p.id === selectedPromptId);
      if (found) return found.content;
    }
    return DEFAULT_SYSTEM_PROMPT;
  };

  // Agent Action 결과 처리
  const handleAgentActions = useCallback((actions: AgentActionResult[]) => {
    if (!actions || actions.length === 0) return;
    
    const dataResults: AgentActionResult[] = [];

    for (const result of actions) {
      switch (result.type) {
        case "navigate":
          if (result.target) {
            if (result.target === "/trading") {
              window.open("https://lifefit2.vercel.app/trading", "_blank", "noopener,noreferrer");
            } else if (result.target.startsWith("/")) {
              window.location.href = result.target;
            } else if (onNavigate) {
              onNavigate(result.target);
              toast({ 
                title: `${TAB_NAMES[result.target] || result.target} 메뉴로 이동합니다`,
                duration: 2000,
              });
            }
          }
          break;
        
        case "open_window":
          if (result.url) {
            window.open(result.url, "_blank");
          }
          break;

        case "navigate_with_action":
          if (result.target && onNavigate) {
            onNavigate(result.target);
          }
          if (result.params?.stockCode) {
            const { stockCode, stockName, market } = result.params;
            setTimeout(() => {
              window.open(
                `/stock-detail?code=${stockCode}&name=${encodeURIComponent(stockName || stockCode)}&market=${market || "domestic"}`,
                "_blank"
              );
            }, 500);
          }
          break;

        case "confirm_required":
          setPendingConfirmAction(result.action);
          setConfirmMessage(result.message || "이 작업을 실행하시겠습니까?");
          setConfirmDialogOpen(true);
          break;

        case "data":
        case "error":
          dataResults.push(result);
          break;
      }
    }

    if (dataResults.length > 0) {
      setAgentResults(dataResults);
      setShowAgentResult(true);
    }
  }, [onNavigate, toast]);

  // 확인된 액션 실행
  const executeConfirmedAction = useMutation({
    mutationFn: async (action: any) => {
      const res = await apiRequest("POST", "/api/ai-agent/execute-action", { action });
      return res.json();
    },
    onSuccess: (data) => {
      setConfirmDialogOpen(false);
      setPendingConfirmAction(null);
      if (data.success) {
        toast({ title: "✅ 주문이 성공적으로 실행되었습니다", duration: 3000 });
        const resultMsg: ChatMessage = {
          role: "assistant",
          content: `✅ 주문 실행 완료: ${data.data?.message || "성공"}`,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, resultMsg]);
      } else {
        toast({ title: "주문 실행 실패", description: data.message, variant: "destructive" });
      }
    },
    onError: (err: any) => {
      setConfirmDialogOpen(false);
      toast({ title: "주문 실행 실패", description: err.message, variant: "destructive" });
    },
  });

  // 대화 전송
  const chatMutation = useMutation({
    mutationFn: async (messages: ChatMessage[]) => {
      const res = await apiRequest("POST", "/api/ai-agent/chat", {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        systemPrompt: getActiveSystemPrompt(),
      });
      return res.json();
    },
    onSuccess: (data) => {
      const aiMsg: ChatMessage = {
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        actions: data.actions || [],
      };
      setChatMessages((prev) => [...prev, aiMsg]);

      // Agent 액션 결과 처리
      if (data.actions && data.actions.length > 0) {
        handleAgentActions(data.actions);
      }
      setIsStreaming(false);
    },
    onError: (err: any) => {
      setIsStreaming(false);
      toast({
        title: "AI 응답 실패",
        description: err.message || "서버 연결 오류",
        variant: "destructive",
      });
    },
  });

  // 메시지 전송
  const handleSendMessage = () => {
    if (!userInput.trim() || isStreaming) return;
    const newMsg: ChatMessage = {
      role: "user",
      content: userInput.trim(),
      timestamp: new Date(),
    };
    const updated = [...chatMessages, newMsg];
    setChatMessages(updated);
    setUserInput("");
    setIsStreaming(true);
    chatMutation.mutate(updated);
  };

  // handleSendMessage를 ref에 저장 (음성인식 콜백에서 최신 함수 참조용)
  useEffect(() => {
    handleSendRef.current = handleSendMessage;
  });

  // 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // 프롬프트 CRUD
  const createPromptMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/ai-prompts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-prompts"] });
      setPromptDialogOpen(false);
      resetPromptForm();
      toast({ title: "프롬프트 저장 완료" });
    },
    onError: (err: any) => {
      toast({ title: "저장 실패", description: err.message, variant: "destructive" });
    },
  });

  const updatePromptMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/ai-prompts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-prompts"] });
      setPromptDialogOpen(false);
      setEditingPrompt(null);
      resetPromptForm();
      toast({ title: "프롬프트 수정 완료" });
    },
    onError: (err: any) => {
      toast({ title: "수정 실패", description: err.message, variant: "destructive" });
    },
  });

  const deletePromptMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/ai-prompts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-prompts"] });
      toast({ title: "프롬프트 삭제 완료" });
    },
    onError: (err: any) => {
      toast({ title: "삭제 실패", description: err.message, variant: "destructive" });
    },
  });

  const resetPromptForm = () => {
    setPromptTitle("");
    setPromptContent("");
    setPromptCategory("일반");
    setPromptIsShared(false);
    setPromptIsDefault(false);
    setEditingPrompt(null);
  };

  const handleSavePrompt = () => {
    if (!promptTitle.trim() || !promptContent.trim()) {
      toast({ title: "입력 오류", description: "제목과 내용을 입력해주세요.", variant: "destructive" });
      return;
    }
    const data = {
      title: promptTitle.trim(),
      content: promptContent.trim(),
      category: promptCategory.trim() || "일반",
      isShared: promptIsShared,
      isDefault: isAdmin ? promptIsDefault : false,
    };
    if (editingPrompt) {
      updatePromptMutation.mutate({ id: editingPrompt.id, data });
    } else {
      createPromptMutation.mutate(data);
    }
  };

  const openEditPrompt = (p: AiPrompt) => {
    setEditingPrompt(p);
    setPromptTitle(p.title);
    setPromptContent(p.content);
    setPromptCategory(p.category || "일반");
    setPromptIsShared(p.isShared || false);
    setPromptIsDefault(p.isDefault || false);
    setPromptDialogOpen(true);
  };

  // API 키 저장
  const saveApiKeyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/user/ai-config", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/ai-config"] });
      setApiKeyDialogOpen(false);
      toast({ title: "API 키 등록 완료", description: "AI 대화를 시작할 수 있습니다." });
    },
    onError: (err: any) => {
      toast({ title: "등록 실패", description: err.message, variant: "destructive" });
    },
  });

  // 메시지 복사
  // JSON 데이터를 자연어로 변환
  const formatJsonContent = useCallback((content: string): string => {
    // 전체가 JSON인 경우
    const trimmed = content.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const data = JSON.parse(trimmed);
        return formatDataToText(data);
      } catch { /* not JSON */ }
    }
    // 부분 JSON 블록이 포함된 경우 (```json ... ``` 또는 인라인 JSON 객체)
    return content.replace(/```json\s*([\s\S]*?)```/g, (_, jsonStr) => {
      try {
        const data = JSON.parse(jsonStr.trim());
        return formatDataToText(data);
      } catch { return jsonStr; }
    });
  }, []);

  const adjustFontSize = useCallback((delta: number) => {
    setChatFontSize(prev => {
      const next = Math.min(24, Math.max(10, prev + delta));
      localStorage.setItem("ai-chat-font-size", String(next));
      return next;
    });
  }, []);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // 분류
  const defaultPrompts = prompts.filter((p) => p.isDefault);
  const sharedPrompts = prompts.filter((p) => p.isShared && !p.isDefault);
  const myPrompts = prompts.filter((p) => !p.isDefault && !p.isShared);

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <Bot className="w-16 h-16 text-muted-foreground/30" />
        <h3 className="text-lg font-semibold">AI Agent</h3>
        <p className="text-muted-foreground">로그인하시면 AI 대화 기능을 사용할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className={compact ? "flex flex-col h-full" : "space-y-4"}>
      {/* 헤더 */}
      {compact ? (
        /* 모바일 컴팩트 헤더 */
        <div className="flex items-center justify-between px-3 py-1.5 border-b shrink-0">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] h-5">
              {hasApiKey ? "🟢 연결됨" : "🔴 미연결"}
            </Badge>
            <span className="text-[10px] text-muted-foreground">🎙️ "오버"로 자동전송</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setApiKeyDialogOpen(true)} className="h-6 px-1.5">
              <Key className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowPromptManager(!showPromptManager)} className="h-6 px-1.5">
              <Settings className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : (
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-purple-500" />
            <h2 className="text-xl font-bold">AI Agent</h2>
            <Badge variant="outline" className="text-[10px]">
              {hasApiKey ? "🟢 API 연결됨" : "🔴 API 미연결"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground ml-7">
            💡 LLM 모델 Query뿐만 아니라, 홈페이지의 <span className="font-semibold text-purple-600 dark:text-purple-400">각종 정보검색</span>·<span className="font-semibold text-blue-600 dark:text-blue-400">메뉴실행</span>·<span className="font-semibold text-amber-600 dark:text-amber-400">주문실행</span> 기능도 수행할 수 있습니다.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            🎙️ 음성인식 기능 사용시 말 끝에 <span className="font-semibold text-red-500">"오버"</span>라고 하면 저절로 입력됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setApiKeyDialogOpen(true)}
            className="gap-1"
          >
            <Key className="h-3.5 w-3.5" />
            API 키 관리
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPromptManager(!showPromptManager)}
            className="gap-1"
          >
            <Settings className="h-3.5 w-3.5" />
            프롬프트 관리
            {showPromptManager ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>
      )}

      {/* API 키 미등록 안내 */}
      {!hasApiKey && !isConfigLoading && (
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Key className="h-8 w-8 text-yellow-500 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-semibold text-base">AI API 키를 등록해주세요</h3>
                <p className="text-sm text-muted-foreground">
                  AI 대화 기능을 사용하려면 본인의 AI API 키를 등록해야 합니다.
                  <br />Gemini 또는 OpenAI API 키를 등록하시면 대화를 시작할 수 있습니다.
                </p>
                <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
                  <span>📌 Gemini API: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-blue-500 underline">키 발급</a></span>
                  <span>📌 OpenAI API: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-blue-500 underline">키 발급</a></span>
                </div>
                <Button size="sm" onClick={() => setApiKeyDialogOpen(true)} className="gap-1">
                  <Key className="h-3.5 w-3.5" />
                  API 키 등록하기
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 프롬프트 관리 패널 */}
      {showPromptManager && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                프롬프트 관리
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  resetPromptForm();
                  setPromptDialogOpen(true);
                }}
                className="gap-1 h-7 text-xs"
              >
                <Plus className="h-3 w-3" />
                새 프롬프트
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* 기본 프롬프트 */}
            {defaultPrompts.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground font-medium mb-1">⭐ 기본 프롬프트</p>
                {defaultPrompts.map((p) => (
                  <PromptItem
                    key={p.id}
                    prompt={p}
                    isSelected={selectedPromptId === p.id}
                    onSelect={() => setSelectedPromptId(selectedPromptId === p.id ? null : p.id)}
                    onEdit={() => openEditPrompt(p)}
                    onDelete={() => {
                      if (confirm(`"${p.title}" 프롬프트를 삭제하시겠습니까?`)) deletePromptMutation.mutate(p.id);
                    }}
                    canEdit={isAdmin}
                  />
                ))}
              </div>
            )}
            {/* 공유 프롬프트 */}
            {sharedPrompts.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground font-medium mb-1">🔗 공유 프롬프트</p>
                {sharedPrompts.map((p) => (
                  <PromptItem
                    key={p.id}
                    prompt={p}
                    isSelected={selectedPromptId === p.id}
                    onSelect={() => setSelectedPromptId(selectedPromptId === p.id ? null : p.id)}
                    onEdit={() => openEditPrompt(p)}
                    onDelete={() => {
                      if (confirm(`"${p.title}" 프롬프트를 삭제하시겠습니까?`)) deletePromptMutation.mutate(p.id);
                    }}
                    canEdit={isAdmin || p.userId === (aiConfig?.userId ?? null)}
                  />
                ))}
              </div>
            )}
            {/* 내 프롬프트 */}
            {myPrompts.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground font-medium mb-1">👤 내 프롬프트</p>
                {myPrompts.map((p) => (
                  <PromptItem
                    key={p.id}
                    prompt={p}
                    isSelected={selectedPromptId === p.id}
                    onSelect={() => setSelectedPromptId(selectedPromptId === p.id ? null : p.id)}
                    onEdit={() => openEditPrompt(p)}
                    onDelete={() => {
                      if (confirm(`"${p.title}" 프롬프트를 삭제하시겠습니까?`)) deletePromptMutation.mutate(p.id);
                    }}
                    canEdit={true}
                  />
                ))}
              </div>
            )}
            {prompts.length === 0 && !isPromptsLoading && (
              <p className="text-xs text-muted-foreground text-center py-4">
                등록된 프롬프트가 없습니다. 기본 시스템 프롬프트가 사용됩니다.
              </p>
            )}
            {/* 현재 활성 프롬프트 */}
            <div className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2">
              <strong>현재 사용 중:</strong>{" "}
              {selectedPromptId
                ? prompts.find((p) => p.id === selectedPromptId)?.title || "기본 프롬프트"
                : "기본 시스템 프롬프트"}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 대화창 */}
      {hasApiKey && (
        <Card className={`border-purple-200 dark:border-purple-800 ${compact ? "flex-1 flex flex-col overflow-hidden border-0 rounded-none shadow-none" : ""}`}>
          <CardHeader className="py-2 px-4 border-b shrink-0">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-purple-500" />
              AI 대화
              <div className="flex items-center gap-0.5 ml-auto">
                {/* 폰트 크기 조절 */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => adjustFontSize(-1)}
                  disabled={chatFontSize <= 10}
                  title="글자 축소"
                >
                  <AArrowDown className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[10px] text-muted-foreground w-5 text-center tabular-nums">{chatFontSize}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => adjustFontSize(1)}
                  disabled={chatFontSize >= 24}
                  title="글자 확대"
                >
                  <AArrowUp className="h-3.5 w-3.5" />
                </Button>
                {chatMessages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] ml-1 text-muted-foreground"
                    onClick={() => {
                      setChatMessages([]);
                      setAgentResults([]);
                      setShowAgentResult(false);
                    }}
                  >
                    대화 초기화
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className={`p-0 ${compact ? "flex-1 flex flex-col overflow-hidden" : ""}`}>
            {/* 대화 메시지 영역 */}
            <div className={`${compact ? "flex-1" : "h-[450px]"} overflow-y-auto p-4 space-y-3`}>
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3 text-muted-foreground">
                  <div className="relative">
                    <Bot className="w-14 h-14 opacity-20" />
                    <Zap className="w-5 h-5 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">🤖 AI Agent - 투자 비서</p>
                    <p className="text-xs">정보 검색, 메뉴 이동, 주문 실행까지 가능합니다.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-w-md">
                    {[
                      { q: "코스피 지수 알려줘", icon: "📊" },
                      { q: "삼성전자 현재가 조회", icon: "🔍" },
                      { q: "실시간ETF 메뉴로 이동", icon: "📈" },
                      { q: "상승률 TOP 종목 보여줘", icon: "🚀" },
                      { q: "내 계좌 잔고 확인", icon: "💰" },
                      { q: "환율 정보 알려줘", icon: "💱" },
                    ].map(({ q, icon }) => (
                      <button
                        key={q}
                        className="text-[11px] px-2.5 py-2 rounded-lg border hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:border-purple-300 transition-all text-left flex items-center gap-1.5"
                        onClick={() => setUserInput(q)}
                      >
                        <span>{icon}</span>
                        <span>{q}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 relative group ${
                        msg.role === "user"
                          ? "bg-purple-500 text-white rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      }`}
                    >
                      <div className="whitespace-pre-wrap leading-relaxed" style={{ fontSize: `${chatFontSize}px` }}>{msg.role === "assistant" ? formatJsonContent(msg.content) : msg.content}</div>
                      <div className={`flex items-center gap-1.5 mt-1 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <span className={`text-[10px] ${msg.role === "user" ? "text-purple-200" : "text-muted-foreground"}`}>
                          {msg.timestamp.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {msg.role === "assistant" && (
                          <button
                            onClick={() => handleCopy(msg.content, idx)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            title="복사"
                          >
                            {copiedIdx === idx ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Agent 액션 배지 표시 */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1 ml-2">
                      {msg.actions.map((act, aidx) => (
                        <AgentActionBadge key={aidx} action={act} onNavigate={onNavigate} />
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {isStreaming && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                      <span className="text-sm text-muted-foreground">AI가 답변을 작성중입니다...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* 입력 영역 */}
            <div className="border-t p-3 shrink-0">
              {/* 음성인식 상태 표시 */}
              {isListening && (
                <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </div>
                  <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                    🎙️ 음성 인식 중... 말씀해주세요 <span className="text-muted-foreground font-normal">(끝에 "오버"라고 말하면 자동 전송)</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-5 text-[10px] text-red-500 hover:text-red-700 px-1"
                    onClick={toggleListening}
                  >
                    중지
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder={isListening ? "음성을 인식하고 있습니다..." : "질문을 입력하세요..."}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isStreaming}
                  className={`flex-1 ${isListening ? "border-red-300 ring-1 ring-red-300" : ""}`}
                />
                {/* 음성인식 버튼 */}
                {speechSupported && (
                  <Button
                    variant={isListening ? "destructive" : "outline"}
                    onClick={toggleListening}
                    disabled={isStreaming}
                    className={`shrink-0 ${isListening ? "animate-pulse" : ""}`}
                    title={isListening ? "음성인식 중지" : "음성으로 입력 (한국어)"}
                  >
                    {isListening ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button
                  id="ai-agent-send-btn"
                  onClick={handleSendMessage}
                  disabled={!userInput.trim() || isStreaming}
                  className="gap-1 bg-purple-500 hover:bg-purple-600 text-white shrink-0"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {!speechSupported && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  ⚠️ 이 브라우저는 음성인식을 지원하지 않습니다. Chrome 또는 Edge를 사용해주세요.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent 실행 결과 패널 */}
      {showAgentResult && agentResults.length > 0 && (
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="py-2 px-4 border-b">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-green-500" />
                Agent 실행 결과
                <Badge variant="outline" className="text-[9px] ml-1">{agentResults.length}건</Badge>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px]"
                onClick={() => { setShowAgentResult(false); setAgentResults([]); }}
              >
                닫기
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {agentResults.map((result, idx) => (
              <AgentDataPanel key={idx} result={result} onNavigate={onNavigate} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* 주문 확인 다이얼로그 */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              주문 실행 확인
            </DialogTitle>
            <DialogDescription>
              아래 주문을 실행하시겠습니까? 실제 매매가 이루어집니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm font-medium">{confirmMessage}</p>
              {pendingConfirmAction?.params && (
                <div className="mt-2 text-xs space-y-1 text-muted-foreground">
                  <p>종목코드: <span className="font-mono font-medium text-foreground">{pendingConfirmAction.params.stockCode}</span></p>
                  <p>주문유형: <span className="font-medium text-foreground">{pendingConfirmAction.params.orderType === "buy" ? "매수" : "매도"}</span></p>
                  <p>수량: <span className="font-medium text-foreground">{Number(pendingConfirmAction.params.quantity).toLocaleString()}주</span></p>
                  {pendingConfirmAction.params.price && (
                    <p>가격: <span className="font-medium text-foreground">{Number(pendingConfirmAction.params.price).toLocaleString()}원</span></p>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setConfirmDialogOpen(false); setPendingConfirmAction(null); }}>
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (pendingConfirmAction) {
                    executeConfirmedAction.mutate(pendingConfirmAction);
                  }
                }}
                disabled={executeConfirmedAction.isPending}
                className="gap-1"
              >
                {executeConfirmedAction.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="h-4 w-4" />
                )}
                주문 실행
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 프롬프트 생성/수정 다이얼로그 */}
      <Dialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              {editingPrompt ? "프롬프트 수정" : "새 프롬프트 생성"}
            </DialogTitle>
            <DialogDescription>
              AI 대화에 사용할 시스템 프롬프트를 작성합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>제목 *</Label>
              <Input
                placeholder="프롬프트 제목"
                value={promptTitle}
                onChange={(e) => setPromptTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>카테고리</Label>
              <Input
                placeholder="예: 투자전략, 시장분석, ETF"
                value={promptCategory}
                onChange={(e) => setPromptCategory(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>프롬프트 내용 *</Label>
              <Textarea
                placeholder="AI에게 전달할 시스템 지시사항을 작성합니다..."
                value={promptContent}
                onChange={(e) => setPromptContent(e.target.value)}
                rows={8}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="promptShared"
                  checked={promptIsShared}
                  onCheckedChange={(c) => setPromptIsShared(c === true)}
                />
                <label htmlFor="promptShared" className="text-sm flex items-center gap-1 cursor-pointer">
                  <Share2 className="h-3.5 w-3.5 text-orange-500" />
                  공유하기
                </label>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="promptDefault"
                    checked={promptIsDefault}
                    onCheckedChange={(c) => setPromptIsDefault(c === true)}
                  />
                  <label htmlFor="promptDefault" className="text-sm flex items-center gap-1 cursor-pointer">
                    <Star className="h-3.5 w-3.5 text-yellow-500" />
                    기본(공통) 프롬프트
                  </label>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setPromptDialogOpen(false); resetPromptForm(); }}>
                취소
              </Button>
              <Button onClick={handleSavePrompt} disabled={createPromptMutation.isPending || updatePromptMutation.isPending}>
                {(createPromptMutation.isPending || updatePromptMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                )}
                {editingPrompt ? "수정" : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* API 키 등록 다이얼로그 */}
      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-purple-500" />
              AI API 키 등록
            </DialogTitle>
            <DialogDescription>
              AI 대화에 사용할 API 키를 등록합니다. (계정별로 별도 관리)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>AI 제공자</Label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI (GPT)</option>
              </select>
            </div>
            {aiProvider === "gemini" && (
              <div className="space-y-1.5">
                <Label>Gemini API Key</Label>
                <Input
                  type="password"
                  placeholder="AIza..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  <a href="https://aistudio.google.com/apikey" target="_blank" className="text-blue-500 underline">
                    Google AI Studio
                  </a>에서 무료로 발급받을 수 있습니다.
                </p>
              </div>
            )}
            {aiProvider === "openai" && (
              <div className="space-y-1.5">
                <Label>OpenAI API Key</Label>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  <a href="https://platform.openai.com/api-keys" target="_blank" className="text-blue-500 underline">
                    OpenAI Platform
                  </a>에서 발급받을 수 있습니다.
                </p>
              </div>
            )}
            {hasApiKey && (
              <div className="text-xs text-green-600 bg-green-50 dark:bg-green-950/20 dark:text-green-400 rounded p-2">
                ✅ 현재 {aiConfig?.aiProvider === "openai" ? "OpenAI" : aiConfig?.aiProvider === "groq" ? "Groq" : "Gemini"} API 키가 등록되어 있습니다.
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setApiKeyDialogOpen(false)}>
                취소
              </Button>
              <Button
                onClick={() => {
                  saveApiKeyMutation.mutate({
                    aiProvider,
                    geminiApiKey: aiProvider === "gemini" ? geminiKey : null,
                    openaiApiKey: aiProvider === "openai" ? openaiKey : null,
                  });
                }}
                disabled={saveApiKeyMutation.isPending || (!geminiKey && !openaiKey)}
              >
                {saveApiKeyMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                등록
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 프롬프트 아이템 컴포넌트
function PromptItem({
  prompt,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  canEdit,
}: {
  prompt: AiPrompt;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors mb-1 ${
        isSelected
          ? "bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800"
          : "hover:bg-muted/50 border border-transparent"
      }`}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium truncate">{prompt.title}</span>
          {prompt.isDefault && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-yellow-300 text-yellow-600">기본</Badge>
          )}
          {prompt.isShared && !prompt.isDefault && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-orange-300 text-orange-600">공유</Badge>
          )}
          {prompt.sharedBy && (
            <span className="text-[9px] text-muted-foreground">
              {prompt.sharedBy.substring(0, 3)}***
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground truncate">{prompt.content.substring(0, 60)}...</p>
      </div>
      {isSelected && <Check className="h-4 w-4 text-purple-500 shrink-0" />}
      {canEdit && (
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={onEdit} className="p-1 rounded hover:bg-muted" title="수정">
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-muted" title="삭제">
            <Trash2 className="h-3 w-3 text-destructive" />
          </button>
        </div>
      )}
    </div>
  );
}

const DATA_TYPE_NAV_MAP: Record<string, string> = {
  balance: "/trading",
  orders: "/trading",
  order_result: "/trading",
  market_indices: "markets-domestic",
  global_indices: "markets-global",
  exchange_rates: "markets-global",
  etf_top_gainers: "etf-components",
  etf_components: "etf-components",
  sectors: "markets-domestic",
  top_stocks: "markets-domestic",
  watchlist: "watchlist-etf",
  watchlist_etf: "watchlist-etf",
  research: "markets-research",
  stock_news: "markets-domestic",
  market_news: "markets-domestic",
};

function AgentActionBadge({ action, onNavigate }: { action: AgentActionResult; onNavigate?: (tab: string) => void }) {
  const getActionInfo = () => {
    switch (action.type) {
      case "navigate":
        return { icon: <ArrowRight className="h-3 w-3" />, label: `${TAB_NAMES[action.target || ""] || action.target} 이동`, color: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200" };
      case "open_window":
        return { icon: <ExternalLink className="h-3 w-3" />, label: "새 창 열기", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border-indigo-200" };
      case "data": {
        const dataLabel = {
          search_results: "🔍 종목 검색",
          stock_price: "💹 현재가",
          balance: "💰 잔고",
          market_indices: "📊 시장 지수",
          global_indices: "🌍 해외 지수",
          etf_top_gainers: "📈 ETF 상승",
          sectors: "🏭 업종",
          top_stocks: "🏆 종목 순위",
          exchange_rates: "💱 환율",
          stock_news: "📰 뉴스",
          market_news: "📰 시장 뉴스",
          watchlist: "⭐ 관심종목",
          order_result: "📋 주문 결과",
          orders: "📋 주문 내역",
          watchlist_etf: "⭐ 관심 ETF",
          research: "📑 리서치",
          etf_components: "📊 ETF 구성",
        }[action.dataType || ""] || "📊 데이터";
        const navTarget = DATA_TYPE_NAV_MAP[action.dataType || ""];
        const suffix = navTarget ? ` → ${TAB_NAMES[navTarget] || navTarget}` : "";
        return { icon: <BarChart3 className="h-3 w-3" />, label: dataLabel + suffix, color: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 border-green-200 cursor-pointer" };
      }
      case "confirm_required":
        return { icon: <AlertTriangle className="h-3 w-3" />, label: "⚠️ 확인 필요", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200" };
      case "error":
        return { icon: <AlertTriangle className="h-3 w-3" />, label: `❌ ${action.message?.slice(0, 20)}`, color: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200" };
      default:
        return { icon: <Zap className="h-3 w-3" />, label: "실행됨", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200" };
    }
  };

  const handleClick = () => {
    switch (action.type) {
      case "navigate":
        if (action.target) {
          if (action.target === "/trading") {
            window.open("https://lifefit2.vercel.app/trading", "_blank", "noopener,noreferrer");
          } else if (action.target.startsWith("/")) {
            window.location.href = action.target;
          } else if (onNavigate) {
            onNavigate(action.target);
          }
        }
        break;
      case "open_window":
        if (action.url) {
          window.open(action.url, "_blank", "noopener,noreferrer");
        }
        break;
      case "data": {
        const navTarget = DATA_TYPE_NAV_MAP[action.dataType || ""];
        if (navTarget) {
          if (navTarget.startsWith("/")) {
            window.open("https://lifefit2.vercel.app/trading", "_blank", "noopener,noreferrer");
          } else if (onNavigate) {
            onNavigate(navTarget);
          }
        }
        break;
      }
    }
  };
  
  const info = getActionInfo();
  
  return (
    <button
      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${info.color} transition-opacity hover:opacity-80`}
      onClick={handleClick}
    >
      {info.icon}
      <span>{info.label}</span>
    </button>
  );
}

// Agent 데이터 결과 표시 패널
function AgentDataPanel({ result, onNavigate }: { result: AgentActionResult; onNavigate?: (tab: string) => void }) {
  const [expanded, setExpanded] = useState(true);

  if (result.type === "error") {
    return (
      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          {result.message}
        </p>
      </div>
    );
  }

  if (result.type !== "data" || !result.data) return null;

  const renderData = () => {
    switch (result.dataType) {
      case "stock_price": {
        const d = result.data;
        const isUp = parseFloat(d.changeRate) > 0;
        return (
          <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border">
            <div>
              <p className="text-sm font-bold">{d.name}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{d.stockCode}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">{Number(d.currentPrice).toLocaleString()}원</p>
              <p className={`text-xs font-medium ${isUp ? "text-red-500" : "text-blue-500"}`}>
                {isUp ? "▲" : "▼"} {d.changePrice} ({d.changeRate}%)
              </p>
            </div>
          </div>
        );
      }

      case "market_indices": {
        const d = result.data;
        return (
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(d).map(([name, val]: [string, any]) => {
              const isUp = parseFloat(val.changeRate) > 0;
              return (
                <div key={name} className="p-2 bg-white dark:bg-slate-900 rounded-lg border">
                  <p className="text-xs font-medium text-muted-foreground">{name.toUpperCase()}</p>
                  <p className="text-sm font-bold">{Number(val.value).toLocaleString()}</p>
                  <p className={`text-[10px] ${isUp ? "text-red-500" : "text-blue-500"}`}>
                    {isUp ? "▲" : "▼"} {val.change} ({val.changeRate}%)
                  </p>
                </div>
              );
            })}
          </div>
        );
      }

      case "global_indices": {
        const d = result.data;
        return (
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(d).map(([name, val]: [string, any]) => {
              const isUp = parseFloat(val.changeRate) > 0;
              return (
                <div key={name} className="p-2 bg-white dark:bg-slate-900 rounded-lg border">
                  <p className="text-[10px] font-medium text-muted-foreground">{name}</p>
                  <p className="text-sm font-bold">{Number(val.value).toLocaleString()}</p>
                  <p className={`text-[10px] ${isUp ? "text-red-500" : "text-blue-500"}`}>
                    {isUp ? "▲" : "▼"} {val.changeRate}%
                  </p>
                </div>
              );
            })}
          </div>
        );
      }

      case "exchange_rates": {
        const d = result.data;
        return (
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(d).map(([name, val]: [string, any]) => {
              const isUp = parseFloat(val.changeRate) > 0;
              return (
                <div key={name} className="p-2 bg-white dark:bg-slate-900 rounded-lg border">
                  <p className="text-[10px] font-medium text-muted-foreground">{name}</p>
                  <p className="text-sm font-bold">{Number(val.value).toLocaleString()}</p>
                  <p className={`text-[10px] ${isUp ? "text-red-500" : "text-blue-500"}`}>
                    {isUp ? "▲" : "▼"} {val.changeRate}%
                  </p>
                </div>
              );
            })}
          </div>
        );
      }

      case "search_results": {
        return (
          <div className="space-y-1">
            {result.data.map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded border hover:bg-muted/50 cursor-pointer text-xs"
                onClick={() => {
                  window.open(
                    `/stock-detail?code=${s.code}&name=${encodeURIComponent(s.name)}&market=${s.market}`,
                    "_blank"
                  );
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{s.code}</span>
                  <span className="font-medium">{s.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[9px]">{s.exchange || s.market}</Badge>
                  <Eye className="h-3 w-3 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        );
      }

      case "top_stocks":
      case "etf_top_gainers": {
        return (
          <div className="space-y-1">
            {result.data.slice(0, 10).map((s: any, i: number) => {
              const isUp = parseFloat(s.changeRate) > 0;
              return (
                <div key={i} className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-900 rounded border text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-4 text-right">{i + 1}</span>
                    <span className="font-medium truncate max-w-[150px]">{s.name}</span>
                    <span className="font-mono text-muted-foreground text-[10px]">{s.code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{Number(s.price).toLocaleString()}</span>
                    <span className={`text-[10px] font-medium ${isUp ? "text-red-500" : "text-blue-500"}`}>
                      {isUp ? "+" : ""}{s.changeRate}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }

      case "balance": {
        const d = result.data;
        const holdings = d?.holdings || d?.stocks || (Array.isArray(d) ? d : null);
        const summary = d?.summary;
        if (holdings && Array.isArray(holdings) && holdings.length > 0) {
          return (
            <div className="space-y-2">
              {/* 요약 정보 */}
              {summary && (
                <div className="grid grid-cols-2 gap-2 p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="text-xs">
                    <p className="text-muted-foreground">예수금</p>
                    <p className="font-bold">{Number(summary.depositAmount || 0).toLocaleString()}원</p>
                  </div>
                  <div className="text-xs">
                    <p className="text-muted-foreground">총 평가금액</p>
                    <p className="font-bold">{Number(summary.totalEvalAmount || 0).toLocaleString()}원</p>
                  </div>
                  <div className="text-xs">
                    <p className="text-muted-foreground">총 매입금액</p>
                    <p className="font-medium">{Number(summary.totalBuyAmount || 0).toLocaleString()}원</p>
                  </div>
                  <div className="text-xs">
                    <p className="text-muted-foreground">총 평가손익</p>
                    <p className={`font-bold ${(summary.totalEvalProfitLoss || 0) >= 0 ? "text-red-500" : "text-blue-500"}`}>
                      {(summary.totalEvalProfitLoss || 0) >= 0 ? "+" : ""}{Number(summary.totalEvalProfitLoss || 0).toLocaleString()}원
                      <span className="ml-1 text-[10px]">({(summary.totalEvalProfitRate || 0).toFixed(2)}%)</span>
                    </p>
                  </div>
                </div>
              )}
              {/* 보유종목 */}
              <div className="space-y-1">
                {holdings.map((s: any, i: number) => {
                  const profitLoss = s.evalProfitLoss ?? s.profitLoss ?? 0;
                  const profitRate = s.evalProfitRate ?? s.profitRate ?? 0;
                  const isUp = profitLoss >= 0;
                  return (
                    <div key={i} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded border text-xs">
                      <div>
                        <span className="font-medium">{s.stockName || s.name}</span>
                        <span className="text-muted-foreground ml-1 text-[10px]">({s.stockCode || s.code})</span>
                      </div>
                      <div className="text-right space-y-0.5">
                        <div>
                          <span className="font-medium">{Number(s.holdingQty || s.quantity || s.holdingQuantity || 0).toLocaleString()}주</span>
                          <span className="ml-1.5 text-muted-foreground">{Number(s.currentPrice || s.price || 0).toLocaleString()}원</span>
                        </div>
                        <div className={`text-[10px] font-medium ${isUp ? "text-red-500" : "text-blue-500"}`}>
                          {isUp ? "+" : ""}{Number(profitLoss).toLocaleString()}원 ({Number(profitRate).toFixed(2)}%)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }
        // fallback: 데이터가 있지만 알려진 구조가 아닌 경우
        return <pre className="text-[10px] overflow-auto max-h-40 bg-muted/50 p-2 rounded">{JSON.stringify(d, null, 2)}</pre>;
      }

      case "stock_news":
      case "market_news": {
        return (
          <div className="space-y-1">
            {result.data.map((n: any, i: number) => (
              <div key={i} className="p-1.5 bg-white dark:bg-slate-900 rounded border text-xs">
                <a href={n.link} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-blue-500 transition-colors line-clamp-1">
                  {n.title}
                </a>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span>{n.source}</span>
                  <span>{n.date}</span>
                </div>
              </div>
            ))}
          </div>
        );
      }

      case "watchlist": {
        return (
          <div className="space-y-1">
            {result.data.map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-900 rounded border text-xs cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  window.open(
                    `/stock-detail?code=${s.code}&name=${encodeURIComponent(s.name)}&market=${s.market}`,
                    "_blank"
                  );
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <span className="font-mono text-muted-foreground">{s.code}</span>
                </div>
                <Badge variant="outline" className="text-[9px]">{s.sector}</Badge>
              </div>
            ))}
          </div>
        );
      }

      case "order_result": {
        const d = result.data;
        return (
          <div className={`p-3 rounded-lg border ${d.success ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"}`}>
            <p className="text-sm font-medium">{d.success ? "✅ 주문 성공" : "❌ 주문 실패"}</p>
            <p className="text-xs text-muted-foreground mt-1">{d.message}</p>
            {d.orderNo && <p className="text-[10px] text-muted-foreground mt-0.5">주문번호: {d.orderNo}</p>}
          </div>
        );
      }

      default:
        return <pre className="text-[10px] overflow-auto max-h-40 bg-muted/50 p-2 rounded">{JSON.stringify(result.data, null, 2)}</pre>;
    }
  };

  const dataTypeLabel = {
    search_results: "🔍 종목 검색 결과",
    stock_price: "💹 종목 현재가",
    balance: "💰 계좌 잔고",
    market_indices: "📊 국내 시장 지수",
    global_indices: "🌍 해외 시장 지수",
    etf_top_gainers: "📈 상승 ETF TOP",
    sectors: "🏭 업종별 현황",
    top_stocks: "🏆 종목 순위",
    exchange_rates: "💱 환율",
    stock_news: "📰 종목 뉴스",
    market_news: "📰 시장 뉴스",
    watchlist: "⭐ 관심종목",
    order_result: "📋 주문 결과",
    orders: "📋 주문 내역",
    watchlist_etf: "⭐ 관심 ETF",
    research: "📑 리서치",
    etf_components: "📊 ETF 구성종목",
  }[result.dataType || ""] || "📊 조회 결과";

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs font-medium">{dataTypeLabel}</span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {expanded && (
        <div className="p-2">
          {renderData()}
        </div>
      )}
    </div>
  );
}

