import {
  LayoutDashboard,
  Server,
  Rocket,
  Layers,
  FolderGit2,
  ScrollText,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { View, Server as ServerType } from "@/App";

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedServer?: ServerType | null;
}

export function Sidebar({
  currentView,
  onNavigate,
  collapsed,
  onToggleCollapse,
  selectedServer,
}: SidebarProps) {
  const globalItems = [
    { id: "lobby" as View, label: "VPS Lobby", icon: Server },
    { id: "billing" as View, label: "Billing", icon: CreditCard },
    { id: "settings" as View, label: "Settings", icon: Settings },
  ];

  const serverItems = [
    { id: "dashboard" as View, label: "Overview", icon: LayoutDashboard },
    { id: "projects" as View, label: "Projects", icon: FolderGit2 },
    { id: "templates" as View, label: "Templates", icon: Layers },
    { id: "deployments" as View, label: "Deployments", icon: Rocket },
    { id: "logs" as View, label: "Logs", icon: ScrollText },
  ];

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen z-50 transition-all duration-300 border-r",
        "bg-dark-100/95 backdrop-blur-xl border-white/10",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Logo Section */}
      <div className="h-16 flex items-center px-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet flex items-center justify-center flex-shrink-0">
            <Boxes className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg text-foreground tracking-tight">
              VPSHub
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col h-[calc(100vh-64px)] justify-between">
        <div className="p-3 space-y-6">
          {/* Main Context */}
          <div className="space-y-1">
            <div
              className={cn(
                "px-3 mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider",
                collapsed && "sr-only",
              )}
            >
              Lobby
            </div>
            {globalItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all group relative",
                    isActive
                      ? "bg-violet/15 text-violet border border-violet/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent",
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && (
                    <span className="font-medium text-sm">{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Server Specific Context */}
          {selectedServer && (
            <div className="space-y-1 animate-in slide-in-from-left-2 duration-300">
              <div
                className={cn(
                  "px-3 mb-2 flex items-center justify-between",
                  collapsed && "sr-only",
                )}
              >
                <span className="text-[10px] font-bold text-violet uppercase tracking-wider">
                  Server: {selectedServer.name}
                </span>
              </div>
              {serverItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-1.5 rounded-xl transition-all group relative",
                      isActive
                        ? "bg-violet/15 text-violet border border-violet/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent",
                    )}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && (
                      <span className="font-medium text-sm">{item.label}</span>
                    )}
                    {isActive && !collapsed && (
                      <div className="absolute right-2 w-1 h-1 rounded-full bg-violet" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* User Profile Section */}
        <div className="p-3 border-t border-white/10">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet to-violet-700 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-white">JD</span>
            </div>
            {!collapsed && (
              <div className="flex-1 text-left overflow-hidden">
                <div className="text-sm font-medium text-foreground truncate">
                  John Doe
                </div>
                <div className="text-xs text-muted-foreground truncate italic">
                  Standard Tier
                </div>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-dark-200 border border-white/20 flex items-center justify-center hover:bg-violet hover:border-violet transition-colors group"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3 text-foreground group-hover:text-white" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-foreground group-hover:text-white" />
        )}
      </button>
    </aside>
  );
}
