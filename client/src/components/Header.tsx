import {
  Search,
  Bell,
  Plus,
  Server as ServerIcon,
  Command,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import type { View, Server } from "@/App";

interface HeaderProps {
  onDeployClick: () => void;
  currentView: View;
  selectedServer: Server | null;
  collapsed: boolean;
}

const notifications = [
  {
    id: "1",
    title: "Deployment successful",
    message: "Next.js app deployed to production-api-01",
    time: "2 min ago",
    type: "success" as const,
  },
  {
    id: "2",
    title: "High CPU usage",
    message: "staging-web-02 CPU at 85%",
    time: "15 min ago",
    type: "warning" as const,
  },
  {
    id: "3",
    title: "Server connected",
    message: "New server dev-worker-03 connected",
    time: "1 hour ago",
    type: "info" as const,
  },
];

export function Header({
  onDeployClick,
  currentView,
  selectedServer,
  collapsed,
}: HeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const { logout } = useAuthStore();
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get('/auth/github/repos');
        if (!mounted) return;
        setGithubConnected(Array.isArray(res.data) && res.data.length > 0);
      } catch (e) {
        if (!mounted) return;
        setGithubConnected(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const getViewTitle = () => {
    if (currentView === "lobby" || !selectedServer) return "VPS Lobby";

    switch (currentView) {
      case "dashboard":
        return "Overview";
      case "templates":
        return "Marketplace";
      case "deployments":
        return "Deployments";
      case "projects":
        return "Projects";
      case "logs":
        return "Logs";
      case "billing":
        return "Billing";
      case "settings":
        return "Settings";
      default:
        return "Overview";
    }
  };

  return (
    <header
      className={cn(
        "fixed top-0 right-0 left-0 h-16 z-40 bg-dark/80 backdrop-blur-xl border-b border-white/10 transition-all duration-300",
        collapsed ? "ml-16" : "ml-64",
      )}
    >
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold text-foreground">
              {getViewTitle()}
            </h1>
            {selectedServer && currentView !== "lobby" && (
              <span className="text-[10px] text-violet font-bold uppercase tracking-widest flex items-center gap-1">
                <ServerIcon className="w-2 h-2" />
                {selectedServer.name}
              </span>
            )}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div
            className={cn(
              "relative transition-all duration-200",
              searchFocused ? "w-80" : "w-64",
            )}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search servers, deployments..."
              className={cn(
                "pl-10 pr-10 h-9 bg-white/5 border-white/10 text-sm",
                "placeholder:text-muted-foreground/60",
                "focus:bg-white/10 focus:border-violet/50 focus:ring-1 focus:ring-violet/30",
                "transition-all duration-200",
              )}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Command className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">K</span>
            </div>
          </div>

          {/* Deploy Button */}
          <Button
            onClick={onDeployClick}
            className="h-9 px-4 bg-violet hover:bg-violet-600 text-white font-medium text-sm rounded-lg transition-all duration-200 hover:shadow-glow"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Deploy
          </Button>

          {/* GitHub Connect */}
          <Button
            onClick={async () => {
              if (githubConnected) {
                try {
                  await api.post('/auth/github/disconnect');
                  setGithubConnected(false);
                  toast.success('Disconnected from GitHub');
                } catch (e) {
                  toast.error('Failed to disconnect');
                }
                return;
              }

              try {
                const urlRes = await api.get('/auth/github/url');
                const url = urlRes.data.url;
                const popup = window.open(url, 'github_connect', 'width=800,height=600');
                if (!popup) { toast.error('Popup blocked'); return; }
                const onMessage = (ev: MessageEvent) => {
                  if (ev.data?.type === 'github_connected') {
                    setGithubConnected(true);
                    toast.success('Connected to GitHub');
                    try { popup.close(); } catch (e) {}
                    window.removeEventListener('message', onMessage);
                  }
                };
                window.addEventListener('message', onMessage);
              } catch (e) {
                toast.error('Failed to start GitHub OAuth');
              }
            }}
            className="h-9 px-3 bg-white/5 hover:bg-white/10 text-sm rounded-lg"
          >
            {githubConnected ? 'GitHub ✓' : 'Connect GitHub'}
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-violet text-[10px] font-medium text-white flex items-center justify-center">
                  {notifications.length}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-80 bg-dark-100 border-white/10"
            >
              <div className="px-4 py-3 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    Notifications
                  </span>
                  <button className="text-xs text-violet hover:text-violet-400">
                    Mark all read
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="px-4 py-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                          notification.type === "success" && "bg-success",
                          notification.type === "warning" && "bg-warning",
                          notification.type === "info" && "bg-info",
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">
                          {notification.title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {notification.message}
                        </div>
                        <div className="text-xs text-muted-foreground/60 mt-1">
                          {notification.time}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-white/10">
                <button className="w-full text-center text-sm text-violet hover:text-violet-400 py-1">
                  View all notifications
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-9 h-9 rounded-full bg-gradient-to-br from-violet to-violet-700 flex items-center justify-center hover:ring-2 hover:ring-violet/50 transition-all">
                <span className="text-sm font-semibold text-white">JD</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-dark-100 border-white/10"
            >
              <div className="px-4 py-3 border-b border-white/10">
                <div className="font-medium text-foreground">John Doe</div>
                <div className="text-sm text-muted-foreground">
                  john@example.com
                </div>
              </div>
              <DropdownMenuItem className="cursor-pointer hover:bg-white/5 focus:bg-white/5">
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer hover:bg-white/5 focus:bg-white/5">
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer hover:bg-white/5 focus:bg-white/5">
                Billing
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                className="cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
                onClick={async () => {
                  try {
                    logout();
                    window.location.reload();
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
