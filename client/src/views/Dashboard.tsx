import { useState } from "react";
import {
  Server,
  Rocket,
  Cpu,
  MemoryStick,
  Plus,
  Layers,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Clock,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Server as ServerType } from "@/App";
import { useDashboard, useActivities, useServers } from "../hooks/useApi";
import { useAuthStore } from "../store/authStore";
import { ConnectVpsModal } from "../components/ConnectVpsModal";

interface DashboardProps {
  onDeployClick: () => void;
  onServerClick: (server: ServerType) => void;
}

export function Dashboard({ onDeployClick, onServerClick }: DashboardProps) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const { user } = useAuthStore();

  const { data: statsData, isLoading: statsLoading } = useDashboard();
  const { data: activities, isLoading: activitiesLoading } = useActivities();
  const { data: servers, isLoading: serversLoading } = useServers();

  const stats = [
    {
      id: "servers",
      label: "Total Servers",
      value: statsData?.servers || "0",
      icon: Server,
      change: "+2",
      changeType: "positive" as const,
    },
    {
      id: "deployments",
      label: "Active Deployments",
      value: statsData?.deployments || "0",
      icon: Rocket,
      change: "+5",
      changeType: "positive" as const,
    },
    {
      id: "cpu",
      label: "Avg CPU Usage",
      value: "42%",
      icon: Cpu,
      change: "-3%",
      changeType: "positive" as const,
    },
    {
      id: "memory",
      label: "Avg Memory",
      value: "68%",
      icon: MemoryStick,
      change: "+8%",
      changeType: "warning" as const,
    },
  ];

  if (statsLoading || activitiesLoading || serversLoading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
        <RefreshCcw className="w-8 h-8 text-violet animate-spin" />
        <p className="text-muted-foreground animate-pulse">
          Fetching infrastructure data...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Welcome back, {user?.name?.split(" ")[0] || "User"}
          </h2>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your infrastructure
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setIsConnectModalOpen(true)}
            className="h-10 px-4 bg-white/5 border-white/10 hover:bg-white/10 hover:border-violet/30 text-foreground"
          >
            <Server className="w-4 h-4 mr-2" />
            Connect VPS
          </Button>
          <Button
            onClick={onDeployClick}
            className="h-10 px-4 bg-violet hover:bg-violet-600 text-white transition-all hover:shadow-glow"
          >
            <Plus className="w-4 h-4 mr-2" />
            Deploy App
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={stat.id}
            onMouseEnter={() => setHoveredCard(stat.id)}
            onMouseLeave={() => setHoveredCard(null)}
            className={cn(
              "relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer group",
              "bg-white/[0.03] border-white/10 hover:border-violet/30 hover:bg-white/[0.05]",
            )}
            style={{
              animationDelay: `${index * 100}ms`,
            }}
          >
            {hoveredCard === stat.id && (
              <div className="absolute inset-0 rounded-2xl bg-violet/5 blur-xl transition-opacity" />
            )}

            <div className="relative">
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                    hoveredCard === stat.id ? "bg-violet/30" : "bg-violet/20",
                  )}
                >
                  <stat.icon className="w-5 h-5 text-violet" />
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    stat.changeType === "positive"
                      ? "text-success"
                      : "text-warning",
                  )}
                >
                  {stat.changeType === "positive" ? "+" : ""}
                  {stat.change}
                  <ArrowUpRight className="w-3 h-3" />
                </div>
              </div>

              <div className="mt-4">
                <div className="text-2xl font-bold text-foreground">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {stat.label}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Activity Timeline */}
        <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-violet" />
              <h3 className="font-semibold text-foreground">Recent Activity</h3>
            </div>
            <button className="text-sm text-violet hover:text-violet-400 transition-colors">
              View all
            </button>
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {activities?.map((activity: any, index: number) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    "bg-violet/10",
                  )}
                >
                  <CheckCircle2 className="w-5 h-5 text-violet" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground group-hover:text-violet transition-colors">
                      {activity.description}
                    </h4>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(activity.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Action:{" "}
                    <span className="text-foreground capitalize">
                      {activity.action?.toLowerCase()}
                    </span>
                  </p>
                </div>
              </div>
            ))}
            {(!activities || activities.length === 0) && (
              <div className="text-center py-10 text-muted-foreground">
                No recent activities found
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 mb-5">
            <Layers className="w-5 h-5 text-violet" />
            <h3 className="font-semibold text-foreground">Quick Actions</h3>
          </div>

          <div className="space-y-3">
            <button
              onClick={onDeployClick}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-violet/20 border border-white/10 hover:border-violet/30 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-violet/20 flex items-center justify-center group-hover:bg-violet/30 transition-colors">
                <Rocket className="w-5 h-5 text-violet" />
              </div>
              <div>
                <div className="font-medium text-foreground">Deploy App</div>
                <div className="text-xs text-muted-foreground">
                  From 20+ templates
                </div>
              </div>
            </button>

            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <Server className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <div className="font-medium text-foreground">
                  Connect Server
                </div>
                <div className="text-xs text-muted-foreground">
                  Add a new VPS
                </div>
              </div>
            </button>

            <button className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group text-left">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <div className="font-medium text-foreground">
                  Browse Templates
                </div>
                <div className="text-xs text-muted-foreground">
                  Explore marketplace
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Server Status List */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-violet" />
            <h3 className="font-semibold text-foreground">Server Status</h3>
          </div>
          <button
            onClick={() => {}}
            className="text-sm text-violet hover:text-violet-400 transition-colors"
          >
            View all servers
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {servers?.map((server: any) => (
            <div
              key={server.id}
              onClick={() => onServerClick(server)}
              className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet/30 transition-all cursor-pointer group"
            >
              <div
                className={cn(
                  "w-3 h-3 rounded-full flex-shrink-0",
                  server.status === "online" &&
                    "bg-success shadow-[0_0_8px_hsl(var(--success))]",
                  server.status === "offline" &&
                    "bg-destructive shadow-[0_0_8px_hsl(var(--destructive))]",
                  server.status === "warning" &&
                    "bg-warning shadow-[0_0_8px_hsl(var(--warning))]",
                )}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground truncate">
                    {server.name}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-muted-foreground">
                    {server.os}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {server.ip}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="text-right">
                  <div className="text-muted-foreground">Mem</div>
                  <div className={cn("font-medium")}>{server.memory}GB</div>
                </div>
                <div className="w-16">
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500 bg-violet",
                      )}
                      style={{ width: `${(server.memory / 32) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
          {(!servers || servers.length === 0) && (
            <div className="col-span-2 text-center py-10 text-muted-foreground border border-dashed border-white/10 rounded-xl">
              No servers connected yet. Start by deploying an app or connecting
              a VPS.
            </div>
          )}
        </div>
      </div>

      <ConnectVpsModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />
    </div>
  );
}
