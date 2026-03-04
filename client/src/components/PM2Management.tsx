import { usePm2 } from "../hooks/useApi";
import {
  Play,
  Square,
  RefreshCcw,
  Trash2,
  Zap,
  Loader2,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PM2ManagementProps {
  serverId: string;
}

export function PM2Management({ serverId }: PM2ManagementProps) {
  const { processes, isLoading, performAction, isPerformingAction } =
    usePm2(serverId);

  const handleAction = async (nameOrId: string | number, action: string) => {
    try {
      await performAction({ nameOrId, action });
      toast.success(`PM2 process ${action}ed successfully`);
    } catch (error: any) {
      toast.error(`Action failed: ${error.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-violet animate-spin" />
        <p className="text-muted-foreground">Retrieving PM2 processes...</p>
      </div>
    );
  }

  if (!processes || processes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
        <Zap className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-1">
          No PM2 processes found
        </h3>
        <p className="text-sm text-muted-foreground text-center px-6">
          There are no PM2 processes currently managed on this server.
          <br /> Processes will appear here after non-static deployments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {processes.map((process: any) => (
          <div
            key={process.pm_id}
            className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
          >
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  process.pm2_env.status === "online"
                    ? "bg-green-500/20 text-green-500"
                    : "bg-red-500/20 text-red-500",
                )}
              >
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground">
                    {process.name}
                  </h4>
                  <span
                    className={cn(
                      "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                      process.pm2_env.status === "online"
                        ? "bg-green-500/10 text-green-500"
                        : "bg-red-500/10 text-red-500",
                    )}
                  >
                    {process.pm2_env.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  ID: {process.pm_id} • CPU: {process.monit?.cpu || 0}% • Mem:{" "}
                  {Math.round((process.monit?.memory || 0) / 1024 / 1024)}MB
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {process.pm2_env.status === "online" ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleAction(process.name, "stop")}
                  disabled={isPerformingAction}
                  className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                >
                  <Square className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleAction(process.name, "start")}
                  disabled={isPerformingAction}
                  className="h-8 w-8 text-muted-foreground hover:text-green-500 hover:bg-green-500/10"
                >
                  <Play className="w-4 h-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleAction(process.name, "restart")}
                disabled={isPerformingAction}
                className="h-8 w-8 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10"
              >
                <RefreshCcw className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleAction(process.name, "delete")}
                disabled={isPerformingAction}
                className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-600/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
