import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AuthData {
  isAdmin: boolean;
  userId: number | null;
  userEmail: string | null;
  userName: string | null;
  userPicture: string | null;
}

// localStorage 키
const AUTH_CACHE_KEY = "auth-cache";

// 인증 데이터를 localStorage에 저장 (새로고침 시 즉시 복원용)
function saveAuthToLocal(data: AuthData | null) {
  try {
    if (data && (data.userId || data.isAdmin)) {
      localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
        ...data,
        cachedAt: Date.now(),
      }));
    } else {
      localStorage.removeItem(AUTH_CACHE_KEY);
    }
  } catch {}
}

// localStorage에서 인증 데이터 복원 (24시간 이내만 유효)
function loadAuthFromLocal(): AuthData | null {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    // 24시간 이내 캐시만 사용
    if (Date.now() - cached.cachedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }
    return {
      isAdmin: cached.isAdmin ?? false,
      userId: cached.userId ?? null,
      userEmail: cached.userEmail ?? null,
      userName: cached.userName ?? null,
      userPicture: cached.userPicture ?? null,
    };
  } catch {
    return null;
  }
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<AuthData | null>({
    queryKey: ["/api/auth/me"],
    staleTime: 5 * 60 * 1000,
    // localStorage 캐시를 initialData로 사용 → 서버 응답 전까지 즉시 표시
    initialData: () => {
      // react-query 캐시에 이미 데이터가 있으면 localStorage 무시
      const existing = queryClient.getQueryData<AuthData | null>(["/api/auth/me"]);
      if (existing !== undefined) return undefined;
      return loadAuthFromLocal();
    },
    initialDataUpdatedAt: () => {
      // initialData의 "신선도"를 현재시간-5분으로 설정하여 즉시 백그라운드 refetch 트리거
      return Date.now() - 5 * 60 * 1000;
    },
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string, { credentials: "include" });
      if (res.status === 401) {
        saveAuthToLocal(null);
        return null;
      }
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const authData: AuthData = await res.json();
      // 서버 응답을 localStorage에 저장
      saveAuthToLocal(authData);
      return authData;
    },
    retry: false,
  });

  // 로그인/로그아웃 시 계정별 데이터 캐시 갱신
  const invalidateUserData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/trading/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/trading/config"] });
    queryClient.invalidateQueries({ queryKey: ["/api/trading/rules"] });
    queryClient.invalidateQueries({ queryKey: ["/api/trading/orders"] });
  };

  // Admin 로그인 (기존)
  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string; rememberMe?: boolean }) => {
      const res = await apiRequest("POST", "/api/auth/login", credentials);
      return res.json();
    },
    onSuccess: invalidateUserData,
  });

  // Google 로그인/계정생성
  const googleLoginMutation = useMutation({
    mutationFn: async (params: { credential?: string; accessToken?: string; userInfo?: any; rememberMe?: boolean }) => {
      const res = await apiRequest("POST", "/api/auth/google", params);
      return res.json();
    },
    onSuccess: invalidateUserData,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/logout");
      return res.json();
    },
    onSuccess: () => {
      // localStorage 캐시도 즉시 제거
      saveAuthToLocal(null);
      // 즉시 캐시를 null로 설정하여 UI가 바로 비로그인 상태로 전환
      queryClient.setQueryData(["/api/auth/me"], null);
      // 계정별 데이터 캐시도 모두 제거
      queryClient.removeQueries({ queryKey: ["/api/bookmarks"] });
      queryClient.removeQueries({ queryKey: ["/api/trading/status"] });
      queryClient.removeQueries({ queryKey: ["/api/trading/config"] });
      queryClient.removeQueries({ queryKey: ["/api/trading/rules"] });
      queryClient.removeQueries({ queryKey: ["/api/trading/orders"] });
      invalidateUserData();
    },
  });

  return {
    isAdmin: data?.isAdmin ?? false,
    isLoggedIn: !!(data?.userId || data?.isAdmin),
    userId: data?.userId ?? null,
    userEmail: data?.userEmail ?? null,
    userName: data?.userName ?? null,
    userPicture: data?.userPicture ?? null,
    isLoading,
    login: loginMutation.mutateAsync,
    googleLogin: googleLoginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isGoogleLoggingIn: googleLoginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    loginError: loginMutation.error,
    googleLoginError: googleLoginMutation.error,
  };
}
