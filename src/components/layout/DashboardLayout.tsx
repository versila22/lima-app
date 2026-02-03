import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { cn } from "@/lib/utils";

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar collapsed={collapsed} onCollapse={setCollapsed} />
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          collapsed ? "ml-16" : "ml-64"
        )}
      >
        <div className="p-6 h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
