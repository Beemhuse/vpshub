import { useState } from "react";
import {
  Server,
  Search,
  Plus,
  MapPin,
  ArrowUpRight,
  RefreshCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Server as ServerType } from "@/App";
import { useServers } from "../hooks/useApi";
import { ConnectVpsModal } from "../components/ConnectVpsModal";

interface ServersProps {
  onServerClick: (server: ServerType) => void;
}

export function Servers({ onServerClick }: ServersProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const { data: servers, isLoading } = useServers();

  const filteredServers = (servers || []).filter((server: any) => {
    const matchesSearch =
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.ip.includes(searchQuery);
    return matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "online":
        return "bg-success";
      case "offline":
        return "bg-destructive";
      case "warning":
        return "bg-warning";
      default:
        return "bg-muted-foreground";
    }
  };

  const getStatusGlow = (status: string, connectionStatus?: string) => {
    if (connectionStatus === "CONNECTING")
      return "shadow-[0_0_8px_hsl(var(--violet))]";
    if (connectionStatus === "FAILED")
      return "shadow-[0_0_8px_hsl(var(--destructive))]";

    switch (status.toLowerCase()) {
      case "online":
        return "shadow-[0_0_8px_hsl(var(--success))]";
      case "offline":
        return "shadow-[0_0_8px_hsl(var(--destructive))]";
      case "warning":
        return "shadow-[0_0_8px_hsl(var(--warning))]";
      default:
        return "";
    }
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <RefreshCcw className="w-8 h-8 text-violet animate-spin" />
        <p className="text-muted-foreground">Loading servers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search servers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        <Button
          onClick={() => setIsConnectModalOpen(true)}
          className="h-10 px-4 bg-violet hover:bg-violet-600 text-white transition-all hover:shadow-glow"
        >
          <Plus className="w-4 h-4 mr-2" />
          Connect VPS
        </Button>
      </div>

      <ConnectVpsModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />

      {/* Servers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServers.map((server: any, index: number) => (
          <div
            key={server.id}
            onClick={() => onServerClick(server)}
            className={cn(
              "relative rounded-2xl border p-6 transition-all duration-300 cursor-pointer group",
              "bg-white/[0.03] border-white/10 hover:border-violet/50 hover:bg-white/[0.05] hover:shadow-2xl hover:shadow-violet/10",
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="relative">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full transition-shadow duration-500",
                      server.connectionStatus === "CONNECTING"
                        ? "bg-violet animate-pulse"
                        : server.connectionStatus === "FAILED"
                          ? "bg-destructive border-2 border-destructive/50"
                          : getStatusColor(server.status),
                      getStatusGlow(server.status, server.connectionStatus),
                    )}
                  />
                  <div>
                    <h3 className="text-xl font-bold text-foreground group-hover:text-violet transition-colors">
                      {server.name}
                    </h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {server.region}
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-muted-foreground group-hover:text-violet group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all opacity-0 group-hover:opacity-100" />
              </div>

              {/* IP & OS */}
              <div className="flex items-center gap-2 mt-6">
                <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-muted-foreground">
                  {server.ip}
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-muted-foreground">
                  {server.os}
                </span>
              </div>

              {/* Status Footer */}
              <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      server.status === "online"
                        ? "bg-success"
                        : "bg-muted-foreground",
                    )}
                  />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {server.connectionStatus === "CONNECTED"
                      ? server.status === "online"
                        ? "Active"
                        : "Offline"
                      : server.connectionStatus?.replace("_", " ") ||
                        server.status}
                  </span>
                </div>
                <span className="text-xs text-violet font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Manage Server &rarr;
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredServers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
          <Server className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            No servers found
          </h3>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search or filters
          </p>
        </div>
      )}
    </div>
  );
}
