import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Home,
  Calendar,
  CalendarDays,
  Settings,
  Users,
  BarChart3,
  Globe,
  Instagram,
  Facebook,
  LogOut,
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
}

const menuItems = [
  { icon: Home, label: "Accueil", path: "/" },
  { icon: Sparkles, label: "Organisateur Cabaret", path: "/cabaret" },
  { icon: Calendar, label: "Agenda", path: "/agenda" },
  { icon: CalendarDays, label: "Mon Planning", path: "/mon-planning" },
  { icon: Users, label: "Membres", path: "/membres" },
  { icon: BarChart3, label: "Statistiques", path: "/stats", adminOnly: true },
  { icon: Settings, label: "Paramètres", path: "/settings", adminOnly: true },
];

export function AppSidebar({ collapsed, onCollapse }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const isAdmin = user?.app_role === "admin";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // Filter menu: hide admin-only items for non-admins
  const visibleItems = menuItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen border-r border-sidebar-border bg-sidebar transition-all duration-300 z-50 flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img
            src={limaLogo}
            alt="LIMA"
            className="w-10 h-10 rounded-lg object-contain bg-white shrink-0"
          />
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-lg gradient-text truncate">LIMA</h1>
              <p className="text-xs text-muted-foreground truncate">Gestion &amp; Spectacles</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          const content = (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive
                  ? "bg-primary/10 text-primary glow-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 shrink-0 transition-colors",
                  isActive && "text-primary"
                )}
              />
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          );

          if (collapsed) {
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

      {/* Logout button (when authenticated) */}
      {isAuthenticated && (
        <div className="p-2 border-t border-sidebar-border">
          {collapsed ? (
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
                {user?.first_name
                  ? `Déconnexion (${user.first_name})`
                  : "Déconnexion"}
              </span>
            </Button>
          )}
        </div>
      )}

      {/* Social Links */}
      <div
        className={cn(
          "p-2 border-t border-sidebar-border flex gap-2",
          collapsed ? "flex-col items-center" : "justify-center"
        )}
      >
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <a
              href="https://www.lima.asso.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
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
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
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
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
            >
              <Facebook className="w-5 h-5" />
            </a>
          </TooltipTrigger>
          <TooltipContent side="right">Facebook</TooltipContent>
        </Tooltip>
      </div>

      {/* Collapse button */}
      <div className="p-2 border-t border-sidebar-border">
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
    </aside>
  );
}
