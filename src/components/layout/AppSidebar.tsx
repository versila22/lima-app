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
  LayoutGrid,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import limaLogo from "@/assets/logo-lima.jpg";

interface AppSidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  isMobile?: boolean;
}

const menuItems = [
  { icon: Sparkles, label: "Organisateur Cabaret", path: "/cabaret" },
  { icon: Calendar, label: "Agenda", path: "/agenda" },
  { icon: User, label: "Mon Profil", path: "/mon-profil" },
  { icon: CalendarDays, label: "Mon Planning", path: "/mon-planning" },
  { icon: Users, label: "Membres", path: "/membres" },
  { icon: LayoutGrid, label: "Alignements", path: "/alignements", adminOnly: true },
  { icon: BarChart3, label: "Statistiques", path: "/stats", adminOnly: true },
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
        "top-0 h-screen border-r border-sidebar-border bg-sidebar transition-all duration-300 z-50 flex flex-col",
        isMobile
          ? cn(
              "fixed left-0 w-72 max-w-[85vw] transform shadow-2xl",
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            )
          : cn("fixed left-0", collapsed ? "w-16" : "w-64")
      )}
    >
      <div className="border-b border-sidebar-border p-4">
        <div className="mb-3 flex items-center justify-between gap-2 md:mb-0">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={limaLogo}
              alt="LIMA"
              className="w-10 h-10 rounded-lg object-contain bg-white shrink-0"
            />
            {(!collapsed || isMobile) && (
              <div className="overflow-hidden">
                <h1 className="truncate text-lg font-bold gradient-text">LIMA</h1>
                <p className="truncate text-xs text-muted-foreground">Gestion &amp; Spectacles</p>
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

      <div
        className={cn(
          "border-t border-sidebar-border p-2 flex gap-2",
          collapsed && !isMobile ? "flex-col items-center" : "justify-center"
        )}
      >
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <a
              href="https://www.lima.asso.fr"
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
              href="https://www.instagram.com/lima_impro_angers/"
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
              href="https://www.facebook.com/lima.impro"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Facebook className="w-5 h-5" />
            </a>
          </TooltipTrigger>
          <TooltipContent side="right">Facebook</TooltipContent>
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
