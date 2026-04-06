import { Calendar, CalendarDays, Home, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

const items = [
  { icon: Home, label: "Accueil", path: "/cabaret" },
  { icon: Calendar, label: "Agenda", path: "/agenda" },
  { icon: CalendarDays, label: "Planning", path: "/mon-planning" },
  { icon: User, label: "Profil", path: "/mon-profil" },
];

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-2 py-2 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
