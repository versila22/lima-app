import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, isSameDay, isSameMonth, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Loader2,
  LogIn,
  MousePointerClick,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { useAuth } from "@/contexts/AuthContext";
import {
  fetchActivityStats,
  fetchLoginStats,
  fetchRecentActivity,
} from "@/lib/api";
import type { ActivityLog, EndpointStat, LoginAttempt } from "@/types";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const PAGE_FILTERS = [
  { label: "Aujourd'hui", value: 1 },
  { label: "7 jours", value: 7 },
  { label: "30 jours", value: 30 },
] as const;

const pageChartConfig = {
  count: {
    label: "Visites",
    color: "hsl(var(--cabaret-purple))",
  },
};

const dauChartConfig = {
  count: {
    label: "Utilisateurs actifs",
    color: "hsl(var(--cabaret-gold))",
  },
};

function isLoginPath(path?: string | null): boolean {
  if (!path) return false;
  const normalized = path.toLowerCase();
  return normalized.includes("/auth/login") || normalized.includes("login");
}

function formatUserLabel(item: { name?: string | null; email?: string | null }) {
  if (item.name && item.email) return `${item.name} · ${item.email}`;
  return item.name || item.email || "Utilisateur inconnu";
}

function deriveLoginAttemptsFromActivity(logs: ActivityLog[]): LoginAttempt[] {
  return logs
    .filter((log) => isLoginPath(log.path))
    .map((log) => ({
      id: log.id,
      user_id: log.user_id,
      email: log.email,
      name: log.name,
      success: typeof log.status_code === "number" ? log.status_code < 400 : true,
      created_at: log.created_at,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function StatsCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-border/50 bg-card/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function SectionSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
    </div>
  );
}

export default function Stats() {
  const { user, isLoading: authLoading } = useAuth();
  const [pageWindow, setPageWindow] = useState<1 | 7 | 30>(7);
  const isAdmin = user?.app_role === "admin";

  const daysSinceMonthStart = new Date().getDate();
  const loginWindow = Math.max(30, daysSinceMonthStart);

  const { data: pageStats, isLoading: pageStatsLoading, isError: pageStatsError } = useQuery({
    queryKey: ["activity-stats", pageWindow],
    queryFn: () => fetchActivityStats(pageWindow),
    enabled: isAdmin,
  });

  const { data: monthlyStats, isLoading: monthlyStatsLoading, isError: monthlyStatsError } = useQuery({
    queryKey: ["activity-stats", 30],
    queryFn: () => fetchActivityStats(30),
    enabled: isAdmin,
  });

  const { data: sevenDayStats } = useQuery({
    queryKey: ["activity-stats", 7, "summary"],
    queryFn: () => fetchActivityStats(7),
    enabled: isAdmin && pageWindow !== 7,
  });

  const { data: loginStats, isLoading: loginStatsLoading, isError: loginStatsError } = useQuery({
    queryKey: ["activity-logins", loginWindow],
    queryFn: () => fetchLoginStats(loginWindow),
    enabled: isAdmin,
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ["activity-recent", 50],
    queryFn: () => fetchRecentActivity(50),
    enabled: isAdmin,
  });

  const loginAttempts = useMemo(() => {
    if (loginStats?.attempts?.length) return loginStats.attempts;
    return deriveLoginAttemptsFromActivity(recentActivity);
  }, [loginStats, recentActivity]);

  const successfulToday = useMemo(
    () =>
      loginAttempts.filter((attempt) => {
        if (!attempt.success) return false;
        try {
          return isSameDay(parseISO(attempt.created_at), new Date());
        } catch {
          return false;
        }
      }).length,
    [loginAttempts],
  );

  const successfulThisMonth = useMemo(
    () =>
      loginAttempts.filter((attempt) => {
        if (!attempt.success) return false;
        try {
          return isSameMonth(parseISO(attempt.created_at), new Date());
        } catch {
          return false;
        }
      }).length,
    [loginAttempts],
  );

  const topPages = pageStats?.top_endpoints ?? [];
  const totalTopPageHits = topPages.reduce((sum, item) => sum + item.count, 0);
  const displayedErrors = pageStats?.error_endpoints ?? [];

  const dauData = useMemo(
    () =>
      (monthlyStats?.daily_active_users ?? []).map((item) => ({
        ...item,
        label: format(parseISO(item.date), "dd/MM", { locale: fr }),
      })),
    [monthlyStats],
  );

  const recentLogins = loginAttempts.slice(0, 10);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/cabaret" replace />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold">
            <Activity className="h-5 w-5 text-background" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Statistiques</h1>
            <p className="text-sm text-muted-foreground">
              Tableau de bord d'usage et d'activité réservé aux administrateurs.
            </p>
          </div>
        </div>

        <Badge variant="outline" className="w-fit border-primary/40 text-primary">
          Admin uniquement
        </Badge>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Connexions</h2>
          <p className="text-sm text-muted-foreground">
            Vue rapide des authentifications réussies et des dernières tentatives.
          </p>
        </div>

        {loginStatsLoading || monthlyStatsLoading ? (
          <SectionSkeleton />
        ) : loginStatsError || monthlyStatsError ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-6 text-sm text-destructive">
              Impossible de charger les statistiques de connexion.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <StatsCard
                title="Connexions aujourd'hui"
                value={successfulToday.toLocaleString("fr-FR")}
                description="Succès sur la journée en cours"
                icon={LogIn}
              />
              <StatsCard
                title="Connexions ce mois"
                value={successfulThisMonth.toLocaleString("fr-FR")}
                description="Succès depuis le début du mois"
                icon={Users}
              />
              <StatsCard
                title="Utilisateurs actifs (7j)"
                value={(pageWindow === 7 ? pageStats?.unique_users : sevenDayStats?.unique_users ?? 0).toLocaleString("fr-FR")}
                description="Basé sur l'activité observée"
                icon={MousePointerClick}
              />
            </div>

            <Card className="border-border/50 bg-card/60">
              <CardHeader>
                <CardTitle>Connexions récentes</CardTitle>
                <CardDescription>Dernières tentatives de connexion connues.</CardDescription>
              </CardHeader>
              <CardContent>
                {recentLogins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune tentative récente disponible.</p>
                ) : (
                  <div className="space-y-3">
                    {recentLogins.map((attempt, index) => (
                      <div
                        key={`${attempt.created_at}-${attempt.email ?? attempt.name ?? index}`}
                        className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/30 p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-medium">{formatUserLabel(attempt)}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(attempt.created_at), "dd MMM yyyy à HH:mm", { locale: fr })}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={attempt.success ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"}
                        >
                          {attempt.success ? "Succès" : "Échec"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Activité par page</h2>
            <p className="text-sm text-muted-foreground">
              Pages les plus visitées, avec part relative sur la période sélectionnée.
            </p>
          </div>

          <ToggleGroup
            type="single"
            value={String(pageWindow)}
            onValueChange={(value) => {
              if (value === "1" || value === "7" || value === "30") {
                setPageWindow(Number(value) as 1 | 7 | 30);
              }
            }}
            className="justify-start"
          >
            {PAGE_FILTERS.map((filter) => (
              <ToggleGroupItem key={filter.value} value={String(filter.value)} variant="outline" size="sm">
                {filter.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <Card className="border-border/50 bg-card/60">
          <CardHeader>
            <CardTitle>Pages visitées</CardTitle>
            <CardDescription>
              Top des endpoints consultés sur {pageWindow === 1 ? "la journée" : `les ${pageWindow} derniers jours`}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {pageStatsLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : pageStatsError ? (
              <p className="text-sm text-destructive">Impossible de charger l'activité par page.</p>
            ) : topPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune visite enregistrée sur cette période.</p>
            ) : (
              <>
                <ChartContainer config={pageChartConfig} className="h-[280px] w-full aspect-auto">
                  <BarChart data={topPages.slice(0, 8)} layout="vertical" margin={{ left: 16, right: 16 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="path"
                      width={140}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => String(value).replace("/", "") || "/"}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent formatter={(value) => <span>{Number(value).toLocaleString("fr-FR")} visites</span>} />}
                    />
                    <Bar dataKey="count" fill="var(--color-count)" radius={6} />
                  </BarChart>
                </ChartContainer>

                <div className="rounded-lg border border-border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead>Page</TableHead>
                        <TableHead className="text-right">Visites</TableHead>
                        <TableHead className="text-right">% du total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topPages.map((item: EndpointStat) => {
                        const share = totalTopPageHits > 0 ? (item.count / totalTopPageHits) * 100 : 0;
                        return (
                          <TableRow key={item.path} className="border-border hover:bg-sidebar-accent/30">
                            <TableCell className="font-mono text-xs text-foreground">{item.path}</TableCell>
                            <TableCell className="text-right">{item.count.toLocaleString("fr-FR")}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{share.toFixed(1)}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Activité journalière</h2>
          <p className="text-sm text-muted-foreground">
            Utilisateurs actifs jour par jour sur les 30 derniers jours.
          </p>
        </div>

        <Card className="border-border/50 bg-card/60">
          <CardHeader>
            <CardTitle>Tendance DAU</CardTitle>
            <CardDescription>
              {monthlyStats?.avg_response_time_ms
                ? `Temps de réponse moyen : ${Math.round(monthlyStats.avg_response_time_ms)} ms`
                : "Vue sur les 30 derniers jours."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyStatsLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : monthlyStatsError ? (
              <p className="text-sm text-destructive">Impossible de charger l'activité journalière.</p>
            ) : dauData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Pas assez de données pour afficher une tendance.</p>
            ) : (
              <ChartContainer config={dauChartConfig} className="h-[320px] w-full aspect-auto">
                <LineChart data={dauData} margin={{ left: 12, right: 12 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="line" />}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-count)"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "var(--color-count)" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {displayedErrors.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Erreurs</h2>
            <p className="text-sm text-muted-foreground">
              Endpoints remontant des erreurs 4xx / 5xx sur la période sélectionnée.
            </p>
          </div>

          <Card className="border-border/50 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Endpoints en erreur
              </CardTitle>
              <CardDescription>Sur {pageWindow === 1 ? "la journée" : `les ${pageWindow} derniers jours`}.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Endpoint</TableHead>
                      <TableHead className="text-right">Erreurs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedErrors.map((item) => (
                      <TableRow key={item.path} className="border-border hover:bg-sidebar-accent/30">
                        <TableCell className="font-mono text-xs">{item.path}</TableCell>
                        <TableCell className="text-right text-destructive">{item.count.toLocaleString("fr-FR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Total requêtes"
          value={(pageStats?.total_requests ?? 0).toLocaleString("fr-FR")}
          description="Sur la fenêtre de filtrage en cours"
          icon={Activity}
        />
        <StatsCard
          title="Temps de réponse moyen"
          value={`${Math.round(pageStats?.avg_response_time_ms ?? 0)} ms`}
          description="Mesure backend moyenne"
          icon={Clock3}
        />
        <StatsCard
          title="Succès connexions"
          value={String(loginStats?.success_count ?? loginAttempts.filter((item) => item.success).length)}
          description="Sur la fenêtre de login chargée"
          icon={LogIn}
        />
        <StatsCard
          title="Échecs connexions"
          value={String(loginStats?.failure_count ?? loginAttempts.filter((item) => !item.success).length)}
          description="Tentatives refusées ou invalides"
          icon={AlertTriangle}
        />
      </div>
    </div>
  );
}
