import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";

import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  "/cabaret": "Organisateur Cabaret",
  "/agenda": "Agenda",
  "/mon-profil": "Mon Profil",
  "/mon-planning": "Mon Planning",
  "/membres": "Membres",
  "/alignements": "Alignements",
  "/stats": "Statistiques",
  "/settings": "Paramètres",
};

export function DashboardLayout() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageTitle = PAGE_TITLES[location.pathname] ?? "LIMA";

  useEffect(() => {
    if (!isMobile) {
      setMobileOpen(false);
    }
  }, [isMobile]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        {isMobile && mobileOpen && (
          <button
            type="button"
            aria-label="Fermer le menu"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <AppSidebar
          collapsed={collapsed}
          onCollapse={setCollapsed}
          mobileOpen={mobileOpen}
          onMobileOpenChange={setMobileOpen}
          isMobile={isMobile}
        />

        <main
          className={cn(
            "flex-1 transition-all duration-300",
            !isMobile && (collapsed ? "md:ml-16" : "md:ml-64")
          )}
        >
          <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-sm font-semibold">{pageTitle}</p>
              <p className="text-xs text-muted-foreground">LIMA</p>
            </div>
          </div>

          <div className="h-full px-4 py-4 md:p-6" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
            <Outlet />
          </div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
