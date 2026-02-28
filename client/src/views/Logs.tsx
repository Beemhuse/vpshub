import { useState } from "react";
import {
  ScrollText,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  RefreshCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLogs } from "../hooks/useApi";

const levelFilters = ["All", "Error", "Warning", "Info", "Success"];

interface LogsProps {
  serverId: string;
}

export function Logs({ serverId }: LogsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("All");

  const { data: logs, isLoading, refetch } = useLogs(serverId);

  const filteredLogs = (logs || []).filter((log: any) => {
    const matchesSearch =
      log.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel =
      selectedLevel === "All" ||
      log.action.includes(selectedLevel.toUpperCase()); // Mock matching level to action caps
    return matchesSearch && matchesLevel;
  });

  const getLevelIcon = (action: string) => {
    if (action.includes("ERROR") || action.includes("FAILED"))
      return <X className="w-4 h-4 text-destructive" />;
    if (action.includes("WARNING"))
      return <AlertCircle className="w-4 h-4 text-warning" />;
    if (
      action.includes("CREATE") ||
      action.includes("UPDATE") ||
      action.includes("START")
    )
      return <CheckCircle2 className="w-4 h-4 text-success" />;
    return <Info className="w-4 h-4 text-blue-400" />;
  };

  const getLevelColor = (action: string) => {
    if (action.includes("ERROR") || action.includes("FAILED"))
      return "text-destructive bg-destructive/10";
    if (action.includes("WARNING")) return "text-warning bg-warning/10";
    if (
      action.includes("CREATE") ||
      action.includes("UPDATE") ||
      action.includes("START")
    )
      return "text-success bg-success/10";
    return "text-blue-400 bg-blue-400/10";
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <RefreshCcw className="w-8 h-8 text-violet animate-spin" />
        <p className="text-muted-foreground">Loading audit logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Audit Logs</h2>
          <p className="text-muted-foreground mt-1">
            View activity logs across your entire infrastructure
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="h-10 bg-white/5 border-white/10 hover:bg-white/10 text-foreground"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 bg-white/5 border-white/10 hover:bg-white/10 text-foreground"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Action Type:</span>
          {levelFilters.map((level) => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                selectedLevel === level
                  ? "bg-violet/20 text-violet border border-violet/30"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-transparent",
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Time
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Action
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Description
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Target
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredLogs.map((log: any) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 text-sm text-muted-foreground font-mono whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium capitalize",
                        getLevelColor(log.action),
                      )}
                    >
                      {getLevelIcon(log.action)}
                      {log.action.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-foreground">
                    {log.description}
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">
                    {log.targetId || "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <ScrollText className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No logs found matching your filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
