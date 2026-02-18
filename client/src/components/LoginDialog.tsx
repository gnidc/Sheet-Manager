import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { LogIn, LogOut, Shield, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

// Google Identity Services 타입 선언
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Google 로고 SVG
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export function LoginDialog() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const rememberMeRef = useRef(rememberMe);

  const {
    isAdmin,
    isLoggedIn,
    userName,
    userEmail,
    userPicture,
    login,
    googleLogin,
    logout,
    isLoggingIn,
    isGoogleLoggingIn,
    isLoggingOut,
    isLoading: authLoading,
  } = useAuth();
  const { toast } = useToast();

  // rememberMe 변경 시 ref 동기화
  useEffect(() => {
    rememberMeRef.current = rememberMe;
  }, [rememberMe]);

  // Google OAuth 팝업 로그인 (INP 최적화: 팝업 열기 후 리스너는 rAF로 지연)
  const triggerGoogleLogin = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const callbackUrl = `${window.location.origin}/oauth-callback.html`;
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=token&scope=openid%20email%20profile&prompt=select_account`;

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    // 팝업은 즉시 열어야 브라우저가 차단하지 않음
    const popup = window.open(oauthUrl, "google-login", `width=${width},height=${height},left=${left},top=${top}`);
    
    if (!popup) {
      toast({ title: "팝업 차단됨", description: "브라우저의 팝업 차단을 해제해주세요.", variant: "destructive" });
      return;
    }

    setGoogleLoading(true);

    // 이벤트 리스너/폴링 등록은 rAF로 지연하여 UI 업데이트를 먼저 처리
    requestAnimationFrame(() => {
      let done = false;

      const finish = () => {
        done = true;
        clearInterval(pollInterval);
        window.removeEventListener("storage", onStorage);
      };

      const processToken = async (accessToken: string) => {
        if (done) return;
        finish();
        try {
          const userInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
          if (!userInfoRes.ok) {
            throw new Error(`Google userinfo 실패: ${userInfoRes.status}`);
          }
          const userInfo = await userInfoRes.json();
          const remember = rememberMeRef.current;
          
          const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken, userInfo, rememberMe: remember }),
            credentials: "include",
          });
          
          if (res.ok) {
            setLoginOpen(false);
            toast({
              title: "로그인 성공",
              description: remember ? "Google 계정으로 로그인되었습니다 (24시간 유지)" : "Google 계정으로 로그인되었습니다",
            });
            const { queryClient } = await import("@/lib/queryClient");
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          } else {
            let errMsg = `서버 에러 (${res.status})`;
            try { const errData = await res.json(); errMsg = errData.message || errMsg; } catch {}
            toast({ title: "로그인 실패", description: errMsg, variant: "destructive" });
          }
        } catch (err: any) {
          toast({ title: "로그인 실패", description: err.message || "Google 인증에 실패했습니다", variant: "destructive" });
        } finally {
          setGoogleLoading(false);
        }
      };

      const onStorage = (e: StorageEvent) => {
        if (e.key === "google-oauth-token" && e.newValue) {
          localStorage.removeItem("google-oauth-token");
          processToken(e.newValue);
        }
      };
      window.addEventListener("storage", onStorage);

      const pollInterval = setInterval(() => {
        const token = localStorage.getItem("google-oauth-token");
        if (token && !done) {
          localStorage.removeItem("google-oauth-token");
          processToken(token);
          return;
        }
        if (popup.closed && !done) {
          finish();
          setGoogleLoading(false);
        }
      }, 500);

      setTimeout(() => {
        if (!done) {
          finish();
          setGoogleLoading(false);
          if (!popup.closed) popup.close();
          toast({ title: "로그인 시간 초과", description: "다시 시도해주세요.", variant: "destructive" });
        }
      }, 30000);
    });
  }, [toast]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ username, password, rememberMe });
      setLoginOpen(false);
      setUsername("");
      setPassword("");
      toast({
        title: "관리자 로그인 성공",
        description: rememberMe
          ? "Admin 모드 활성화 (24시간 유지)"
          : "Admin 모드 활성화",
      });
    } catch (err) {
      toast({
        title: "로그인 실패",
        description: "잘못된 관리자 정보입니다",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "로그아웃 완료", description: "로그아웃되었습니다" });
    } catch (err) {
      toast({
        title: "오류",
        description: "로그아웃 실패",
        variant: "destructive",
      });
    }
  };

  // Google 로그인 버튼 컴포넌트
  const GoogleLoginButton = ({ label }: { label?: string }) => (
    <Button
      variant="outline"
      className="w-full h-11 gap-3 text-sm font-medium border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
      onClick={triggerGoogleLogin}
      disabled={googleLoading || isGoogleLoggingIn}
    >
      {googleLoading || isGoogleLoggingIn ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <GoogleLogo />
      )}
      {label || "Google 계정으로 로그인"}
    </Button>
  );

  // 인증 상태 확인 중 (브라우저 새로고침 시 세션 확인)
  if (authLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground hidden sm:inline">확인 중...</span>
      </div>
    );
  }

  // 로그인 상태일 때
  if (isLoggedIn || isAdmin) {
    return (
      <div className="flex items-center gap-2">
        {userPicture ? (
          <img
            src={userPicture}
            alt={userName || "User"}
            className="w-7 h-7 rounded-full border"
          />
        ) : isAdmin ? (
          <Shield className="w-5 h-5 text-emerald-500" />
        ) : null}
        <span className="text-sm font-medium hidden sm:inline max-w-[120px] truncate">
          {isAdmin ? "Admin" : userName || userEmail || "User"}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="gap-1"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">로그아웃</span>
        </Button>
      </div>
    );
  }

  // 비로그인 상태: 로그인 + 계정생성 버튼
  return (
    <div className="flex items-center gap-2">
      {/* 로그인 버튼 */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setLoginOpen(true)}
          data-testid="button-login"
        >
          <LogIn className="w-4 h-4" />
          구글계정 로그인
        </Button>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5" />
              로그인
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Google 로그인 버튼 */}
            {GOOGLE_CLIENT_ID ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Google 계정으로 간편 로그인
                </p>
                <GoogleLoginButton />
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg">
                Google OAuth가 설정되지 않았습니다.
                <br />
                <span className="text-xs">VITE_GOOGLE_CLIENT_ID 환경변수를 설정하세요.</span>
              </div>
            )}

            {/* 로그인 유지 체크박스 */}
            <div className="flex items-center space-x-2 justify-center">
              <Checkbox
                id="rememberMe-login"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label
                htmlFor="rememberMe-login"
                className="text-sm font-normal cursor-pointer select-none"
              >
                로그인 유지 (24시간)
              </Label>
            </div>

            {/* 구분선 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  또는
                </span>
              </div>
            </div>

            {/* 관리자 로그인 토글 */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground gap-2"
                onClick={() => setShowAdminLogin(!showAdminLogin)}
              >
                <Shield className="w-4 h-4" />
                관리자 로그인
                {showAdminLogin ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>

              {showAdminLogin && (
                <form
                  onSubmit={handleAdminLogin}
                  className="space-y-3 mt-3 p-3 bg-muted/20 rounded-lg border"
                >
                  <div className="space-y-2">
                    <Label htmlFor="admin-username" className="text-xs">
                      Username
                    </Label>
                    <Input
                      id="admin-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="관리자 아이디"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password" className="text-xs">
                      Password
                    </Label>
                    <Input
                      id="admin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="관리자 비밀번호"
                      className="h-9 text-sm"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    className="w-full"
                    disabled={isLoggingIn}
                  >
                    {isLoggingIn ? "로그인 중..." : "관리자 로그인"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
