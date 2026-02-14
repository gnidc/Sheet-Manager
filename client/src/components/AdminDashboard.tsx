import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Eye, Clock, TrendingUp, BarChart3, Loader2,
  RefreshCw, Calendar, Globe, Monitor, UserCheck, Activity,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, AreaChart, Area,
} from "recharts";

interface DashboardStats {
  summary: {
    totalVisits: number;
    uniqueVisitors: number;
    todayVisits: number;
    todayUniqueVisitors: number;
    totalUsers: number;
    period: string;
  };
  dailyStats: { date: string; totalVisits: number; uniqueVisitors: number }[];
  userStats: { email: string; name: string; count: number; lastVisit: string }[];
  hourlyStats: { hour: number; count: number }[];
  pageStats: { page: string; count: number }[];
  recentLogs: {
    id: number;
    userEmail: string;
    userName: string;
    ipAddress: string;
    page: string;
    visitedAt: string;
  }[];
}

interface AdminUser {
  id: number;
  email: string;
  name: string;
  isAdmin: boolean;
  createdAt: string;
}

const PAGE_NAMES: Record<string, string> = {
  "/": "홈",
  "home": "홈",
  "etf-components": "실시간ETF",
  "new-etf": "신규ETF",
  "watchlist-etf": "관심(Core)",
  "satellite-etf": "관심(Satellite)",
  "etf-search": "ETF검색",
  "markets-domestic": "국내증시",
  "markets-global": "해외증시",
  "markets-research": "리서치",
  "strategy-daily": "일일보고서",
  "domestic-stocks": "국내주식",
  "overseas-stocks": "해외주식",
  "tenbagger": "10X",
  "ai-agent": "AI Agent",
  "steem-report": "스팀보고서",
  "steem-reader": "스팀글읽기",
  "bookmarks": "즐겨찾기",
  "admin-dashboard": "대시보드",
};

export default function AdminDashboard() {
  const [period, setPeriod] = useState("30");
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "pages" | "logs">("overview");

  const { data: stats, isLoading, refetch } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard/stats", period],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/dashboard/stats?days=${period}`);
      return res.json();
    },
    refetchInterval: 60000, // 1분마다 자동 갱신
  });

  const { data: registeredUsers } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/users");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">대시보드 로딩 중...</span>
      </div>
    );
  }

  const summary = stats?.summary;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Admin Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-1">방문자 통계 및 사용자 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">최근 7일</SelectItem>
              <SelectItem value="14">최근 14일</SelectItem>
              <SelectItem value="30">최근 30일</SelectItem>
              <SelectItem value="90">최근 90일</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1 h-8">
            <RefreshCw className="h-3.5 w-3.5" /> 새로고침
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <SummaryCard icon={<Eye className="h-5 w-5 text-blue-500" />}
            title="오늘 방문" value={summary.todayVisits} sub={`고유 ${summary.todayUniqueVisitors}명`} color="blue" />
          <SummaryCard icon={<TrendingUp className="h-5 w-5 text-green-500" />}
            title={`${summary.period} 총방문`} value={summary.totalVisits} sub={`고유 ${summary.uniqueVisitors}명`} color="green" />
          <SummaryCard icon={<Users className="h-5 w-5 text-purple-500" />}
            title="가입 사용자" value={registeredUsers?.length || summary.totalUsers} sub="전체 등록 계정" color="purple" />
          <SummaryCard icon={<UserCheck className="h-5 w-5 text-amber-500" />}
            title="활성 사용자" value={stats?.userStats?.length || 0} sub={`${summary.period} 내 접속`} color="amber" />
          <SummaryCard icon={<Activity className="h-5 w-5 text-red-500" />}
            title="평균 일방문" value={stats?.dailyStats && stats.dailyStats.length > 0
              ? Math.round(summary.totalVisits / stats.dailyStats.length) : 0}
            sub="일 평균 페이지뷰" color="red" />
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 border-b">
        {([
          { key: "overview", label: "📊 개요", },
          { key: "users", label: "👥 사용자" },
          { key: "pages", label: "📄 페이지" },
          { key: "logs", label: "📋 접속 로그" },
        ] as const).map(tab => (
          <button key={tab.key}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      {activeTab === "overview" && stats && <OverviewTab stats={stats} />}
      {activeTab === "users" && <UsersTab userStats={stats?.userStats || []} registeredUsers={registeredUsers || []} />}
      {activeTab === "pages" && <PagesTab pageStats={stats?.pageStats || []} />}
      {activeTab === "logs" && <LogsTab logs={stats?.recentLogs || []} />}
    </div>
  );
}

// ========== 요약 카드 ==========
function SummaryCard({ icon, title, value, sub, color }: {
  icon: React.ReactNode; title: string; value: number; sub: string; color: string;
}) {
  const bgMap: Record<string, string> = {
    blue: "bg-blue-50 dark:bg-blue-950/30",
    green: "bg-green-50 dark:bg-green-950/30",
    purple: "bg-purple-50 dark:bg-purple-950/30",
    amber: "bg-amber-50 dark:bg-amber-950/30",
    red: "bg-red-50 dark:bg-red-950/30",
  };
  return (
    <Card className={bgMap[color] || ""}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-xs text-muted-foreground font-medium">{title}</span>
        </div>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}

// ========== 개요 탭 ==========
function OverviewTab({ stats }: { stats: DashboardStats }) {
  return (
    <div className="space-y-4">
      {/* 일별 방문 추이 */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" /> 일별 방문 추이
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.dailyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={stats.dailyStats}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }}
                  tickFormatter={(d) => { const dt = new Date(d); return `${dt.getMonth()+1}/${dt.getDate()}`; }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  labelFormatter={(d) => new Date(d).toLocaleDateString("ko-KR")}
                  formatter={(v: number, name: string) => [v, name === "totalVisits" ? "총 방문" : "고유 방문자"]} />
                <Area type="monotone" dataKey="totalVisits" name="totalVisits"
                  stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
                <Area type="monotone" dataKey="uniqueVisitors" name="uniqueVisitors"
                  stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">방문 데이터가 없습니다.</div>
          )}
        </CardContent>
      </Card>

      {/* 시간대별 방문 */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" /> 시간대별 방문 분포
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.hourlyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.hourlyStats}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }}
                  tickFormatter={(h) => `${h}시`} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip labelFormatter={(h) => `${h}시`}
                  formatter={(v: number) => [v, "방문"]} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {stats.hourlyStats.map((_, i) => (
                    <Cell key={i} fill={`hsl(${210 + (i * 5)}, 70%, ${50 + (i % 2) * 10}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">시간대별 데이터가 없습니다.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ========== 사용자 탭 ==========
function UsersTab({ userStats, registeredUsers }: {
  userStats: DashboardStats["userStats"];
  registeredUsers: AdminUser[];
}) {
  return (
    <div className="space-y-4">
      {/* 활성 사용자 (방문 기록 기준) */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserCheck className="h-4 w-4" /> 계정별 방문 내역
            <Badge variant="secondary" className="ml-auto">{userStats.length}명</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">#</th>
                  <th className="text-left px-3 py-2 font-medium">이름</th>
                  <th className="text-left px-3 py-2 font-medium">이메일</th>
                  <th className="text-right px-3 py-2 font-medium">방문 수</th>
                  <th className="text-right px-3 py-2 font-medium">최근 방문</th>
                </tr>
              </thead>
              <tbody>
                {userStats.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">방문 기록이 없습니다.</td></tr>
                ) : (
                  userStats.map((user, i) => (
                    <tr key={i} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{user.name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{user.email}</td>
                      <td className="text-right px-3 py-2">
                        <Badge variant="secondary">{user.count}</Badge>
                      </td>
                      <td className="text-right px-3 py-2 text-xs text-muted-foreground">
                        {new Date(user.lastVisit).toLocaleString("ko-KR", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 등록된 사용자 */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> 등록 사용자 목록
            <Badge variant="secondary" className="ml-auto">{registeredUsers.length}명</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">#</th>
                  <th className="text-left px-3 py-2 font-medium">이름</th>
                  <th className="text-left px-3 py-2 font-medium">이메일</th>
                  <th className="text-center px-3 py-2 font-medium">권한</th>
                  <th className="text-right px-3 py-2 font-medium">가입일</th>
                </tr>
              </thead>
              <tbody>
                {registeredUsers.map((user, i) => (
                  <tr key={user.id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{user.name || "-"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{user.email}</td>
                    <td className="text-center px-3 py-2">
                      {user.isAdmin ? (
                        <Badge variant="destructive" className="text-xs">Admin</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">User</Badge>
                      )}
                    </td>
                    <td className="text-right px-3 py-2 text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ========== 페이지 탭 ==========
function PagesTab({ pageStats }: { pageStats: DashboardStats["pageStats"] }) {
  const maxCount = Math.max(...pageStats.map(p => p.count), 1);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Globe className="h-4 w-4" /> 페이지별 방문 통계
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pageStats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">페이지 방문 데이터가 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {pageStats.map((page, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}</span>
                <span className="text-sm font-medium w-32 truncate">
                  {PAGE_NAMES[page.page] || page.page}
                </span>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/70 rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${Math.max((page.count / maxCount) * 100, 5)}%` }}>
                    <span className="text-xs text-white font-mono">{page.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ========== 접속 로그 탭 ==========
function LogsTab({ logs }: { logs: DashboardStats["recentLogs"] }) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Monitor className="h-4 w-4" /> 최근 접속 로그
          <Badge variant="secondary" className="ml-auto">{logs.length}건</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium">시간</th>
                <th className="text-left px-3 py-2 font-medium">사용자</th>
                <th className="text-left px-3 py-2 font-medium">페이지</th>
                <th className="text-left px-3 py-2 font-medium hidden md:table-cell">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">접속 로그가 없습니다.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.visitedAt).toLocaleString("ko-KR", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="text-xs font-medium">{log.userName || log.userEmail || "비로그인"}</div>
                      {log.userEmail && (
                        <div className="text-xs text-muted-foreground">{log.userEmail}</div>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <Badge variant="outline" className="text-xs">
                        {PAGE_NAMES[log.page] || log.page}
                      </Badge>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground hidden md:table-cell font-mono">
                      {log.ipAddress}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

