import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AuthData {
  isAdmin: boolean;
  userId: number | null;
  userEmail: string | null;
  userName: string | null;
  userPicture: string | null;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<AuthData | null>({
    queryKey: ["/api/auth/me"],
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
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
