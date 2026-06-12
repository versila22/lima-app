import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Home,
  Calendar,
  CalendarDays,
  Settings,
  Users,
  User,
  BarChart3,
  Globe,
  Instagram,
  Facebook,
  LogOut,
  X,
  Images,
  MessageSquareWarning,
  Gift,
  Shield,
} from "lucide-react";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import limaLogo from "@/assets/logo-lima.jpg";
import logoLimaCouleur from "@/assets/posters/logo-lima-couleur.png";
import { LIMA_WEBSITE, LIMA_FACEBOOK, LIMA_INSTAGRAM } from "@/lib/socials";

interface AppSidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  isMobile?: boolean;
}

const menuItems = [
  { icon: Home, label: "Accueil", path: "/" },
  { icon: Sparkles, label: "Organisateur Cabaret", path: "/cabaret" },
  { icon: Calendar, label: "Agenda", path: "/agenda" },
  { icon: User, label: "Mon Profil", path: "/mon-profil" },
  { icon: CalendarDays, label: "Mon Planning", path: "/mon-planning" },
  { icon: Images, label: "Galerie", path: "/galerie" },
  { icon: Users, label: "Membres", path: "/membres" },
  // { icon: LayoutGrid, label: "Alignements", path: "/alignements", adminOnly: true }, // masqué jusqu'en septembre
  { icon: BarChart3, label: "Statistiques", path: "/stats", adminOnly: true },
  { icon: MessageSquareWarning, label: "Remarques / bugs", path: "/admin/feedback", adminOnly: true },
  { icon: Settings, label: "Paramètres", path: "/settings", adminOnly: true },
];

export function AppSidebar({
  collapsed,
  onCollapse,
  mobileOpen = false,
  onMobileOpenChange,
  isMobile = false,
}: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const isAdmin = user?.app_role === "admin";
  const handleLogout = () => {
    logout();
    onMobileOpenChange?.(false);
    navigate("/login", { replace: true });
  };

  const handleNavigate = () => {
    if (isMobile) {
      onMobileOpenChange?.(false);
    }
  };

  const visibleItems = menuItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside
      className={cn(
        "top-0 h-screen border-r border-sidebar-border bg-sidebar transition-all duration-300 z-50",
        isMobile
          ? cn(
              "fixed left-0 flex flex-col w-72 max-w-[85vw] transform shadow-2xl",
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            )
          : cn("fixed left-0 hidden md:flex flex-col", collapsed ? "w-16" : "w-64")
      )}
    >
      <div className="border-b border-sidebar-border p-4">
        <div className="mb-3 flex items-center justify-between gap-2 md:mb-0">
          <div className="flex items-center gap-3 min-w-0">
            {(collapsed && !isMobile) ? (
              <img
                src={limaLogo}
                alt="LIMA"
                className="w-10 h-10 rounded-lg object-contain bg-white shrink-0"
              />
            ) : (
              <div className="bg-white rounded-xl px-3 py-1.5 shrink-0">
                <img
                  src={logoLimaCouleur}
                  alt="LIMA"
                  className="h-9 w-auto object-contain"
                />
              </div>
            )}
          </div>

          {isMobile && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => onMobileOpenChange?.(false)}
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          const content = (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 group",
                isActive
                  ? "bg-primary/10 text-primary glow-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  isActive && "text-primary"
                )}
              />
              {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (collapsed && !isMobile) {
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>{content}</TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border-border">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          }

          return content;
        })}
      </nav>

      {/* Feedback / bug report */}
      <div className="border-t border-sidebar-border p-2">
        {collapsed && !isMobile ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <FeedbackDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                    aria-label="Remarques / bugs"
                  >
                    <MessageSquareWarning className="w-4 h-4" />
                  </Button>
                }
              />
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover border-border">
              Remarques / bugs
            </TooltipContent>
          </Tooltip>
        ) : (
          <FeedbackDialog
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-primary hover:bg-primary/10"
              >
                <MessageSquareWarning className="w-4 h-4 shrink-0" />
                <span className="truncate">Remarques / bugs</span>
              </Button>
            }
          />
        )}
      </div>

      {isAuthenticated && (
        <div className="border-t border-sidebar-border p-2">
          {collapsed && !isMobile ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-popover border-border">
                Déconnexion
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {user?.first_name ? `Déconnexion (${user.first_name})` : "Déconnexion"}
              </span>
            </Button>
          )}
        </div>
      )}

      {/* Données personnelles */}
      <div className="border-t border-sidebar-border px-2 pt-2 pb-1">
        {collapsed && !isMobile ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
                to="/donnees-personnelles"
                className="flex justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                aria-label="Données personnelles"
              >
                <Shield className="w-4 h-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover border-border">
              Données personnelles
            </TooltipContent>
          </Tooltip>
        ) : (
          <Link
            to="/donnees-personnelles"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Données personnelles</span>
          </Link>
        )}
      </div>

      <div
        className={cn(
          "border-t border-sidebar-border p-2 flex gap-2",
          collapsed && !isMobile ? "flex-col items-center" : "justify-center"
        )}
      >
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <a
              href={LIMA_WEBSITE}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Globe className="w-5 h-5" />
            </a>
          </TooltipTrigger>
          <TooltipContent side="right">Site web LIMA</TooltipContent>
        </Tooltip>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <a
              href={LIMA_INSTAGRAM}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Instagram className="w-5 h-5" />
            </a>
          </TooltipTrigger>
          <TooltipContent side="right">Instagram</TooltipContent>
        </Tooltip>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <a
              href={LIMA_FACEBOOK}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Facebook className="w-5 h-5" />
            </a>
          </TooltipTrigger>
          <TooltipContent side="right">Facebook</TooltipContent>
        </Tooltip>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <a
              href="https://ko-fi.com/jeromejacq"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2 text-rose-400/80 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
              aria-label="Soutenir le développeur"
            >
              <Gift className="w-5 h-5" />
            </a>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-popover border-border max-w-[220px]">
            <p className="font-medium">Soutenir le développeur</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Don personnel à Jérôme — ne va pas à LIMA
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {!isMobile && (
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCollapse(!collapsed)}
            className="w-full justify-center text-muted-foreground hover:text-foreground"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="ml-2">Réduire</span>
              </>
            )}
          </Button>
        </div>
      )}
    </aside>
  );
}
