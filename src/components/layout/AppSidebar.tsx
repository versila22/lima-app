import { ChevronLeft, ChevronRight, Sparkles, Home, Calendar, Settings, Users, Globe, Instagram, Facebook } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AppSidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

const menuItems = [
  { icon: Home, label: "Accueil", path: "/" },
  { icon: Sparkles, label: "Organisateur Cabaret", path: "/cabaret" },
  { icon: Calendar, label: "Agenda", path: "/agenda", disabled: true },
  { icon: Users, label: "Membres", path: "/membres", disabled: true },
  { icon: Settings, label: "Paramètres", path: "/settings", disabled: true },
];

export function AppSidebar({ collapsed, onCollapse }: AppSidebarProps) {
  const location = useLocation();

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
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-background" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-lg gradient-text truncate">ImproClub</h1>
              <p className="text-xs text-muted-foreground truncate">Gestion & Spectacles</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const content = (
            <Link
              key={item.path}
              to={item.disabled ? "#" : item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive
                  ? "bg-primary/10 text-primary glow-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                item.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
              )}
              onClick={(e) => item.disabled && e.preventDefault()}
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
              {!collapsed && item.disabled && (
                <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  Bientôt
                </span>
              )}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>{content}</TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border-border">
                  <p>{item.label}</p>
                  {item.disabled && <p className="text-xs text-muted-foreground">Bientôt disponible</p>}
                </TooltipContent>
              </Tooltip>
            );
          }

          return content;
        })}
      </nav>

      {/* Social Links */}
      <div className={cn(
        "p-2 border-t border-sidebar-border flex gap-2",
        collapsed ? "flex-col items-center" : "justify-center"
      )}>
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
